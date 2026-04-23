#!/usr/bin/env python3
"""
scripts/seed_rooms.py — Seed room data for all clinics.

Tier-2 clinics: 4 room types  (Non-AC Standard, AC Standard, Deluxe AC, Suite)
Tier-1 clinics: 3 room types  (Non-AC Standard, AC Standard, Deluxe AC)

Idempotent: skips clinics that already have rooms.

Run from project root:
    python backend/scripts/seed_rooms.py
    python backend/scripts/seed_rooms.py --reset   # delete and re-seed
"""
import argparse
import os
import random
import socket
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# ── DB connection ──────────────────────────────────────────────────────────────
try:
    socket.gethostbyname("postgres")
    _DB_HOST = "postgres"
except socket.gaierror:
    _DB_HOST = "localhost"

DATABASE_SYNC_URL = os.getenv(
    "DATABASE_SYNC_URL",
    f"postgresql+psycopg2://vaidya:vaidya_dev@{_DB_HOST}:5432/vaidya",
)
engine = create_engine(DATABASE_SYNC_URL, echo=False)


# ── Photo helper ───────────────────────────────────────────────────────────────
def photo(seed: str, w: int = 1200, h: int = 800) -> str:
    return f"https://picsum.photos/seed/{seed}/{w}/{h}"


# ── Room templates per category ────────────────────────────────────────────────
# Each template has a name, description, amenities, photos, and max_occupancy.
# Prices are set per-clinic below based on tier + random variation.

NON_AC_TEMPLATES = [
    {
        "name": "Garden Cottage",
        "description": (
            "A cozy traditional Kerala cottage with teak wood ceiling, terracotta-tiled floors "
            "and direct access to the herb garden. Natural cross-ventilation keeps the space cool "
            "and aromatic. Ideal for guests who prefer an immersive, earthy experience."
        ),
        "amenities": ["Hot Water", "Private Bathroom", "Garden View", "Mosquito Net",
                      "Ayurvedic Toiletries", "Kettle", "Safe"],
        "photos": [photo("cottage1"), photo("nature1", 900, 600), photo("garden1", 900, 600)],
        "max_occupancy": 2,
    },
    {
        "name": "Forest Cottage",
        "description": (
            "Nestled in a canopy of banana, jackfruit and coconut trees, this non-AC cottage "
            "uses the natural forest breeze for ventilation. Locally sourced wooden furniture "
            "and woven coir mats create an authentic Kerala village feel."
        ),
        "amenities": ["Hot Water", "Private Bathroom", "Mosquito Net", "Ayurvedic Toiletries",
                      "Safe", "Kettle"],
        "photos": [photo("forest1"), photo("stone1", 900, 600), photo("nature2", 900, 600)],
        "max_occupancy": 2,
    },
    {
        "name": "Heritage Room",
        "description": (
            "Traditional Kerala room with antique carved-wood headboard, hand-woven cotton "
            "drapes and terracotta ventilation tiles. A sit-out veranda overlooks the "
            "medicinal plant garden — perfect for morning Pranayama."
        ),
        "amenities": ["Hot Water", "Private Bathroom", "Balcony", "Garden View",
                      "Mosquito Net", "Ayurvedic Toiletries", "Kettle"],
        "photos": [photo("heritage1"), photo("wood1", 900, 600), photo("palm1", 900, 600)],
        "max_occupancy": 2,
    },
]

AC_STANDARD_TEMPLATES = [
    {
        "name": "AC Standard Room",
        "description": (
            "Comfortable split-AC room blending modern conveniences with traditional Kerala décor. "
            "Features a king-size bed with Ayurvedic cotton mattress, en-suite bathroom with "
            "24-hour hot water, and a private sit-out overlooking the lotus pond."
        ),
        "amenities": ["Air Conditioning", "Hot Water", "Private Bathroom", "WiFi", "TV",
                      "Balcony", "Garden View", "Kettle", "Ayurvedic Toiletries", "Safe"],
        "photos": [photo("resort2"), photo("spa1", 900, 600), photo("lotus1", 900, 600)],
        "max_occupancy": 2,
    },
    {
        "name": "AC Garden Room",
        "description": (
            "Well-appointed air-conditioned room with a large bay window opening to a fragrant "
            "herb garden. Traditional Nattika wood furniture, Ayurvedic pillow menu, and premium "
            "copper-vessel hot water service."
        ),
        "amenities": ["Air Conditioning", "Hot Water", "Private Bathroom", "WiFi", "TV",
                      "Garden View", "Kettle", "Ayurvedic Toiletries", "Safe", "Hair Dryer"],
        "photos": [photo("spa2"), photo("resort1", 900, 600), photo("herbs1", 900, 600)],
        "max_occupancy": 2,
    },
    {
        "name": "Pool View AC Room",
        "description": (
            "Freshly renovated AC room with floor-to-ceiling glass doors opening to a private "
            "sit-out with views of the heated mineral pool. Rosewood furniture, Kerala mural art "
            "wall panel and Ayurvedic bedtime diffuser kit."
        ),
        "amenities": ["Air Conditioning", "Hot Water", "Private Bathroom", "WiFi", "TV",
                      "Balcony", "Mini Fridge", "Kettle", "Ayurvedic Toiletries", "Safe", "Hair Dryer"],
        "photos": [photo("pool1"), photo("spa3", 900, 600), photo("resort2", 900, 600)],
        "max_occupancy": 2,
    },
]

DELUXE_TEMPLATES = [
    {
        "name": "Deluxe Garden Suite",
        "description": (
            "Spacious deluxe suite with king-size hand-carved rosewood bed, private balcony "
            "surrounded by tropical garden, and a rain-shower bathroom with copper-inlaid tiles. "
            "Includes personalised in-room Abhyanga consultation and premium Kottakkal Arya "
            "Vaidya Sala herbal bath set."
        ),
        "amenities": ["Air Conditioning", "Hot Water", "Private Bathroom", "WiFi", "TV",
                      "Balcony", "Garden View", "Mini Fridge", "Kettle", "Room Service",
                      "Ayurvedic Toiletries", "Hair Dryer", "Safe"],
        "photos": [photo("villa1"), photo("garden2", 900, 600), photo("spa4", 900, 600)],
        "max_occupancy": 2,
    },
    {
        "name": "Deluxe Heritage Room",
        "description": (
            "Heritage-inspired deluxe room featuring antique teakwood furniture sourced from a "
            "19th-century Tharavad (ancestral home). The private balcony overlooks a 200-year-old "
            "jackfruit tree. Includes nightly herbal foot-soak kit and an Ayurvedic pillow menu."
        ),
        "amenities": ["Air Conditioning", "Hot Water", "Private Bathroom", "WiFi", "TV",
                      "Balcony", "Garden View", "Mini Fridge", "Kettle", "Room Service",
                      "Ayurvedic Toiletries", "Hair Dryer", "Safe"],
        "photos": [photo("heritage2"), photo("stone1", 900, 600), photo("resort3", 900, 600)],
        "max_occupancy": 2,
    },
    {
        "name": "Deluxe Forest View",
        "description": (
            "Set at the edge of the property's private forest patch, this airy deluxe room "
            "opens to a cantilevered balcony with uninterrupted treetop views. Walk-in wardrobe, "
            "freestanding copper bathtub, and a curated library of Ayurvedic texts included."
        ),
        "amenities": ["Air Conditioning", "Hot Water", "Private Bathroom", "WiFi", "TV",
                      "Balcony", "Mini Fridge", "Kettle", "Room Service",
                      "Ayurvedic Toiletries", "Hair Dryer", "Safe"],
        "photos": [photo("forest2"), photo("spa5", 900, 600), photo("nature3", 900, 600)],
        "max_occupancy": 2,
    },
]

