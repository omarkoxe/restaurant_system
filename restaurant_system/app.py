from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, date
from functools import wraps
import os

app = Flask(__name__)
app.secret_key = "CHANGE_THIS_SECRET_KEY"

DB_NAME = "restaurant.db"


# =========================
# DATABASE
# =========================

def get_db():
    db = sqlite3.connect(DB_NAME)
    db.row_factory = sqlite3.Row
    return db


def init_db():
    db = get_db()

    db.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    """)

    db.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name_ar TEXT NOT NULL,
            name_ku TEXT NOT NULL
        )
    """)

    db.execute("""
        CREATE TABLE IF NOT EXISTS foods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name_ar TEXT NOT NULL,
            name_ku TEXT NOT NULL,
            price INTEGER NOT NULL,
            image_url TEXT,
            category_id INTEGER,
            available INTEGER DEFAULT 1,
            FOREIGN KEY(category_id) REFERENCES categories(id)
        )
    """)

    db.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT,
            phone TEXT,
            address TEXT,
            notes TEXT,
            total INTEGER NOT NULL,
            status TEXT DEFAULT 'new',
            created_at TEXT NOT NULL
        )
    """)

    db.execute("""
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            food_id INTEGER NOT NULL,
            food_name_ar TEXT NOT NULL,
            food_name_ku TEXT NOT NULL,
            price INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            FOREIGN KEY(order_id) REFERENCES orders(id),
            FOREIGN KEY(food_id) REFERENCES foods(id)
        )
    """)

    # حساب الإدارة الافتراضي
    admin = db.execute(
        "SELECT id FROM admins WHERE username = ?",
        ("admin",)
    ).fetchone()

    if not admin:
        db.execute(
            "INSERT INTO admins (username, password) VALUES (?, ?)",
            ("admin", generate_password_hash("admin123"))
        )

    # أقسام افتراضية
    category_count = db.execute(
        "SELECT COUNT(*) AS count FROM categories"
    ).fetchone()["count"]

    if category_count == 0:
        db.execute(
            "INSERT INTO categories (name_ar, name_ku) VALUES (?, ?)",
            ("أكلات", "خوارن")
        )

        db.execute(
            "INSERT INTO categories (name_ar, name_ku) VALUES (?, ?)",
            ("مشروبات", "خوارن")
        )

    # أكلات تجريبية
    food_count = db.execute(
        "SELECT COUNT(*) AS count FROM foods"
    ).fetchone()["count"]

    if food_count == 0:
        category = db.execute(
            "SELECT id FROM categories LIMIT 1"
        ).fetchone()

        db.execute("""
            INSERT INTO foods
            (name_ar, name_ku, price, image_url, category_id, available)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            "بيتزا",
            "بيتزا",
            5000,
            "",
            category["id"],
            1
        ))

        db.execute("""
            INSERT INTO foods
            (name_ar, name_ku, price, image_url, category_id, available)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            "برگر",
            "برگر",
            4000,
            "",
            category["id"],
            1
        ))

    db.commit()
    db.close()


# =========================
# ADMIN PROTECTION
# =========================

def admin_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not session.get("admin_id"):
            return jsonify({
                "success": False,
                "message": "غير مسموح"
            }), 401

        return func(*args, **kwargs)

    return wrapper


# =========================
# PAGES
# =========================

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/login")
def login_page():
    if session.get("admin_id"):
        return redirect(url_for("admin_page"))

    return render_template("login.html")


@app.route("/admin")
def admin_page():
    if not session.get("admin_id"):
        return redirect(url_for("login_page"))

    return render_template("admin.html")


@app.route("/orders")
def orders_page():
    if not session.get("admin_id"):
        return redirect(url_for("login_page"))

    return render_template("orders.html")


# =========================
# LOGIN
# =========================

@app.post("/api/login")
def login():
    data = request.get_json() or {}

    username = data.get("username", "").strip()
    password = data.get("password", "")

    db = get_db()

    admin = db.execute(
        "SELECT * FROM admins WHERE username = ?",
        (username,)
    ).fetchone()

    db.close()

    if not admin or not check_password_hash(
        admin["password"],
        password
    ):
        return jsonify({
            "success": False,
            "message": "اسم المستخدم أو كلمة السر غير صحيحة"
        }), 401

    session["admin_id"] = admin["id"]
    session["admin_username"] = admin["username"]

    return jsonify({
        "success": True
    })


@app.post("/api/logout")
def logout():
    session.clear()

    return jsonify({
        "success": True
    })


@app.get("/api/session")
def get_session():
    return jsonify({
        "logged_in": bool(session.get("admin_id")),
        "username": session.get("admin_username")
    })


# =========================
# CHANGE PASSWORD
# =========================

@app.post("/api/change-password")
@admin_required
def change_password():
    data = request.get_json() or {}

    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    if len(new_password) < 6:
        return jsonify({
            "success": False,
            "message": "كلمة السر الجديدة يجب أن تكون 6 أحرف على الأقل"
        }), 400

    db = get_db()

    admin = db.execute(
        "SELECT * FROM admins WHERE id = ?",
        (session["admin_id"],)
    ).fetchone()

    if not check_password_hash(
        admin["password"],
        current_password
    ):
        db.close()

        return jsonify({
            "success": False,
            "message": "كلمة السر الحالية غير صحيحة"
        }), 400

    db.execute(
        "UPDATE admins SET password = ? WHERE id = ?",
        (
            generate_password_hash(new_password),
            session["admin_id"]
        )
    )

    db.commit()
    db.close()

    return jsonify({
        "success": True,
        "message": "تم تغيير كلمة السر بنجاح"
    })


# =========================
# FOODS
# =========================

@app.get("/api/foods")
def get_foods():
    db = get_db()

    foods = db.execute("""
        SELECT
            foods.*,
            categories.name_ar AS category_ar,
            categories.name_ku AS category_ku
        FROM foods
        LEFT JOIN categories
            ON foods.category_id = categories.id
        ORDER BY foods.id DESC
    """).fetchall()

    db.close()

    return jsonify([
        dict(food)
        for food in foods
    ])


@app.post("/api/foods")
@admin_required
def add_food():
    data = request.get_json() or {}

    name_ar = data.get("name_ar", "").strip()
    name_ku = data.get("name_ku", "").strip()
    price = data.get("price")
    image_url = data.get("image_url", "").strip()
    category_id = data.get("category_id")
    available = 1 if data.get("available", True) else 0

    if not name_ar:
        return jsonify({
            "success": False,
            "message": "اسم الأكلة مطلوب"
        }), 400

    try:
        price = int(price)
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "السعر غير صحيح"
        }), 400

    if price < 0:
        return jsonify({
            "success": False,
            "message": "السعر غير صحيح"
        }), 400

    db = get_db()

    db.execute("""
        INSERT INTO foods
        (name_ar, name_ku, price, image_url, category_id, available)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        name_ar,
        name_ku or name_ar,
        price,
        image_url,
        category_id,
        available
    ))

    db.commit()
    db.close()

    return jsonify({
        "success": True
    })


