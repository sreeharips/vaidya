#!/usr/bin/env python3
"""
Seed script for platform experiences and clinic add-on experiences.
Run with:
  DATABASE_SYNC_URL="postgresql+psycopg2://vaidya:vaidya_dev@localhost:5432/vaidya" \
    python backend/scripts/seed_experiences.py [--reset]
"""
import argparse
import os
import socket
import sys
import uuid
from pathlib import Path

# Ensure backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# ── DB URL ────────────────────────────────────────────────────────────────────
_DEFAULT_HOST = "postgres"
try:
    socket.gethostbyname(_DEFAULT_HOST)
    _DB_HOST = _DEFAULT_HOST
except socket.gaierror:
    _DB_HOST = "localhost"

DATABASE_SYNC_URL = os.getenv(
    "DATABASE_SYNC_URL",
    f"postgresql+psycopg2://vaidya:vaidya_dev@{_DB_HOST}:5432/vaidya",
)
engine = create_engine(DATABASE_SYNC_URL, echo=False)

# ── Photo helpers ─────────────────────────────────────────────────────────────
# Using Picsum Photos with curated seeds that produce beautiful Kerala-style imagery.
# Seed names are chosen to match aesthetic (beach, nature, forest, temple, water, etc.)
def photo(seed: str, w: int = 900, h: int = 600) -> str:
    return f"https://picsum.photos/seed/{seed}/{w}/{h}"

# ── Kerala platform experiences ───────────────────────────────────────────────
# Each entry → one row in the `experiences` table.
# Photos: 2–3 per experience, high-quality Picsum seeds chosen to match the vibe.

