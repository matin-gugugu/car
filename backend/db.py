import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "app.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT name FROM sqlite_master
        WHERE type='table' AND name IN ('vehicles', 'rental_orders')
        """
    )
    existing = {row["name"] for row in cursor.fetchall()}
    if "vehicles" in existing and "rental_orders" not in existing:
        cursor.execute("ALTER TABLE vehicles RENAME TO rental_orders")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            age INTEGER,
            sex INTEGER,
            birth TEXT,
            addr TEXT
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS vehicle_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            today_rent INTEGER,
            month_rent INTEGER,
            total_rent INTEGER
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS rental_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plate TEXT NOT NULL,
            car_type TEXT NOT NULL,
            driver_name TEXT NOT NULL,
            driver_phone TEXT NOT NULL,
            start_date TEXT,
            end_date TEXT,
            deposit TEXT,
            status TEXT DEFAULT 'unsettled',
            remark TEXT DEFAULT ''
        )
        """
    )

    cursor.execute("PRAGMA table_info(rental_orders)")
    columns = {row["name"] for row in cursor.fetchall()}
    if "status" not in columns:
        cursor.execute("ALTER TABLE rental_orders ADD COLUMN status TEXT DEFAULT 'unsettled'")
    if "remark" not in columns:
        cursor.execute("ALTER TABLE rental_orders ADD COLUMN remark TEXT DEFAULT ''")

    conn.commit()
    conn.close()
