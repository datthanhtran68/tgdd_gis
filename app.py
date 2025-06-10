# app.py

from flask import Flask, render_template, send_from_directory
from flask_cors import CORS
from routes.stores import stores_bp
from routes.districts import districts_bp
from routes.stats import stats_bp
from routes.auth import auth_bp
import logging
import os

# Cấu hình logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/app.log'),  # bạn có thể bỏ nếu không cần log file
        logging.StreamHandler()
    ]
)

# Khởi tạo Flask app
app = Flask(__name__)
CORS(app)  # Cho phép gọi API từ frontend khác domain (ngăn lỗi CORS)

# Đăng ký các blueprint
app.register_blueprint(stores_bp, url_prefix='/api')
app.register_blueprint(districts_bp, url_prefix='/api')
app.register_blueprint(stats_bp, url_prefix='/api')
app.register_blueprint(auth_bp, url_prefix='/api')

# Trang chủ
@app.route('/')
def index():
    return render_template('index.html')

# favicon (nếu có)
@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static', 'favicon.ico', mimetype='image/x-icon')

# Khởi động server
if __name__ == '__main__':
    # Render yêu cầu app phải chạy ở host 0.0.0.0 và PORT từ biến môi trường
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