PLATFORM_EXPERIENCES = [
    # ── Thiruvananthapuram ────────────────────────────────────────────────────
    {
        "name_en": "Varkala Cliff Sunset Walk",
        "name_ar": "مشي على جرف فاركالا عند الغروب",
        "name_ml": "വർക്കല ക്ലിഫ് സൂര്യാസ്ത സഞ്ചാരം",
        "description_en": (
            "Stroll along the dramatic red laterite cliffs of Varkala as the sun melts into "
            "the Arabian Sea. The cliff-top path is lined with cafés, yoga studios, and shops "
            "with sweeping ocean views. Best experienced in the golden hour before sunset."
        ),
        "category": "sightseeing",
        "lat": 8.7329, "lng": 76.7162,
        "district": "Thiruvananthapuram",
        "region_label": "Varkala Cliffs",
        "typical_duration_hours": 2.0,
        "is_free": True,
        "price_inr": 0,
        "photos": [
            photo("varkala-cliff-sunset", 900, 600),
            photo("varkala-beach-cliff", 900, 600),
            photo("kerala-coastal-sunset", 900, 600),
        ],
        "external_url": "https://maps.app.goo.gl/varkala",
    },
    {
        "name_en": "Padmanabhaswamy Temple Darshan",
        "name_ar": "زيارة معبد بادمانابهاسوامي",
        "name_ml": "പദ്മനാഭസ്വാമി ക്ഷേത്ര ദർശനം",
        "description_en": (
            "Visit one of the richest and most magnificent temples in India. The 16th-century "
            "Dravidian gopuram soars 30 metres above Trivandrum's heart. Entry is restricted "
            "to Hindus; dress code strictly enforced. Arrive by 6:30 am for morning rituals."
        ),
        "category": "cultural",
        "lat": 8.4820, "lng": 76.9474,
        "district": "Thiruvananthapuram",
        "region_label": "Trivandrum City",
        "typical_duration_hours": 2.0,
        "is_free": True,
        "price_inr": 0,
        "photos": [
            photo("kerala-temple-gopuram", 900, 600),
            photo("hindu-temple-kerala", 900, 600),
        ],
        "external_url": None,
    },
    {
        "name_en": "Kovalam Beach Surfing & Watersports",
        "name_ar": "ركوب الأمواج والرياضات المائية في كوفالام",
        "name_ml": "കോവളം ബീച്ച് സർഫിംഗ്",
        "description_en": (
            "Kovalam's crescent lighthouse beach is one of India's best spots for learning to surf. "
            "Certified instructors offer 90-minute beginner sessions. Also available: kayaking, "
            "stand-up paddleboarding, and snorkelling off the rocks."
        ),
        "category": "adventure",
        "lat": 8.3988, "lng": 76.9782,
        "district": "Thiruvananthapuram",
        "region_label": "Kovalam Beach",
        "typical_duration_hours": 2.0,
        "is_free": False,
        "price_inr": 1200,
        "photos": [
            photo("kovalam-surf-beach", 900, 600),
            photo("india-beach-surfing", 900, 600),
            photo("kerala-beach-waves", 900, 600),
        ],
        "external_url": None,
    },
    # ── Alappuzha ─────────────────────────────────────────────────────────────
    {
        "name_en": "Alleppey Backwater Houseboat Day Cruise",
        "name_ar": "رحلة اليوم على قارب منزلي في الممرات المائية الخلفية",
        "name_ml": "അലപ്പുഴ ബാക്ക്‌വാട്ടർ ഹൗസ്‌ബോട്ട് ദിന ക്രൂസ്",
        "description_en": (
            "Drift through the legendary Kerala backwaters on a traditional kettuvallam "
            "(rice boat converted to houseboat). Glide past coconut palms, paddy fields, and "
            "fishing villages along the Vembanad Lake. Includes an onboard Ayurvedic lunch."
        ),
        "category": "sightseeing",
        "lat": 9.4981, "lng": 76.3388,
        "district": "Alappuzha",
        "region_label": "Alleppey Backwaters",
        "typical_duration_hours": 8.0,
        "is_free": False,
        "price_inr": 4500,
        "photos": [
            photo("kerala-houseboat-backwaters", 900, 600),
            photo("alleppey-houseboat-lake", 900, 600),
            photo("vembanad-lake-kerala", 900, 600),
        ],
        "external_url": None,
    },
    {
        "name_en": "Kuttanad Canoe Village Tour",
        "name_ar": "جولة قرية كوتاناد بالزورق",
        "name_ml": "കുട്ടനാട് കനോ ഗ്രാമ ടൂർ",
        "description_en": (
            "Paddle through Kuttanad — the rice bowl of Kerala — in a traditional dug-out canoe. "
            "Your local guide explains the unique below-sea-level farming, stops at a "
            "traditional toddy shop, and shares stories of the annual Nehru Trophy Boat Race."
        ),
        "category": "adventure",
        "lat": 9.3745, "lng": 76.4234,
        "district": "Alappuzha",
        "region_label": "Kuttanad Backwaters",
        "typical_duration_hours": 3.0,
        "is_free": False,
        "price_inr": 900,
        "photos": [
            photo("kuttanad-canoe-paddle", 900, 600),
            photo("kerala-village-canal", 900, 600),
        ],
        "external_url": None,
    },
    # ── Idukki / Munnar ───────────────────────────────────────────────────────
    {
        "name_en": "Munnar Tea Plantation Walk",
        "name_ar": "المشي في مزارع الشاي في موناروف",
        "name_ml": "മൂന്നാർ ചായത്തോട്ട നടത്ത",
        "description_en": (
            "Walk through the mist-clad tea gardens of Munnar at 1,500–2,700 m elevation. "
            "A factory guide explains the journey from leaf to cup. The rolling emerald carpets "
            "of tea bushes against blue mountains are endlessly photogenic."
        ),
        "category": "nature",
        "lat": 10.0889, "lng": 77.0595,
        "district": "Idukki",
        "region_label": "Munnar Tea Estates",
        "typical_duration_hours": 3.0,
        "is_free": False,
        "price_inr": 350,
        "photos": [
            photo("munnar-tea-plantation-green", 900, 600),
            photo("kerala-tea-garden-hills", 900, 600),
            photo("munnar-mist-mountains", 900, 600),
        ],
        "external_url": None,
    },
    {
        "name_en": "Periyar Wildlife Safari",
        "name_ar": "سفاري الحياة البرية في بيرياروف",
        "name_ml": "പെരിയാർ വൈൽഡ്‌ലൈഫ് സഫാരി",
        "description_en": (
            "Cruise on Periyar Lake inside the Periyar Tiger Reserve and spot elephants, "
            "gaur, sambar deer, and rare birds from your boat. Dawn departures offer the best "
            "wildlife sightings. The KTDC boat is the easiest; bamboo rafting is for adventurers."
        ),
        "category": "nature",
        "lat": 9.4945, "lng": 77.1601,
        "district": "Idukki",
        "region_label": "Thekkady – Periyar Reserve",
        "typical_duration_hours": 2.5,
        "is_free": False,
        "price_inr": 600,
        "photos": [
            photo("periyar-lake-elephant", 900, 600),
            photo("thekkady-wildlife-boat", 900, 600),
            photo("kerala-jungle-river", 900, 600),
        ],
        "external_url": None,
    },
    {
        "name_en": "Mattupetty Dam & Eco-Point Hike",
        "name_ar": "المشي إلى سد ماتوبيتي ونقطة الطبيعة",
        "name_ml": "മാട്ടുപ്പെട്ടി ഡാം ഹൈക്ക്",
        "description_en": (
            "A short hike from Mattupetty Dam leads to Echo Point — a glacial valley that "
            "bounces your voice back. Boating on the reservoir with herds of buffalo and "
            "Nilgiri hills as backdrop makes for an unforgettable morning."
        ),
        "category": "nature",
        "lat": 10.1162, "lng": 77.0786,
        "district": "Idukki",
        "region_label": "Munnar Highlands",
        "typical_duration_hours": 3.5,
        "is_free": False,
        "price_inr": 250,
        "photos": [
            photo("mattupetty-dam-munnar", 900, 600),
            photo("kerala-reservoir-hills", 900, 600),
        ],
        "external_url": None,
    },
    # ── Thrissur ──────────────────────────────────────────────────────────────
    {
        "name_en": "Athirapally Waterfall Trek",
        "name_ar": "رحلة شلال أثيرابالي",
        "name_ml": "അത്തിരപ്പള്ളി വെള്ളച്ചാട്ടം ട്രെക്ക്",
        "description_en": (
            "Hike through the Sholayar rainforest to reach Athirapally — Kerala's most "
            "spectacular waterfall, often called the Niagara of India. The 24-metre cascade "
            "flows through lush Vazhachal forest, home to endangered hornbills and lion-tailed macaques."
        ),
        "category": "adventure",
        "lat": 10.2867, "lng": 76.5700,
        "district": "Thrissur",
        "region_label": "Vazhachal Forest Range",
        "typical_duration_hours": 4.0,
        "is_free": False,
        "price_inr": 400,
        "photos": [
            photo("athirapally-waterfall-kerala", 900, 600),
            photo("kerala-jungle-waterfall", 900, 600),
            photo("india-rainforest-falls", 900, 600),
        ],
        "external_url": None,
    },
    {
        "name_en": "Guruvayur Temple & Elephant Sanctuary",
        "name_ar": "معبد غوروفايور وملجأ الفيلة",
        "name_ml": "ഗുരുവായൂർ ക്ഷേത്രം & ആനത്താവളം",
        "description_en": (
            "Visit the Krishna temple at Guruvayur — one of the most important Hindu pilgrim "
            "centres in south India — then walk to the adjacent Punnathur Kotta elephant yard "
            "that houses over 50 temple elephants. An extraordinary cultural and spiritual experience."
        ),
        "category": "cultural",
        "lat": 10.5943, "lng": 76.0418,
        "district": "Thrissur",
        "region_label": "Guruvayur",
        "typical_duration_hours": 4.0,
        "is_free": True,
        "price_inr": 0,
        "photos": [
            photo("guruvayur-temple-elephant", 900, 600),
            photo("kerala-temple-elephant", 900, 600),
        ],
        "external_url": None,
    },
    # ── Ernakulam / Kochi ─────────────────────────────────────────────────────
    {
        "name_en": "Fort Kochi Heritage Walk",
        "name_ar": "جولة التراث في فورت كوتشي",
        "name_ml": "ഫോർട്ട് കൊച്ചി ഹെറിറ്റേജ് വാക്ക്",
        "description_en": (
            "Wander the streets of Fort Kochi — a living museum of 500 years of colonial history. "
            "Portuguese churches, Dutch palaces, Jewish synagogue, and Mattancherry spice bazaars "
            "all within walking distance. Best explored in the cooler morning hours."
        ),
        "category": "cultural",
        "lat": 9.9658, "lng": 76.2432,
        "district": "Ernakulam",
        "region_label": "Fort Kochi & Mattancherry",
        "typical_duration_hours": 3.0,
        "is_free": True,
        "price_inr": 0,
        "photos": [
            photo("fort-kochi-colonial-streets", 900, 600),
            photo("mattancherry-kochi-heritage", 900, 600),
            photo("kochi-jewish-synagogue", 900, 600),
        ],
        "external_url": None,
    },
    {
        "name_en": "Chinese Fishing Nets Sunrise Experience",
        "name_ar": "تجربة شروق الشمس مع شباك الصيد الصينية",
        "name_ml": "ചൈനീസ് ഫിഷിങ്ങ് നെറ്റ്സ് സൂര്യോദയ ദൃശ്യം",
        "description_en": (
            "Watch the iconic Chinese fishing nets — unchanged since the 14th century — silhouetted "
            "against the golden sunrise over the Arabian Sea inlet. The best light is 6–7 am. "
            "Buy fresh catch directly from fishermen for breakfast."
        ),
        "category": "sightseeing",
        "lat": 9.9674, "lng": 76.2390,
        "district": "Ernakulam",
        "region_label": "Fort Kochi Seafront",
        "typical_duration_hours": 1.5,
        "is_free": True,
        "price_inr": 0,
        "photos": [
            photo("chinese-fishing-nets-kochi-sunrise", 900, 600),
            photo("kochi-harbour-morning", 900, 600),
            photo("kerala-fishing-nets-sunset", 900, 600),
        ],
        "external_url": None,
    },
    {
        "name_en": "Kathakali Classical Dance Performance",
        "name_ar": "عرض رقص كاثاكالي الكلاسيكي",
        "name_ml": "കഥകളി ക്ലാസിക്കൽ നൃത്ത പ്രദർശനം",
        "description_en": (
            "Experience Kerala's most iconic classical art form — Kathakali — at the Kerala Kathakali "
            "Centre in Fort Kochi. Arrive 45 minutes early to watch the elaborate make-up and "
            "costume transformation. The performance tells stories from the Mahabharata and Ramayana."
        ),
        "category": "cultural",
        "lat": 9.9658, "lng": 76.2432,
        "district": "Ernakulam",
        "region_label": "Fort Kochi",
        "typical_duration_hours": 2.0,
        "is_free": False,
        "price_inr": 500,
        "photos": [
            photo("kathakali-dance-performance", 900, 600),
            photo("kerala-classical-dance-makeup", 900, 600),
        ],
        "external_url": None,
    },
    # ── Wayanad ───────────────────────────────────────────────────────────────
    {
        "name_en": "Chembra Peak Trek (Heart Lake)",
        "name_ar": "رحلة تسلق قمة شيمبرا",
        "name_ml": "ചേമ്പ്ര പീക്ക് ട്രെക്ക്",
        "description_en": (
            "Trek to Chembra Peak (2,100 m), the highest peak in the Wayanad hills, passing the "
            "legendary heart-shaped lake halfway up. The 5-km trail offers panoramic views of "
            "Tamil Nadu, Karnataka, and Kerala meeting at the horizon. Forest Department permit required."
        ),
        "category": "adventure",
        "lat": 11.5228, "lng": 76.0560,
        "district": "Wayanad",
        "region_label": "Kalpetta Hills",
        "typical_duration_hours": 6.0,
        "is_free": False,
        "price_inr": 500,
        "photos": [
            photo("chembra-peak-heart-lake-wayanad", 900, 600),
            photo("wayanad-trekking-hills", 900, 600),
            photo("kerala-mountain-trekking-mist", 900, 600),
        ],
        "external_url": None,
    },
    {
        "name_en": "Edakkal Caves Prehistoric Rock Art",
        "name_ar": "رسوم كهف إيداكال الصخرية ما قبل التاريخ",
        "name_ml": "എടക്കൽ ഗുഹ ചരിത്രാതീത ചിത്രങ്ങൾ",
        "description_en": (
            "Climb through dense forest to the Edakkal Caves at 1,200 m — natural clefts in a "
            "boulder containing prehistoric petroglyphs dating back 6,000+ years. One of the few "
            "places in India where Stone Age carvings are still visible in situ."
        ),
        "category": "cultural",
        "lat": 11.5883, "lng": 76.1284,
        "district": "Wayanad",
        "region_label": "Ambalavayal, Wayanad",
        "typical_duration_hours": 3.5,
        "is_free": False,
        "price_inr": 200,
        "photos": [
            photo("edakkal-caves-wayanad-forest", 900, 600),
            photo("wayanad-tribal-heritage", 900, 600),
        ],
        "external_url": None,
    },
    {
        "name_en": "Wayanad Spice & Coffee Plantation Tour",
        "name_ar": "جولة مزارع البهارات والقهوة في وايناد",
        "name_ml": "വയനാട് സ്പൈസ് & കോഫി പ്ലാൻ്റേഷൻ ടൂർ",
        "description_en": (
            "Walk through a family-run plantation where pepper vines climb coffee trees and "
            "cardamom grows in the shade of giant jackfruit. Your host guides you through "
            "how spices are harvested and explains their use in Ayurvedic medicine."
        ),
        "category": "nature",
        "lat": 11.6023, "lng": 76.0861,
        "district": "Wayanad",
        "region_label": "Kalpetta Plantation Belt",
        "typical_duration_hours": 2.5,
        "is_free": False,
        "price_inr": 600,
        "photos": [
            photo("wayanad-cardamom-plantation", 900, 600),
            photo("kerala-spice-garden-tour", 900, 600),
            photo("coffee-plantation-india-mist", 900, 600),
        ],
        "external_url": None,
    },
    # ── Kozhikode ─────────────────────────────────────────────────────────────
    {
        "name_en": "Kozhikode Calicut Heritage & Foodie Walk",
        "name_ar": "جولة التراث والطعام في كاليكوت",
        "name_ml": "കോഴിക്കോട് ഹെറിറ്റേജ് ഫൂഡ് വാക്ക്",
        "description_en": (
            "Stroll through Kozhikode's ancient Mopla merchant quarter and taste the legendary "
            "Malabar biriyani, kozhikodan halwa, and freshly grilled fish at the beach stalls. "
            "This is where Vasco da Gama first landed in India — history with every bite."
        ),
        "category": "cultural",
        "lat": 11.2588, "lng": 75.7804,
        "district": "Kozhikode",
        "region_label": "Kozhikode City",
        "typical_duration_hours": 3.0,
        "is_free": False,
        "price_inr": 400,
        "photos": [
            photo("kozhikode-malabar-food-market", 900, 600),
            photo("kerala-street-food-beach", 900, 600),
        ],
        "external_url": None,
    },
    {
        "name_en": "Kappad Beach Sunset (Vasco's Landing)",
        "name_ar": "غروب شمس شاطئ كابّاد",
        "name_ml": "കപ്പാട് ബീച്ച് സൂര്യാസ്ത",
        "description_en": (
            "Visit the rocky cape where Vasco da Gama first set foot in India in 1498. A small "
            "monument marks the historic spot. The sunset here — over the same waters the "
            "Portuguese navigated — is deeply evocative."
        ),
        "category": "sightseeing",
        "lat": 11.3717, "lng": 75.7174,
        "district": "Kozhikode",
        "region_label": "Kappad, North Kozhikode",
        "typical_duration_hours": 1.5,
        "is_free": True,
        "price_inr": 0,
        "photos": [
            photo("kappad-beach-historical", 900, 600),
            photo("kerala-rocky-beach-sunset", 900, 600),
        ],
        "external_url": None,
    },
    # ── Kannur ────────────────────────────────────────────────────────────────
    {
        "name_en": "Theyyam Ritual Performance Experience",
        "name_ar": "تجربة طقوس ثيام",
        "name_ml": "തെയ്യം ആചാര അനുഭവം",
        "description_en": (
            "Witness Theyyam — one of India's most spectacular ritual art forms — at a temple "
            "in Kannur or Kasaragod. The performer, believed to embody a deity, dances in "
            "3-metre-tall headdresses with fire. Performances are seasonal (Nov–Apr)."
        ),
        "category": "cultural",
        "lat": 11.8745, "lng": 75.3704,
        "district": "Kannur",
        "region_label": "Kannur District Temples",
        "typical_duration_hours": 3.0,
        "is_free": True,
        "price_inr": 0,
        "photos": [
            photo("theyyam-ritual-fire-dance-kannur", 900, 600),
            photo("kerala-theyyam-costume", 900, 600),
            photo("kannur-ritual-performance", 900, 600),
        ],
        "external_url": None,
    },
    {
        "name_en": "Muzhappilangad Drive-in Beach",
        "name_ar": "شاطئ موزابيلانغاد للسيارات",
        "name_ml": "മൂഴിക്കൽ ദ്വീപ് ഡ്രൈവ്-ഇൻ ബീച്ച്",
        "description_en": (
            "Asia's longest drive-in beach — 4 km of hard-packed golden sand where you can "
            "actually drive your car along the waterline. Rent a bicycle or motorbike to cruise "
            "alongside the waves. A sunset here is utterly unforgettable."
        ),
        "category": "sightseeing",
        "lat": 11.9536, "lng": 75.3439,
        "district": "Kannur",
        "region_label": "Muzhappilangad Beach",
        "typical_duration_hours": 2.0,
        "is_free": True,
        "price_inr": 0,
        "photos": [
            photo("muzhappilangad-drive-beach", 900, 600),
            photo("kerala-long-beach-sunset", 900, 600),
        ],
        "external_url": None,
    },
    # ── Kasaragod ─────────────────────────────────────────────────────────────
    {
        "name_en": "Bekal Fort & Bekal Beach",
        "name_ar": "قلعة بيكال وشاطئها",
        "name_ml": "ബേക്കൽ കോട്ടയും ബീച്ചും",
        "description_en": (
            "Explore the largest fort in Kerala — a 300-year-old behemoth rising from the sea "
            "on a promontory in Kasaragod. The fort offers dramatic 360° views of the Arabian Sea "
            "and surrounding coconut groves. Swimming is excellent at the adjacent beach."
        ),
        "category": "cultural",
        "lat": 12.3939, "lng": 75.0398,
        "district": "Kasaragod",
        "region_label": "Bekal, Kasaragod",
        "typical_duration_hours": 3.0,
        "is_free": False,
        "price_inr": 100,
        "photos": [
            photo("bekal-fort-kasaragod-sea", 900, 600),
            photo("kerala-fort-ocean-view", 900, 600),
            photo("bekal-beach-kerala", 900, 600),
        ],
        "external_url": None,
    },
    # ── Kollam ────────────────────────────────────────────────────────────────
    {
        "name_en": "Ashtamudi Lake Sunset Cruise",
        "name_ar": "رحلة غروب الشمس على بحيرة أشتاموضي",
        "name_ml": "അഷ്ടമുടി തടാക സൂര്യാസ്ത ക്രൂസ്",
        "description_en": (
            "Cruise Kerala's second-largest backwater lake as the day ends. Ashtamudi's eight "
            "arms (meaning 'eight inlets') are framed by palms and fishing villages. The KTDC "
            "cruise boat departs Kollam and runs to Alappuzha — or take a short sunset ferry."
        ),
        "category": "sightseeing",
        "lat": 8.8932, "lng": 76.5820,
        "district": "Kollam",
        "region_label": "Ashtamudi Wetlands",
        "typical_duration_hours": 2.0,
        "is_free": False,
        "price_inr": 300,
        "photos": [
            photo("ashtamudi-lake-kollam-sunset", 900, 600),
            photo("kerala-backwaters-sunset-boat", 900, 600),
        ],
        "external_url": None,
    },
    # ── Palakkad ──────────────────────────────────────────────────────────────
    {
        "name_en": "Palakkad Fort & Silent Valley Day Trip",
        "name_ar": "قلعة بالغات ورحلة الوادي الهادئ",
        "name_ml": "പാലക്കാട് കോട്ടയും സൈലൻ്റ് വാലിയും",
        "description_en": (
            "Start at the well-preserved 18th-century Haider Ali fort in Palakkad town, "
            "then drive to Silent Valley National Park — one of India's last undisturbed "
            "tropical rainforests. The park hosts lion-tailed macaques, Nilgiri langurs, "
            "and over 1,000 flowering plant species."
        ),
        "category": "nature",
        "lat": 10.7867, "lng": 76.6548,
        "district": "Palakkad",
        "region_label": "Palakkad & Nilambur Valley",
        "typical_duration_hours": 8.0,
        "is_free": False,
        "price_inr": 500,
        "photos": [
            photo("palakkad-fort-historic", 900, 600),
            photo("silent-valley-rainforest", 900, 600),
            photo("nilambur-forest-kerala", 900, 600),
        ],
        "external_url": None,
    },
    # ── Kottayam ──────────────────────────────────────────────────────────────
    {
        "name_en": "Kumarakom Bird Sanctuary Dawn Walk",
        "name_ar": "نزهة فجرية في محمية كوماراكوم للطيور",
        "name_ml": "കുമരകം പക്ഷി സങ്കേതം",
        "description_en": (
            "The Kumarakom Bird Sanctuary on the banks of Vembanad Lake is a winter haven for "
            "migratory birds from Siberia and the Himalayas. Dawn walks (6–8 am) offer sightings "
            "of cormorants, teal, cuckoos, and the majestic Siberian cranes."
        ),
        "category": "nature",
        "lat": 9.6174, "lng": 76.4330,
        "district": "Kottayam",
        "region_label": "Kumarakom, Vembanad Lake",
        "typical_duration_hours": 2.5,
        "is_free": False,
        "price_inr": 250,
        "photos": [
            photo("kumarakom-birds-vembanad", 900, 600),
            photo("kerala-wetlands-birds-sunrise", 900, 600),
        ],
        "external_url": None,
    },
    # ── Pathanamthitta ────────────────────────────────────────────────────────
    {
        "name_en": "Pamba River White-Water Rafting",
        "name_ar": "التجديف في نهر بامبا",
        "name_ml": "പമ്പ നദി വൈറ്റ്‌വാട്ടർ റാഫ്റ്റിംഗ്",
        "description_en": (
            "Rush through Class II–III rapids on the sacred Pamba River flowing from the "
            "Sabari hills. The 10-km rafting route passes rubber plantations, bamboo groves, "
            "and small temples. Certified guides and all equipment provided."
        ),
        "category": "adventure",
        "lat": 9.3605, "lng": 76.8210,
        "district": "Pathanamthitta",
        "region_label": "Ranni, Pamba River",
        "typical_duration_hours": 3.0,
        "is_free": False,
        "price_inr": 1200,
        "photos": [
            photo("pamba-river-rafting-kerala", 900, 600),
            photo("kerala-river-adventure-forest", 900, 600),
        ],
        "external_url": None,
    },
    # ── Malappuram ────────────────────────────────────────────────────────────
    {
        "name_en": "Nilambur Teak Forest & Conolly's Plot",
        "name_ar": "غابة التيك في نيلامبور",
        "name_ml": "നിലമ്പൂർ ടീക്ക് ഫോറസ്റ്റ്",
        "description_en": (
            "Walk through Conolly's Plot — the world's oldest teak plantation, established in 1844. "
            "The giant teak trees soar 40+ metres, their straight trunks like cathedral columns. "
            "The adjacent Nilambur Valley is one of Kerala's most pristine forest corridors."
        ),
        "category": "nature",
        "lat": 11.2786, "lng": 76.2144,
        "district": "Malappuram",
        "region_label": "Nilambur Forest Range",
        "typical_duration_hours": 3.0,
        "is_free": False,
        "price_inr": 150,
        "photos": [
            photo("nilambur-teak-forest-tall-trees", 900, 600),
            photo("kerala-forest-giant-trees", 900, 600),
        ],
        "external_url": None,
    },
    # ── Thrissur (wellness) ───────────────────────────────────────────────────
    {
        "name_en": "Kerala Classical Music & Dance Evening",
        "name_ar": "أمسية الموسيقى والرقص الكلاسيكية في كيرالا",
        "name_ml": "കേരള ക്ലാസിക്കൽ സംഗീത നൃത്ത സന്ധ്യ",
        "description_en": (
            "An intimate evening recital of Mohiniyattam (the dance of the enchantress) or "
            "Carnatic classical music in a traditional Kerala nalukettu (courtyard house). "
            "The Sangeet Natak Akademi-certified performers are among Kerala's finest."
        ),
        "category": "wellness",
        "lat": 10.5276, "lng": 76.2144,
        "district": "Thrissur",
        "region_label": "Thrissur Cultural Town",
        "typical_duration_hours": 2.0,
        "is_free": False,
        "price_inr": 800,
        "photos": [
            photo("mohiniyattam-dance-kerala-evening", 900, 600),
            photo("kerala-classical-dance-hall", 900, 600),
        ],
        "external_url": None,
    },
    # ── Ernakulam (wellness) ──────────────────────────────────────────────────
    {
        "name_en": "Sunrise Yoga on Kochi Harbour",
        "name_ar": "يوغا شروق الشمس على ميناء كوتشي",
        "name_ml": "കൊച്ചി ഹാർബർ യോഗ",
        "description_en": (
            "Join a small-group sunrise yoga session on the waterfront promenade of Fort Kochi. "
            "An experienced teacher leads a 90-minute Hatha practice as fishing boats return to "
            "harbour and the Chinese fishing nets stretch golden in the morning light."
        ),
        "category": "wellness",
        "lat": 9.9674, "lng": 76.2390,
        "district": "Ernakulam",
        "region_label": "Fort Kochi Seafront",
        "typical_duration_hours": 1.5,
        "is_free": False,
        "price_inr": 700,
        "photos": [
            photo("kochi-yoga-harbour-sunrise", 900, 600),
            photo("kerala-yoga-waterfront-morning", 900, 600),
        ],
        "external_url": None,
    },
]

