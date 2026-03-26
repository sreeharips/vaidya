import uuid
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from api.admin import admin_router
from api.auth import router as auth_router
from api.booking import router as booking_router
from api.clinics import router as clinics_router
from api.packages import router as packages_router
from api.search import router as search_router
from api.users import router as users_router
from db.database import async_session
from db.models import GuestSession

_COOKIE_NAME = "vaidya_session"
_COOKIE_TTL_DAYS = 90


class GuestSessionMiddleware(BaseHTTPMiddleware):
    """
    Runs on every request.

    1. Read the `vaidya_session` cookie.
    2. Validate the session UUID against the DB (creates a new one if missing
       or expired).
    3. Attach `session_id` to `request.state` so all downstream handlers can
       reference it without another DB round-trip.
    4. Set / renew the cookie on the response when a new session is created.
    """

    async def dispatch(self, request, call_next):
        session_id: uuid.UUID | None = None
        set_cookie = False

        raw_cookie = request.cookies.get(_COOKIE_NAME)
        if raw_cookie:
            try:
                session_id = uuid.UUID(raw_cookie)
            except ValueError:
                session_id = None

        async with async_session() as db:
            if session_id:
                guest = await db.get(GuestSession, session_id)
                if not guest or guest.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
                    session_id = None  # expired or unknown — fall through to create

            if not session_id:
                session_id = uuid.uuid4()
                expires = datetime.now(timezone.utc) + timedelta(days=_COOKIE_TTL_DAYS)
                db.add(GuestSession(id=session_id, expires_at=expires))
                await db.commit()
                set_cookie = True
            else:
                # Refresh last_seen_at without a full model load
                guest.last_seen_at = datetime.now(timezone.utc)
                await db.commit()

        request.state.session_id = session_id

        response = await call_next(request)

        if set_cookie:
            response.set_cookie(
                key=_COOKIE_NAME,
                value=str(session_id),
                max_age=_COOKIE_TTL_DAYS * 24 * 60 * 60,
                httponly=False,   # Must be readable by JS (AuthContext reads sessionId)
                samesite="lax",
                secure=False,     # Set True behind TLS in production
            )

        return response


app = FastAPI(
    title="AyuRetreats API",
    description="Clinic-based Ayurvedic wellness retreat booking platform",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GuestSessionMiddleware must be added AFTER CORSMiddleware so CORS headers
# are set even if the session middleware short-circuits.
app.add_middleware(GuestSessionMiddleware)

app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(booking_router)
app.include_router(clinics_router)
app.include_router(packages_router)
app.include_router(search_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ayuretreats-backend"}


@app.get("/")
async def root():
    return {"message": "AyuRetreats API", "docs": "/docs"}
