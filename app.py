# app.py

from flask import Flask, render_template, send_from_directory
from flask_cors import CORS
from routes.stores import stores_bp
from routes.districts import districts_bp
from routes.stats import stats_bp
from routes.auth import auth_bp
import logging
import os
import psycopg2

# Lấy biến DATABASE_URL từ biến môi trường Render
DATABASE_URL = os.environ.get("DATABASE_URL")

# Cấu hình logging (ghi cả ra file lẫn console)
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/app.log'),
        logging.StreamHandler()
    ]
)

# Hàm kết nối đến cơ sở dữ liệu PostgreSQL
def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        logging.error(f"Database connection failed: {e}")
        raise

# Khởi tạo ứng dụng Flask
app = Flask(__name__)
CORS(app)  # Cho phép CORS toàn app (rất cần khi frontend gọi fetch())

# Đăng ký các blueprint từ các module routes
app.register_blueprint(stores_bp, url_prefix='/api')
app.register_blueprint(districts_bp, url_prefix='/api')
app.register_blueprint(stats_bp, url_prefix='/api')
app.register_blueprint(auth_bp, url_prefix='/api')

# Route trang chủ (frontend HTML)
@app.route('/')
def index():
    return render_template('index.html')

# Route favicon (nếu có)
@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static', 'favicon.ico', mimetype='image/x-icon')

# Chạy ứng dụng (Render sẽ tự set biến PORT)
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
