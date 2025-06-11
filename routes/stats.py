# routes/stats.py
from flask import Blueprint, jsonify
from db import get_db_connection

stats_bp = Blueprint('stats', __name__)

@stats_bp.route('/stats')
def get_stats():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT district, COUNT(*) FROM stores GROUP BY district")
    stats = {row[0]: row[1] for row in cur.fetchall()}
    cur.close()
    conn.close()
    return jsonify(stats)
