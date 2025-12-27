from flask import Flask, jsonify, request
from flask_cors import CORS
from db import get_db, init_db
from seed import seed_if_empty

app = Flask(__name__)
CORS(app)

# Flask 3 移除了 before_first_request，启动时直接初始化即可
init_db()
seed_if_empty()


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
               start_date AS startDate, end_date AS endDate, deposit,
               status, remark
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

    status = payload.get("status") or "unsettled"
    operator_name = payload.get("operatorName") or ""
    start_date = payload.get("startDate") or ""
    end_date = payload.get("endDate") or ""
    deposit = payload.get("deposit") or ""
    db = get_db()
    cursor = db.execute(
        """
        INSERT INTO rental_orders (plate, car_type, driver_name, driver_phone, operator_name, start_date, end_date, deposit, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            status,
        ),
    )
    db.commit()
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

    params.append(order_id)
    db = get_db()
    db.execute(
        f"UPDATE rental_orders SET {', '.join(fields)} WHERE id = ?",
        params,
    )
    db.commit()
    return jsonify({"code": 200, "message": "updated"})


@app.delete("/api/rental-orders/<int:order_id>")
def rental_order_delete(order_id):
    db = get_db()
    db.execute("DELETE FROM rental_orders WHERE id = ?", (order_id,))
    db.commit()
    return jsonify({"code": 200, "message": "deleted"})


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
