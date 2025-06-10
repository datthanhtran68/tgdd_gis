# db.py

import os
import psycopg2
import logging

# Lấy DATABASE_URL từ biến môi trường do Render cung cấp
DATABASE_URL = os.environ.get("DATABASE_URL")

def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        logging.error(f"Database connection failed: {e}")
        raise