@app.put("/api/foods/<int:food_id>")
@admin_required
def edit_food(food_id):
    data = request.get_json() or {}

    name_ar = data.get("name_ar", "").strip()
    name_ku = data.get("name_ku", "").strip()
    price = data.get("price")
    image_url = data.get("image_url", "").strip()
    category_id = data.get("category_id")
    available = 1 if data.get("available", True) else 0

    if not name_ar:
        return jsonify({
            "success": False,
            "message": "اسم الأكلة مطلوب"
        }), 400

    try:
        price = int(price)
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "السعر غير صحيح"
        }), 400

    db = get_db()

    food = db.execute(
        "SELECT id FROM foods WHERE id = ?",
        (food_id,)
    ).fetchone()

    if not food:
        db.close()

        return jsonify({
            "success": False,
            "message": "الأكلة غير موجودة"
        }), 404

    db.execute("""
        UPDATE foods
        SET
            name_ar = ?,
            name_ku = ?,
            price = ?,
            image_url = ?,
            category_id = ?,
            available = ?
        WHERE id = ?
    """, (
        name_ar,
        name_ku or name_ar,
        price,
        image_url,
        category_id,
        available,
        food_id
    ))

    db.commit()
    db.close()

    return jsonify({
        "success": True
    })


@app.delete("/api/foods/<int:food_id>")
@admin_required
def delete_food(food_id):
    db = get_db()

    db.execute(
        "DELETE FROM foods WHERE id = ?",
        (food_id,)
    )

    db.commit()
    db.close()

    return jsonify({
        "success": True
    })


@app.patch("/api/foods/<int:food_id>/availability")
@admin_required
def change_food_availability(food_id):
    data = request.get_json() or {}

    available = 1 if data.get("available") else 0

    db = get_db()

    db.execute(
        "UPDATE foods SET available = ? WHERE id = ?",
        (available, food_id)
    )

    db.commit()
    db.close()

    return jsonify({
        "success": True
    })


# =========================
# CATEGORIES
# =========================

@app.get("/api/categories")
def get_categories():
    db = get_db()

    categories = db.execute(
        "SELECT * FROM categories ORDER BY id"
    ).fetchall()

    db.close()

    return jsonify([
        dict(category)
        for category in categories
    ])


@app.post("/api/categories")
@admin_required
def add_category():
    data = request.get_json() or {}

    name_ar = data.get("name_ar", "").strip()
    name_ku = data.get("name_ku", "").strip()

    if not name_ar:
        return jsonify({
            "success": False,
            "message": "اسم القسم مطلوب"
        }), 400

    db = get_db()

    db.execute("""
        INSERT INTO categories
        (name_ar, name_ku)
        VALUES (?, ?)
    """, (
        name_ar,
        name_ku or name_ar
    ))

    db.commit()
    db.close()

    return jsonify({
        "success": True
    })