# ── Clinic add-on experiences ─────────────────────────────────────────────────
# These seed into `clinic_experiences` for the first few Tier 2 retreat clinics.
# We pick clinics by name/district match (fetched at seed time).

CLINIC_ADDON_TEMPLATES = [
    # For Thiruvananthapuram clinics
    {
        "district": "Thiruvananthapuram",
        "add_ons": [
            {
                "name_en": "Guided Varkala Cliff Sunrise Walk",
                "name_ml": "വർക്കല ക്ലിഫ് ഗൈഡഡ് വാക്ക്",
                "description_en": (
                    "An early-morning guided walk along Varkala's dramatic red cliffs with your "
                    "retreat's wellness guide, followed by a meditation session at cliff-top and "
                    "a fresh coconut breakfast at a local café."
                ),
                "category": "sightseeing",
                "price_inr": 1800,
                "max_per_booking": 4,
                "display_order": 0,
            },
            {
                "name_en": "Kovalam Sunset Catamaran Sail",
                "name_ml": "കോവളം കടൽ ക്രൂസ്",
                "description_en": (
                    "A 90-minute private catamaran sailing trip off Kovalam Beach at sunset. "
                    "Watch dolphins, enjoy chilled fresh lime water, and witness the Arabian Sea "
                    "turn amber from the water."
                ),
                "category": "adventure",
                "price_inr": 3500,
                "max_per_booking": 2,
                "display_order": 1,
            },
        ],
    },
    # For Palakkad clinics
    {
        "district": "Palakkad",
        "add_ons": [
            {
                "name_en": "Silent Valley Forest Half-Day Hike",
                "name_ml": "സൈലൻ്റ് വാലി ഹൈക്ക്",
                "description_en": (
                    "A private guided hike into the buffer zone of Silent Valley National Park. "
                    "Your naturalist guide identifies medicinal herbs used in Ayurveda and explains "
                    "the forest ecology. Limited to 6 guests per session."
                ),
                "category": "nature",
                "price_inr": 2200,
                "max_per_booking": 3,
                "display_order": 0,
            },
            {
                "name_en": "Heritage Palakkad Nalukettu Tour",
                "name_ml": "പാലക്കാട് നാലുകെട്ട് ടൂർ",
                "description_en": (
                    "Visit a 200-year-old traditional Kerala nalukettu (courtyard house) owned by "
                    "an Ayurvedic family. Explore the herbal garden, watch traditional rice pounding, "
                    "and enjoy a home-cooked sadhya (feast) on banana leaf."
                ),
                "category": "cultural",
                "price_inr": 2800,
                "max_per_booking": 4,
                "display_order": 1,
            },
        ],
    },
    # For Thrissur clinics
    {
        "district": "Thrissur",
        "add_ons": [
            {
                "name_en": "Athirapally Waterfall Private Transfer & Trek",
                "name_ml": "അത്തിരപ്പള്ളി ട്രെക്ക്",
                "description_en": (
                    "Private AC transfer from your retreat to Athirapally Falls with a certified "
                    "forest guide. Includes the 2-km trek through Vazhachal forest and picnic "
                    "lunch by the waterfall. Return by 3 pm."
                ),
                "category": "adventure",
                "price_inr": 4500,
                "max_per_booking": 4,
                "display_order": 0,
            },
        ],
    },
    # For Alappuzha clinics
    {
        "district": "Alappuzha",
        "add_ons": [
            {
                "name_en": "Private Moonlight Houseboat Dinner",
                "name_ml": "ഹൗസ്‌ബോട്ട് ഡിന്നർ ക്രൂസ്",
                "description_en": (
                    "A private 3-hour evening cruise on a luxury kettuvallam as the sun sets over "
                    "the Vembanad backwaters. A chef prepares a 5-course Ayurvedic dinner on board. "
                    "Champagne (alcohol-free varieties available) and live Carnatic music included."
                ),
                "category": "wellness",
                "price_inr": 8500,
                "max_per_booking": 2,
                "display_order": 0,
            },
            {
                "name_en": "Kuttanad Village Canoe & Cooking Class",
                "name_ml": "കുട്ടനാട് കനോ & പാചക ക്ലാസ്",
                "description_en": (
                    "Morning canoe through village canals followed by a 2-hour Kerala cooking "
                    "masterclass in a local home. Learn to make fish curry, puttu, and ada pradaman. "
                    "Recipe cards included to recreate the flavours at home."
                ),
                "category": "cultural",
                "price_inr": 3200,
                "max_per_booking": 3,
                "display_order": 1,
            },
        ],
    },
    # For Kottayam clinics
    {
        "district": "Kottayam",
        "add_ons": [
            {
                "name_en": "Kumarakom Birdwatching at Dawn",
                "name_ml": "കുമരകം ഡോൺ ബേർഡ്‌വാച്ചിംഗ്",
                "description_en": (
                    "A guided dawn birdwatching walk through the Kumarakom Bird Sanctuary with "
                    "binoculars provided. Your ornithologist guide identifies 50+ species including "
                    "rare migratory birds. Maximum 6 guests. Departs 5:45 am."
                ),
                "category": "nature",
                "price_inr": 1600,
                "max_per_booking": 3,
                "display_order": 0,
            },
        ],
    },
    # For Idukki clinics
    {
        "district": "Idukki",
        "add_ons": [
            {
                "name_en": "Periyar Bamboo Rafting Expedition",
                "name_ml": "പെരിയാർ ബാംബൂ റാഫ്റ്റിംഗ്",
                "description_en": (
                    "Navigate the deep forest zones of Periyar Tiger Reserve on traditional bamboo "
                    "rafts — accessible only on this permit. The most intimate way to encounter "
                    "wildlife: elephants drinking at the banks, hornbills overhead."
                ),
                "category": "adventure",
                "price_inr": 3800,
                "max_per_booking": 2,
                "display_order": 0,
            },
            {
                "name_en": "Munnar Tea & Spice Heritage Tour",
                "name_ml": "മൂന്നാർ ചായ & സ്പൈസ് ടൂർ",
                "description_en": (
                    "A half-day guided tour of a heritage tea estate followed by a private spice "
                    "garden visit. Includes a tea-tasting session with 8 varieties and a "
                    "traditional Kerala sadhya lunch at the estate bungalow."
                ),
                "category": "cultural",
                "price_inr": 2500,
                "max_per_booking": 4,
                "display_order": 1,
            },
        ],
    },
    # For Wayanad clinics
    {
        "district": "Wayanad",
        "add_ons": [
            {
                "name_en": "Sunrise Chembra Peak Guided Trek",
                "name_ml": "ചേമ്പ്ര പീക്ക് ഗൈഡഡ് ട്രെക്ക്",
                "description_en": (
                    "A private guided trek to Chembra Peak leaving at 5 am to reach the summit "
                    "for sunrise. Includes packed Ayurvedic breakfast, walking poles, and a "
                    "certified forest guide. Return by 12 pm. Limited to 4 guests."
                ),
                "category": "adventure",
                "price_inr": 3500,
                "max_per_booking": 4,
                "display_order": 0,
            },
        ],
    },
]


