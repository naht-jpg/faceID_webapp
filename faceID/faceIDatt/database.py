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
    
    # Database và Collections - cập nhật theo cấu trúc mới
    db = client[settings.MONGO_DB_NAME]
    dataset_collection = db['dataset']  # Lưu đường dẫn khuôn mặt
    employees_collection = db['employees']  # Collection mới lưu thông tin nhân viên
    attendance_collection = db['attendance']  # Collection mới lưu thông tin điểm danh
    signin_collection = db[settings.MONGO_COLLECTIONS.get('signin', 'signin')]  #lưu thông tin tài khoản đăng nhập cho từng nhân viên
    trainner_collection = db[settings.MONGO_COLLECTIONS.get('trainner', 'trainner')]  
    
except Exception as e:
    logger.error(f"MongoDB connection error: {str(e)}")
    raise

def get_employees():
    """Lấy danh sách nhân viên từ collection employees"""
    try:
        employees = list(employees_collection.find({}))
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
        return employees_collection.find_one({'_id': ObjectId(employee_id)})
    except Exception as e:
        logger.error(f"Error getting employee by ID: {str(e)}")
        return None

def add_employee(employee_data):
    """Thêm nhân viên mới vào collection employees"""
    try:
        # Thêm timestamp
        employee_data['timestamp'] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        employee_data['created_at'] = datetime.datetime.now()
        
        # Lưu thông tin nhân viên vào collection employees
        result = employees_collection.insert_one(employee_data)
        employee_id = str(result.inserted_id)
        
        # Tạo bản ghi trong dataset để lưu đường dẫn khuôn mặt (trống ban đầu)
        dataset_record = {
            'employee_id': employee_id,
            'name': employee_data.get('name', ''),
            'image_path': None,
            'has_face': False,
            'created_at': datetime.datetime.now()
        }
        dataset_collection.insert_one(dataset_record)
        
        return employee_id
    except Exception as e:
        logger.error(f"Error adding employee: {str(e)}")
        raise

