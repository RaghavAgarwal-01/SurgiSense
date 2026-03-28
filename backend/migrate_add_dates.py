
"""
Migration script to add pdf_upload_date and next_appointment_date columns
to the patient_profiles table.

Run this once to update the database schema:
    python3 migrate_add_dates.py
"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def migrate():
    """Add missing columns to patient_profiles table"""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("❌ DATABASE_URL not found in .env file")
        return
    
    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()      
        try:
            print("Adding pdf_upload_date column...")
            cursor.execute("""
                ALTER TABLE patient_profiles 
                ADD COLUMN pdf_upload_date VARCHAR NULL
            """)
            conn.commit()
            print("✓ Added pdf_upload_date")
        except psycopg2.Error as e:
            if "already exists" in str(e):
                print("✓ pdf_upload_date already exists")
                conn.rollback()
            else:
                raise
        
        # Check and add next_appointment_date column
        try:
            print("Adding next_appointment_date column...")
            cursor.execute("""
                ALTER TABLE patient_profiles 
                ADD COLUMN next_appointment_date VARCHAR NULL
            """)
            conn.commit()
            print("✓ Added next_appointment_date")
        except psycopg2.Error as e:
            if "already exists" in str(e):
                print("✓ next_appointment_date already exists")
                conn.rollback()
            else:
                raise
        
        cursor.close()
        conn.close()
        print("\n✅ Migration complete!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    migrate()
