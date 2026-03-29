"""
migrate_full.py — Run once to bring the Neon DB fully up to date.

Safely adds every column and table that was added after the initial schema.
All ALTER TABLE statements are wrapped in IF NOT EXISTS checks so this
script is idempotent — safe to run multiple times.

Usage:
    cd backend
    python3 migrate_full.py
"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

MIGRATIONS = [
    # ── patient_profiles ────────────────────────────────────────────────────
    ("patient_profiles", "age",                    "ALTER TABLE patient_profiles ADD COLUMN age INTEGER NULL"),
    ("patient_profiles", "gender",                 "ALTER TABLE patient_profiles ADD COLUMN gender VARCHAR NULL"),
    ("patient_profiles", "surgery_phase",          "ALTER TABLE patient_profiles ADD COLUMN surgery_phase VARCHAR NULL DEFAULT 'post'"),
    ("patient_profiles", "icd10_code",             "ALTER TABLE patient_profiles ADD COLUMN icd10_code VARCHAR NULL"),
    ("patient_profiles", "cpt_code",               "ALTER TABLE patient_profiles ADD COLUMN cpt_code VARCHAR NULL"),
    ("patient_profiles", "payer_id",               "ALTER TABLE patient_profiles ADD COLUMN payer_id VARCHAR NULL"),
    ("patient_profiles", "recovery_days_total",    "ALTER TABLE patient_profiles ADD COLUMN recovery_days_total INTEGER DEFAULT 90"),
    ("patient_profiles", "pdf_upload_date",        "ALTER TABLE patient_profiles ADD COLUMN pdf_upload_date VARCHAR NULL"),
    ("patient_profiles", "next_appointment_date",  "ALTER TABLE patient_profiles ADD COLUMN next_appointment_date VARCHAR NULL"),

    # ── recovery_tasks ───────────────────────────────────────────────────────
    ("recovery_tasks",   "task_date",              "ALTER TABLE recovery_tasks ADD COLUMN task_date VARCHAR NULL"),
    ("recovery_tasks",   "is_critical",            "ALTER TABLE recovery_tasks ADD COLUMN is_critical INTEGER DEFAULT 0"),

    # ── adherence_logs ───────────────────────────────────────────────────────
    ("adherence_logs",   "scheduled_time",         "ALTER TABLE adherence_logs ADD COLUMN scheduled_time VARCHAR NULL"),
    ("adherence_logs",   "completed_time",         "ALTER TABLE adherence_logs ADD COLUMN completed_time VARCHAR NULL"),
    ("adherence_logs",   "task_date",              "ALTER TABLE adherence_logs ADD COLUMN task_date VARCHAR NULL"),
    ("adherence_logs",   "task_id",                "ALTER TABLE adherence_logs ADD COLUMN task_id INTEGER NULL"),
    ("adherence_logs",   "medicine_id",            "ALTER TABLE adherence_logs ADD COLUMN medicine_id INTEGER NULL"),

    # ── medicines ────────────────────────────────────────────────────────────
    ("medicines",        "dose_amount",            "ALTER TABLE medicines ADD COLUMN dose_amount INTEGER NULL DEFAULT 1"),
    ("medicines",        "total_quantity",         "ALTER TABLE medicines ADD COLUMN total_quantity INTEGER NULL"),
    ("medicines",        "current_quantity",       "ALTER TABLE medicines ADD COLUMN current_quantity INTEGER NULL"),

    # ── agent_alerts ─────────────────────────────────────────────────────────
    ("agent_alerts",     "data_json",              "ALTER TABLE agent_alerts ADD COLUMN data_json TEXT NULL"),
]

CREATE_TABLES = [
    # intake_records — may not exist at all
    """
    CREATE TABLE IF NOT EXISTS intake_records (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id),
        intake_json TEXT,
        report_json TEXT,
        created_at  VARCHAR
    )
    """,
    # discharge_summaries
    """
    CREATE TABLE IF NOT EXISTS discharge_summaries (
        id             SERIAL PRIMARY KEY,
        user_id        INTEGER REFERENCES users(id),
        patient_name   VARCHAR,
        age            INTEGER,
        gender         VARCHAR,
        surgery_type   VARCHAR,
        surgery_date   VARCHAR,
        surgery_phase  VARCHAR DEFAULT 'post',
        icd10_code     VARCHAR,
        cpt_code       VARCHAR,
        bp_sys         INTEGER,
        bp_dia         INTEGER,
        heart_rate     INTEGER,
        spo2           INTEGER,
        temperature    VARCHAR,
        hemoglobin     VARCHAR,
        blood_sugar    INTEGER,
        created_at     VARCHAR
    )
    """,
    # medication_logs
    """
    CREATE TABLE IF NOT EXISTS medication_logs (
        id              SERIAL PRIMARY KEY,
        medicine_id     INTEGER REFERENCES medicines(id),
        user_id         INTEGER REFERENCES users(id),
        action          VARCHAR NOT NULL,
        quantity_change INTEGER NOT NULL,
        remaining       INTEGER NOT NULL,
        timestamp       VARCHAR NOT NULL
    )
    """,
    # adherence_logs — create if missing
    """
    CREATE TABLE IF NOT EXISTS adherence_logs (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER REFERENCES users(id),
        task_id         INTEGER,
        medicine_id     INTEGER,
        action          VARCHAR NOT NULL,
        scheduled_time  VARCHAR,
        completed_time  VARCHAR,
        task_date       VARCHAR,
        timestamp       VARCHAR NOT NULL
    )
    """,
    # agent_alerts
    """
    CREATE TABLE IF NOT EXISTS agent_alerts (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id),
        alert_type  VARCHAR NOT NULL,
        message     VARCHAR NOT NULL,
        data_json   TEXT,
        is_read     INTEGER DEFAULT 0,
        created_at  VARCHAR NOT NULL
    )
    """,
]


def column_exists(cursor, table, column):
    cursor.execute("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = %s AND column_name = %s
    """, (table, column))
    return cursor.fetchone() is not None


def run():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("❌ DATABASE_URL not set")
        return

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()

    print("── Creating missing tables ─────────────────────────")
    for sql in CREATE_TABLES:
        table_name = sql.strip().split("EXISTS")[1].strip().split("(")[0].strip()
        try:
            cur.execute(sql)
            conn.commit()
            print(f"  ✓ {table_name}")
        except Exception as e:
            conn.rollback()
            print(f"  ✗ {table_name}: {e}")

    print("\n── Adding missing columns ──────────────────────────")
    for table, column, sql in MIGRATIONS:
        if column_exists(cur, table, column):
            print(f"  · {table}.{column} already exists")
            continue
        try:
            cur.execute(sql)
            conn.commit()
            print(f"  ✓ Added {table}.{column}")
        except Exception as e:
            conn.rollback()
            print(f"  ✗ {table}.{column}: {e}")

    cur.close()
    conn.close()
    print("\n✅ Migration complete!")


if __name__ == "__main__":
    run()