def update_employee(employee_id, updated_data):
    """Cập nhật thông tin nhân viên trong collection employees"""
    try:
        # Cập nhật thông tin trong employees collection
        updated_data['updated_at'] = datetime.datetime.now()
        result = employees_collection.update_one(
            {'_id': ObjectId(employee_id)},
            {'$set': updated_data}
        )
        
        # Nếu thông tin được cập nhật, kiểm tra trong trainner và dataset
        if result.matched_count > 0:
            # Lấy tên nhân viên từ dữ liệu mới hoặc từ DB
            employee = employees_collection.find_one({'_id': ObjectId(employee_id)})
            if employee:
                name = updated_data.get('name', employee.get('name'))
                if name:
                    # Cập nhật tên trong dataset nếu có
                    dataset_collection.update_one(
                        {'employee_id': employee_id},
                        {'$set': {'name': name}}
                    )
                    
                    # Cập nhật thông tin trong trainner nếu nhân viên đã đăng ký khuôn mặt
                    trainner_update = {}
                    for field in ['name', 'age', 'location', 'email', 'phone', 'job_position']:
                        if field in updated_data:
                            trainner_update[field] = updated_data[field]
                    
                    if trainner_update:
                        trainner_collection.update_many(
                            {'employee_id': employee_id},
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
        employee = employees_collection.find_one({'_id': ObjectId(employee_id)})
        
        if not employee:
            return False
            
        # Xóa từ employees collection
        result = employees_collection.delete_one({'_id': ObjectId(employee_id)})
        
        # Nếu xóa thành công, xóa khỏi các collection liên quan
        if result.deleted_count > 0:
            # Xóa từ dataset collection
            dataset_collection.delete_many({'employee_id': employee_id})
            
            # Xóa từ trainner collection
            trainner_collection.delete_many({'employee_id': employee_id})
            
        return result.deleted_count > 0
    except Exception as e:
        logger.error(f"Error deleting employee: {str(e)}")
        return False

def get_face_features():
    """Lấy đặc trưng khuôn mặt của tất cả nhân viên"""
    try:
        # Lấy dữ liệu từ trainner collection và kết hợp với employee data
        features = []
        trainers = list(trainner_collection.find({}, {
            '_id': 1, 
            'employee_id': 1, 
            'name': 1, 
            'feature_vector': 1, 
            'image_path': 1
        }))
        
        for trainer in trainers:
            # Lấy thông tin nhân viên từ employees collection
            employee_id = trainer.get('employee_id')
            if employee_id:
                employee = employees_collection.find_one({'_id': ObjectId(employee_id)})
                if employee:
                    # Kết hợp thông tin
                    trainer['age'] = employee.get('age')
                    trainer['location'] = employee.get('location')
                    trainer['email'] = employee.get('email')
                    trainer['phone'] = employee.get('phone')
                    trainer['job_position'] = employee.get('job_position')
                    features.append(trainer)
        
        return features
    except Exception as e:
        logger.error(f"Error getting face features: {str(e)}")
        return []

def save_face_feature(employee_id, name, feature_vector, image_path=None):
    """Lưu đặc trưng khuôn mặt của nhân viên"""
    try:
        # Kiểm tra xem nhân viên có tồn tại không
        employee = employees_collection.find_one({'_id': ObjectId(employee_id)})
        if not employee:
            logger.error(f"Employee ID {employee_id} not found")
            return False
        
        # Dữ liệu cho collection trainner
        trainner_data = {
            'employee_id': employee_id,
            'name': name,
            'feature_vector': feature_vector,
            'created_at': datetime.datetime.now()
        }
        
        # Thêm đường dẫn ảnh nếu có
        if image_path:
            trainner_data['image_path'] = image_path
            # Trích xuất đường dẫn thư mục từ đường dẫn ảnh
            import os
            employee_folder_path = os.path.dirname(image_path)
        else:
            employee_folder_path = None
        
        # Lưu vào collection trainner
        result = trainner_collection.insert_one(trainner_data)
        
        # Cập nhật thông tin khuôn mặt trong dataset collection
        update_data = {
            'has_face': True,
            'updated_at': datetime.datetime.now()
        }
        
        # Thêm đường dẫn nếu có
        if image_path:
            update_data['image_path'] = image_path
            if employee_folder_path:
                update_data['folder_path'] = employee_folder_path
        
        dataset_collection.update_one(
            {'employee_id': employee_id},
            {'$set': update_data}
        )
        
        return result.inserted_id is not None
    except Exception as e:
        logger.error(f"Error saving face feature: {str(e)}")
        return False

def save_attendance(name, image_path, person_data=None):
    """Lưu thông tin điểm danh"""
    try:
        # Nếu không có person_data, tìm trong trainner collection
        employee_id = None
        if not person_data:
            trainer = trainner_collection.find_one({'name': name})
            if not trainer:
                logger.error(f"Person not found: {name}")
                return False
            employee_id = trainer.get('employee_id')
            person_data = trainer
        else:
            employee_id = person_data.get('employee_id')
        
        # Tìm thông tin nhân viên từ ID
        employee = None
        if employee_id:
            employee = employees_collection.find_one({'_id': ObjectId(employee_id)})
        
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
            'employee_id': employee_id,
            'name': name,
            'image_path': image_path,
            'timestamp': timestamp,
            'datetime': now,
            'early_minutes': early_minutes_str,
            'late_minutes': late_minutes_str,
            'early_leave_minutes': early_leave_minutes_str,
            'late_leave_minutes': late_leave_minutes_str,
            'created_at': now
        }
        
        # Thêm thông tin nhân viên nếu có
        if employee:
            attendance_data.update({
                'age': employee.get('age'),
                'location': employee.get('location'),
                'email': employee.get('email'),
                'phone': employee.get('phone'),
                'job_position': employee.get('job_position')
            })
        
        # Lưu vào collection attendance
        result = attendance_collection.insert_one(attendance_data)
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
            query['employee_id'] = employee_id
        
        # Lấy tất cả bản ghi điểm danh của nhân viên, sắp xếp theo thời gian giảm dần
        attendance_records = list(attendance_collection.find(query).sort('datetime', -1))
        
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