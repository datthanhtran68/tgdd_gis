# database/db.py
from config import DATABASE_URL
import psycopg2
import logging

def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        logging.error(f"Database connection failed: {e}")
        raise
