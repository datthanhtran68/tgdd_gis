import pandas as pd
import psycopg2
from psycopg2 import sql

# Kết nối PostgreSQL
conn = psycopg2.connect(
    dbname="tgdđ_gis",
    user="postgres",
    password="1",
    host="localhost",
    port="5432"
)
cur = conn.cursor()

# Đọc CSV
df = pd.read_csv('stores.csv')

# Nhập dữ liệu
for _, row in df.iterrows():
    query = sql.SQL("""
        INSERT INTO stores (name, address, phone, open_hours, district, geom)
        VALUES (%s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
    """)
    cur.execute(query, (
        row['name'],
        row['address'],
        row['phone'],
        row['open_hours'],
        row['district'],
        row['longitude'],  # ST_MakePoint(longitude, latitude)
        row['latitude']
    ))

# Commit và đóng kết nối
conn.commit()
cur.close()
conn.close()
print("Imported stores successfully!")