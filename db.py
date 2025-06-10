# db.py
import psycopg2
import logging

def get_db_connection():
    conn = psycopg2.connect(
        dbname="tgdd_gis",
        user="postgres",
        password="1",
        host="localhost",
        port="5432"
    )
    logging.debug("Kết nối database thành công")
    return conn
