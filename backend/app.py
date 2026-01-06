from flask import Flask, jsonify, request
from flask_cors import CORS
from db import get_db, init_db
from seed import seed_if_empty
import calendar
import json
import csv
import io
from datetime import date, datetime

app = Flask(__name__)
CORS(app)

# Flask 3 移除了 before_first_request，启动时直接初始化即可
init_db()
seed_if_empty()


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _add_months(d, months):
    year = d.year + (d.month - 1 + months) // 12
    month = (d.month - 1 + months) % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    day = min(d.day, last_day)
    return date(year, month, day)


def _build_due_dates(start_date, end_date):
    if not start_date or not end_date:
        return []
    dates = []
    current = start_date
    while current < end_date:
        dates.append(current)
        current = _add_months(current, 1)
    return dates


def _ensure_rent_records(order_id, start_date_str, end_date_str):
    start_date = _parse_date(start_date_str)
    end_date = _parse_date(end_date_str)
    if not start_date or not end_date:
        return

    all_due = _build_due_dates(start_date, end_date)
    if not all_due:
        return

    today = date.today()
    wanted = []
    next_due = None
    for due in all_due:
        if due <= today:
            wanted.append(due)
        else:
            next_due = due
            break

    if next_due:
        wanted.append(next_due)

    if not wanted:
        return

    db = get_db()
    db.executemany(
        """
        INSERT OR IGNORE INTO rent_records (order_id, due_date, status, remark)
        VALUES (?, ?, 'unsettled', '')
        """,
        [(order_id, d.isoformat()) for d in wanted],
    )
    db.commit()


