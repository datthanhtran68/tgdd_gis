# database/db.py
import psycopg2
import logging
from config import DATABASE_URL

def get_db_connection():
    """
    Tạo và trả về kết nối đến database PostgreSQL.
    Returns:
        connection: Đối tượng kết nối database.
    """
    try:
        conn = psycopg2.connect(DATABASE_URL)
        logging.debug("Kết nối database thành công")
        return conn
    except Exception as e:
        logging.error(f"Lỗi kết nối database: {e}")
        raise
