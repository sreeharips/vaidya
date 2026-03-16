from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.assessment import router as assessment_router
from api.booking import router as booking_router
from api.clinics import router as clinics_router
from api.doctors import router as doctors_router
from api.products import router as products_router
from api.search import router as search_router

app = FastAPI(
    title="Vaidya API",
    description="AI-powered Ayurveda marketplace",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assessment_router)
app.include_router(booking_router)
app.include_router(clinics_router)
app.include_router(doctors_router)
app.include_router(products_router)
app.include_router(search_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "vaidya-backend"}


@app.get("/")
async def root():
    return {"message": "Vaidya API", "docs": "/docs"}
