from pymongo import MongoClient
from bson import ObjectId
import json

# Kết nối MongoDB
client = MongoClient("mongodb://localhost:27017/")
db = client["CongTy"]
collection = db["employees"]

print("=== KIỂM TRA KẾT NỐI MONGODB ===")

try:
    # Kiểm tra server
    info = client.server_info()
    print(f"✅ Kết nối thành công! MongoDB version: {info.get('version')}")
    
    # Kiểm tra database và collection
    print(f"Các collection trong DB: {db.list_collection_names()}")
    
    # Đếm số lượng documents
    count = collection.count_documents({})
    print(f"Số lượng nhân viên: {count}")
    
    # Liệt kê vài document để kiểm tra
    if count > 0:
        print("\nMẫu dữ liệu:")
        for emp in collection.find().limit(2):
            emp_id = emp["_id"]
            print(f"ID: {emp_id} (type: {type(emp_id)})")
            print(f"Tên: {emp.get('name')}")
            print(f"Chức vụ: {emp.get('position')}")
            print("---")
            
            # Thử tìm bằng ID
            print(f"Kiểm tra tìm kiếm theo ID:")
            found = collection.find_one({"_id": emp_id})
            if found:
                print(f"✅ Tìm thấy: {found.get('name')}")
            else:
                print("❌ Không tìm thấy!")
    else:
        print("Collection rỗng! Hãy thêm dữ liệu trước.")
        
except Exception as e:
    print(f"❌ LỖI: {e}")