def _read_csv_rows(file_storage):
    raw = file_storage.stream.read()
    text = raw.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        cleaned = {k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
        rows.append(cleaned)
    return rows


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/home/getData")
def home_get_data():
    db = get_db()
    cursor = db.execute(
        """
        SELECT name, today_rent AS todayRent, month_rent AS monthRent, total_rent AS totalRent
        FROM vehicle_stats
        ORDER BY id ASC
        """
    )
    table_data = [dict(row) for row in cursor.fetchall()]
    return jsonify({"code": 200, "data": {"tableData": table_data}})


@app.get("/api/user/getUser")
def user_get_user():
    name = request.args.get("name")
    keyword = request.args.get("keyword")
    query_value = name or keyword

    db = get_db()
    if query_value:
        cursor = db.execute(
            """
            SELECT id, name, age, sex, birth, addr
            FROM users
            WHERE name LIKE ?
            ORDER BY id ASC
            """,
            (f"%{query_value}%",),
        )
    else:
        cursor = db.execute(
            """
            SELECT id, name, age, sex, birth, addr
            FROM users
            ORDER BY id ASC
            """
        )

    data = [dict(row) for row in cursor.fetchall()]
    return jsonify({"code": 200, "list": data})


@app.post("/api/echo")
def echo():
    payload = request.get_json(silent=True) or {}
    return jsonify({"code": 200, "data": payload})


@app.get("/api/rental-orders")
def rental_order_list():
    plate = request.args.get("plate")
    driver_name = request.args.get("driverName")
    operator_name = request.args.get("operatorName")

    db = get_db()
    clauses = []
    params = []
    if plate:
        clauses.append("plate LIKE ?")
        params.append(f"%{plate}%")
    if driver_name:
        clauses.append("driver_name LIKE ?")
        params.append(f"%{driver_name}%")
    if operator_name:
        clauses.append("operator_name LIKE ?")
        params.append(f"%{operator_name}%")

    where_sql = ""
    if clauses:
        where_sql = " WHERE " + " AND ".join(clauses)

    cursor = db.execute(
        """
        SELECT id, plate, car_type AS carType, driver_name AS driverName,
               driver_phone AS driverPhone, operator_name AS operatorName,
               start_date AS startDate, end_date AS endDate, deposit, rent
        FROM rental_orders
        """
        + where_sql
        + " ORDER BY id ASC",
        params,
    )
    data = [dict(row) for row in cursor.fetchall()]
    return jsonify({"code": 200, "list": data})


@app.post("/api/rental-orders")
def rental_order_create():
    payload = request.get_json(silent=True) or {}
    required = [
        "plate",
        "carType",
        "driverName",
        "driverPhone",
    ]
    missing = [field for field in required if not payload.get(field)]
    if missing:
        return jsonify({"code": 400, "message": f"missing fields: {', '.join(missing)}"}), 400

    operator_name = payload.get("operatorName") or ""
    start_date = payload.get("startDate") or ""
    end_date = payload.get("endDate") or ""
    deposit = payload.get("deposit") or ""
    rent = payload.get("rent") or ""

    db = get_db()
    cursor = db.execute(
        """
        SELECT 1 FROM vehicles
        WHERE plate = ? AND car_type = ?
        LIMIT 1
        """,
        (payload["plate"], payload["carType"]),
    )
    if cursor.fetchone() is None:
        return jsonify({"code": 400, "message": "vehicle not found in vehicles table"}), 400

    cursor = db.execute(
        """
        INSERT INTO rental_orders (plate, car_type, driver_name, driver_phone, operator_name, start_date, end_date, deposit, rent, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload["plate"],
            payload["carType"],
            payload["driverName"],
            payload["driverPhone"],
            operator_name,
            start_date,
            end_date,
            deposit,
            rent,
            "unsettled",
        ),
    )
    db.commit()
    _ensure_rent_records(cursor.lastrowid, start_date, end_date)
    return jsonify({"code": 200, "id": cursor.lastrowid})


@app.put("/api/rental-orders/<int:order_id>")
def rental_order_update(order_id):
    payload = request.get_json(silent=True) or {}
    allowed = {
        "plate": "plate",
        "carType": "car_type",
        "driverName": "driver_name",
        "driverPhone": "driver_phone",
        "operatorName": "operator_name",
        "startDate": "start_date",
        "endDate": "end_date",
        "deposit": "deposit",
        "rent": "rent",
    }

    fields = []
    params = []
    for key, column in allowed.items():
        if key in payload:
            fields.append(f"{column} = ?")
            params.append(payload[key])

    if not fields:
        return jsonify({"code": 400, "message": "no fields to update"}), 400

    if "plate" in payload or "carType" in payload:
        db = get_db()
        cursor = db.execute(
            "SELECT plate, car_type FROM rental_orders WHERE id = ?",
            (order_id,),
        )
        current = cursor.fetchone()
        if current is None:
            return jsonify({"code": 404, "message": "rental order not found"}), 404
        next_plate = payload.get("plate") or current["plate"]
        next_car_type = payload.get("carType") or current["car_type"]
        cursor = db.execute(
            """
            SELECT 1 FROM vehicles
            WHERE plate = ? AND car_type = ?
            LIMIT 1
            """,
            (next_plate, next_car_type),
        )
        if cursor.fetchone() is None:
            return jsonify({"code": 400, "message": "vehicle not found in vehicles table"}), 400

    params.append(order_id)
    db = get_db()
    db.execute(
        f"UPDATE rental_orders SET {', '.join(fields)} WHERE id = ?",
        params,
    )
    db.commit()
    if "startDate" in payload or "endDate" in payload:
        cursor = db.execute(
            "SELECT start_date, end_date FROM rental_orders WHERE id = ?",
            (order_id,),
        )
        row = cursor.fetchone()
        if row:
            _ensure_rent_records(order_id, row["start_date"], row["end_date"])
    return jsonify({"code": 200, "message": "updated"})


@app.delete("/api/rental-orders/<int:order_id>")
def rental_order_delete(order_id):
    db = get_db()
    db.execute("DELETE FROM rent_records WHERE order_id = ?", (order_id,))
    db.execute("DELETE FROM rental_orders WHERE id = ?", (order_id,))
    db.commit()
    return jsonify({"code": 200, "message": "deleted"})


@app.get("/api/rent-records")
def rent_record_list():
    plate = request.args.get("plate")
    driver_name = request.args.get("driverName")
    operator_name = request.args.get("operatorName")
    car_type = request.args.get("carType")
    rent_status = request.args.get("rentRecordStatus")
    rent_due_month = request.args.get("rentDueMonth")

    db = get_db()
    clauses = []
    params = []
    if plate:
        clauses.append("r.plate LIKE ?")
        params.append(f"%{plate}%")
    if driver_name:
        clauses.append("r.driver_name LIKE ?")
        params.append(f"%{driver_name}%")
    if operator_name:
        clauses.append("r.operator_name LIKE ?")
        params.append(f"%{operator_name}%")
    if car_type:
        clauses.append("r.car_type LIKE ?")
        params.append(f"%{car_type}%")
    if rent_status:
        clauses.append("rr.status = ?")
        params.append(rent_status)
    if rent_due_month:
        clauses.append("rr.due_date LIKE ?")
        params.append(f"{rent_due_month}%")

    where_sql = ""
    if clauses:
        where_sql = " WHERE " + " AND ".join(clauses)

    order_cursor = db.execute(
        """
        SELECT id, start_date, end_date
        FROM rental_orders
        """
    )
    for row in order_cursor.fetchall():
        _ensure_rent_records(row["id"], row["start_date"], row["end_date"])

    cursor = db.execute(
        """
        SELECT r.id AS orderId, r.plate, r.car_type AS carType,
               r.driver_name AS driverName, r.driver_phone AS driverPhone,
               r.operator_name AS operatorName, r.start_date AS startDate,
               r.end_date AS endDate, r.deposit, r.rent,
               rr.id AS rentRecordId, rr.due_date AS rentDueDate,
               rr.status AS rentRecordStatus, rr.remark AS rentRecordRemark
        FROM rental_orders r
        JOIN rent_records rr ON rr.order_id = r.id
        WHERE rr.status != 'deleted'
        """
        + ((" AND " + " AND ".join(clauses)) if clauses else "")
        + " ORDER BY r.id ASC, rr.due_date ASC",
        params,
    )
    data = [dict(row) for row in cursor.fetchall()]
    return jsonify({"code": 200, "list": data})


@app.put("/api/rent-records/<int:record_id>")
def rent_record_update(record_id):
    payload = request.get_json(silent=True) or {}
    allowed = {
        "status": "status",
        "remark": "remark",
    }
    fields = []
    params = []
    for key, column in allowed.items():
        if key in payload:
            fields.append(f"{column} = ?")
            params.append(payload[key])

    if not fields:
        return jsonify({"code": 400, "message": "no fields to update"}), 400

    params.append(record_id)
    db = get_db()
    db.execute(
        f"UPDATE rent_records SET {', '.join(fields)} WHERE id = ?",
        params,
    )
    db.commit()
    return jsonify({"code": 200, "message": "updated"})


@app.delete("/api/rent-records/<int:record_id>")
def rent_record_delete(record_id):
    db = get_db()
    cursor = db.execute(
        "SELECT order_id FROM rent_records WHERE id = ?",
        (record_id,),
    )
    row = cursor.fetchone()
    if row is None:
        return jsonify({"code": 404, "message": "rent record not found"}), 404

    db.execute("UPDATE rent_records SET status = 'deleted' WHERE id = ?", (record_id,))
    db.commit()

    cursor = db.execute(
        "SELECT COUNT(*) AS count FROM rent_records WHERE order_id = ? AND status != 'deleted'",
        (row["order_id"],),
    )
    remaining = cursor.fetchone()["count"]
    return jsonify({"code": 200, "message": "deleted", "orderId": row["order_id"], "remaining": remaining})


@app.delete("/api/rental-orders/<int:order_id>/with-records")
def rental_order_delete_with_records(order_id):
    db = get_db()
    db.execute("DELETE FROM rent_records WHERE order_id = ?", (order_id,))
    db.execute("DELETE FROM rental_orders WHERE id = ?", (order_id,))
    db.commit()
    return jsonify({"code": 200, "message": "deleted"})


@app.post("/api/import/rent")
def import_rent_data():
    if "file" not in request.files:
        return jsonify({"code": 400, "message": "file is required"}), 400
    rows = _read_csv_rows(request.files["file"])
    if not rows:
        return jsonify({"code": 400, "message": "empty file"}), 400

    db = get_db()
    inserted_orders = 0
    inserted_records = 0
    skipped = 0
    errors = []

    for idx, row in enumerate(rows, start=2):
        if row.get("rentDueDate"):
            plate = row.get("plate", "")
            car_type = row.get("carType", "")
            due_date = row.get("rentDueDate", "")
            status = row.get("status") or row.get("rentRecordStatus") or "unsettled"
            remark = row.get("remark") or row.get("rentRecordRemark") or ""
            if not plate or not due_date:
                errors.append(f"line {idx}: rent record missing plate or rentDueDate")
                continue

            cursor = db.execute(
                """
                SELECT id FROM rental_orders
                WHERE plate = ?
                  AND (? = '' OR car_type = ?)
                  AND start_date <= ?
                  AND end_date > ?
                ORDER BY start_date DESC
                LIMIT 1
                """,
                (plate, car_type, car_type, due_date, due_date),
            )
            order = cursor.fetchone()
            if order is None:
                errors.append(f"line {idx}: no matching order for rentDueDate")
                continue

            cursor = db.execute(
                """
                INSERT OR IGNORE INTO rent_records (order_id, due_date, status, remark)
                VALUES (?, ?, ?, ?)
                """,
                (order["id"], due_date, status, remark),
            )
            if cursor.rowcount == 0:
                skipped += 1
            else:
                inserted_records += 1
        elif row.get("startDate") or row.get("endDate"):
            plate = row.get("plate", "")
            car_type = row.get("carType", "")
            driver_name = row.get("driverName", "")
            driver_phone = row.get("driverPhone", "")
            operator_name = row.get("operatorName", "")
            start_date = row.get("startDate", "")
            end_date = row.get("endDate", "")
            deposit = row.get("deposit", "")
            rent = row.get("rent", "")
            if not plate or not car_type or not driver_name or not driver_phone:
                errors.append(f"line {idx}: order missing required fields")
                continue

            cursor = db.execute(
                """
                SELECT 1 FROM vehicles
                WHERE plate = ? AND car_type = ?
                LIMIT 1
                """,
                (plate, car_type),
            )
            if cursor.fetchone() is None:
                errors.append(f"line {idx}: vehicle not found in vehicles table")
                continue

            cursor = db.execute(
                """
                INSERT INTO rental_orders (
                    plate, car_type, driver_name, driver_phone, operator_name,
                    start_date, end_date, deposit, rent, status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    plate,
                    car_type,
                    driver_name,
                    driver_phone,
                    operator_name,
                    start_date,
                    end_date,
                    deposit,
                    rent,
                    "unsettled",
                ),
            )
            inserted_orders += 1
            _ensure_rent_records(cursor.lastrowid, start_date, end_date)
        else:
            errors.append(f"line {idx}: unknown row type")
            continue

    db.commit()
    return jsonify(
        {
            "code": 200,
            "insertedOrders": inserted_orders,
            "insertedRecords": inserted_records,
            "skipped": skipped,
            "errors": errors,
        }
    )


@app.post("/api/import/vehicles")
def import_vehicles_data():
    if "file" not in request.files:
        return jsonify({"code": 400, "message": "file is required"}), 400
    rows = _read_csv_rows(request.files["file"])
    if not rows:
        return jsonify({"code": 400, "message": "empty file"}), 400

    db = get_db()
    inserted = 0
    skipped = 0
    errors = []

    for idx, row in enumerate(rows, start=2):
        plate = row.get("plate", "")
        car_type = row.get("carType", "")
        if not plate or not car_type:
            errors.append(f"line {idx}: vehicle missing plate or carType")
            continue

        cursor = db.execute(
            "SELECT 1 FROM vehicles WHERE plate = ? LIMIT 1",
            (plate,),
        )
        if cursor.fetchone() is not None:
            skipped += 1
            continue

        db.execute(
            """
            INSERT INTO vehicles (plate, car_type, last_inspection, last_insurance, is_rented, condition_remark)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                plate,
                car_type,
                row.get("lastInspection") or "",
                row.get("lastInsurance") or "",
                int(row.get("isRented") or 0),
                row.get("conditionRemark") or "",
            ),
        )
        inserted += 1

    db.commit()
    return jsonify({"code": 200, "inserted": inserted, "skipped": skipped, "errors": errors})


@app.get("/api/vehicles")
def vehicle_list():
    plate = request.args.get("plate")
    car_type = request.args.get("carType")
    is_rented = request.args.get("isRented")

    db = get_db()
    clauses = []
    params = []
    if plate:
        clauses.append("plate LIKE ?")
        params.append(f"%{plate}%")
    if car_type:
        clauses.append("car_type LIKE ?")
        params.append(f"%{car_type}%")
    if is_rented in ("0", "1"):
        clauses.append("is_rented = ?")
        params.append(int(is_rented))

    where_sql = ""
    if clauses:
        where_sql = " WHERE " + " AND ".join(clauses)

    cursor = db.execute(
        """
        SELECT id, plate, car_type AS carType,
               last_inspection AS lastInspection,
               last_insurance AS lastInsurance,
               is_rented AS isRented,
               condition_remark AS conditionRemark
        FROM vehicles
        """
        + where_sql
        + " ORDER BY id ASC",
        params,
    )
    data = [dict(row) for row in cursor.fetchall()]
    return jsonify({"code": 200, "list": data})


@app.post("/api/vehicles")
def vehicle_create():
    payload = request.get_json(silent=True) or {}
    required = ["plate", "carType"]
    missing = [field for field in required if not payload.get(field)]
    if missing:
        return jsonify({"code": 400, "message": f"missing fields: {', '.join(missing)}"}), 400

    db = get_db()
    cursor = db.execute(
        "SELECT 1 FROM vehicles WHERE plate = ? LIMIT 1",
        (payload["plate"],),
    )
    if cursor.fetchone() is not None:
        return jsonify({"code": 400, "message": "plate already exists"}), 400

    cursor = db.execute(
        """
        INSERT INTO vehicles (plate, car_type, last_inspection, last_insurance, is_rented, condition_remark)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            payload["plate"],
            payload["carType"],
            payload.get("lastInspection") or "",
            payload.get("lastInsurance") or "",
            int(payload.get("isRented") or 0),
            payload.get("conditionRemark") or "",
        ),
    )
    db.commit()
    return jsonify({"code": 200, "id": cursor.lastrowid})


@app.put("/api/vehicles/<int:vehicle_id>")
def vehicle_update(vehicle_id):
    payload = request.get_json(silent=True) or {}
    allowed = {
        "plate": "plate",
        "carType": "car_type",
        "lastInspection": "last_inspection",
        "lastInsurance": "last_insurance",
        "isRented": "is_rented",
        "conditionRemark": "condition_remark",
    }

    fields = []
    params = []
    for key, column in allowed.items():
        if key in payload:
            fields.append(f"{column} = ?")
            if key == "isRented":
                params.append(int(payload[key]))
            else:
                params.append(payload[key] or "")

    if not fields:
        return jsonify({"code": 400, "message": "no fields to update"}), 400

    params.append(vehicle_id)
    db = get_db()
    db.execute(
        f"UPDATE vehicles SET {', '.join(fields)} WHERE id = ?",
        params,
    )
    db.commit()
    return jsonify({"code": 200, "message": "updated"})


@app.delete("/api/vehicles/<int:vehicle_id>")
def vehicle_delete(vehicle_id):
    db = get_db()
    db.execute("DELETE FROM vehicles WHERE id = ?", (vehicle_id,))
    db.commit()
    return jsonify({"code": 200, "message": "deleted"})




if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
