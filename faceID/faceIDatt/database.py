from pymongo import MongoClient
from django.conf import settings
import datetime
import logging
import ssl
from bson.objectid import ObjectId

# Cấu hình logging
logger = logging.getLogger(__name__)

# Kết nối MongoDB với cấu hình bảo mật
try:
    client = MongoClient(
        settings.MONGO_URI,
        maxPoolSize=50,
        wtimeout=2500,
        ssl=True,
        ssl_cert_reqs=ssl.CERT_NONE,
        retryWrites=True,
        serverSelectionTimeoutMS=5000
    )
    
    # Kiểm tra kết nối
    client.admin.command('ismaster')
    logger.info("MongoDB connection successful")
    
    # Database và Collections
    db = client[settings.MONGO_DB_NAME]
    dataset_collection = db[settings.MONGO_COLLECTIONS['dataset']]
    signin_collection = db[settings.MONGO_COLLECTIONS['signin']]
    testdata_collection = db[settings.MONGO_COLLECTIONS['testdata']]
    trainner_collection = db[settings.MONGO_COLLECTIONS['trainner']]
    
except Exception as e:
    logger.error(f"MongoDB connection error: {str(e)}")
    raise

def get_employees():
    """Lấy danh sách nhân viên từ collection dataset"""
    try:
        employees = list(dataset_collection.find({}))
        # Chuyển ObjectId thành string
        for employee in employees:
            if '_id' in employee:
                employee['_id'] = str(employee['_id'])
        return employees
    except Exception as e:
        logger.error(f"Error getting employees: {str(e)}")
        return []

def get_employee_by_id(employee_id):
    """Lấy thông tin nhân viên theo ID"""
    try:
        return dataset_collection.find_one({'_id': ObjectId(employee_id)})
    except Exception as e:
        logger.error(f"Error getting employee by ID: {str(e)}")
        return None

def add_employee(employee_data):
    """Thêm nhân viên mới"""
    try:
        employee_data['timestamp'] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        result = dataset_collection.insert_one(employee_data)
        return str(result.inserted_id)
    except Exception as e:
        logger.error(f"Error adding employee: {str(e)}")
        raise

def update_employee(employee_id, updated_data):
    """Cập nhật thông tin nhân viên"""
    try:
        # Cập nhật thông tin ở dataset collection
        result = dataset_collection.update_one(
            {'_id': ObjectId(employee_id)},
            {'$set': updated_data}
        )
        
        # Nếu thông tin được cập nhật trong dataset, kiểm tra trong trainner
        if result.matched_count > 0:
            # Lấy tên nhân viên từ dữ liệu mới hoặc từ DB
            employee = dataset_collection.find_one({'_id': ObjectId(employee_id)})
            if employee:
                name = updated_data.get('name', employee.get('name'))
                if name:
                    # Cập nhật thông tin trong trainner nếu nhân viên đã đăng ký khuôn mặt
                    trainner_update = {}
                    for field in ['name', 'age', 'location', 'email', 'phone', 'job_position']:
                        if field in updated_data:
                            trainner_update[field] = updated_data[field]
                    
                    if trainner_update:
                        trainner_collection.update_many(
                            {'name': name},
                            {'$set': trainner_update}
                        )
        
        return result.matched_count > 0
    except Exception as e:
        logger.error(f"Error updating employee: {str(e)}")
        return False

def delete_employee(employee_id):
    """Xóa nhân viên"""
    try:
        # Lấy thông tin nhân viên trước khi xóa
        employee = dataset_collection.find_one({'_id': ObjectId(employee_id)})
        
        if not employee:
            return False
            
        # Xóa từ dataset collection
        result = dataset_collection.delete_one({'_id': ObjectId(employee_id)})
        
        # Nếu xóa thành công và có tên, xóa khỏi trainner collection
        if result.deleted_count > 0 and 'name' in employee:
            trainner_collection.delete_many({'name': employee['name']})
            
        return result.deleted_count > 0
    except Exception as e:
        logger.error(f"Error deleting employee: {str(e)}")
        return False

def get_face_features():
    """Lấy đặc trưng khuôn mặt của tất cả nhân viên"""
    try:
        return list(trainner_collection.find({}, {'_id': 1, 'name': 1, 'feature': 1, 
                                                  'age': 1, 'location': 1, 'email': 1, 
                                                  'phone': 1, 'job_position': 1}))
    except Exception as e:
        logger.error(f"Error getting face features: {str(e)}")
        return []

def save_face_feature(employee_id, name, feature_vector, image_path=None):
    """Lưu đặc trưng khuôn mặt của nhân viên"""
    try:
        # Tìm thông tin nhân viên để lấy metadata
        employee = get_employee_by_id(employee_id)
        
        if not employee:
            logger.error(f"Employee not found: {employee_id}")
            return False
        
        # Chuẩn bị dữ liệu để lưu
        trainner_data = {
            'name': name,
            'feature': feature_vector,
            'age': employee.get('age'),
            'email': employee.get('email'),
            'job_position': employee.get('job_position'),
            'location': employee.get('location'),
            'phone': employee.get('phone'),
            'updated_at': datetime.datetime.now()
        }
        
        if image_path:
            trainner_data['image_path'] = image_path
        
        # Kiểm tra xem nhân viên đã có feature chưa
        existing = trainner_collection.find_one({'name': name})
        
        if existing:
            # Cập nhật
            result = trainner_collection.update_one(
                {'name': name},
                {'$set': trainner_data}
            )
            success = result.modified_count > 0
        else:
            # Thêm mới
            result = trainner_collection.insert_one(trainner_data)
            success = result.inserted_id is not None
        
        # Cập nhật trạng thái face_registered trong dataset
        if success:
            dataset_collection.update_one(
                {'_id': ObjectId(employee_id)},
                {'$set': {'face_registered': True}}
            )
            
        return success
    except Exception as e:
        logger.error(f"Error saving face feature: {str(e)}")
        return False