# ── Seed functions ────────────────────────────────────────────────────────────

def seed_platform_experiences(session: Session) -> None:
    existing = session.execute(text("SELECT COUNT(*) FROM experiences")).scalar()
    if existing and existing > 0:
        print(f"  ✓ {existing} platform experiences already exist, skipping")
        return

    for exp in PLATFORM_EXPERIENCES:
        row_id = uuid.uuid4()
        session.execute(
            text("""
                INSERT INTO experiences (
                    id, name_en, name_ar, name_ml,
                    description_en,
                    category, lat, lng, district, region_label,
                    typical_duration_hours,
                    price_inr, is_free,
                    photos, external_url, is_active
                ) VALUES (
                    :id, :name_en, :name_ar, :name_ml,
                    :description_en,
                    :category, :lat, :lng, :district, :region_label,
                    :typical_duration_hours,
                    :price_inr, :is_free,
                    :photos, :external_url, true
                )
            """),
            {
                "id": str(row_id),
                "name_en": exp["name_en"],
                "name_ar": exp.get("name_ar"),
                "name_ml": exp.get("name_ml"),
                "description_en": exp.get("description_en"),
                "category": exp["category"],
                "lat": exp.get("lat"),
                "lng": exp.get("lng"),
                "district": exp.get("district"),
                "region_label": exp.get("region_label"),
                "typical_duration_hours": exp.get("typical_duration_hours"),
                "price_inr": exp.get("price_inr", 0),
                "is_free": exp.get("is_free", True),
                "photos": exp.get("photos", []),
                "external_url": exp.get("external_url"),
            },
        )

    print(f"  ✓ Seeded {len(PLATFORM_EXPERIENCES)} platform experiences")


