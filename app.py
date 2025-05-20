from flask import Flask, jsonify, render_template, request, send_from_directory
import psycopg2
import json
from psycopg2 import sql
import logging
import bcrypt
import os

app = Flask(__name__, static_folder='static', template_folder='templates')

logging.basicConfig(level=logging.ERROR, format='%(asctime)s - %(levelname)s - %(message)s')

def get_db_connection():
    try:
        conn = psycopg2.connect(
            dbname=os.environ.get('DB_NAME'),
            user=os.environ.get('DB_USER'),
            password=os.environ.get('DB_PASSWORD'),
            host=os.environ.get('DB_HOST'),
            port=os.environ.get('DB_PORT')
        )
        return conn
    except Exception as e:
        logging.error(f"Database connection failed: {e}")
        raise

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static', 'favicon.ico', mimetype='image/x-icon')

@app.route('/api/stores', methods=['GET'])
def get_stores():
    search_query = request.args.get('q', '')
    district = request.args.get('district', '')
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        query = "SELECT s.name, s.address, s.phone, s.open_hours, s.district, ST_X(s.geom) as lon, ST_Y(s.geom) as lat, s.image FROM stores s"
        params = []
        if search_query or district:
            query += " WHERE "
            conditions = []
            if search_query:
                conditions.append("s.name ILIKE %s")
                params.append(f"%{search_query}%")
            if district:
                conditions.append("s.district = %s")
                params.append(district)
            query += " AND ".join(conditions)
        cur.execute(query, params)
        stores = [
            {
                "name": row[0],
                "address": row[1],
                "phone": row[2],
                "open_hours": row[3],
                "district": row[4],
                "longitude": row[5],
                "latitude": row[6],
                "image": row[7] if row[7] else None
            } for row in cur.fetchall()
        ]
        return jsonify(stores)
    except Exception as e:
        logging.error(f"Error in /api/stores GET: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/stores', methods=['POST'])
def create_store():
    data = request.get_json()
    required_fields = ['name', 'address', 'phone', 'open_hours', 'district', 'latitude', 'longitude']
    if not all(key in data for key in required_fields):
        return jsonify({"error": "Thiếu thông tin chi nhánh"}), 400
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO stores (name, address, phone, open_hours, district, geom, image)
            VALUES (%s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s)
            RETURNING id
        """, (
            data['name'],
            data['address'],
            data['phone'],
            data['open_hours'],
            data['district'],
            float(data['longitude']),
            float(data['latitude']),
            data.get('image')
        ))
        store_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"id": store_id, "message": "Store created"}), 201
    except Exception as e:
        logging.error(f"Error in /api/stores POST: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/stores', methods=['PUT'])
def update_store():
    data = request.get_json()
    required_fields = ['name', 'latitude', 'longitude', 'original_name']
    if not all(key in data for key in required_fields):
        return jsonify({"error": "Thiếu thông tin chi nhánh: yêu cầu name, latitude, longitude, original_name"}), 400
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT name, address, phone, open_hours, district, image FROM stores WHERE name = %s", (data['original_name'],))
        store = cur.fetchone()
        if not store:
            return jsonify({"error": "Store not found"}), 404

        updated_data = {
            'name': data.get('name', store[0]),
            'address': data.get('address', store[1]) or store[1],
            'phone': data.get('phone', store[2]) or store[2],
            'open_hours': data.get('open_hours', store[3]) or store[3],
            'district': data.get('district', store[4]) or store[4],
            'latitude': float(data['latitude']),
            'longitude': float(data['longitude']),
            'image': data.get('image', store[5]),
            'original_name': data['original_name']
        }

        cur.execute("""
            UPDATE stores
            SET name = %s, address = %s, phone = %s, open_hours = %s, district = %s,
                geom = ST_SetSRID(ST_MakePoint(%s, %s), 4326), image = %s
            WHERE name = %s
            RETURNING id
        """, (
            updated_data['name'],
            updated_data['address'],
            updated_data['phone'],
            updated_data['open_hours'],
            updated_data['district'],
            updated_data['longitude'],
            updated_data['latitude'],
            updated_data['image'],
            updated_data['original_name']
        ))
        result = cur.fetchone()
        if result:
            conn.commit()
            return jsonify({"message": "Store updated"}), 200
        return jsonify({"error": "Store not found"}), 404
    except Exception as e:
        logging.error(f"Error in /api/stores PUT: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/stores', methods=['DELETE'])
def delete_store():
    name = request.args.get('name')
    if not name:
        return jsonify({"error": "Thiếu tên chi nhánh"}), 400
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM stores WHERE name = %s RETURNING id", (name,))
        result = cur.fetchone()
        if result:
            conn.commit()
            return jsonify({"message": "Store deleted"}), 200
        return jsonify({"error": "Store not found"}), 404
    except Exception as e:
        logging.error(f"Error in /api/stores DELETE: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/districts')
def get_districts():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT name, ST_AsGeoJSON(geom) as geom FROM districts")
        districts = [{"name": row[0], "geom": json.loads(row[1]) if row[1] else None} for row in cur.fetchall()]
        return jsonify(districts)
    except Exception as e:
        logging.error(f"Error in /api/districts: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/stats')
def get_stats():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT district, COUNT(*) FROM stores GROUP BY district")
        stats = {row[0]: row[1] for row in cur.fetchall()}
        return jsonify(stats)
    except Exception as e:
        logging.error(f"Error in /api/stats: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"success": False, "message": "Missing username or password"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT username, password, role FROM users WHERE username = %s", (username,))
        user = cur.fetchone()
        if user and bcrypt.checkpw(password.encode('utf-8'), user[1].encode('utf-8')):
            return jsonify({"success": True, "isAdmin": user[2] == 'admin'})
        return jsonify({"success": False, "message": "Invalid username or password"}), 401
    except Exception as e:
        logging.error(f"Error in /api/login: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/change-password', methods=['POST'])
def change_password():
    data = request.get_json()
    username = data.get('username')
    old_password = data.get('oldPassword')
    new_password = data.get('newPassword')

    if not username or not old_password or not new_password:
        return jsonify({"success": False, "message": "Missing username, old password, or new password"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT password FROM users WHERE username = %s", (username,))
        user = cur.fetchone()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        if not bcrypt.checkpw(old_password.encode('utf-8'), user[0].encode('utf-8')):
            return jsonify({"success": False, "message": "Old password is incorrect"}), 401

        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute("UPDATE users SET password = %s WHERE username = %s", (hashed_password, username))
        conn.commit()
        return jsonify({"success": True, "message": "Password changed successfully"}), 200
    except Exception as e:
        logging.error(f"Error in /api/change-password: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
