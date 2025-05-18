import json
import psycopg2
from psycopg2 import sql

# Kết nối PostgreSQL
try:
    conn = psycopg2.connect(
        dbname="yenbai_bank_gis",
        user="postgres",
        password="1",
        host="localhost",
        port="5432"
    )
    cur = conn.cursor()
except Exception as e:
    print(f"Database connection error: {e}")
    exit()

# Đọc GeoJSON với encoding UTF-8-SIG
try:
    with open('base_map.geojson', 'r', encoding='utf-8-sig') as f:
        data = json.load(f)
except Exception as e:
    print(f"Error reading GeoJSON file: {e}")
    cur.close()
    conn.close()
    exit()

# Nhập dữ liệu mới
try:
    for feature in data['features']:
        name = feature['properties']['NAME_2']  # Sửa từ 'name' thành 'NAME_2' dựa trên cấu trúc file mới
        geom = json.dumps(feature['geometry'])
        query = sql.SQL("""
            INSERT INTO base_map (name, geom)
            VALUES (%s, ST_GeomFromGeoJSON(%s))
        """)
        cur.execute(query, (name, geom))
    conn.commit()
    print("Imported base_map successfully!")
except Exception as e:
    print(f"Error inserting data: {e}")
finally:
    cur.close()
    conn.close()