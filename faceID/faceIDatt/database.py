from pymongo import MongoClient
from django.conf import settings
import datetime
import logging
import ssl
from bson.objectid import ObjectId
from django.utils import timezone
from unidecode import unidecode


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
    dataset_collection = db['dataset']  # Collection lưu đường dẫn khuôn mặt
    employees_collection = db['employees']  # Collection lưu thông tin nhân viên
    attendance_collection = db['attendance']  # Collection lưu thông tin điểm danh
    signin_collection = db[settings.MONGO_COLLECTIONS.get('signin', 'signin')]  #Collection lưu thông tin tài khoản đăng nhập cho từng nhân viên
    trainner_collection = db[settings.MONGO_COLLECTIONS.get('trainner', 'trainner')]  # Collection lưu thông tin dữ liệu khuôn mặt đã được đổi thành Array
    testdata_collection = db['testdata']  # Collection lưu thông tin test vào testdata
    work_schedules_collection = db['work_schedules']  # Collection lưu thông tin lịch làm việc tùy chỉnh
    
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

def generate_employee_id(department=None):
    """Tạo mã nhân viên theo mẫu: [Mã phòng ban]-[Năm][Tháng][Số thứ tự]"""
    try:
        now = datetime.datetime.now()
        year_month = now.strftime("%y%m")
        
        # Mã phòng ban, mặc định là EMP nếu không có
        dept_code = "EMP"
        if department:
            # Lấy 2-3 ký tự đầu của phòng ban và chuyển thành in hoa
            dept_code = department.strip().upper()[:3]
            # Xóa dấu tiếng Việt nếu có
            dept_code = unidecode(dept_code)
        
        # Tìm số thứ tự lớn nhất hiện tại
        latest_employee = employees_collection.find_one(
            {"employee_id": {"$regex": f"^{dept_code}-{year_month}"}},
            sort=[("employee_id", -1)]
        )
        
        if latest_employee and latest_employee.get('employee_id'):
            # Tách phần số từ ID hiện có
            try:
                seq_num = int(latest_employee['employee_id'].split('-')[-1]) + 1
            except (ValueError, IndexError):
                seq_num = 1
        else:
            seq_num = 1
            
        # Tạo mã nhân viên mới với số thứ tự 3 chữ số
        new_id = f"{dept_code}-{year_month}{seq_num:03d}"
        return new_id
    except Exception as e:
        logger.error(f"Error generating employee ID: {str(e)}")
        return f"EMP-{year_month}001"  # ID mặc định nếu có lỗi

def add_employee(employee_data):
    """Thêm nhân viên mới vào collection employees"""
    try:
        # Thêm timestamp
        employee_data['timestamp'] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        employee_data['created_at'] = datetime.datetime.now()
        
        # Tạo mã nhân viên tự động nếu chưa có
        if not employee_data.get('employee_id'):
            employee_data['employee_id'] = generate_employee_id(employee_data.get('department'))
        
        # Lưu thông tin nhân viên vào collection employees
        result = employees_collection.insert_one(employee_data)
        mongodb_id = str(result.inserted_id)
        
        # Tạo bản ghi trong dataset để lưu đường dẫn khuôn mặt (trống ban đầu)
        dataset_record = {
            'employee_id': employee_data['employee_id'],  # Dùng mã nhân viên đã tạo
            'mongodb_id': mongodb_id,  # Lưu thêm MongoDB ID để tham chiếu
            'name': employee_data.get('name', ''),
            'image_path': None,
            'has_face': False,
            'created_at': datetime.datetime.now()
        }
        dataset_collection.insert_one(dataset_record)
        
        return mongodb_id
    except Exception as e:
        logger.error(f"Error adding employee: {str(e)}")
        raise

