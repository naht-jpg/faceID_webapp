import os
import getpass
import bcrypt
from pymongo import MongoClient
from dotenv import load_dotenv
from bson import ObjectId, Binary

# Load biến môi trường
load_dotenv()

# Kết nối MongoDB
mongo_uri = os.environ.get('MONGO_URI')
db_name = os.environ.get('MONGO_DB_NAME', 'pmmnm')

if not mongo_uri:
    print("Lỗi: Không tìm thấy MONGO_URI trong biến môi trường")
    exit(1)

try:
    client = MongoClient(mongo_uri)
    db = client[db_name]
    signin_collection = db['signin']
    
    print("\n=== TẠO NGƯỜI DÙNG MONGODB ===")
    
    name = input("Họ tên: ")
    password = getpass.getpass("Mật khẩu: ")
    confirm_password = getpass.getpass("Xác nhận mật khẩu: ")
    
    if password != confirm_password:
        print("Mật khẩu không khớp!")
        exit(1)
    
    # Mã hóa mật khẩu sử dụng bcrypt
    salt = bcrypt.gensalt(12)
    hashed_password = bcrypt.hashpw(password.encode(), salt)
    
    # Kiểm tra người dùng đã tồn tại chưa
    existing_user = signin_collection.find_one({'name': name})
    if existing_user:
        print(f"Người dùng '{name}' đã tồn tại!")
        option = input("Bạn có muốn cập nhật mật khẩu không? (y/n): ").lower()
        if option == 'y':
            signin_collection.update_one(
                {'name': name},
                {'$set': {'password': Binary(hashed_password)}}
            )
            print(f"✅ Đã cập nhật mật khẩu cho '{name}'!")
        exit(0)
    
    # Xác định role
    role = input("Chọn vai trò (admin/employee): ").lower()
    if role not in ['admin', 'employee']:
        role = 'employee'
    
    user_data = {
        'name': name,
        'password': Binary(hashed_password),
        'role': role
    }
    
    result = signin_collection.insert_one(user_data)
    
    print(f"✅ Tạo người dùng {name} thành công!")
    print(f"ID: {result.inserted_id}")
    print(f"Role: {role}")

except Exception as e:
    print(f"❌ Lỗi: {str(e)}")