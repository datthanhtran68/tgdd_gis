from flask import Blueprint, jsonify
from db import get_db_connection

# Khởi tạo blueprint cho stats
stats_bp = Blueprint('stats', __name__)

@stats_bp.route('/stats')
def get_stats():
    """
    Lấy thống kê số lượng chi nhánh theo quận.
    Returns:
        JSON: Từ điển với quận làm key và số lượng chi nhánh làm value.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT district, COUNT(*) FROM stores GROUP BY district")
    stats = {row[0]: row[1] for row in cur.fetchall()}
    cur.close()
    conn.close()
    return jsonify(stats)
