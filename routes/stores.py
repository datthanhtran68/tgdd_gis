from flask import Blueprint, jsonify, request
from database.db import get_db_connection
import logging

# Khởi tạo blueprint cho stores
stores_bp = Blueprint('stores', __name__)

@stores_bp.route('/stores', methods=['GET'])
def get_stores():
    """
    Lấy danh sách chi nhánh với tùy chọn tìm kiếm theo tên hoặc quận.
    Query params:
        q (str): Từ khóa tìm kiếm tên chi nhánh.
        district (str): Lọc theo quận.
    Returns:
        JSON: Danh sách chi nhánh.
    """
    search_query = request.args.get('q', '')
    district = request.args.get('district', '')
    conn = get_db_connection()
    cur = conn.cursor()
    
    query = """
        SELECT s.name, s.address, s.phone, s.open_hours, s.district, 
               ST_X(s.geom) as lon, ST_Y(s.geom) as lat, s.image
        FROM stores s
    """
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
    cur.close()
    conn.close()
    return jsonify(stores)

@stores_bp.route('/stores', methods=['POST'])
def create_store():
    """
    Tạo mới một chi nhánh.
    Body:
        JSON chứa name, address, phone, open_hours, district, latitude, longitude, image (tùy chọn).
    Returns:
        JSON: ID chi nhánh mới và thông báo.
    """
    data = request.get_json()
    required_fields = ['name', 'address', 'phone', 'open_hours', 'district', 'latitude', 'longitude']
    if not all(key in data for key in required_fields):
        return jsonify({"error": "Thiếu thông tin chi nhánh"}), 400
    
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
        data['longitude'],
        data['latitude'],
        data.get('image')
    ))
    store_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"id": store_id, "message": "Store created"}), 201

@stores_bp.route('/stores', methods=['PUT'])
def update_store():
    """
    Cập nhật thông tin chi nhánh.
    Body:
        JSON chứa name, latitude, longitude, original_name và các trường tùy chọn.
    Returns:
        JSON: Thông báo cập nhật thành công hoặc lỗi.
    """
    data = request.get_json()
    required_fields = ['name', 'latitude', 'longitude', 'original_name']
    if not all(key in data for key in required_fields):
        return jsonify({"error": "Thiếu thông tin chi nhánh: yêu cầu name, latitude, longitude, original_name"}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT name, address, phone, open_hours, district, image
        FROM stores
        WHERE name = %s
    """, (data['original_name'],))
    store = cur.fetchone()
    if not store:
        cur.close()
        conn.close()
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
    cur.close()
    conn.close()
    if result:
        conn.commit()
        return jsonify({"message": "Store updated"}), 200
    return jsonify({"error": "Store not found"}), 404

@stores_bp.route('/stores', methods=['DELETE'])
def delete_store():
    """
    Xóa một chi nhánh theo tên.
    Query params:
        name (str): Tên chi nhánh cần xóa.
    Returns:
        JSON: Thông báo xóa thành công hoặc lỗi.
    """
    name = request.args.get('name')
    if not name:
        return jsonify({"error": "Thiếu tên chi nhánh"}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM stores WHERE name = %s RETURNING id", (name,))
    result = cur.fetchone()
    cur.close()
    conn.close()
    if result:
        conn.commit()
        return jsonify({"message","Store deleted"}), 200
    return jsonify({"error": "Store not found"}), 404