SUITE_TEMPLATES = [
    {
        "name": "Royal Heritage Suite",
        "description": (
            "Our most coveted accommodation — a full heritage suite in a restored Kerala manor "
            "house. Features a separate drawing room with antique furniture, king-size four-poster "
            "bed, private plunge pool in a walled courtyard, and a dedicated Ayurvedic butler who "
            "coordinates all treatments and meal preferences. Breakfast, evening Ayurvedic herbal "
            "drink and daily housekeeping with floral turndown are included."
        ),
        "amenities": ["Air Conditioning", "Hot Water", "Private Bathroom", "WiFi", "TV",
                      "Balcony", "Garden View", "Sea View", "Mini Fridge", "Room Service",
                      "Kettle", "Ayurvedic Toiletries", "Hair Dryer", "Safe"],
        "photos": [photo("suite1"), photo("luxury1", 900, 600), photo("pool2", 900, 600)],
        "max_occupancy": 3,
    },
    {
        "name": "Forest Pool Suite",
        "description": (
            "Perched on a private hillock within the resort grounds, this secluded suite offers "
            "complete privacy with its own infinity plunge pool overlooking the forest canopy. "
            "Hand-block-printed Kerala murals, a private outdoor Ayurvedic steam room, and a "
            "dedicated wellness concierge make this the ultimate healing retreat."
        ),
        "amenities": ["Air Conditioning", "Hot Water", "Private Bathroom", "WiFi", "TV",
                      "Balcony", "Garden View", "Mini Fridge", "Room Service",
                      "Kettle", "Ayurvedic Toiletries", "Hair Dryer", "Safe"],
        "photos": [photo("villa2"), photo("pool3", 900, 600), photo("luxury2", 900, 600)],
        "max_occupancy": 3,
    },
    {
        "name": "Backwater Suite",
        "description": (
            "Floated at the edge of the clinic's private backwater arm, this over-water suite "
            "channels the calm of Kerala's kettuvallam houseboats. Thatched roof, bamboo walls "
            "with fine-mesh screens, a wraparound deck for sunrise meditation, and a glass floor "
            "panel that reveals the water below. Includes private cooking experience with "
            "Ayurvedic chef."
        ),
        "amenities": ["Air Conditioning", "Hot Water", "Private Bathroom", "WiFi", "TV",
                      "Balcony", "Sea View", "Mini Fridge", "Room Service",
                      "Kettle", "Ayurvedic Toiletries", "Hair Dryer", "Safe"],
        "photos": [photo("lake1"), photo("water1", 900, 600), photo("resort4", 900, 600)],
        "max_occupancy": 2,
    },
]


# ── Per-clinic room definitions ────────────────────────────────────────────────
# Each entry maps clinic slug → list of room dicts.
# Pricing is in INR per night.
# Photos use Picsum with contextual seeds.

