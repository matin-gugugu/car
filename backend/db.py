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
            operator_name TEXT DEFAULT '',
            contract_month TEXT DEFAULT '',
            start_date TEXT,
            end_date TEXT,
            deposit TEXT,
            rent TEXT DEFAULT '',
            status TEXT DEFAULT 'unsettled',
            remark TEXT DEFAULT ''
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plate TEXT NOT NULL,
            car_type TEXT NOT NULL,
            last_inspection TEXT,
            last_insurance TEXT,
            is_rented INTEGER DEFAULT 0,
            condition_remark TEXT DEFAULT ''
        )
        """
    )

    cursor.execute("PRAGMA table_info(rental_orders)")
    columns = {row["name"] for row in cursor.fetchall()}
    if "status" not in columns:
        cursor.execute("ALTER TABLE rental_orders ADD COLUMN status TEXT DEFAULT 'unsettled'")
    if "remark" not in columns:
        cursor.execute("ALTER TABLE rental_orders ADD COLUMN remark TEXT DEFAULT ''")
    if "operator_name" not in columns:
        cursor.execute("ALTER TABLE rental_orders ADD COLUMN operator_name TEXT DEFAULT ''")
    if "rent" not in columns:
        cursor.execute("ALTER TABLE rental_orders ADD COLUMN rent TEXT DEFAULT ''")
    if "contract_month" not in columns:
        cursor.execute("ALTER TABLE rental_orders ADD COLUMN contract_month TEXT DEFAULT ''")

    cursor.execute("PRAGMA table_info(vehicles)")
    vehicle_columns = {row["name"] for row in cursor.fetchall()}
    if "last_inspection" not in vehicle_columns:
        cursor.execute("ALTER TABLE vehicles ADD COLUMN last_inspection TEXT")
    if "last_insurance" not in vehicle_columns:
        cursor.execute("ALTER TABLE vehicles ADD COLUMN last_insurance TEXT")
    if "is_rented" not in vehicle_columns:
        cursor.execute("ALTER TABLE vehicles ADD COLUMN is_rented INTEGER DEFAULT 0")
    if "condition_remark" not in vehicle_columns:
        cursor.execute("ALTER TABLE vehicles ADD COLUMN condition_remark TEXT DEFAULT ''")

    cursor.execute(
        """
        DELETE FROM vehicles
        WHERE rowid NOT IN (
            SELECT MIN(rowid)
            FROM vehicles
            GROUP BY plate
        )
        """
    )

    cursor.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS vehicles_plate_unique
        ON vehicles(plate)
        """
    )

    cursor.execute(
        """
        INSERT INTO vehicles (plate, car_type)
        SELECT DISTINCT r.plate, r.car_type
        FROM rental_orders r
        WHERE NOT EXISTS (
            SELECT 1 FROM vehicles v
            WHERE v.plate = r.plate
        )
        """
    )

    cursor.execute(
        """
        UPDATE vehicles
        SET is_rented = CASE
            WHEN EXISTS (
                SELECT 1 FROM rental_orders r
                WHERE r.plate = vehicles.plate
                  AND r.status != 'settled'
            ) THEN 1
            ELSE 0
        END
        """
    )

    conn.commit()
    conn.close()
