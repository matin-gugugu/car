from db import get_db


def seed_if_empty():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) AS count FROM users")
    if cursor.fetchone()["count"] == 0:
        cursor.executemany(
            """
            INSERT INTO users (name, age, sex, birth, addr)
            VALUES (?, ?, ?, ?, ?)
            """,
            [
                ("张三", 28, 0, "1996-01-01", "北京"),
                ("李四", 32, 0, "1992-03-12", "上海"),
                ("王五", 26, 1, "1998-07-09", "深圳"),
            ],
        )

    cursor.execute("SELECT COUNT(*) AS count FROM vehicle_stats")
    if cursor.fetchone()["count"] == 0:
        cursor.executemany(
            """
            INSERT INTO vehicle_stats (name, today_rent, month_rent, total_rent)
            VALUES (?, ?, ?, ?)
            """,
            [
                ("丰田凯美瑞", 3, 42, 320),
                ("本田雅阁", 5, 55, 410),
                ("大众帕萨特", 2, 36, 280),
            ],
        )

    cursor.execute("SELECT COUNT(*) AS count FROM rental_orders")
    if cursor.fetchone()["count"] == 0:
        cursor.executemany(
            """
            INSERT INTO rental_orders (plate, car_type, driver_name, driver_phone, operator_name, start_date, end_date, deposit, status, remark)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("京A12345", "丰田凯美瑞", "张三", "13800001111", "王五", "2023-01-01", "2024-01-01", "5000", "unsettled", ""),
                ("沪B54321", "本田雅阁", "李四", "13900002222", "赵六", "2023-06-01", "2024-06-01", "4000", "unsettled", ""),
            ],
        )

    cursor.execute("SELECT COUNT(*) AS count FROM vehicles")
    if cursor.fetchone()["count"] == 0:
        cursor.executemany(
            """
            INSERT INTO vehicles (plate, car_type, last_inspection, last_insurance, is_rented, condition_remark)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                ("吉A12345", "红旗EH7", "2024-06-01", "2024-05-15", 1, "轻微划痕"),
                ("吉A54321", "比亚迪", "2024-04-10", "2024-03-28", 0, "车况良好"),
            ],
        )

    conn.commit()
    conn.close()