def update_employee(employee_id, updated_data):
    """Cập nhật thông tin nhân viên trong collection employees"""
    try:
        # Kiểm tra nếu employee_id là chuỗi rỗng, xóa khỏi dữ liệu cập nhật
        if 'employee_id' in updated_data and not updated_data['employee_id']:
            # Nếu không có employee_id, tạo mới dựa trên department
            updated_data['employee_id'] = generate_employee_id(updated_data.get('department'))
        
        # Cập nhật thời gian
        updated_data['updated_at'] = datetime.datetime.now()
        
        # Cập nhật thông tin trong employees collection
        result = employees_collection.update_one(
            {'_id': ObjectId(employee_id)},
            {'$set': updated_data}
        )
        
        # Cập nhật các collection liên quan
        if result.matched_count > 0:
            # Lấy tên và employee_id mới từ dữ liệu cập nhật hoặc từ DB
            employee = employees_collection.find_one({'_id': ObjectId(employee_id)})
            if employee:
                # Tạo dictionary các trường cần cập nhật cho các collection khác
                update_fields = {}
                for field in ['name', 'employee_id', 'department', 'job_position', 'email', 'phone']:
                    if field in updated_data:
                        update_fields[field] = updated_data[field]
                
                if update_fields:
                    # Cập nhật dataset collection
                    dataset_collection.update_many(
                        {'mongodb_id': employee_id},
                        {'$set': update_fields}
                    )
                    
                    # Cập nhật trainner collection
                    trainner_collection.update_many(
                        {'employee_id': employee.get('employee_id')},
                        {'$set': update_fields}
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

def save_attendance(name, image_path, person_data=None, is_check_out=False):
    """Lưu thông tin điểm danh vào collection attendance"""
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
        now = timezone.now()  
        timestamp = now.strftime("%H:%M ngày %d/%m/%Y")
        
        # Lấy cấu hình thời gian làm việc
        work_schedule = get_work_schedule()
        
        # Cấu hình giờ làm việc
        work_hours = {
            'start': timezone.make_aware(
                datetime.datetime.combine(
                    now.date(), 
                    datetime.time(
                        hour=work_schedule.get('start_hour', 7),
                        minute=work_schedule.get('start_minute', 0)
                    )
                ),
                timezone.get_current_timezone()
            ),
            'end': timezone.make_aware(
                datetime.datetime.combine(
                    now.date(), 
                    datetime.time(
                        hour=work_schedule.get('end_hour', 17),
                        minute=work_schedule.get('end_minute', 0)
                    )
                ),
                timezone.get_current_timezone()
            )
        }
        
        # Tính toán các thông số đi muộn, về sớm
        early_minutes = datetime.timedelta(0)
        late_minutes = datetime.timedelta(0)
        early_leave_minutes = datetime.timedelta(0)
        late_leave_minutes = datetime.timedelta(0)
        
        # Nếu là check-out, tính toán thời gian về sớm/muộn
        if is_check_out:
            # Ensure timezone awareness
            now_aware = timezone.localtime(now)
            end_time_aware = timezone.localtime(work_hours['end'])
            
            # Nếu về sớm hơn giờ kết thúc
            if now_aware < end_time_aware:
                early_leave_minutes = end_time_aware - now_aware
            else:
                late_leave_minutes = now_aware - end_time_aware
        else:
            # Ensure timezone awareness
            now_aware = timezone.localtime(now)
            start_time_aware = timezone.localtime(work_hours['start'])
            
            # Nếu đi làm muộn hơn giờ bắt đầu
            if now_aware > start_time_aware:
                late_minutes = now_aware - start_time_aware
            else:
                early_minutes = start_time_aware - now_aware
        
        # Chuyển đổi thành chuỗi định dạng H:M:S
        early_minutes_str = str(early_minutes)
        late_minutes_str = str(late_minutes)
        early_leave_minutes_str = str(early_leave_minutes)
        late_leave_minutes_str = str(late_leave_minutes)
        
        # Tạo dữ liệu điểm danh cho attendance collection
        attendance_data = {
            'name': name,
            'image_path': image_path,
            'timestamp': timestamp,
            'early_minutes': early_minutes_str,
            'late_minutes': late_minutes_str,
            'early_leave_minutes': early_leave_minutes_str,
            'late_leave_minutes': late_leave_minutes_str,
            'created_at': now,
            'is_check_out': is_check_out,
            'datetime': now,
            'employee_id': str(employee_id) 

        }
        
        # Thêm thông tin nhân viên nếu có
        if employee:
            attendance_data.update({
                'employee_id': str(employee.get('_id')),
                'age': employee.get('age'),
                'location': employee.get('location'),
                'email': employee.get('email'),
                'phone': employee.get('phone'),
                'job_position': employee.get('job_position')
            })
        elif person_data:
            attendance_data.update({
                'employee_id': person_data.get('employee_id'),
                'age': person_data.get('age'),
                'location': person_data.get('location'),
                'email': person_data.get('email'),
                'phone': person_data.get('phone'),
                'job_position': person_data.get('job_position')
            })
        
        # Nếu là check-out, ƯU TIÊN CẬP NHẬT bản ghi check-in
        if is_check_out and employee_id:
            # Lấy timezone offset từ client
            client_timezone_offset = attendance_data.get('timezone_offset')
            if client_timezone_offset is not None:
                # Chuyển đổi thời gian hiện tại về timezone của client
                offset_seconds = -int(client_timezone_offset) * 60
                now = now + datetime.timedelta(seconds=offset_seconds)
            
            # Tìm bản ghi check-in hôm nay
            start_of_day = timezone.make_aware(
                datetime.datetime.combine(now.date(), datetime.time(0, 0, 0)),
                timezone.get_current_timezone()
            )
            
            latest_check_in = attendance_collection.find_one({
                'employee_id': str(employee_id),
                'datetime': {'$gte': start_of_day},
                'is_check_out': {'$ne': True}
            }, sort=[('datetime', -1)])
            
            if latest_check_in:
                # Cập nhật bản ghi check-in với thông tin check-out thay vì tạo mới
                attendance_collection.update_one(
                    {'_id': latest_check_in['_id']},
                    {
                        '$set': {
                            'check_out_time': now,
                            'updated_at': now,
                            'early_leave_minutes': early_leave_minutes_str,
                            'late_leave_minutes': late_leave_minutes_str,
                            'is_check_out_record': True  # Đánh dấu đã check-out
                        }
                    }
                )
                
                # Không tạo bản ghi mới sau khi cập nhật thành công
                return True
        
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

def update_dataset_image_path(employee_id, image_path):
    """Cập nhật đường dẫn ảnh trong collection dataset"""
    try:
        # Kiểm tra xem bản ghi dataset đã tồn tại chưa
        dataset_record = dataset_collection.find_one({'employee_id': employee_id})
        
        if dataset_record:
            # Cập nhật đường dẫn ảnh nếu bản ghi đã tồn tại
            dataset_collection.update_one(
                {'employee_id': employee_id},
                {'$set': {
                    'image_path': image_path,
                    'has_face': True,
                    'updated_at': datetime.datetime.now()
                }}
            )
        else:
            # Lấy thông tin nhân viên để tạo bản ghi mới
            employee = employees_collection.find_one({'_id': ObjectId(employee_id)})
            
            if not employee:
                logger.error(f"Employee with ID {employee_id} not found")
                return False
                
            # Tạo bản ghi mới trong dataset
            dataset_record = {
                'employee_id': employee_id,
                'name': employee.get('name', ''),
                'age': employee.get('age', ''),
                'location': employee.get('location', ''),
                'email': employee.get('email', ''),
                'phone': employee.get('phone', ''),
                'job_position': employee.get('job_position', ''),
                'image_path': image_path,
                'has_face': True,
                'created_at': datetime.datetime.now(),
                'timestamp': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
            dataset_collection.insert_one(dataset_record)
            
        return True
    except Exception as e:
        logger.error(f"Error updating dataset image path: {str(e)}")
        return False

def get_work_schedule(schedule_id=None):
    """Lấy cấu hình thời gian làm việc"""
    try:
        if schedule_id:
            return work_schedules_collection.find_one({'_id': ObjectId(schedule_id)})
        else:
            # Lấy cấu hình mặc định (active)
            schedule = work_schedules_collection.find_one({'is_active': True})
            if not schedule:
                # Nếu không có cấu hình mặc định, tạo một cấu hình mặc định
                default_schedule = {
                    'name': 'Lịch Làm Việc Mặc Định',
                    'start_hour': 7,
                    'start_minute': 0,
                    'end_hour': 17,
                    'end_minute': 0,
                    'is_active': True,
                    'created_at': datetime.datetime.now()
                }
                result = work_schedules_collection.insert_one(default_schedule)
                return work_schedules_collection.find_one({'_id': result.inserted_id})
            return schedule
    except Exception as e:
        logger.error(f"Error getting work schedule: {str(e)}")
        # Trả về cấu hình mặc định nếu có lỗi
        return {
            'name': 'Lịch Làm Việc Mặc Định',
            'start_hour': 7,
            'start_minute': 0,
            'end_hour': 17,
            'end_minute': 0,
            'is_active': True
        }

def get_all_work_schedules():
    """Lấy tất cả cấu hình thời gian làm việc"""
    try:
        return list(work_schedules_collection.find())
    except Exception as e:
        logger.error(f"Error getting all work schedules: {str(e)}")
        return []

def create_work_schedule(data):
    """Tạo cấu hình thời gian làm việc mới"""
    try:
        # Nếu là cấu hình mặc định, vô hiệu hóa tất cả các cấu hình mặc định khác
        if data.get('is_active', False):
            work_schedules_collection.update_many(
                {'is_active': True},
                {'$set': {'is_active': False}}
            )
        
        result = work_schedules_collection.insert_one(data)
        return str(result.inserted_id)
    except Exception as e:
        logger.error(f"Error creating work schedule: {str(e)}")
        return None

def update_work_schedule(schedule_id, data):
    """Cập nhật cấu hình thời gian làm việc"""
    try:
        # Nếu là cấu hình mặc định, vô hiệu hóa tất cả các cấu hình mặc định khác
        if data.get('is_active', False):
            work_schedules_collection.update_many(
                {'is_active': True, '_id': {'$ne': ObjectId(schedule_id)}},
                {'$set': {'is_active': False}}
            )
        
        work_schedules_collection.update_one(
            {'_id': ObjectId(schedule_id)},
            {'$set': data}
        )
        return True
    except Exception as e:
        logger.error(f"Error updating work schedule: {str(e)}")
        return False

def delete_work_schedule(schedule_id):
    """Xóa cấu hình thời gian làm việc"""
    try:
        # Không cho phép xóa cấu hình mặc định duy nhất
        schedule = work_schedules_collection.find_one({'_id': ObjectId(schedule_id)})
        if schedule and schedule.get('is_active') and work_schedules_collection.count_documents({}) == 1:
            return False
        
        result = work_schedules_collection.delete_one({'_id': ObjectId(schedule_id)})
        return result.deleted_count > 0
    except Exception as e:
        logger.error(f"Error deleting work schedule: {str(e)}")
        return False

def calculate_work_time(check_in_time, check_out_time):
    """Tính thời gian làm việc từ check-in đến check-out"""
    try:
        # Lấy timezone hiện tại
        current_tz = timezone.get_current_timezone()
        
        # chuyển đổi check_in_time và check_out_time thành datetime
        if isinstance(check_in_time, str):
            try:
                # Thử chuyển đổi với timezone info
                check_in_time = datetime.datetime.fromisoformat(check_in_time.replace('Z', '+00:00'))
            except ValueError:
                # Nếu không có timezone info, tạo datetime naive
                check_in_time = datetime.datetime.strptime(check_in_time.split('.')[0], "%Y-%m-%dT%H:%M:%S")
        
        if isinstance(check_out_time, str):
            try:
                # Thử chuyển đổi với timezone info
                check_out_time = datetime.datetime.fromisoformat(check_out_time.replace('Z', '+00:00'))
            except ValueError:
                # Nếu không có timezone info, tạo datetime naive
                check_out_time = datetime.datetime.strptime(check_out_time.split('.')[0], "%Y-%m-%dT%H:%M:%S")
        
        # Làm cho check_in_time và check_out_time trở thành timezone-aware
        if not timezone.is_aware(check_in_time):
            check_in_time = timezone.make_aware(check_in_time, current_tz)
            
        if not timezone.is_aware(check_out_time):
            check_out_time = timezone.make_aware(check_out_time, current_tz)
        
        # Tính toán thời gian làm việc
        work_time = check_out_time - check_in_time
        
        return str(work_time)
    except Exception as e:
        logger.error(f"Error calculating work time: {str(e)}")
        return "0:00:00"

# Khi nhận datetime từ client
def handle_attendance(request, employee_id):
    data = request.data
    
    # Đảm bảo datetime có timezone
    if 'datetime' in data:
        try:
            # Nếu datetime đã có timezone (dạng ISO với Z hoặc +00:00)
            datetime_obj = datetime.datetime.fromisoformat(data['datetime'].replace('Z', '+00:00'))
            if not timezone.is_aware(datetime_obj):
                datetime_obj = timezone.make_aware(datetime_obj)
            data['datetime'] = datetime_obj
        except (ValueError, TypeError):
            # Nếu parse thất bại, sử dụng thời gian hiện tại
            data['datetime'] = timezone.now()
    
    # Tiếp tục xử lý với datetime đã có timezone
    # Thêm các trường cần thiết khác
    if 'created_at' not in data:
        data['created_at'] = timezone.now()
    
    # Lưu vào cơ sở dữ liệu
    from .database import attendance_collection
    
    # Chuyển employee_id thành chuỗi nếu cần
    if 'employee_id' not in data:
        data['employee_id'] = str(employee_id)
    
    # Thêm vào MongoDB
    result = attendance_collection.insert_one(data)
    return result.inserted_id is not None