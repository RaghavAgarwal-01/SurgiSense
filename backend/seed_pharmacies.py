import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from database import SessionLocal

def seed_pharmacies():
    db = SessionLocal()
    
    # Dummy pharmacies located around Kanpur
    pharmacies = [
        ("Apollo Pharmacy - Mall Road", "The Mall Road, Kanpur, UP", 80.3498, 26.4607),
        ("MedPlus Swaroop Nagar", "Swaroop Nagar, Kanpur, UP", 80.3153, 26.4837),
        ("Wellness Forever - Kakadeo", "Kakadeo, Kanpur, UP", 80.2974, 26.4746),
        ("Sanjeevani Medical Store", "Kidwai Nagar, Kanpur, UP", 80.3283, 26.4355),
        ("City Health Pharmacy", "Civil Lines, Kanpur, UP", 80.3500, 26.4700)
    ]
    
    try:
        # Clear the table first just in case
        db.execute(text("TRUNCATE TABLE pharmacies;"))
        
        for name, addr, lng, lat in pharmacies:
            query = text("""
                INSERT INTO pharmacies (name, address, location)
                VALUES (:name, :addr, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)
            """)
            db.execute(query, {"name": name, "addr": addr, "lng": lng, "lat": lat})
        db.commit()
        print("✅ Kanpur Pharmacies seeded successfully in Neon DB!")
    except Exception as e:
        print(f"❌ Error seeding pharmacies: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_pharmacies()