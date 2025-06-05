# app.py
from flask import Flask, render_template
from routes.stores import stores_bp
from routes.districts import districts_bp
from routes.stats import stats_bp
from routes.auth import auth_bp
import logging
import os
import psycopg2
from config import DATABASE_URL  # Import DATABASE_URL từ config.py

# Cấu hình logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/app.log'),
        logging.StreamHandler()
    ]
)

# Hàm kết nối cơ sở dữ liệu
def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        logging.error(f"Database connection failed: {e}")
        raise

# Khởi tạo ứng dụng Flask
app = Flask(__name__)

# Đăng ký các blueprint từ các module routes
app.register_blueprint(stores_bp, url_prefix='/api')
app.register_blueprint(districts_bp, url_prefix='/api')
app.register_blueprint(stats_bp, url_prefix='/api')
app.register_blueprint(auth_bp, url_prefix='/api')

# Route phục vụ trang chủ
@app.route('/')
def index():
    """Render trang index.html từ thư mục templates"""
    return render_template('index.html')

# Route phục vụ favicon
@app.route('/favicon.ico')
def favicon():
    """Phục vụ file favicon.ico từ thư mục static"""
    return app.send_from_directory('static', 'favicon.ico', mimetype='image/x-icon')

if __name__ == '__main__':
    # Chạy ứng dụng ở chế độ debug trên cổng 5000
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))