def seed_clinic_experiences(session: Session) -> None:
    existing = session.execute(text("SELECT COUNT(*) FROM clinic_experiences")).scalar()
    if existing and existing > 0:
        print(f"  ✓ {existing} clinic add-on experiences already exist, skipping")
        return

    total = 0
    for template in CLINIC_ADDON_TEMPLATES:
        district = template["district"]
        # Pick the first active clinic from this district
        result = session.execute(
            text(
                "SELECT id FROM clinic_feature_store "
                "WHERE district = :d AND is_active = true ORDER BY tier DESC LIMIT 1"
            ),
            {"d": district},
        ).fetchone()
        if not result:
            print(f"  ⚠ No clinic found for district={district}, skipping add-ons")
            continue

        clinic_id = result[0]
        for addon in template["add_ons"]:
            session.execute(
                text("""
                    INSERT INTO clinic_experiences (
                        id, clinic_id,
                        name_en, name_ml,
                        description_en,
                        category, price_inr, max_per_booking,
                        display_order, is_active
                    ) VALUES (
                        :id, :clinic_id,
                        :name_en, :name_ml,
                        :description_en,
                        :category, :price_inr, :max_per_booking,
                        :display_order, true
                    )
                """),
                {
                    "id": str(uuid.uuid4()),
                    "clinic_id": str(clinic_id),
                    "name_en": addon["name_en"],
                    "name_ml": addon.get("name_ml"),
                    "description_en": addon["description_en"],
                    "category": addon["category"],
                    "price_inr": addon["price_inr"],
                    "max_per_booking": addon.get("max_per_booking", 2),
                    "display_order": addon.get("display_order", 0),
                },
            )
            total += 1

    print(f"  ✓ Seeded {total} clinic add-on experiences")


def reset_experiences(session: Session) -> None:
    print("  Resetting experience data...")
    session.execute(text("DELETE FROM booking_add_ons"))
    session.execute(text("DELETE FROM clinic_experiences"))
    session.execute(text("DELETE FROM experiences"))
    session.commit()
    print("  ✓ Reset complete")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Seed experiences into Vaidya DB")
    parser.add_argument("--reset", action="store_true", help="Clear experience tables first")
    args = parser.parse_args()

    print("🌿 Vaidya experiences seed script")
    print(f"  DB: {DATABASE_SYNC_URL.split('@')[-1]}")

    with Session(engine) as session:
        if args.reset:
            reset_experiences(session)

        seed_platform_experiences(session)
        seed_clinic_experiences(session)
        session.commit()

    total_platform = len(PLATFORM_EXPERIENCES)
    total_addons = sum(len(t["add_ons"]) for t in CLINIC_ADDON_TEMPLATES)
    print(f"\n✅ Done — {total_platform} platform experiences, {total_addons} clinic add-ons")


if __name__ == "__main__":
    main()
