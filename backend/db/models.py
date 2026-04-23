"""
Vaidya database models — SQLAlchemy 2.0 async (asyncpg).

Clinic-based wellness retreat booking platform.
Core entities: ClinicFeatureStore, Retreat, RetreatAvailability, ClinicTeam, Booking.
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
    language: Mapped[str] = mapped_column(String(5), default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    bookings: Mapped[list["Booking"]] = relationship(back_populates="patient", foreign_keys="Booking.patient_pseudo_id")


# ---------------------------------------------------------------------------
# Clinic Feature Store
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
    wellness_categories = mapped_column(ARRAY(String), default=list)
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
    # Enriched clinic detail fields
    established_year: Mapped[int | None] = mapped_column(Integer)
    highlights = mapped_column(ARRAY(String), default=list)
    accommodation_types = mapped_column(ARRAY(String), default=list)
    meal_options = mapped_column(ARRAY(String), default=list)
    atmosphere = mapped_column(ARRAY(String), default=list)
    nearest_airport: Mapped[str | None] = mapped_column(String(255))
    nearest_railway: Mapped[str | None] = mapped_column(String(255))
    patient_capacity: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    retreats: Mapped[list["Retreat"]] = relationship(back_populates="clinic")
    team_members: Mapped[list["ClinicTeam"]] = relationship(back_populates="clinic")
    reviews: Mapped[list["Review"]] = relationship(back_populates="clinic")
    blocked_dates: Mapped[list["ClinicBlockedDate"]] = relationship(back_populates="clinic")
    images: Mapped[list["ClinicImage"]] = relationship(back_populates="clinic")
    clinic_experiences: Mapped[list["ClinicExperience"]] = relationship(back_populates="clinic")
    rooms: Mapped[list["Room"]] = relationship(back_populates="clinic")

    __table_args__ = (
        CheckConstraint("tier IN (1, 2)", name="ck_clinic_tier"),
        Index("ix_clinic_search_vector", "search_vector", postgresql_using="gin"),
    )


# ---------------------------------------------------------------------------
# Clinic Blocked Dates
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
# Retreats (child of ClinicFeatureStore)
# ---------------------------------------------------------------------------
class Retreat(Base):
    __tablename__ = "retreats"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_feature_store.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_display_en: Mapped[str | None] = mapped_column(String(255))
    name_display_ar: Mapped[str | None] = mapped_column(String(255))
    name_display_ml: Mapped[str | None] = mapped_column(String(255))
    description_en: Mapped[str | None] = mapped_column(Text)
    description_ar: Mapped[str | None] = mapped_column(Text)
    description_ml: Mapped[str | None] = mapped_column(Text)
    package_type: Mapped[str] = mapped_column(String(100), nullable=False)
    wellness_categories = mapped_column(ARRAY(String), default=list)
    duration_min_days: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_max_days: Mapped[int] = mapped_column(Integer, nullable=False)
    price_usd: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    price_inr: Mapped[float | None] = mapped_column(Numeric(10, 2))
    includes_accommodation: Mapped[bool] = mapped_column(Boolean, default=False)
    includes_meals: Mapped[bool] = mapped_column(Boolean, default=False)
    includes_transfers: Mapped[bool] = mapped_column(Boolean, default=False)
    max_guests_per_slot: Mapped[int] = mapped_column(Integer, default=1)
    what_to_expect: Mapped[str | None] = mapped_column(Text)
    contraindications: Mapped[str | None] = mapped_column(Text)
    highlights = mapped_column(ARRAY(String), default=list)
    treatments_included = mapped_column(ARRAY(String), default=list)
    ideal_for = mapped_column(ARRAY(String), default=list)
    prakriti_tags = mapped_column(ARRAY(String), default=list)
    photos = mapped_column(ARRAY(String), default=list)
    daily_schedule: Mapped[str | None] = mapped_column(Text)
    cancellation_policy: Mapped[str | None] = mapped_column(Text)
    language_of_instruction = mapped_column(ARRAY(String), default=list)
    min_age: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    clinic: Mapped["ClinicFeatureStore"] = relationship(back_populates="retreats")
    availability: Mapped[list["RetreatAvailability"]] = relationship(back_populates="retreat")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="retreat")


# ---------------------------------------------------------------------------
# Retreat Availability
# ---------------------------------------------------------------------------
class RetreatAvailability(Base):
    __tablename__ = "retreat_availability"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    retreat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("retreats.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    available_spots: Mapped[int] = mapped_column(Integer, default=1)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    block_reason: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    retreat: Mapped["Retreat"] = relationship(back_populates="availability")

    __table_args__ = (
        UniqueConstraint("retreat_id", "date", name="uq_retreat_availability_date"),
    )


# ---------------------------------------------------------------------------
# Clinic Team (informational only — no booking, no rating)
# ---------------------------------------------------------------------------
class ClinicTeam(Base):
    __tablename__ = "clinic_team"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_feature_store.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_ml: Mapped[str | None] = mapped_column(String(255))
    name_ar: Mapped[str | None] = mapped_column(String(255))
    qualification: Mapped[str | None] = mapped_column(String(255))
    years_experience: Mapped[int | None] = mapped_column(Integer)
    bio_en: Mapped[str | None] = mapped_column(Text)
    bio_ml: Mapped[str | None] = mapped_column(Text)
    photo_url: Mapped[str | None] = mapped_column(Text)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    clinic: Mapped["ClinicFeatureStore"] = relationship(back_populates="team_members")


# ---------------------------------------------------------------------------
# Users
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

    __table_args__ = (
        CheckConstraint(
            "role IN ('patient','clinic_admin','platform_admin')",
            name="ck_users_role",
        ),
    )


# ---------------------------------------------------------------------------
# Guest Sessions
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

    __table_args__ = (
        Index("ix_guest_sessions_claimed_user", "claimed_by_user_id", postgresql_where=text("claimed_by_user_id IS NOT NULL")),
    )


# ---------------------------------------------------------------------------
# User Preferences
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
    preferred_treatment_types = mapped_column(ARRAY(String), default=list)
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
# User Watchlist (clinics saved by user or guest)
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
        CheckConstraint("entity_type IN ('clinic')", name="ck_watchlist_entity_type"),
        Index("ix_user_watchlist_user", "user_id", "entity_type", postgresql_where=text("user_id IS NOT NULL")),
        Index("ix_user_watchlist_session", "session_id", "entity_type", postgresql_where=text("session_id IS NOT NULL")),
        UniqueConstraint("user_id", "entity_type", "entity_id", name="uq_watchlist_user"),
        UniqueConstraint("session_id", "entity_type", "entity_id", name="uq_watchlist_session"),
    )


# ---------------------------------------------------------------------------
# Booking History (user-facing view)
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
    package_name: Mapped[str] = mapped_column(String(255), nullable=False)
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
# Bookings
# ---------------------------------------------------------------------------
class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_pseudo_id: Mapped[str] = mapped_column(String(64), ForeignKey("patient_profiles.pseudo_id"), index=True)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), index=True)
    retreat_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("retreats.id"), index=True)
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guest_sessions.id")
    )
    guest_name: Mapped[str | None] = mapped_column(String(255))
    guest_email: Mapped[str | None] = mapped_column(String(320))
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    guest_count: Mapped[int] = mapped_column(Integer, default=1)
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

    room_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True, index=True
    )
    room_price_inr_snapshot: Mapped[float | None] = mapped_column(Numeric(10, 2))

    patient: Mapped["PatientProfile"] = relationship(back_populates="bookings", foreign_keys=[patient_pseudo_id])
    clinic: Mapped["ClinicFeatureStore"] = relationship()
    retreat: Mapped["Retreat"] = relationship(back_populates="bookings")
    room: Mapped["Room | None"] = relationship(foreign_keys=[room_id])
    review: Mapped["Review | None"] = relationship(back_populates="booking", uselist=False)
    add_ons: Mapped[list["BookingAddOn"]] = relationship(back_populates="booking")


# ---------------------------------------------------------------------------
# Reviews
# ---------------------------------------------------------------------------
class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_pseudo_id: Mapped[str] = mapped_column(String(64), index=True)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), index=True)
    booking_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bookings.id"), unique=True, index=True)
    retreat_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("retreats.id", ondelete="SET NULL"), nullable=True, index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    review_text: Mapped[str | None] = mapped_column(Text)
    treatment_slug: Mapped[str | None] = mapped_column(String(255))
    reviewer_location: Mapped[str | None] = mapped_column(String(255))
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    clinic: Mapped["ClinicFeatureStore"] = relationship(back_populates="reviews")
    booking: Mapped["Booking"] = relationship(back_populates="review")
    retreat: Mapped["Retreat | None"] = relationship(foreign_keys=[retreat_id])

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
            "image_type IN ('clinic_hero','clinic_gallery','clinic_logo','room','treatment','team_photo')",
            name="ck_clinic_image_type",
        ),
    )


# ---------------------------------------------------------------------------
# Experiences (platform-curated — auto-matched by proximity)
# ---------------------------------------------------------------------------
class Experience(Base):
    __tablename__ = "experiences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name_ar: Mapped[str | None] = mapped_column(String(255))
    name_ml: Mapped[str | None] = mapped_column(String(255))
    description_en: Mapped[str | None] = mapped_column(Text)
    description_ar: Mapped[str | None] = mapped_column(Text)
    description_ml: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    district: Mapped[str | None] = mapped_column(String(255))
    region_label: Mapped[str | None] = mapped_column(String(255))
    typical_duration_hours: Mapped[float | None] = mapped_column(Float)
    price_inr: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    is_free: Mapped[bool] = mapped_column(Boolean, default=True)
    photos = mapped_column(ARRAY(String), default=list)
    external_url: Mapped[str | None] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "category IN ('sightseeing','adventure','cultural','nature','wellness')",
            name="ck_experiences_category",
        ),
        Index("ix_experiences_category", "category", "is_active"),
        Index("ix_experiences_district", "district", postgresql_where=text("district IS NOT NULL")),
    )


# ---------------------------------------------------------------------------
# Clinic Experiences (clinic-owned paid add-ons)
# ---------------------------------------------------------------------------
class ClinicExperience(Base):
    __tablename__ = "clinic_experiences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_feature_store.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name_ar: Mapped[str | None] = mapped_column(String(255))
    name_ml: Mapped[str | None] = mapped_column(String(255))
    description_en: Mapped[str | None] = mapped_column(Text)
    description_ar: Mapped[str | None] = mapped_column(Text)
    description_ml: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    price_inr: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    photos = mapped_column(ARRAY(String), default=list)
    max_per_booking: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    clinic: Mapped["ClinicFeatureStore"] = relationship(back_populates="clinic_experiences")

    __table_args__ = (
        CheckConstraint(
            "category IN ('sightseeing','adventure','cultural','nature','wellness')",
            name="ck_clinic_exp_category",
        ),
        CheckConstraint("price_inr > 0", name="ck_clinic_exp_price_nonzero"),
        Index("ix_clinic_experiences_clinic", "clinic_id", "is_active", "display_order"),
    )


# ---------------------------------------------------------------------------
# Rooms (child of ClinicFeatureStore)
# ---------------------------------------------------------------------------
class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_feature_store.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)  # non_ac | ac_standard | deluxe | suite
    description: Mapped[str | None] = mapped_column(Text)
    price_per_night_inr: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    amenities = mapped_column(ARRAY(String), default=list)
    photos = mapped_column(ARRAY(String), default=list)
    max_occupancy: Mapped[int] = mapped_column(Integer, default=2)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    clinic: Mapped["ClinicFeatureStore"] = relationship(back_populates="rooms")

    __table_args__ = (
        CheckConstraint(
            "category IN ('non_ac','ac_standard','deluxe','suite')",
            name="ck_room_category",
        ),
        CheckConstraint("price_per_night_inr > 0", name="ck_room_price_nonzero"),
        Index("ix_rooms_clinic", "clinic_id", "is_active", "display_order"),
    )


# ---------------------------------------------------------------------------
# Booking Add-Ons
# APPEND-ONLY — never UPDATE or DELETE any row.
# ---------------------------------------------------------------------------
class BookingAddOn(Base):
    """APPEND-ONLY — never UPDATE or DELETE any row."""

    __tablename__ = "booking_add_ons"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    add_on_type: Mapped[str] = mapped_column(String(10), nullable=False)   # 'platform' | 'clinic'
    experience_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)  # polymorphic ref
    name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    price_inr_snapshot: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    booking: Mapped["Booking"] = relationship(back_populates="add_ons")

    __table_args__ = (
        CheckConstraint("add_on_type IN ('platform','clinic')", name="ck_booking_add_on_type"),
        CheckConstraint("quantity >= 1", name="ck_booking_add_on_qty"),
    )


# ---------------------------------------------------------------------------
# Outcomes Log
# APPEND-ONLY — never UPDATE or DELETE any row. This is the AI training corpus.
# ---------------------------------------------------------------------------
class WaitlistEmail(Base):
    """Pre-launch waitlist. Drop this table and remove the route after launch."""

    __tablename__ = "waitlist_emails"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    source: Mapped[str | None] = mapped_column(String(50))   # e.g. "landing", "social"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class OutcomesLog(Base):
    """APPEND-ONLY — never UPDATE or DELETE any row. This is the AI training corpus."""

    __tablename__ = "outcomes_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    patient_pseudo_id: Mapped[str | None] = mapped_column(String(64), index=True)
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    answers_raw: Mapped[dict | None] = mapped_column(JSONB)
    scores: Mapped[dict | None] = mapped_column(JSONB)
    booking_status: Mapped[str | None] = mapped_column(String(30))
    medicine_ordered: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    __table_args__ = (
        CheckConstraint("event_type IS NOT NULL", name="ck_outcomes_log_append_only_marker"),
    )


# ---------------------------------------------------------------------------
# Platform Tags (super admin managed — specialisations & certifications)
# ---------------------------------------------------------------------------
class PlatformTag(Base):
    __tablename__ = "platform_tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    __table_args__ = (
        UniqueConstraint("type", "value", name="uq_platform_tag_type_value"),
        CheckConstraint("type IN ('specialisation','certification')", name="ck_platform_tag_type"),
        Index("ix_platform_tags_type", "type", "is_active"),
    )
