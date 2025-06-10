from flask import Blueprint, jsonify
from db import get_db_connection
import json

# Khởi tạo blueprint cho districts
districts_bp = Blueprint('districts', __name__)

@districts_bp.route('/districts')
def get_districts():
    """
    Lấy danh sách các quận với thông tin hình học (GeoJSON).
    Returns:
        JSON: Danh sách các quận với tên và thông tin hình học.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT name, ST_AsGeoJSON(geom) as geom FROM districts")
    districts = [
        {
            "name": row[0],
            "geom": json.loads(row[1])
        } for row in cur.fetchall()
    ]
    cur.close()
    conn.close()
    return jsonify(districts)
