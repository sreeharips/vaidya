"""
Vaidya database models — SQLAlchemy 2.0 async (asyncpg).

All tables from CLAUDE.md + additional fields from vaidya_design.html.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    Column,
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


# ---------------------------------------------------------------------------
# Doctors
# ---------------------------------------------------------------------------
class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    qualification: Mapped[str] = mapped_column(String(255), nullable=False)
    years_exp: Mapped[int] = mapped_column(Integer, default=0)
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), index=True)
    specialisations = mapped_column(ARRAY(String), default=list)
    prakriti_affinities = mapped_column(ARRAY(String), default=list)
    languages = mapped_column(ARRAY(String), default=list)
    bio: Mapped[str | None] = mapped_column(Text)
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
    treatments: Mapped[list["Treatment"]] = relationship(back_populates="doctor", foreign_keys="Treatment.doctor_id")
    treatment_kb_entries: Mapped[list["TreatmentKB"]] = relationship(back_populates="doctor")
    reviews: Mapped[list["Review"]] = relationship(back_populates="doctor")

    __table_args__ = (
        CheckConstraint("tier IN (1, 2)", name="ck_doctors_tier"),
        Index("ix_doctors_search_vector", "search_vector", postgresql_using="gin"),
    )


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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    doctors: Mapped[list["Doctor"]] = relationship(back_populates="clinic")
    treatments: Mapped[list["Treatment"]] = relationship(back_populates="clinic", foreign_keys="Treatment.clinic_id")
    reviews: Mapped[list["Review"]] = relationship(back_populates="clinic")

    __table_args__ = (
        CheckConstraint("tier IN (1, 2)", name="ck_clinic_tier"),
        Index("ix_clinic_search_vector", "search_vector", postgresql_using="gin"),
    )


# ---------------------------------------------------------------------------
# Treatments
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
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("clinic_feature_store.id"), index=True)
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    clinic: Mapped["ClinicFeatureStore | None"] = relationship(back_populates="treatments", foreign_keys=[clinic_id])
    doctor: Mapped["Doctor | None"] = relationship(back_populates="treatments", foreign_keys=[doctor_id])


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
        # Database-level guard: prevent updates and deletes via a naming convention.
        # Actual enforcement is via a PostgreSQL trigger (see migration).
        CheckConstraint("event_type IS NOT NULL", name="ck_outcomes_log_append_only_marker"),
    )
