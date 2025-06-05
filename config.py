# config.py
import os

# Lấy cấu hình từ biến môi trường DATABASE_URL
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:1@localhost:5432/tgdd_gis')