CLINIC_ROOMS: dict[str, list[dict]] = {

    # ── TIER 2 CLINICS (4 room types each) ────────────────────────────────────

    "somatheeram-ayurvedic-village-thiruvananthapuram": [
        {"category": "non_ac", "price": 2200,
         "name": "Garden Cottage", "desc": NON_AC_TEMPLATES[0]["description"],
         "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("cottage1"), photo("palm1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 4800,
         "name": "AC Beach View Room", "desc": "Breezy AC room with partial view of the Arabian Sea through coconut groves. En-suite bathroom with hot water, television, and private sit-out for sunrise yoga.",
         "amenities": ["Air Conditioning", "Hot Water", "Private Bathroom", "WiFi", "TV", "Balcony", "Sea View", "Kettle", "Ayurvedic Toiletries", "Safe"], "photos": [photo("beach1"), photo("resort2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 8500,
         "name": "Deluxe Sea View Room", "desc": "Elevated deluxe room with panoramic Arabian Sea views from a wraparound balcony. King-size bed with organic cotton linen, copper rain-shower and nightly Ayurvedic turndown service.",
         "amenities": ["Air Conditioning", "Hot Water", "Private Bathroom", "WiFi", "TV", "Balcony", "Sea View", "Mini Fridge", "Kettle", "Room Service", "Ayurvedic Toiletries", "Hair Dryer", "Safe"], "photos": [photo("spa4"), photo("beach2", 900, 600), photo("resort3", 900, 600)], "occ": 2},
        {"category": "suite", "price": 16500,
         "name": "Royal Samudra Suite", "desc": SUITE_TEMPLATES[0]["description"],
         "amenities": SUITE_TEMPLATES[0]["amenities"], "photos": [photo("suite1"), photo("luxury1", 900, 600), photo("pool2", 900, 600)], "occ": 3},
    ],

    "kalari-kovilakom-heritage-palace-palakkad": [
        {"category": "non_ac", "price": 2800,
         "name": "Palace Cottage", "desc": "Authentically restored cottage within the 19th-century Kovilakom palace compound. Laterite stone walls, polished red oxide floors and traditional Kerala ventilation keep it naturally cool.",
         "amenities": NON_AC_TEMPLATES[2]["amenities"], "photos": [photo("heritage1"), photo("stone1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 6200,
         "name": "Heritage AC Room", "desc": "Restored palace room with period-appropriate teakwood four-poster bed, modern split AC, and en-suite bathroom with traditional copper fittings. Overlooks the royal garden courtyard.",
         "amenities": ["Air Conditioning", "Hot Water", "Private Bathroom", "WiFi", "TV", "Balcony", "Garden View", "Kettle", "Ayurvedic Toiletries", "Safe", "Hair Dryer"], "photos": [photo("heritage2"), photo("resort1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 11000,
         "name": "Deluxe Palace Suite", "desc": DELUXE_TEMPLATES[1]["description"],
         "amenities": DELUXE_TEMPLATES[1]["amenities"], "photos": [photo("heritage3"), photo("stone2", 900, 600), photo("luxury1", 900, 600)], "occ": 2},
        {"category": "suite", "price": 22000,
         "name": "Kovilakom Royal Suite", "desc": "The original royal bedchamber, meticulously restored and converted to a palatial suite. A hand-carved Kerala teak canopy bed, private walled garden with plunge pool, butler service, and access to the palace's exclusive Kerala manuscript library.",
         "amenities": SUITE_TEMPLATES[0]["amenities"], "photos": [photo("palace1"), photo("luxury2", 900, 600), photo("pool3", 900, 600)], "occ": 3},
    ],

    "kairali-ayurvedic-health-village-palakkad": [
        {"category": "non_ac", "price": 2400,
         "name": "Village Cottage", "desc": NON_AC_TEMPLATES[1]["description"],
         "amenities": NON_AC_TEMPLATES[1]["amenities"], "photos": [photo("cottage2"), photo("forest1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 5200,
         "name": "AC Garden Room", "desc": AC_STANDARD_TEMPLATES[1]["description"],
         "amenities": AC_STANDARD_TEMPLATES[1]["amenities"], "photos": [photo("resort2"), photo("herbs1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 9500,
         "name": "Deluxe Forest View", "desc": DELUXE_TEMPLATES[2]["description"],
         "amenities": DELUXE_TEMPLATES[2]["amenities"], "photos": [photo("forest2"), photo("spa4", 900, 600)], "occ": 2},
        {"category": "suite", "price": 18000,
         "name": "Forest Pool Suite", "desc": SUITE_TEMPLATES[1]["description"],
         "amenities": SUITE_TEMPLATES[1]["amenities"], "photos": [photo("villa2"), photo("pool3", 900, 600)], "occ": 3},
    ],

    "vaidyaratnam-ayurveda-village-thrissur": [
        {"category": "non_ac", "price": 2600,
         "name": "Tharavad Cottage", "desc": "Traditional Naalukettu-style cottage with an open central courtyard, surrounded by a fragrant tulsi and neem border. The handloom cotton furnishings and polished stone floors evoke an authentic 1920s Tharavad atmosphere.",
         "amenities": NON_AC_TEMPLATES[2]["amenities"], "photos": [photo("heritage1"), photo("nature1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 5800,
         "name": "AC Heritage Room", "desc": "Spacious AC room in the heritage wing with original Calicut tile flooring, brass oil lamps and contemporary en-suite bathroom. Overlooks the 150-year-old Pala tree under which morning meditation is held.",
         "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort1"), photo("spa2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 10500,
         "name": "Deluxe Ayurvana Suite", "desc": DELUXE_TEMPLATES[0]["description"],
         "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("garden2", 900, 600)], "occ": 2},
        {"category": "suite", "price": 20000,
         "name": "Vaidyaratnam Heritage Suite", "desc": "A curated suite in the original physician's quarters of the 1917 Vaidyaratnam mansion. Handmade Ettumanoor murals, private medicinal herb garden, a copper soaking tub and Kottakkal physician's letter archive displayed in a glass cabinet.",
         "amenities": SUITE_TEMPLATES[0]["amenities"], "photos": [photo("heritage4"), photo("luxury1", 900, 600)], "occ": 3},
    ],

    "athreya-ayurvedic-retreat-thrissur": [
        {"category": "non_ac", "price": 2000,
         "name": "Garden Cottage", "desc": NON_AC_TEMPLATES[0]["description"],
         "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("cottage1"), photo("garden1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 4500,
         "name": "AC Pool View Room", "desc": AC_STANDARD_TEMPLATES[2]["description"],
         "amenities": AC_STANDARD_TEMPLATES[2]["amenities"], "photos": [photo("pool1"), photo("resort2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 8000,
         "name": "Deluxe Garden Suite", "desc": DELUXE_TEMPLATES[0]["description"],
         "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("spa4", 900, 600)], "occ": 2},
        {"category": "suite", "price": 15000,
         "name": "Royal Heritage Suite", "desc": SUITE_TEMPLATES[0]["description"],
         "amenities": SUITE_TEMPLATES[0]["amenities"], "photos": [photo("suite1"), photo("luxury2", 900, 600)], "occ": 3},
    ],

    "arya-vaidya-sala-retreat-malappuram": [
        {"category": "non_ac", "price": 1800,
         "name": "Heritage Cottage", "desc": NON_AC_TEMPLATES[2]["description"],
         "amenities": NON_AC_TEMPLATES[2]["amenities"], "photos": [photo("heritage1"), photo("palm1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 4200,
         "name": "AC Standard Room", "desc": AC_STANDARD_TEMPLATES[0]["description"],
         "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("spa1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 7800,
         "name": "Deluxe Heritage Room", "desc": DELUXE_TEMPLATES[1]["description"],
         "amenities": DELUXE_TEMPLATES[1]["amenities"], "photos": [photo("heritage2"), photo("stone1", 900, 600)], "occ": 2},
        {"category": "suite", "price": 15500,
         "name": "Arya Heritage Suite", "desc": SUITE_TEMPLATES[0]["description"],
         "amenities": SUITE_TEMPLATES[0]["amenities"], "photos": [photo("heritage3"), photo("luxury1", 900, 600)], "occ": 3},
    ],

    "poovar-island-ayurveda-resort-thiruvananthapuram": [
        {"category": "non_ac", "price": 2500,
         "name": "Island Cottage", "desc": "A secluded cottage on the island's interior, shaded by coconut palms and surrounded by brackish water channels. Thatched roof, coir flooring and natural breeze through the palm fronds make it naturally cool.",
         "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("palm1"), photo("island1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 5500,
         "name": "Backwater AC Room", "desc": "Peaceful AC room on stilts over the backwater channel, with a private deck for fishing or watching the migratory birds. Fully equipped with WiFi, television and premium toiletries.",
         "amenities": ["Air Conditioning", "Hot Water", "Private Bathroom", "WiFi", "TV", "Balcony", "Sea View", "Kettle", "Ayurvedic Toiletries", "Safe"], "photos": [photo("lake1"), photo("resort2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 10000,
         "name": "Deluxe Floating Chalet", "desc": "A luxury chalet built entirely over the backwaters. The glass floor panel reveals fish and water-lily beds beneath. King-size bed, private sun deck, telescopic star-gazing kit and Ayurvedic mini-bar.",
         "amenities": DELUXE_TEMPLATES[0]["amenities"] + ["Sea View"], "photos": [photo("lake2"), photo("water1", 900, 600), photo("resort3", 900, 600)], "occ": 2},
        {"category": "suite", "price": 19500,
         "name": "Poovar Backwater Suite", "desc": SUITE_TEMPLATES[2]["description"],
         "amenities": SUITE_TEMPLATES[2]["amenities"], "photos": [photo("lake1"), photo("water2", 900, 600), photo("luxury1", 900, 600)], "occ": 2},
    ],

    "kalari-rasayana-retreat-thiruvananthapuram": [
        {"category": "non_ac", "price": 2100,
         "name": "Mud-Wall Cottage", "desc": "Eco-cottage built with traditional mud-plaster walls and thatched Arecanut leaf roof. Natural insulation keeps it cool; the outdoor shower is surrounded by banana and jackfruit trees.",
         "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("cottage1"), photo("nature2", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 4600,
         "name": "Rasayana AC Room", "desc": AC_STANDARD_TEMPLATES[0]["description"],
         "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("spa2"), photo("resort1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 8500,
         "name": "Deluxe Kalari Suite", "desc": "Named after the ancient Kerala martial art, this suite features combat-art-inspired décor, a private open-air Kalari practice space, and a therapeutic copper-vessel bathtub for post-treatment recovery.",
         "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("spa4", 900, 600)], "occ": 2},
        {"category": "suite", "price": 17000,
         "name": "Grand Rasayana Suite", "desc": SUITE_TEMPLATES[1]["description"],
         "amenities": SUITE_TEMPLATES[1]["amenities"], "photos": [photo("villa2"), photo("luxury2", 900, 600)], "occ": 3},
    ],

    "wayanad-forest-ayurveda-retreat-wayanad": [
        {"category": "non_ac", "price": 2300,
         "name": "Tree-House Cottage", "desc": "Perched 8 feet above the forest floor on treated bamboo stilts, this cottage gives you unobstructed views of Wayanad's cardamom and coffee plantation. Wake to the calls of the Malabar Giant Squirrel.",
         "amenities": NON_AC_TEMPLATES[1]["amenities"], "photos": [photo("forest1"), photo("nature3", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 5000,
         "name": "Forest AC Room", "desc": "Cosy AC room with floor-to-ceiling windows framing the dense Wayanad forest. Locally sourced bamboo furniture, hand-loomed bedspreads dyed with Indigo from the retreat's own farm.",
         "amenities": ["Air Conditioning", "Hot Water", "Private Bathroom", "WiFi", "TV", "Balcony", "Garden View", "Kettle", "Ayurvedic Toiletries", "Safe"], "photos": [photo("forest2"), photo("resort2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 9200,
         "name": "Deluxe Jungle Suite", "desc": "Spacious suite with split AC, a private plunge pool filled with spring water, and a reading nook with a curated library of Kerala's forest ecology and Ayurvedic texts. Evening tribal folk-art session included.",
         "amenities": DELUXE_TEMPLATES[2]["amenities"], "photos": [photo("forest3"), photo("spa5", 900, 600), photo("nature4", 900, 600)], "occ": 2},
        {"category": "suite", "price": 18500,
         "name": "Wayanad Wilderness Suite", "desc": SUITE_TEMPLATES[1]["description"],
         "amenities": SUITE_TEMPLATES[1]["amenities"], "photos": [photo("villa2"), photo("forest4", 900, 600), photo("pool3", 900, 600)], "occ": 3},
    ],

    "dhanwantari-heritage-wellness-kottayam": [
        {"category": "non_ac", "price": 2000,
         "name": "Rubber Estate Cottage", "desc": "Surrounded by Kottayam's iconic rubber plantations, this cottage uses the natural shade and humidity-controlled ventilation to remain cool. Red oxide floors, cane furniture and hand-stitched Kerala kantha quilts.",
         "amenities": NON_AC_TEMPLATES[2]["amenities"], "photos": [photo("cottage2"), photo("nature1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 4400,
         "name": "Heritage AC Room", "desc": AC_STANDARD_TEMPLATES[1]["description"],
         "amenities": AC_STANDARD_TEMPLATES[1]["amenities"], "photos": [photo("heritage1"), photo("resort1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 8200,
         "name": "Deluxe Heritage Room", "desc": DELUXE_TEMPLATES[1]["description"],
         "amenities": DELUXE_TEMPLATES[1]["amenities"], "photos": [photo("heritage2"), photo("resort3", 900, 600)], "occ": 2},
        {"category": "suite", "price": 16000,
         "name": "Dhanwantari Heritage Suite", "desc": "Occupying the restored 1890 Dhanwantari physician's bungalow, this suite retains original Burma teak floors, colonial-era medicine cabinet, and a private verandah with rubber plantation views.",
         "amenities": SUITE_TEMPLATES[0]["amenities"], "photos": [photo("heritage4"), photo("luxury1", 900, 600)], "occ": 3},
    ],

    "santhigiri-holistic-health-village-thiruvananthapuram": [
        {"category": "non_ac", "price": 1900,
         "name": "Ashram Cottage", "desc": "Simple, peaceful cottage in the spirit of an Ashram setting. Smooth lime-plastered walls, dhurrie rugs and copper water vessels encourage a contemplative, unhurried pace.",
         "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("cottage1"), photo("temple1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 4200,
         "name": "AC Comfort Room", "desc": AC_STANDARD_TEMPLATES[0]["description"],
         "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("spa1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 7800,
         "name": "Deluxe Garden Suite", "desc": DELUXE_TEMPLATES[0]["description"],
         "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("garden2", 900, 600)], "occ": 2},
        {"category": "suite", "price": 15500,
         "name": "Santhigiri Meditation Suite", "desc": "A serene suite designed for deep contemplative retreat. Private meditation hall with Tibetan singing bowls, dedicated yoga terrace, Sattvic meal service and access to the Santhigiri elder spiritual counsel.",
         "amenities": SUITE_TEMPLATES[0]["amenities"], "photos": [photo("meditate1"), photo("luxury1", 900, 600)], "occ": 2},
    ],

    "nagarjuna-ayurvedic-village-ernakulam": [
        {"category": "non_ac", "price": 2200,
         "name": "Village Cottage", "desc": NON_AC_TEMPLATES[1]["description"],
         "amenities": NON_AC_TEMPLATES[1]["amenities"], "photos": [photo("cottage2"), photo("nature2", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 4800,
         "name": "AC Garden Room", "desc": AC_STANDARD_TEMPLATES[1]["description"],
         "amenities": AC_STANDARD_TEMPLATES[1]["amenities"], "photos": [photo("resort2"), photo("herbs1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 9000,
         "name": "Deluxe Ayurvana Room", "desc": DELUXE_TEMPLATES[0]["description"],
         "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("spa4", 900, 600)], "occ": 2},
        {"category": "suite", "price": 17500,
         "name": "Nagarjuna Premium Suite", "desc": SUITE_TEMPLATES[1]["description"],
         "amenities": SUITE_TEMPLATES[1]["amenities"], "photos": [photo("villa2"), photo("pool3", 900, 600)], "occ": 3},
    ],

    "malabar-heritage-wellness-retreat-kozhikode": [
        {"category": "non_ac", "price": 2100,
         "name": "Spice Garden Cottage", "desc": "Surrounded by the retreat's working spice farm — pepper, cardamom, turmeric and ginger. The scent of drying spices drifts through the louvred windows and the breeze is cool year-round.",
         "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("spice1"), photo("nature1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 4600,
         "name": "AC Heritage Room", "desc": "Restored Zamorin-era room with Calicut tile flooring, brass door fittings and a private courtyard with a traditional well. AC comfort meets Malabar heritage architecture.",
         "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("heritage1"), photo("resort2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 8600,
         "name": "Deluxe Malabar Suite", "desc": "Generous deluxe suite with hand-painted Malabar tile art panels, a private balcony overlooking the Kozhikode spice fields and a copper soaking tub with infused Ayurvedic water.",
         "amenities": DELUXE_TEMPLATES[1]["amenities"], "photos": [photo("heritage2"), photo("spa4", 900, 600)], "occ": 2},
        {"category": "suite", "price": 16500,
         "name": "Zamorin Heritage Suite", "desc": "Named after the legendary Zamorin rulers of Kozhikode, this top-floor suite commands views over the spice farms to the distant Western Ghats. Original Samoothiri Palace artefacts, a private Malabar cooking class with the head chef, and complimentary spice basket.",
         "amenities": SUITE_TEMPLATES[0]["amenities"], "photos": [photo("heritage4"), photo("luxury1", 900, 600)], "occ": 3},
    ],

    "backwaters-ayurveda-village-alappuzha": [
        {"category": "non_ac", "price": 1900,
         "name": "Backwater Cottage", "desc": "Thatched bamboo cottage at the water's edge, accessible only by a narrow plank bridge. The houseboat-inspired interiors — woven cane walls, brass oil lamps — create a true Alappuzha experience.",
         "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("lake1"), photo("palm1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 4200,
         "name": "Backwater AC Room", "desc": "Modern AC room with panoramic backwater views from a wraparound timber deck. Locally woven bamboo ceiling fans, copper-vessel bathroom and sunset canoe ride included.",
         "amenities": ["Air Conditioning", "Hot Water", "Private Bathroom", "WiFi", "TV", "Balcony", "Sea View", "Kettle", "Ayurvedic Toiletries", "Safe"], "photos": [photo("lake2"), photo("resort2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 7800,
         "name": "Deluxe Houseboat Suite", "desc": "Modelled on a premium kettuvallam, this land-based suite mimics every detail of a luxury houseboat — cane furniture, skylight ceiling, private deck on the water, and a personalised backwater village tour.",
         "amenities": DELUXE_TEMPLATES[0]["amenities"] + ["Sea View"], "photos": [photo("lake3"), photo("water1", 900, 600), photo("resort3", 900, 600)], "occ": 2},
        {"category": "suite", "price": 15000,
         "name": "Alappuzha Backwater Suite", "desc": SUITE_TEMPLATES[2]["description"],
         "amenities": SUITE_TEMPLATES[2]["amenities"], "photos": [photo("lake1"), photo("luxury1", 900, 600)], "occ": 2},
    ],

    "kannur-heritage-ayurveda-resort-kannur": [
        {"category": "non_ac", "price": 1800,
         "name": "Heritage Cottage", "desc": NON_AC_TEMPLATES[2]["description"],
         "amenities": NON_AC_TEMPLATES[2]["amenities"], "photos": [photo("heritage1"), photo("palm1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 4000,
         "name": "AC Standard Room", "desc": "Well-appointed AC room with Kannur handloom cotton furnishings — the district is Kerala's weaving capital. Private balcony with views of the resort's coconut grove.",
         "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("spa2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 7500,
         "name": "Deluxe Garden Room", "desc": DELUXE_TEMPLATES[0]["description"],
         "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("garden2", 900, 600)], "occ": 2},
        {"category": "suite", "price": 14500,
         "name": "Kannur Royal Suite", "desc": "A heritage suite inspired by Kannur's coastal fort architecture. Private sea-facing terrace, Theyyam art display, handloom four-poster bed and complimentary rice-boat sunset cruise on the Valapattanam river.",
         "amenities": SUITE_TEMPLATES[0]["amenities"] + ["Sea View"], "photos": [photo("heritage3"), photo("beach1", 900, 600), photo("luxury1", 900, 600)], "occ": 3},
    ],

    # ── TIER 1 CLINICS (3 room types each) ────────────────────────────────────

    "bala-wellness-retreat-kasaragod": [
        {"category": "non_ac", "price": 1400, "name": "Garden Cottage", "desc": NON_AC_TEMPLATES[0]["description"], "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("cottage1"), photo("nature1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2800, "name": "AC Standard Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("spa1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5200, "name": "Deluxe Garden Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("spa4", 900, 600)], "occ": 2},
    ],

    "nirmala-healing-retreat-kollam": [
        {"category": "non_ac", "price": 1300, "name": "Forest Cottage", "desc": NON_AC_TEMPLATES[1]["description"], "amenities": NON_AC_TEMPLATES[1]["amenities"], "photos": [photo("forest1"), photo("nature2", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2600, "name": "AC Garden Room", "desc": AC_STANDARD_TEMPLATES[1]["description"], "amenities": AC_STANDARD_TEMPLATES[1]["amenities"], "photos": [photo("resort2"), photo("herbs1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 4800, "name": "Deluxe Heritage Room", "desc": DELUXE_TEMPLATES[1]["description"], "amenities": DELUXE_TEMPLATES[1]["amenities"], "photos": [photo("heritage2"), photo("stone1", 900, 600)], "occ": 2},
    ],

    "agni-healing-retreat-idukki": [
        {"category": "non_ac", "price": 1200, "name": "Hilltop Cottage", "desc": "Perched at 900m altitude in Idukki's cardamom hills, this airy cottage needs no AC — the mountain breeze keeps it at a constant 22°C. Sunrise views of the mist-covered valley are spectacular.", "amenities": NON_AC_TEMPLATES[1]["amenities"], "photos": [photo("forest1"), photo("nature3", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2500, "name": "AC Mountain Room", "desc": "Warm AC room for cooler Idukki evenings, with panoramic hill station views from a wrap-around balcony. Locally crafted bamboo furniture and mountain-spring hot water.", "amenities": AC_STANDARD_TEMPLATES[1]["amenities"], "photos": [photo("resort2"), photo("nature4", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 4600, "name": "Deluxe Forest View", "desc": DELUXE_TEMPLATES[2]["description"], "amenities": DELUXE_TEMPLATES[2]["amenities"], "photos": [photo("forest2"), photo("spa5", 900, 600)], "occ": 2},
    ],

    "amrita-ayurveda-retreat-pathanamthitta": [
        {"category": "non_ac", "price": 1300, "name": "Garden Cottage", "desc": NON_AC_TEMPLATES[0]["description"], "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("cottage1"), photo("garden1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2700, "name": "AC Standard Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("spa1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5000, "name": "Deluxe Garden Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("garden2", 900, 600)], "occ": 2},
    ],

    "chandra-wellness-resort-pathanamthitta": [
        {"category": "non_ac", "price": 1400, "name": "Heritage Cottage", "desc": NON_AC_TEMPLATES[2]["description"], "amenities": NON_AC_TEMPLATES[2]["amenities"], "photos": [photo("heritage1"), photo("nature1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2900, "name": "AC Heritage Room", "desc": AC_STANDARD_TEMPLATES[1]["description"], "amenities": AC_STANDARD_TEMPLATES[1]["amenities"], "photos": [photo("resort1"), photo("spa2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5400, "name": "Deluxe Heritage Room", "desc": DELUXE_TEMPLATES[1]["description"], "amenities": DELUXE_TEMPLATES[1]["amenities"], "photos": [photo("heritage2"), photo("resort3", 900, 600)], "occ": 2},
    ],

    "tridosha-wellness-retreat-malappuram": [
        {"category": "non_ac", "price": 1200, "name": "Garden Cottage", "desc": NON_AC_TEMPLATES[0]["description"], "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("cottage1"), photo("nature1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2600, "name": "AC Standard Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("spa1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 4900, "name": "Deluxe Garden Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("spa4", 900, 600)], "occ": 2},
    ],

    "nirmala-ayurvedic-village-kottayam": [
        {"category": "non_ac", "price": 1300, "name": "Village Cottage", "desc": NON_AC_TEMPLATES[1]["description"], "amenities": NON_AC_TEMPLATES[1]["amenities"], "photos": [photo("cottage2"), photo("forest1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2700, "name": "AC Garden Room", "desc": AC_STANDARD_TEMPLATES[1]["description"], "amenities": AC_STANDARD_TEMPLATES[1]["amenities"], "photos": [photo("resort2"), photo("herbs1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5000, "name": "Deluxe Forest View", "desc": DELUXE_TEMPLATES[2]["description"], "amenities": DELUXE_TEMPLATES[2]["amenities"], "photos": [photo("forest2"), photo("spa5", 900, 600)], "occ": 2},
    ],

    "ashoka-heritage-ayurveda-thrissur": [
        {"category": "non_ac", "price": 1400, "name": "Heritage Cottage", "desc": NON_AC_TEMPLATES[2]["description"], "amenities": NON_AC_TEMPLATES[2]["amenities"], "photos": [photo("heritage1"), photo("palm1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2900, "name": "AC Heritage Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort1"), photo("spa2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5300, "name": "Deluxe Heritage Room", "desc": DELUXE_TEMPLATES[1]["description"], "amenities": DELUXE_TEMPLATES[1]["amenities"], "photos": [photo("heritage2"), photo("stone1", 900, 600)], "occ": 2},
    ],

    "sukha-ayurveda-sanctuary-wayanad": [
        {"category": "non_ac", "price": 1500, "name": "Tree-House Cottage", "desc": "Elevated bamboo cottage among Wayanad's coffee estates. Natural ventilation from the plantation breeze keeps temperatures ideal. Binoculars provided for bird-watching.", "amenities": NON_AC_TEMPLATES[1]["amenities"], "photos": [photo("forest1"), photo("nature3", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 3100, "name": "AC Forest Room", "desc": AC_STANDARD_TEMPLATES[1]["description"], "amenities": AC_STANDARD_TEMPLATES[1]["amenities"], "photos": [photo("forest2"), photo("resort2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5800, "name": "Deluxe Jungle Suite", "desc": DELUXE_TEMPLATES[2]["description"], "amenities": DELUXE_TEMPLATES[2]["amenities"], "photos": [photo("forest3"), photo("spa5", 900, 600)], "occ": 2},
    ],

    "elixir-panchakarma-retreat-thiruvananthapuram": [
        {"category": "non_ac", "price": 1300, "name": "Garden Cottage", "desc": NON_AC_TEMPLATES[0]["description"], "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("cottage1"), photo("garden1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2700, "name": "AC Standard Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("spa1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5100, "name": "Deluxe Garden Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("garden2", 900, 600)], "occ": 2},
    ],

    "prana-wellness-sanctuary-kozhikode": [
        {"category": "non_ac", "price": 1300, "name": "Spice Cottage", "desc": NON_AC_TEMPLATES[0]["description"], "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("spice1"), photo("nature1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2700, "name": "AC Comfort Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("spa1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5000, "name": "Deluxe Malabar Room", "desc": DELUXE_TEMPLATES[1]["description"], "amenities": DELUXE_TEMPLATES[1]["amenities"], "photos": [photo("heritage2"), photo("resort3", 900, 600)], "occ": 2},
    ],

    "surya-ayurvedic-village-thiruvananthapuram": [
        {"category": "non_ac", "price": 1400, "name": "Garden Cottage", "desc": NON_AC_TEMPLATES[0]["description"], "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("cottage1"), photo("nature1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2900, "name": "AC Standard Room", "desc": AC_STANDARD_TEMPLATES[2]["description"], "amenities": AC_STANDARD_TEMPLATES[2]["amenities"], "photos": [photo("pool1"), photo("resort2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5400, "name": "Deluxe Garden Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("spa4", 900, 600)], "occ": 2},
    ],

    "vedic-wellness-resort-ernakulam": [
        {"category": "non_ac", "price": 1500, "name": "Village Cottage", "desc": NON_AC_TEMPLATES[1]["description"], "amenities": NON_AC_TEMPLATES[1]["amenities"], "photos": [photo("cottage2"), photo("forest1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 3000, "name": "AC Garden Room", "desc": AC_STANDARD_TEMPLATES[1]["description"], "amenities": AC_STANDARD_TEMPLATES[1]["amenities"], "photos": [photo("resort2"), photo("herbs1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5600, "name": "Deluxe Vedic Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("garden2", 900, 600)], "occ": 2},
    ],

    "ashoka-ayurveda-retreat-kottayam": [
        {"category": "non_ac", "price": 1300, "name": "Heritage Cottage", "desc": NON_AC_TEMPLATES[2]["description"], "amenities": NON_AC_TEMPLATES[2]["amenities"], "photos": [photo("heritage1"), photo("palm1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2700, "name": "AC Heritage Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort1"), photo("spa2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5000, "name": "Deluxe Heritage Room", "desc": DELUXE_TEMPLATES[1]["description"], "amenities": DELUXE_TEMPLATES[1]["amenities"], "photos": [photo("heritage2"), photo("stone1", 900, 600)], "occ": 2},
    ],

    "panchabhoota-ayurvedic-village-kozhikode": [
        {"category": "non_ac", "price": 1200, "name": "Garden Cottage", "desc": NON_AC_TEMPLATES[0]["description"], "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("cottage1"), photo("nature1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2600, "name": "AC Standard Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("spa1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 4800, "name": "Deluxe Malabar Room", "desc": DELUXE_TEMPLATES[1]["description"], "amenities": DELUXE_TEMPLATES[1]["amenities"], "photos": [photo("heritage2"), photo("stone1", 900, 600)], "occ": 2},
    ],

    "ojas-ayurveda-retreat-kannur": [
        {"category": "non_ac", "price": 1300, "name": "Spice Cottage", "desc": NON_AC_TEMPLATES[0]["description"], "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("spice1"), photo("nature1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2700, "name": "AC Standard Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("spa1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5000, "name": "Deluxe Garden Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("spa4", 900, 600)], "occ": 2},
    ],

    "brahma-wellness-retreat-idukki": [
        {"category": "non_ac", "price": 1200, "name": "Hilltop Cottage", "desc": "High-altitude cottage in Idukki's misty hills. Permanent cool breeze negates AC. Morning cloud-sea visible from the sit-out between October and February.", "amenities": NON_AC_TEMPLATES[1]["amenities"], "photos": [photo("forest1"), photo("nature3", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2500, "name": "AC Mountain Room", "desc": AC_STANDARD_TEMPLATES[1]["description"], "amenities": AC_STANDARD_TEMPLATES[1]["amenities"], "photos": [photo("resort2"), photo("nature4", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 4700, "name": "Deluxe Forest Suite", "desc": DELUXE_TEMPLATES[2]["description"], "amenities": DELUXE_TEMPLATES[2]["amenities"], "photos": [photo("forest2"), photo("spa5", 900, 600)], "occ": 2},
    ],

    "prana-nature-retreat-thrissur": [
        {"category": "non_ac", "price": 1300, "name": "Garden Cottage", "desc": NON_AC_TEMPLATES[0]["description"], "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("cottage1"), photo("garden1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2700, "name": "AC Comfort Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("spa1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5000, "name": "Deluxe Garden Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("garden2", 900, 600)], "occ": 2},
    ],

    "sukha-wellness-resort-palakkad": [
        {"category": "non_ac", "price": 1400, "name": "Village Cottage", "desc": NON_AC_TEMPLATES[1]["description"], "amenities": NON_AC_TEMPLATES[1]["amenities"], "photos": [photo("cottage2"), photo("forest1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2900, "name": "AC Garden Room", "desc": AC_STANDARD_TEMPLATES[1]["description"], "amenities": AC_STANDARD_TEMPLATES[1]["amenities"], "photos": [photo("resort2"), photo("herbs1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5300, "name": "Deluxe Forest View", "desc": DELUXE_TEMPLATES[2]["description"], "amenities": DELUXE_TEMPLATES[2]["amenities"], "photos": [photo("forest2"), photo("spa5", 900, 600)], "occ": 2},
    ],

    "elixir-wellness-retreat-alappuzha": [
        {"category": "non_ac", "price": 1400, "name": "Backwater Cottage", "desc": "Thatched cottage at the edge of Alappuzha's canal network. Natural breeze from the backwaters, coir flooring and brass-lamp lighting create an authentic Kuttanad ambience.", "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("lake1"), photo("palm1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2900, "name": "AC Backwater Room", "desc": "Air-conditioned room with floor-to-ceiling windows overlooking the Alappuzha canals. Evening canoe ride included.", "amenities": AC_STANDARD_TEMPLATES[0]["amenities"] + ["Sea View"], "photos": [photo("lake2"), photo("resort2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5400, "name": "Deluxe Canal Suite", "desc": "Spacious deluxe suite with a private deck over the canal, copper soaking tub and personalised backwater ecology walk.", "amenities": DELUXE_TEMPLATES[0]["amenities"] + ["Sea View"], "photos": [photo("lake3"), photo("resort3", 900, 600)], "occ": 2},
    ],

    "indra-heritage-ayurveda-alappuzha": [
        {"category": "non_ac", "price": 1500, "name": "Canal Cottage", "desc": NON_AC_TEMPLATES[0]["description"], "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("lake1"), photo("palm1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 3000, "name": "AC Backwater Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("lake2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5600, "name": "Deluxe Heritage Suite", "desc": DELUXE_TEMPLATES[1]["description"], "amenities": DELUXE_TEMPLATES[1]["amenities"], "photos": [photo("heritage2"), photo("resort3", 900, 600)], "occ": 2},
    ],

    "sapta-nature-retreat-wayanad": [
        {"category": "non_ac", "price": 1400, "name": "Forest Cottage", "desc": NON_AC_TEMPLATES[1]["description"], "amenities": NON_AC_TEMPLATES[1]["amenities"], "photos": [photo("forest1"), photo("nature2", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2900, "name": "AC Forest Room", "desc": AC_STANDARD_TEMPLATES[1]["description"], "amenities": AC_STANDARD_TEMPLATES[1]["amenities"], "photos": [photo("forest2"), photo("resort2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5400, "name": "Deluxe Jungle Suite", "desc": DELUXE_TEMPLATES[2]["description"], "amenities": DELUXE_TEMPLATES[2]["amenities"], "photos": [photo("forest3"), photo("spa5", 900, 600)], "occ": 2},
    ],

    "ashtanga-wellness-resort-kannur": [
        {"category": "non_ac", "price": 1300, "name": "Garden Cottage", "desc": NON_AC_TEMPLATES[0]["description"], "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("cottage1"), photo("nature1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2700, "name": "AC Standard Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("spa1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5000, "name": "Deluxe Garden Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("garden2", 900, 600)], "occ": 2},
    ],

    "brahma-panchakarma-retreat-palakkad": [
        {"category": "non_ac", "price": 1300, "name": "Village Cottage", "desc": NON_AC_TEMPLATES[1]["description"], "amenities": NON_AC_TEMPLATES[1]["amenities"], "photos": [photo("cottage2"), photo("forest1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2700, "name": "AC Garden Room", "desc": AC_STANDARD_TEMPLATES[1]["description"], "amenities": AC_STANDARD_TEMPLATES[1]["amenities"], "photos": [photo("resort2"), photo("herbs1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5000, "name": "Deluxe Garden Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("spa4", 900, 600)], "occ": 2},
    ],

    "varuna-panchakarma-retreat-kottayam": [
        {"category": "non_ac", "price": 1400, "name": "Riverside Cottage", "desc": "Set beside a tributary of the Meenachil river, this cottage channels Kerala's backwater culture. Clay-pot water filter, hand-block-printed cotton curtains and sunset boat rides.", "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("lake1"), photo("nature1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2900, "name": "AC Riverside Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("lake2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5300, "name": "Deluxe River Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"] + ["Sea View"], "photos": [photo("villa1"), photo("lake3", 900, 600)], "occ": 2},
    ],

    "lakshmi-ayurvedic-village-ernakulam": [
        {"category": "non_ac", "price": 1400, "name": "Garden Cottage", "desc": NON_AC_TEMPLATES[0]["description"], "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("cottage1"), photo("garden1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2900, "name": "AC Standard Room", "desc": AC_STANDARD_TEMPLATES[2]["description"], "amenities": AC_STANDARD_TEMPLATES[2]["amenities"], "photos": [photo("pool1"), photo("resort2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5300, "name": "Deluxe Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("spa4", 900, 600)], "occ": 2},
    ],

    "pitta-ayurveda-sanctuary-thrissur": [
        {"category": "non_ac", "price": 1300, "name": "Heritage Cottage", "desc": NON_AC_TEMPLATES[2]["description"], "amenities": NON_AC_TEMPLATES[2]["amenities"], "photos": [photo("heritage1"), photo("palm1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2700, "name": "AC Heritage Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort1"), photo("spa2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5000, "name": "Deluxe Heritage Suite", "desc": DELUXE_TEMPLATES[1]["description"], "amenities": DELUXE_TEMPLATES[1]["amenities"], "photos": [photo("heritage2"), photo("stone1", 900, 600)], "occ": 2},
    ],

    "lakshmi-healing-retreat-malappuram": [
        {"category": "non_ac", "price": 1200, "name": "Garden Cottage", "desc": NON_AC_TEMPLATES[0]["description"], "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("cottage1"), photo("nature1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2500, "name": "AC Standard Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("spa1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 4700, "name": "Deluxe Garden Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("garden2", 900, 600)], "occ": 2},
    ],

    "amrita-heritage-ayurveda-kasaragod": [
        {"category": "non_ac", "price": 1300, "name": "Heritage Cottage", "desc": NON_AC_TEMPLATES[2]["description"], "amenities": NON_AC_TEMPLATES[2]["amenities"], "photos": [photo("heritage1"), photo("nature1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2700, "name": "AC Standard Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("spa1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5000, "name": "Deluxe Garden Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("spa4", 900, 600)], "occ": 2},
    ],

    "suvarna-wellness-sanctuary-pathanamthitta": [
        {"category": "non_ac", "price": 1300, "name": "Garden Cottage", "desc": NON_AC_TEMPLATES[0]["description"], "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("cottage1"), photo("garden1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2700, "name": "AC Standard Room", "desc": AC_STANDARD_TEMPLATES[1]["description"], "amenities": AC_STANDARD_TEMPLATES[1]["amenities"], "photos": [photo("resort2"), photo("herbs1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5000, "name": "Deluxe Garden Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("garden2", 900, 600)], "occ": 2},
    ],

    "vedic-ayurveda-sanctuary-alappuzha": [
        {"category": "non_ac", "price": 1400, "name": "Backwater Cottage", "desc": NON_AC_TEMPLATES[0]["description"], "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("lake1"), photo("palm1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2900, "name": "AC Backwater Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"] + ["Sea View"], "photos": [photo("lake2"), photo("resort2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5400, "name": "Deluxe Canal Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"] + ["Sea View"], "photos": [photo("lake3"), photo("spa4", 900, 600)], "occ": 2},
    ],

    "soma-nature-retreat-kollam": [
        {"category": "non_ac", "price": 1200, "name": "Forest Cottage", "desc": NON_AC_TEMPLATES[1]["description"], "amenities": NON_AC_TEMPLATES[1]["amenities"], "photos": [photo("forest1"), photo("nature2", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2600, "name": "AC Standard Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("spa1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 4900, "name": "Deluxe Forest Suite", "desc": DELUXE_TEMPLATES[2]["description"], "amenities": DELUXE_TEMPLATES[2]["amenities"], "photos": [photo("forest2"), photo("spa5", 900, 600)], "occ": 2},
    ],

    "suvarna-nature-retreat-idukki": [
        {"category": "non_ac", "price": 1200, "name": "Hilltop Cottage", "desc": "Nestled in Idukki's tea estates at 1,100m altitude. Crisp mountain air keeps it naturally cool year-round. Waking to mist-wrapped tea bushes and bird calls is the daily morning ritual.", "amenities": NON_AC_TEMPLATES[1]["amenities"], "photos": [photo("forest1"), photo("nature3", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2500, "name": "AC Hill Room", "desc": "Warm AC room for cool Idukki nights, with a wood-burning stove option in winter. Mountain-spring hot water, wool-blend blankets and panoramic hill views.", "amenities": AC_STANDARD_TEMPLATES[1]["amenities"], "photos": [photo("resort2"), photo("nature4", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 4700, "name": "Deluxe Hill Suite", "desc": DELUXE_TEMPLATES[2]["description"], "amenities": DELUXE_TEMPLATES[2]["amenities"], "photos": [photo("forest3"), photo("nature5", 900, 600)], "occ": 2},
    ],

    "kapha-ayurveda-retreat-palakkad": [
        {"category": "non_ac", "price": 1300, "name": "Village Cottage", "desc": NON_AC_TEMPLATES[1]["description"], "amenities": NON_AC_TEMPLATES[1]["amenities"], "photos": [photo("cottage2"), photo("forest1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2700, "name": "AC Standard Room", "desc": AC_STANDARD_TEMPLATES[0]["description"], "amenities": AC_STANDARD_TEMPLATES[0]["amenities"], "photos": [photo("resort2"), photo("spa1", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5000, "name": "Deluxe Garden Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("garden2", 900, 600)], "occ": 2},
    ],

    "vata-wellness-sanctuary-ernakulam": [
        {"category": "non_ac", "price": 1400, "name": "Garden Cottage", "desc": NON_AC_TEMPLATES[0]["description"], "amenities": NON_AC_TEMPLATES[0]["amenities"], "photos": [photo("cottage1"), photo("garden1", 900, 600)], "occ": 2},
        {"category": "ac_standard", "price": 2900, "name": "AC Standard Room", "desc": AC_STANDARD_TEMPLATES[2]["description"], "amenities": AC_STANDARD_TEMPLATES[2]["amenities"], "photos": [photo("pool1"), photo("resort2", 900, 600)], "occ": 2},
        {"category": "deluxe", "price": 5400, "name": "Deluxe Vata Suite", "desc": DELUXE_TEMPLATES[0]["description"], "amenities": DELUXE_TEMPLATES[0]["amenities"], "photos": [photo("villa1"), photo("spa4", 900, 600)], "occ": 2},
    ],
}


# ── Main seeder ────────────────────────────────────────────────────────────────

def seed(reset: bool = False) -> None:
    with Session(engine) as session:
        # Fetch all clinics
        clinics = session.execute(
            text("SELECT id, slug, tier FROM clinic_feature_store ORDER BY slug")
        ).fetchall()

        print(f"Found {len(clinics)} clinics.")

        seeded = 0
        skipped = 0
        no_data = 0

        for clinic_row in clinics:
            clinic_id = clinic_row[0]
            slug = clinic_row[1]
            tier = clinic_row[2]

            if slug not in CLINIC_ROOMS:
                # Skip test/user-created clinics (e.g. "sreehari-rekha-pinchu")
                no_data += 1
                continue

            # Check if rooms already exist
            existing = session.execute(
                text("SELECT COUNT(*) FROM rooms WHERE clinic_id = :cid"),
                {"cid": clinic_id},
            ).scalar()

            if existing and not reset:
                skipped += 1
                continue

            if reset and existing:
                session.execute(
                    text("DELETE FROM rooms WHERE clinic_id = :cid"),
                    {"cid": clinic_id},
                )
                session.commit()

            rooms = CLINIC_ROOMS[slug]
            for order, room in enumerate(rooms):
                room_id = uuid.uuid4()
                session.execute(
                    text("""
                        INSERT INTO rooms
                            (id, clinic_id, name, category, description,
                             price_per_night_inr, amenities, photos,
                             max_occupancy, is_active, display_order,
                             created_at, updated_at)
                        VALUES
                            (:id, :clinic_id, :name, :category, :description,
                             :price, :amenities, :photos,
                             :max_occ, true, :order,
                             now(), now())
                    """),
                    {
                        "id": room_id,
                        "clinic_id": clinic_id,
                        "name": room["name"],
                        "category": room["category"],
                        "description": room["desc"],
                        "price": room["price"],
                        "amenities": room["amenities"],
                        "photos": room["photos"],
                        "max_occ": room["occ"],
                        "order": order,
                    },
                )

            session.commit()
            seeded += 1
            room_count = len(rooms)
            print(f"  ✓  {slug}  ({room_count} rooms, tier {tier})")

        print(f"\nDone — {seeded} clinics seeded, {skipped} skipped (already have rooms), {no_data} no template.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Delete and re-seed rooms")
    args = parser.parse_args()
    seed(reset=args.reset)