# =========================
# ORDERS
# =========================

@app.post("/api/orders")
def create_order():
    data = request.get_json() or {}

    items = data.get("items", [])

    if not items:
        return jsonify({
            "success": False,
            "message": "السلة فارغة"
        }), 400

    customer_name = data.get("customer_name", "").strip()
    phone = data.get("phone", "").strip()
    address = data.get("address", "").strip()
    notes = data.get("notes", "").strip()

    db = get_db()

    final_items = []
    total = 0

    for item in items:
        try:
            food_id = int(item.get("food_id"))
            quantity = int(item.get("quantity"))
        except (TypeError, ValueError):
            db.close()

            return jsonify({
                "success": False,
                "message": "بيانات الطلب غير صحيحة"
            }), 400

        if quantity <= 0:
            db.close()

            return jsonify({
                "success": False,
                "message": "الكمية غير صحيحة"
            }), 400

        food = db.execute(
            "SELECT * FROM foods WHERE id = ? AND available = 1",
            (food_id,)
        ).fetchone()

        if not food:
            db.close()

            return jsonify({
                "success": False,
                "message": "إحدى الأكلات غير متوفرة"
            }), 400

        item_total = food["price"] * quantity
        total += item_total

        final_items.append({
            "food": food,
            "quantity": quantity
        })

    created_at = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    cursor = db.execute("""
        INSERT INTO orders
        (customer_name, phone, address, notes, total, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        customer_name,
        phone,
        address,
        notes,
        total,
        "new",
        created_at
    ))

    order_id = cursor.lastrowid

    for item in final_items:
        food = item["food"]
        quantity = item["quantity"]

        db.execute("""
            INSERT INTO order_items
            (
                order_id,
                food_id,
                food_name_ar,
                food_name_ku,
                price,
                quantity
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            order_id,
            food["id"],
            food["name_ar"],
            food["name_ku"],
            food["price"],
            quantity
        ))

    db.commit()
    db.close()

    return jsonify({
        "success": True,
        "order_id": order_id,
        "total": total
    })


@app.get("/api/orders")
@admin_required
def get_orders():
    db = get_db()

    orders = db.execute("""
        SELECT *
        FROM orders
        ORDER BY id DESC
    """).fetchall()

    result = []

    for order in orders:
        items = db.execute("""
            SELECT *
            FROM order_items
            WHERE order_id = ?
        """, (order["id"],)).fetchall()

        order_data = dict(order)

        order_data["items"] = [
            dict(item)
            for item in items
        ]

        result.append(order_data)

    db.close()

    return jsonify(result)


@app.patch("/api/orders/<int:order_id>/status")
@admin_required
def update_order_status(order_id):
    data = request.get_json() or {}

    status = data.get("status")

    allowed_statuses = [
        "new",
        "preparing",
        "ready",
        "delivered",
        "cancelled"
    ]

    if status not in allowed_statuses:
        return jsonify({
            "success": False,
            "message": "حالة غير صحيحة"
        }), 400

    db = get_db()

    db.execute(
        "UPDATE orders SET status = ? WHERE id = ?",
        (status, order_id)
    )

    db.commit()
    db.close()

    return jsonify({
        "success": True
    })


# =========================
# REPORTS
# =========================

@app.get("/api/reports")
@admin_required
def reports():
    db = get_db()

    total_orders = db.execute(
        "SELECT COUNT(*) AS count FROM orders"
    ).fetchone()["count"]

    total_income = db.execute(
        "SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE status != 'cancelled'"
    ).fetchone()["total"]

    today = date.today().strftime("%Y-%m-%d")

    today_orders = db.execute(
        "SELECT COUNT(*) AS count FROM orders WHERE created_at LIKE ?",
        (today + "%",)
    ).fetchone()["count"]

    today_income = db.execute("""
        SELECT COALESCE(SUM(total), 0) AS total
        FROM orders
        WHERE created_at LIKE ?
        AND status != 'cancelled'
    """, (today + "%",)).fetchone()["total"]

    best_foods = db.execute("""
        SELECT
            food_name_ar,
            food_name_ku,
            SUM(quantity) AS quantity
        FROM order_items
        GROUP BY food_id
        ORDER BY quantity DESC
        LIMIT 5
    """).fetchall()

    db.close()

    return jsonify({
        "total_orders": total_orders,
        "total_income": total_income,
        "today_orders": today_orders,
        "today_income": today_income,
        "best_foods": [
            dict(food)
            for food in best_foods
        ]
    })


# =========================
# START
# =========================

if __name__ == "__main__":
    init_db()

    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )