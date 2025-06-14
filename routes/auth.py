# routes/auth.py
from flask import Blueprint, request, jsonify
from db import get_db_connection

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"success": False, "message": "Missing username or password"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT username, password, role FROM users WHERE username = %s", (username,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if user and user[1] == password:
        return jsonify({"success": True, "isAdmin": user[2] == 'admin'})
    return jsonify({"success": False, "message": "Invalid username or password"}), 401

@auth_bp.route('/change-password', methods=['POST'])
def change_password():
    data = request.get_json()
    username = data.get('username')
    old_password = data.get('oldPassword')
    new_password = data.get('newPassword')

    if not username or not old_password or not new_password:
        return jsonify({"success": False, "message": "Missing username, old password, or new password"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT password FROM users WHERE username = %s", (username,))
    user = cur.fetchone()

    if not user:
        cur.close()
        conn.close()
        return jsonify({"success": False, "message": "User not found"}), 404

    if user[0] != old_password:
        cur.close()
        conn.close()
        return jsonify({"success": False, "message": "Old password is incorrect"}), 401

    cur.execute("UPDATE users SET password = %s WHERE username = %s", (new_password, username))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"success": True, "message": "Password changed successfully"}), 200