def save_attendance(name, image_path, person_data=None):
    """Lưu thông tin điểm danh"""
    try:
        # Nếu không có person_data, tìm trong trainner collection
        if not person_data:
            person_data = trainner_collection.find_one({'name': name})
            if not person_data:
                logger.error(f"Person not found: {name}")
                return False
        
        # Tính toán các thông số điểm danh
        now = datetime.datetime.now()
        timestamp = now.strftime("%H:%M ngày %d/%m/%Y")
        
        # Cấu hình giờ làm việc
        work_hours = {
            'check_in': (7, 0),     # 7:00 AM
            'late_threshold': (7, 59), # 7:59 AM
            'noon': (12, 0),         # 12:00 PM
            'check_out': (16, 0)     # 4:00 PM
        }
        
        # Tính thời gian đi muộn/về sớm
        check_in_time = datetime.datetime.combine(
            now.date(), 
            datetime.time(work_hours['check_in'][0], work_hours['check_in'][1])
        )
        
        late_threshold = datetime.datetime.combine(
            now.date(),
            datetime.time(work_hours['late_threshold'][0], work_hours['late_threshold'][1])
        )
        
        noon_time = datetime.datetime.combine(
            now.date(),
            datetime.time(work_hours['noon'][0], work_hours['noon'][1])
        )
        
        check_out_time = datetime.datetime.combine(
            now.date(),
            datetime.time(work_hours['check_out'][0], work_hours['check_out'][1])
        )
        
        # Khởi tạo thời gian đến/về
        early_minutes = late_minutes = early_leave_minutes = late_leave_minutes = 0
        
        # Tính thời gian đến
        if now < check_in_time:
            # Đến sớm
            early_minutes = (check_in_time - now).total_seconds() / 60
        elif now <= late_threshold:
            # Trong khoảng cho phép
            late_minutes = 0
        else:
            # Đến muộn
            late_minutes = (now - check_in_time).total_seconds() / 60
        
        # Tính thời gian về
        if now < check_out_time:
            # Về sớm
            early_leave_minutes = (check_out_time - now).total_seconds() / 60
            late_leave_minutes = 0
        else:
            # Về trễ
            early_leave_minutes = 0
            late_leave_minutes = (now - check_out_time).total_seconds() / 60
        
        # Chuyển đổi sang định dạng chuỗi
        early_minutes_str = str(datetime.timedelta(minutes=early_minutes))
        late_minutes_str = str(datetime.timedelta(minutes=late_minutes))
        early_leave_minutes_str = str(datetime.timedelta(minutes=early_leave_minutes))
        late_leave_minutes_str = str(datetime.timedelta(minutes=late_leave_minutes))
        
        # Dữ liệu điểm danh
        attendance_data = {
            'name': name,
            'age': person_data.get('age'),
            'location': person_data.get('location'),
            'email': person_data.get('email'),
            'phone': person_data.get('phone'),
            'job_position': person_data.get('job_position'),
            'image_path': image_path,
            'timestamp': timestamp,
            'datetime': now,
            'early_minutes': early_minutes_str,
            'late_minutes': late_minutes_str,
            'early_leave_minutes': early_leave_minutes_str,
            'late_leave_minutes': late_leave_minutes_str,
            'created_at': now
        }
        
        # Lưu vào collection testdata
        result = testdata_collection.insert_one(attendance_data)
        return result.inserted_id is not None
    except Exception as e:
        logger.error(f"Error saving attendance: {str(e)}")
        return False

def get_attendance_history(name=None, employee_id=None):
    """Lấy lịch sử điểm danh của nhân viên"""
    try:
        query = {}
        if name:
            query['name'] = name
        elif employee_id:
            # Lấy tên từ ID
            employee = dataset_collection.find_one({'_id': ObjectId(employee_id)})
            if not employee:
                return []
            query['name'] = employee.get('name')
        
        # Lấy tất cả bản ghi điểm danh của nhân viên, sắp xếp theo thời gian giảm dần
        attendance_records = list(testdata_collection.find(query).sort('datetime', -1))
        
        # Chuyển ObjectId thành string
        for record in attendance_records:
            if '_id' in record:
                record['_id'] = str(record['_id'])
            if 'datetime' in record:
                record['datetime'] = record['datetime'].isoformat() if hasattr(record['datetime'], 'isoformat') else str(record['datetime'])
            if 'created_at' in record:
                record['created_at'] = record['created_at'].isoformat() if hasattr(record['created_at'], 'isoformat') else str(record['created_at'])
        
        return attendance_records
    except Exception as e:
        logger.error(f"Error getting attendance history: {str(e)}")
        return []