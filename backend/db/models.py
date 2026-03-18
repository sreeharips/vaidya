"""
Vaidya database models — SQLAlchemy 2.0 async (asyncpg).

Entity ownership rules (enforced here):
  - Treatment  is owned by Clinic (clinic_id NOT NULL). Doctors are linked via
    DoctorTreatment junction — a doctor leaving a clinic does not delete treatments.
  - Product    is owned by Clinic (clinic_id NOT NULL). Clinics sell herbal products;
    doctors do not have independent product catalogues.
  - Shipping   is clinic-direct — the clinic fulfils and dispatches product orders.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Patient Profiles
# ---------------------------------------------------------------------------
class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pseudo_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    prakriti_raw: Mapped[dict | None] = mapped_column(JSONB)
    prakriti_scores: Mapped[dict | None] = mapped_column(JSONB)
    dosha_type: Mapped[str | None] = mapped_column(String(32))
    language: Mapped[str] = mapped_column(String(5), default="en")
    assessment_status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    bookings: Mapped[list["Booking"]] = relationship(back_populates="patient", foreign_keys="Booking.patient_pseudo_id")
    product_orders: Mapped[list["ProductOrder"]] = relationship(back_populates="patient", foreign_keys="ProductOrder.patient_pseudo_id")


# ---------------------------------------------------------------------------
# Doctors
#
# A doctor belongs to a Clinic (clinic_id nullable — some vaidyas are itinerant).
# Treatments offered by a doctor are recorded in DoctorTreatment junction, NOT
# via a direct FK on treatments. This means treatments survive doctor reassignment.
# ---------------------------------------------------------------------------
class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    qualification: Mapped[str] = mapped_column(String(255), nullable=False)
    years_exp: Mapped[int] = mapped_column(Integer, default=0)
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), index=True
    )
    specialisations = mapped_column(ARRAY(String), default=list)
    prakriti_affinities = mapped_column(ARRAY(String), default=list)
    languages = mapped_column(ARRAY(String), default=list)
    bio: Mapped[str | None] = mapped_column(Text)
    bio_ml: Mapped[str | None] = mapped_column(Text)
    bio_ar: Mapped[str | None] = mapped_column(Text)
    name_ml: Mapped[str | None] = mapped_column(String(255))
    name_ar: Mapped[str | None] = mapped_column(String(255))
    gender: Mapped[str | None] = mapped_column(String(10))
    consultation_fee_usd: Mapped[float | None] = mapped_column(Numeric(10, 2))
    doctor_certifications: Mapped[dict | None] = mapped_column(JSONB)
    photo_url: Mapped[str | None] = mapped_column(String(512))
    tier: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    patients_treated: Mapped[int] = mapped_column(Integer, default=0)
    available_dates = mapped_column(ARRAY(Date), default=list)
    location_address: Mapped[str | None] = mapped_column(String(512))
    rating: Mapped[float | None] = mapped_column(Float)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    pricing_per_day: Mapped[float | None] = mapped_column(Numeric(10, 2))
    search_vector = mapped_column(TSVECTOR)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    clinic: Mapped["ClinicFeatureStore | None"] = relationship(back_populates="doctors")
    # Treatments this doctor delivers — via junction (many-to-many)
    doctor_treatments: Mapped[list["DoctorTreatment"]] = relationship(back_populates="doctor")
    treatment_kb_entries: Mapped[list["TreatmentKB"]] = relationship(back_populates="doctor")
    reviews: Mapped[list["Review"]] = relationship(back_populates="doctor")

    __table_args__ = (
        CheckConstraint("tier IN (1, 2)", name="ck_doctors_tier"),
        Index("ix_doctors_search_vector", "search_vector", postgresql_using="gin"),
    )


# ---------------------------------------------------------------------------
# Clinic Feature Store
#
# The Clinic is the top-level supply-side entity. It owns:
#   - Doctors      (doctor.clinic_id FK)
#   - Treatments   (treatment.clinic_id FK — NOT NULL)
#   - Products     (product.clinic_id FK — NOT NULL)
#   - ProductOrders (fulfilled and shipped by the clinic directly)
# ---------------------------------------------------------------------------
class ClinicFeatureStore(Base):
    __tablename__ = "clinic_feature_store"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tier: Mapped[int] = mapped_column(Integer, default=1)
    district: Mapped[str | None] = mapped_column(String(255))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    specialisations = mapped_column(ARRAY(String), default=list)
    prakriti_affinities = mapped_column(ARRAY(String), default=list)
    languages = mapped_column(ARRAY(String), default=list)
    pricing_min: Mapped[float | None] = mapped_column(Numeric(10, 2))
    pricing_max: Mapped[float | None] = mapped_column(Numeric(10, 2))
    photos = mapped_column(ARRAY(String), default=list)
    certifications = mapped_column(ARRAY(String), default=list)
    outcome_enrolled: Mapped[bool] = mapped_column(Boolean, default=False)
    accommodation_available: Mapped[bool] = mapped_column(Boolean, default=False)
    transport_info: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(String(512))
    rating: Mapped[float | None] = mapped_column(Float)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    search_vector = mapped_column(TSVECTOR)
    # Admin portal fields
    admin_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    description_en: Mapped[str | None] = mapped_column(Text)
    description_ml: Mapped[str | None] = mapped_column(Text)
    description_ar: Mapped[str | None] = mapped_column(Text)
    address_line1: Mapped[str | None] = mapped_column(String(255))
    address_line2: Mapped[str | None] = mapped_column(String(255))
    state: Mapped[str | None] = mapped_column(String(100))
    pincode: Mapped[str | None] = mapped_column(String(10))
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(320))
    website_url: Mapped[str | None] = mapped_column(String(512))
    operating_hours: Mapped[dict | None] = mapped_column(JSONB)
    social_links: Mapped[dict | None] = mapped_column(JSONB)
    pickup_available: Mapped[bool] = mapped_column(Boolean, default=False)
    pickup_locations = mapped_column(ARRAY(String), default=list)
    ecommerce_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    shipping_policy: Mapped[str | None] = mapped_column(Text)
    return_policy: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    doctors: Mapped[list["Doctor"]] = relationship(back_populates="clinic")
    treatments: Mapped[list["Treatment"]] = relationship(back_populates="clinic")
    products: Mapped[list["Product"]] = relationship(back_populates="clinic")
    product_orders: Mapped[list["ProductOrder"]] = relationship(back_populates="clinic")
    reviews: Mapped[list["Review"]] = relationship(back_populates="clinic")
    blocked_dates: Mapped[list["ClinicBlockedDate"]] = relationship(back_populates="clinic")
    availability_slots: Mapped[list["ClinicAvailabilitySlot"]] = relationship(back_populates="clinic")
    images: Mapped[list["ClinicImage"]] = relationship(back_populates="clinic")
    clinic_products: Mapped[list["ClinicProduct"]] = relationship(back_populates="clinic")
    booking_slots: Mapped[list["BookingSlot"]] = relationship(back_populates="clinic")

    __table_args__ = (
        CheckConstraint("tier IN (1, 2)", name="ck_clinic_tier"),
        Index("ix_clinic_search_vector", "search_vector", postgresql_using="gin"),
    )


# ---------------------------------------------------------------------------
# Clinic Blocked Dates
#
# Clinics block date ranges for monsoon closures, festivals, full occupancy.
# The booking engine rejects patient requests that overlap blocked dates.
# ---------------------------------------------------------------------------
class ClinicBlockedDate(Base):
    __tablename__ = "clinic_blocked_dates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), nullable=False, index=True
    )
    blocked_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    clinic: Mapped["ClinicFeatureStore"] = relationship(back_populates="blocked_dates")

    __table_args__ = (
        UniqueConstraint("clinic_id", "blocked_date", name="uq_clinic_blocked_date"),
        Index("ix_clinic_blocked_dates_clinic_date", "clinic_id", "blocked_date"),
    )


# ---------------------------------------------------------------------------
# Clinic Availability Slots
#
# Per-day slot configuration: total slots, which treatments are offered,
# and whether the day is closed. Booked count is computed from bookings.
# Shared between the clinic portal (admin) and patient-facing pages.
# ---------------------------------------------------------------------------
class ClinicAvailabilitySlot(Base):
    __tablename__ = "clinic_availability_slots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), nullable=False, index=True
    )
    slot_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_slots: Mapped[int] = mapped_column(Integer, default=5)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False)
    close_reason: Mapped[str | None] = mapped_column(String(255))
    # UUIDs of Treatment rows available on this day (empty = all clinic treatments)
    treatment_ids = mapped_column(ARRAY(String), default=list)
    notes: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    clinic: Mapped["ClinicFeatureStore"] = relationship(back_populates="availability_slots")

    __table_args__ = (
        UniqueConstraint("clinic_id", "slot_date", name="uq_clinic_slot_date"),
        Index("ix_clinic_availability_clinic_date", "clinic_id", "slot_date"),
    )


# ---------------------------------------------------------------------------
# Treatments
#
# Owned by Clinic (clinic_id NOT NULL). Which doctors deliver a treatment is
# recorded in DoctorTreatment. This means:
#   - A doctor leaving doesn't orphan treatments.
#   - Multiple doctors at the same clinic can deliver the same treatment.
# ---------------------------------------------------------------------------
class Treatment(Base):
    __tablename__ = "treatments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    prakriti_tags = mapped_column(ARRAY(String), default=list)
    duration_min_days: Mapped[int | None] = mapped_column(Integer)
    duration_max_days: Mapped[int | None] = mapped_column(Integer)
    price_per_day: Mapped[float | None] = mapped_column(Numeric(10, 2))
    included_therapies = mapped_column(ARRAY(String), default=list)
    # Clinic is the owner — NOT NULL
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    clinic: Mapped["ClinicFeatureStore"] = relationship(back_populates="treatments")
    # Doctors who deliver this treatment (many-to-many via junction)
    doctor_treatments: Mapped[list["DoctorTreatment"]] = relationship(back_populates="treatment")


# ---------------------------------------------------------------------------
# DoctorTreatment  (junction: Doctor ↔ Treatment)
#
# Records which doctors at a clinic deliver which treatments.
# is_primary flags the lead doctor for a treatment programme (used on clinic page).
# ---------------------------------------------------------------------------
class DoctorTreatment(Base):
    __tablename__ = "doctor_treatments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False, index=True
    )
    treatment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("treatments.id"), nullable=False, index=True
    )
    # True = this doctor leads / is the primary practitioner for this treatment
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    doctor: Mapped["Doctor"] = relationship(back_populates="doctor_treatments")
    treatment: Mapped["Treatment"] = relationship(back_populates="doctor_treatments")

    __table_args__ = (
        UniqueConstraint("doctor_id", "treatment_id", name="uq_doctor_treatment"),
    )


# ---------------------------------------------------------------------------
# Products  (herbal products sold by the clinic — Phase 2 e-commerce)
#
# Owned by Clinic (clinic_id NOT NULL). Doctors do not own products.
# A product can have multiple variants (e.g. 100g / 250g / 500g).
# ---------------------------------------------------------------------------
class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), nullable=False, index=True
    )
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    # e.g. "oils", "churnas", "lehyas", "capsules", "external", "decoctions"
    category: Mapped[str | None] = mapped_column(String(100))
    prakriti_tags = mapped_column(ARRAY(String), default=list)   # for personalised recommendation
    # Base price (INR). Variants override this with their own price.
    base_price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    photos = mapped_column(ARRAY(String), default=list)
    is_gmp_certified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    clinic: Mapped["ClinicFeatureStore"] = relationship(back_populates="products")
    variants: Mapped[list["ProductVariant"]] = relationship(back_populates="product", cascade="all, delete-orphan")
    order_items: Mapped[list["OrderItem"]] = relationship(back_populates="product")


# ---------------------------------------------------------------------------
# ProductVariant  (size / form variants of a product)
#
# Examples: "100g", "250g", "500g" for an oil; "30 caps", "60 caps" for a tablet.
# Each variant has its own SKU, price, and stock.
# If a product has no variants, a single default variant should be created.
# ---------------------------------------------------------------------------
class ProductVariant(Base):
    __tablename__ = "product_variants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True
    )
    # Human-readable label shown in the UI, e.g. "100g", "250ml", "30 capsules"
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(100), unique=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    stock_qty: Mapped[int] = mapped_column(Integer, default=0)
    weight_grams: Mapped[int | None] = mapped_column(Integer)   # for shipping cost calc
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    product: Mapped["Product"] = relationship(back_populates="variants")
    order_items: Mapped[list["OrderItem"]] = relationship(back_populates="variant")

    __table_args__ = (
        UniqueConstraint("product_id", "label", name="uq_product_variant_label"),
    )


# ---------------------------------------------------------------------------
# ProductOrder  (a patient's medicine order — fulfilled by the clinic directly)
#
# booking_id is nullable: patients can reorder medicine after their retreat
# without creating a new booking.
# ---------------------------------------------------------------------------
class ProductOrder(Base):
    __tablename__ = "product_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_pseudo_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("patient_profiles.pseudo_id"), nullable=False, index=True
    )
    # Clinic that will fulfil and ship this order
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), nullable=False, index=True
    )
    # Optional link to the retreat booking that prompted this medicine order
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id"), index=True
    )
    # pending → paid → dispatched → delivered | cancelled | refunded
    status: Mapped[str] = mapped_column(String(30), default="pending")
    total_amount: Mapped[float | None] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    payment_ref: Mapped[str | None] = mapped_column(String(255))
    stripe_session_id: Mapped[str | None] = mapped_column(String(255))
    razorpay_order_id: Mapped[str | None] = mapped_column(String(255))
    # Shipping address snapshot at time of order (JSONB — format may vary by country)
    shipping_address: Mapped[dict | None] = mapped_column(JSONB)
    tracking_number: Mapped[str | None] = mapped_column(String(255))
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    patient: Mapped["PatientProfile"] = relationship(back_populates="product_orders")
    clinic: Mapped["ClinicFeatureStore"] = relationship(back_populates="product_orders")
    booking: Mapped["Booking | None"] = relationship()
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','paid','dispatched','delivered','cancelled','refunded')",
            name="ck_product_order_status",
        ),
    )


# ---------------------------------------------------------------------------
# OrderItem  (line items within a ProductOrder)
#
# product_id is denormalised here for fast querying without joining through variant.
# unit_price and subtotal are snapshots — they must not change if the variant
# price is updated later.
# ---------------------------------------------------------------------------
class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_orders.id"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True
    )
    # Specific variant selected (nullable: null = base product, no variant chosen)
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_variants.id"), index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    # Price snapshot at time of order — never update these
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    order: Mapped["ProductOrder"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship(back_populates="order_items")
    variant: Mapped["ProductVariant | None"] = relationship(back_populates="order_items")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_order_item_quantity_positive"),
    )


# ---------------------------------------------------------------------------
# Users
#
# Login is optional. Guests use a session_id (GuestSession).
# When a guest logs in, their session data is claimed to their user_id.
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(30))
    preferred_language: Mapped[str] = mapped_column(String(5), default="en")
    role: Mapped[str] = mapped_column(String(20), default="patient")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verification_token: Mapped[str | None] = mapped_column(String(255))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sso_provider: Mapped[str | None] = mapped_column(String(20))
    sso_id: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    clinic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), nullable=True, index=True
    )

    guest_sessions: Mapped[list["GuestSession"]] = relationship(back_populates="claimed_by_user")
    preferences: Mapped["UserPreferences | None"] = relationship(back_populates="user", uselist=False)
    watchlist_items: Mapped[list["UserWatchlist"]] = relationship(back_populates="user")
    booking_history: Mapped[list["BookingHistory"]] = relationship(back_populates="user")
    consultations: Mapped[list["ConsultationHistory"]] = relationship(back_populates="user")
    prescriptions: Mapped[list["Prescription"]] = relationship(back_populates="user")
    product_purchases: Mapped[list["ProductPurchaseHistory"]] = relationship(back_populates="user")

    __table_args__ = (
        CheckConstraint(
            "role IN ('patient','doctor','clinic_admin','platform_admin')",
            name="ck_users_role",
        ),
    )


# ---------------------------------------------------------------------------
# Guest Sessions
#
# The session_id (= primary key) is stored in a browser cookie.
# When a guest logs in, claimed_by_user_id is set.
# ---------------------------------------------------------------------------
class GuestSession(Base):
    __tablename__ = "guest_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    claimed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    preferred_language: Mapped[str] = mapped_column(String(5), default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now() + interval '90 days'")
    )

    claimed_by_user: Mapped["User | None"] = relationship(back_populates="guest_sessions")
    preferences: Mapped["UserPreferences | None"] = relationship(back_populates="session", uselist=False)
    watchlist_items: Mapped[list["UserWatchlist"]] = relationship(back_populates="session")
    booking_history_items: Mapped[list["BookingHistory"]] = relationship(back_populates="session")
    consultations: Mapped[list["ConsultationHistory"]] = relationship(back_populates="session")
    prescriptions: Mapped[list["Prescription"]] = relationship(back_populates="session")
    product_purchases: Mapped[list["ProductPurchaseHistory"]] = relationship(back_populates="session")

    __table_args__ = (
        Index("ix_guest_sessions_claimed_user", "claimed_by_user_id", postgresql_where=text("claimed_by_user_id IS NOT NULL")),
    )


# ---------------------------------------------------------------------------
# User Preferences (one row per user OR per guest session)
# ---------------------------------------------------------------------------
class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guest_sessions.id")
    )
    prakriti_vata_pct: Mapped[int | None] = mapped_column(Integer)
    prakriti_pitta_pct: Mapped[int | None] = mapped_column(Integer)
    prakriti_kapha_pct: Mapped[int | None] = mapped_column(Integer)
    prakriti_primary_type: Mapped[str | None] = mapped_column(String(32))
    prakriti_secondary_type: Mapped[str | None] = mapped_column(String(32))
    prakriti_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    prakriti_assessment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outcomes_log.id")
    )
    preferred_treatment_types = mapped_column(ARRAY(String), default=list)
    preferred_doctor_languages = mapped_column(ARRAY(String), default=list)
    preferred_budget_max: Mapped[int | None] = mapped_column(Integer)
    preferred_districts = mapped_column(ARRAY(String), default=list)
    content_personalisation_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    user: Mapped["User | None"] = relationship(back_populates="preferences")
    session: Mapped["GuestSession | None"] = relationship(back_populates="preferences")

    __table_args__ = (
        CheckConstraint(
            "user_id IS NOT NULL OR session_id IS NOT NULL",
            name="ck_user_prefs_owner",
        ),
        Index("ix_user_preferences_user_id", "user_id", unique=True, postgresql_where=text("user_id IS NOT NULL")),
        Index("ix_user_preferences_session_id", "session_id", unique=True, postgresql_where=text("session_id IS NOT NULL")),
    )


# ---------------------------------------------------------------------------
# User Watchlist (clinics and doctors saved by user or guest)
# ---------------------------------------------------------------------------
class UserWatchlist(Base):
    __tablename__ = "user_watchlist"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guest_sessions.id")
    )
    entity_type: Mapped[str] = mapped_column(String(10), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    user: Mapped["User | None"] = relationship(back_populates="watchlist_items")
    session: Mapped["GuestSession | None"] = relationship(back_populates="watchlist_items")

    __table_args__ = (
        CheckConstraint(
            "user_id IS NOT NULL OR session_id IS NOT NULL",
            name="ck_watchlist_owner",
        ),
        CheckConstraint("entity_type IN ('clinic','doctor')", name="ck_watchlist_entity_type"),
        Index("ix_user_watchlist_user", "user_id", "entity_type", postgresql_where=text("user_id IS NOT NULL")),
        Index("ix_user_watchlist_session", "session_id", "entity_type", postgresql_where=text("session_id IS NOT NULL")),
        UniqueConstraint("user_id", "entity_type", "entity_id", name="uq_watchlist_user"),
        UniqueConstraint("session_id", "entity_type", "entity_id", name="uq_watchlist_session"),
    )


# ---------------------------------------------------------------------------
# Booking History (user-facing view — user_id nullable for guest bookings)
# ---------------------------------------------------------------------------
class BookingHistory(Base):
    __tablename__ = "booking_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guest_sessions.id")
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False, index=True
    )
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), nullable=False
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False
    )
    treatment_name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_paid: Mapped[float | None] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    user: Mapped["User | None"] = relationship(back_populates="booking_history")
    session: Mapped["GuestSession | None"] = relationship(back_populates="booking_history_items")

    __table_args__ = (
        Index("ix_booking_history_user", "user_id", postgresql_where=text("user_id IS NOT NULL")),
        Index("ix_booking_history_session", "session_id", postgresql_where=text("session_id IS NOT NULL")),
    )


# ---------------------------------------------------------------------------
# Consultation History
# ---------------------------------------------------------------------------
class ConsultationHistory(Base):
    __tablename__ = "consultation_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guest_sessions.id")
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False
    )
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), nullable=False
    )
    consultation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    chief_complaint_en: Mapped[str | None] = mapped_column(Text)
    chief_complaint_original: Mapped[str | None] = mapped_column(Text)
    prakriti_at_consultation: Mapped[str | None] = mapped_column(String(32))
    notes_en: Mapped[str | None] = mapped_column(Text)
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    user: Mapped["User | None"] = relationship(back_populates="consultations")
    session: Mapped["GuestSession | None"] = relationship(back_populates="consultations")

    __table_args__ = (
        Index("ix_consultation_history_user", "user_id", postgresql_where=text("user_id IS NOT NULL")),
    )


# ---------------------------------------------------------------------------
# Prescriptions
# ---------------------------------------------------------------------------
class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guest_sessions.id")
    )
    consultation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("consultation_history.id"), nullable=False, index=True
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False
    )
    prescription_date: Mapped[date] = mapped_column(Date, nullable=False)
    structured_data: Mapped[dict | None] = mapped_column(JSONB)
    medicines: Mapped[dict | None] = mapped_column(JSONB)
    treatments_prescribed: Mapped[dict | None] = mapped_column(JSONB)
    diet_instructions_en: Mapped[str | None] = mapped_column(Text)
    follow_up_date: Mapped[date | None] = mapped_column(Date)
    raw_transcript_original: Mapped[str | None] = mapped_column(Text)
    raw_transcript_en: Mapped[str | None] = mapped_column(Text)
    pdf_url: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    user: Mapped["User | None"] = relationship(back_populates="prescriptions")
    session: Mapped["GuestSession | None"] = relationship(back_populates="prescriptions")

    __table_args__ = (
        Index("ix_prescriptions_user", "user_id", postgresql_where=text("user_id IS NOT NULL")),
    )


# ---------------------------------------------------------------------------
# Product Purchase History
# ---------------------------------------------------------------------------
class ProductPurchaseHistory(Base):
    __tablename__ = "product_purchase_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guest_sessions.id")
    )
    prescription_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prescriptions.id")
    )
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_slug: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    total_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    payment_ref: Mapped[str] = mapped_column(String(255), nullable=False)
    stripe_session_id: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    shipping_address: Mapped[dict | None] = mapped_column(JSONB)
    ordered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    user: Mapped["User | None"] = relationship(back_populates="product_purchases")
    session: Mapped["GuestSession | None"] = relationship(back_populates="product_purchases")

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','paid','shipped','delivered','cancelled')",
            name="ck_product_purchase_status",
        ),
        CheckConstraint("quantity > 0", name="ck_product_purchase_quantity_positive"),
        Index("ix_product_purchase_user", "user_id", postgresql_where=text("user_id IS NOT NULL")),
    )


# ---------------------------------------------------------------------------
# Conditions Map
# ---------------------------------------------------------------------------
class ConditionMap(Base):
    __tablename__ = "conditions_map"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    condition_slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    condition_name: Mapped[str] = mapped_column(String(255), nullable=False)
    condition_name_ar: Mapped[str | None] = mapped_column(String(255))
    condition_name_ml: Mapped[str | None] = mapped_column(String(255))
    treatment_slugs = mapped_column(ARRAY(String), default=list)


# ---------------------------------------------------------------------------
# Treatment Knowledge Base
# ---------------------------------------------------------------------------
class TreatmentKB(Base):
    __tablename__ = "treatment_kb"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    prakriti_tags = mapped_column(ARRAY(String), default=list)
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id"), index=True)
    language: Mapped[str] = mapped_column(String(5), default="en")
    source_type: Mapped[str | None] = mapped_column(String(50))
    verified_by_doctor: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    doctor: Mapped["Doctor | None"] = relationship(back_populates="treatment_kb_entries")


# ---------------------------------------------------------------------------
# Bookings
# ---------------------------------------------------------------------------
class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_pseudo_id: Mapped[str] = mapped_column(String(64), ForeignKey("patient_profiles.pseudo_id"), index=True)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id"), index=True)
    treatment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("treatments.id"), index=True)
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guest_sessions.id")
    )
    guest_email: Mapped[str | None] = mapped_column(String(320))
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    payment_ref: Mapped[str | None] = mapped_column(String(255))
    total_amount: Mapped[float | None] = mapped_column(Numeric(10, 2))
    commission_amount: Mapped[float | None] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    lang: Mapped[str] = mapped_column(String(5), default="en")
    stripe_session_id: Mapped[str | None] = mapped_column(String(255))
    cancellation_policy: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    patient: Mapped["PatientProfile"] = relationship(back_populates="bookings", foreign_keys=[patient_pseudo_id])
    clinic: Mapped["ClinicFeatureStore"] = relationship()
    doctor: Mapped["Doctor"] = relationship()
    treatment: Mapped["Treatment"] = relationship()
    review: Mapped["Review | None"] = relationship(back_populates="booking", uselist=False)


# ---------------------------------------------------------------------------
# Voice Sessions
# ---------------------------------------------------------------------------
class VoiceSession(Base):
    __tablename__ = "voice_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_pseudo_id: Mapped[str | None] = mapped_column(String(64), index=True)
    language: Mapped[str] = mapped_column(String(5), default="en")
    stt_provider: Mapped[str | None] = mapped_column(String(50))
    intent_matches: Mapped[dict | None] = mapped_column(JSONB)
    confidence_scores: Mapped[dict | None] = mapped_column(JSONB)
    reask_count: Mapped[int] = mapped_column(Integer, default=0)
    final_answers: Mapped[dict | None] = mapped_column(JSONB)
    tier: Mapped[str] = mapped_column(String(20), default="standard")
    amount_paid: Mapped[float | None] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


# ---------------------------------------------------------------------------
# Reviews
# ---------------------------------------------------------------------------
class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_pseudo_id: Mapped[str] = mapped_column(String(64), index=True)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id"), index=True)
    booking_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bookings.id"), unique=True, index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    review_text: Mapped[str | None] = mapped_column(Text)
    treatment_slug: Mapped[str | None] = mapped_column(String(255))
    reviewer_location: Mapped[str | None] = mapped_column(String(255))
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    clinic: Mapped["ClinicFeatureStore"] = relationship(back_populates="reviews")
    doctor: Mapped["Doctor"] = relationship(back_populates="reviews")
    booking: Mapped["Booking"] = relationship(back_populates="review")

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating"),
    )


# ---------------------------------------------------------------------------
# Search Events (analytics)
# ---------------------------------------------------------------------------
class SearchEvent(Base):
    __tablename__ = "search_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    query: Mapped[str | None] = mapped_column(String(500))
    search_type: Mapped[str | None] = mapped_column(String(30))
    results_count: Mapped[int] = mapped_column(Integer, default=0)
    clicked_id: Mapped[str | None] = mapped_column(String(255))
    clicked_type: Mapped[str | None] = mapped_column(String(30))
    patient_pseudo_id: Mapped[str | None] = mapped_column(String(64))
    lang: Mapped[str] = mapped_column(String(5), default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


# ---------------------------------------------------------------------------
# Clinic Images
# ---------------------------------------------------------------------------
class ClinicImage(Base):
    __tablename__ = "clinic_images"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), nullable=False, index=True
    )
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=True, index=True
    )
    image_type: Mapped[str] = mapped_column(String(30), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(512), nullable=False)
    s3_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    alt_text: Mapped[str | None] = mapped_column(String(500))
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    clinic: Mapped["ClinicFeatureStore"] = relationship(back_populates="images")

    __table_args__ = (
        CheckConstraint(
            "image_type IN ('clinic_hero','clinic_gallery','clinic_logo','doctor_profile','doctor_gallery','treatment','certificate','room')",
            name="ck_clinic_image_type",
        ),
    )


# ---------------------------------------------------------------------------
# Booking Slots
# ---------------------------------------------------------------------------
class BookingSlot(Base):
    __tablename__ = "booking_slots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), nullable=False, index=True
    )
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=True, index=True
    )
    treatment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("treatments.id"), nullable=True
    )
    slot_type: Mapped[str] = mapped_column(String(20), nullable=False)
    recurrence: Mapped[dict | None] = mapped_column(JSONB)
    date: Mapped[date | None] = mapped_column(Date)
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    max_bookings: Mapped[int] = mapped_column(Integer, default=1)
    current_bookings: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    clinic: Mapped["ClinicFeatureStore"] = relationship(back_populates="booking_slots")

    __table_args__ = (
        CheckConstraint(
            "slot_type IN ('recurring','single','blocked')",
            name="ck_booking_slot_type",
        ),
    )


# ---------------------------------------------------------------------------
# Clinic Products (admin-managed product catalogue)
# ---------------------------------------------------------------------------
class ClinicProduct(Base):
    __tablename__ = "clinic_products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_display_en: Mapped[str | None] = mapped_column(String(255))
    name_display_ml: Mapped[str | None] = mapped_column(String(255))
    name_display_ar: Mapped[str | None] = mapped_column(String(255))
    description_en: Mapped[str | None] = mapped_column(Text)
    description_ml: Mapped[str | None] = mapped_column(Text)
    product_type: Mapped[str] = mapped_column(String(30), default="other")
    sku: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    price_usd: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    price_inr: Mapped[float | None] = mapped_column(Numeric(10, 2))
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0)
    is_prescription_only: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    ships_internationally: Mapped[bool] = mapped_column(Boolean, default=False)
    weight_grams: Mapped[int | None] = mapped_column(Integer)
    image_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_images.id"), nullable=True
    )
    prakriti_tags = mapped_column(ARRAY(String), default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    clinic: Mapped["ClinicFeatureStore"] = relationship(back_populates="clinic_products")

    __table_args__ = (
        CheckConstraint(
            "product_type IN ('kashayam','arishtam','ghritam','tailam','churnam','lehyam','bhasma','tablet','capsule','other')",
            name="ck_clinic_product_type",
        ),
    )


# ---------------------------------------------------------------------------
# Outcomes Log
# APPEND-ONLY — never UPDATE or DELETE any row. This is the AI training corpus.
# ---------------------------------------------------------------------------
class OutcomesLog(Base):
    """APPEND-ONLY — never UPDATE or DELETE any row. This is the AI training corpus."""

    __tablename__ = "outcomes_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    patient_pseudo_id: Mapped[str | None] = mapped_column(String(64), index=True)
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    answers_raw: Mapped[dict | None] = mapped_column(JSONB)
    scores: Mapped[dict | None] = mapped_column(JSONB)
    booking_status: Mapped[str | None] = mapped_column(String(30))
    medicine_ordered: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    __table_args__ = (
        CheckConstraint("event_type IS NOT NULL", name="ck_outcomes_log_append_only_marker"),
    )
