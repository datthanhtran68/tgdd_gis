# routes/districts.py
from flask import Blueprint, jsonify
import json
from db import get_db_connection

districts_bp = Blueprint('districts', __name__)

@districts_bp.route('/districts')
def get_districts():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT name, ST_AsGeoJSON(geom) as geom FROM districts")
    districts = [{"name": row[0], "geom": json.loads(row[1])} for row in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(districts)
