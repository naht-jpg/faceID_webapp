from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from pymongo import MongoClient
from bson import ObjectId
from bson.errors import InvalidId
import json
import bcrypt
import logging
import os
import base64
import numpy as np
import cv2
import dlib
from datetime import datetime, timedelta, time
from django.utils import timezone

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User

from .face_recognition import recognize_face, register_face
from .models import Employee, Attendance
from .serializers import EmployeeSerializer
from .auth import MongoDBAuthBackend, get_tokens_for_user
from .database import (
    get_employees, get_employee_by_id, add_employee,
    update_employee, delete_employee, get_attendance_history,
    signin_collection, attendance_collection, employees_collection,
    get_work_schedule, get_all_work_schedules, 
    create_work_schedule, update_work_schedule, delete_work_schedule
)

# Setup logger
logger = logging.getLogger(__name__)

# Sử dụng MONGO_URI từ settings thay vì hard-code
client = MongoClient(settings.MONGO_URI)
db = client[settings.MONGO_DB_NAME]
collection = db[settings.MONGO_COLLECTIONS['dataset']]

# Load dlib models
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")

# Load models
detector = dlib.get_frontal_face_detector()
sp = dlib.shape_predictor(os.path.join(MODEL_DIR, "shape_predictor_68_face_landmarks.dat"))
facerec = dlib.face_recognition_model_v1(os.path.join(MODEL_DIR, "dlib_face_recognition_resnet_model_v1.dat"))

@api_view(['POST'])
def face_check(request):
    image = request.data.get('image')
    name = recognize_face(image)
    return Response({'name': name if name else "Unknown"})

@api_view(['GET'])
def test_api(request):
    """Simple test API endpoint to check if the API is working"""
    return Response({
        'status': 'success',
        'message': 'FaceID API is working properly',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def test_mongo_connection(request):
    """API kiểm tra kết nối MongoDB"""
    from pymongo import MongoClient
    from django.conf import settings
    
    mongo_uri = settings.MONGO_URI
    db_name = settings.MONGO_DB_NAME
    
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        server_info = client.server_info()
        
        db = client[db_name]
        collections = db.list_collection_names()
        
        # Đếm số lượng documents trong từng collection
        collection_stats = {}
        for collection_name in collections:
            collection_stats[collection_name] = db[collection_name].count_documents({})
        
        return Response({
            'status': 'success',
            'connection_status': 'Connected',
            'mongodb_version': server_info.get('version', 'unknown'),
            'database': db_name,
            'collections': collections,
            'collection_stats': collection_stats
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': "Database connection failed",
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def mongodb_token_obtain(request):
    """API đăng nhập với MongoDB signin collection"""
    try:
        username = request.data.get('username')  # Trên frontend vẫn dùng username
        password = request.data.get('password')
        
        if not username or not password:
            return Response({
                'detail': 'Thiếu tên đăng nhập hoặc mật khẩu'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Sử dụng backend tùy chỉnh
        auth_backend = MongoDBAuthBackend()
        user = auth_backend.authenticate(request, username=username, password=password)
        
        if not user:
            return Response({
                'detail': 'Tài khoản hoặc mật khẩu không chính xác'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Lấy mongo_user từ request
        mongo_user = getattr(request, 'mongo_user', {})
        
        # Tạo token
        tokens = get_tokens_for_user(user)
        
        return Response({
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'user': {
                'id': str(mongo_user.get('_id', '')),
                'name': mongo_user.get('name', username),
                'role': mongo_user.get('role', 'employee')
            }
        })
    
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return Response({
            'detail': 'Lỗi đăng nhập'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    try:
        username = request.user.username
        
        # Find user in MongoDB
        user_data = signin_collection.find_one({'name': username})
        
        if not user_data:
            return Response({
                'name': username,
                'role': 'admin' if request.user.is_staff else 'employee'
            })
        
        # Thêm code để tìm employee liên quan
        employee_data = None
        employee_id = user_data.get('employee_id')
        custom_employee_id = None
        
        # Nếu có employee_id trong user_data, sử dụng nó
        if employee_id:
            from .database import employees_collection
            try:
                employee_data = employees_collection.find_one({'_id': ObjectId(employee_id)})
                if employee_data and 'employee_id' in employee_data:
                    custom_employee_id = employee_data.get('employee_id')
            except:
                # Thử tìm theo tên nếu không tìm được theo ID
                employee_data = employees_collection.find_one({'name': username})
                if employee_data and 'employee_id' in employee_data:
                    custom_employee_id = employee_data.get('employee_id')
        else:
            # Tìm employee theo name
            from .database import employees_collection
            employee_data = employees_collection.find_one({'name': username})
            if employee_data and 'employee_id' in employee_data:
                custom_employee_id = employee_data.get('employee_id')
        
        # Trả về cả hai ID
        response_data = {
            'id': str(user_data.get('_id', '')),
            'name': user_data.get('name', username),
            'role': user_data.get('role', 'employee')
        }
        
        if employee_data:
            response_data['employee_id'] = str(employee_data.get('_id', ''))
            # Thêm custom employee_id vào response
            response_data['custom_employee_id'] = custom_employee_id
        
        return Response(response_data)
    
    except Exception as e:
        logger.error(f"Current user error: {str(e)}")
        return Response({
            'detail': 'Lỗi khi lấy thông tin người dùng'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    """API đăng ký người dùng mới"""
    try:
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email', '')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        
        # Validate required fields
        if not username or not password:
            return Response({
                'success': False,
                'detail': 'Tên đăng nhập và mật khẩu là bắt buộc'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user already exists
        if User.objects.filter(username=username).exists():
            return Response({
                'success': False,
                'detail': 'Tên đăng nhập đã tồn tại'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        # Create the user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        
        return Response({
            'success': True,
            'detail': 'Đăng ký thành công'
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return Response({
            'success': False,
            'detail': 'Lỗi khi đăng ký người dùng'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        return super().default(o)

class EmployeeListAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """GET method: Lấy danh sách nhân viên"""
        try:
            employees = get_employees()
            if not isinstance(employees, list):
                employees = []
                
            response = Response(employees)
            # Add headers to prevent caching
            response["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response["Pragma"] = "no-cache"
            response["Expires"] = "0"
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        """POST method: Tạo nhân viên mới"""
        try:
            print("Received employee data:", request.data)
            
            employee_data = request.data
            employee_id = add_employee(employee_data)
            
            print("Created employee with ID:", employee_id)
            
            return Response({
                'success': True,
                '_id': employee_id,
                'message': 'Đã tạo nhân viên mới'
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            print("Error creating employee:", str(e))
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class EmployeeDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, employee_id):
        """GET method: Lấy thông tin nhân viên theo ID"""
        try:
            employee = get_employee_by_id(employee_id)
            if employee:
                # Chuyển _id thành string để serializable
                if '_id' in employee:
                    employee['_id'] = str(employee['_id'])
                return Response(employee)
            else:
                return Response({'error': 'Không tìm thấy nhân viên'}, status=status.HTTP_404_NOT_FOUND)
        except InvalidId:
            return Response({'error': 'ID không hợp lệ'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def put(self, request, employee_id):
        """PUT method: Cập nhật toàn bộ thông tin nhân viên"""
        try:
            updated_data = request.data
            result = update_employee(employee_id, updated_data)
            if result:
                # Lấy thông tin nhân viên đã cập nhật để trả về
                updated_employee = get_employee_by_id(employee_id)
                if updated_employee:
                    if '_id' in updated_employee:
                        updated_employee['_id'] = str(updated_employee['_id'])
                    return Response({
                        'success': True,
                        'message': 'Đã cập nhật thông tin nhân viên',
                        'data': updated_employee
                    })
                else:
                    return Response({
                        'success': True,
                        'message': 'Đã cập nhật thông tin nhân viên'
                    })
            else:
                return Response({'error': 'Không tìm thấy nhân viên'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
    def patch(self, request, employee_id):
        """PATCH method: Cập nhật một phần thông tin nhân viên"""
        try:
            employee = get_employee_by_id(employee_id)
            if not employee:
                return Response({'error': 'Không tìm thấy nhân viên'}, status=status.HTTP_404_NOT_FOUND)
                
            # Chỉ cập nhật các trường được cung cấp
            updated_data = {k: v for k, v in request.data.items() if v is not None}
            result = update_employee(employee_id, updated_data)
            
            if result:
                return Response({
                    'success': True,
                    'message': 'Đã cập nhật thông tin nhân viên'
                })
            else:
                return Response({'error': 'Không thể cập nhật nhân viên'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def delete(self, request, employee_id):
        """DELETE method: Xóa nhân viên"""
        try:
            result = delete_employee(employee_id)
            if result:
                return Response({
                    'success': True,
                    'message': 'Đã xóa nhân viên'
                })
            else:
                return Response({'error': 'Không tìm thấy nhân viên'}, status=status.HTTP_404_NOT_FOUND)
        except InvalidId:
            return Response({'error': 'ID không hợp lệ'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class FaceRegisterAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """API đăng ký khuôn mặt cho nhân viên"""
        try:
            data = request.data
            employee_id = data.get('employee_id')
            name = data.get('name')
            image_data = data.get('image')
            
            # Log để debug
            logger.info(f"Received registration request: employee_id={employee_id}, name={name}")
            
            if not employee_id or not image_data:
                return Response({
                    'success': False,
                    'message': 'Thiếu employee_id hoặc image'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Kiểm tra kiểu dữ liệu image
            if not isinstance(image_data, str):
                logger.warning(f"Invalid image type: {type(image_data)}")
                return Response({
                    'success': False,
                    'message': 'Định dạng ảnh không hợp lệ, cần base64'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Đăng ký khuôn mặt - lưu vào dataset và tạo feature trong trainer
            result = register_face(employee_id, name, image_data)
            
            # Thống nhất với mã trạng thái HTTP
            if result.get('success'):
                return Response(result, status=status.HTTP_201_CREATED)
            else:
                return Response(result, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Face registration error: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return Response({
                'success': False,
                'message': f"Lỗi server: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class FaceRecognitionAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """API nhận diện khuôn mặt"""
        try:
            image_data = request.data.get('image')
            
            if not image_data:
                return Response({
                    'success': False,
                    'message': 'Thiếu dữ liệu image'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Nhận diện khuôn mặt và lưu vào testdata nếu thành công
            result = recognize_face(image_data)
            return Response(result)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AttendanceAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, employee_id):
        """GET: Lấy lịch sử điểm danh của nhân viên"""
        try:
            # Lấy tham số query
            year = request.query_params.get('year')
            month = request.query_params.get('month')
            day = request.query_params.get('day')
            latest = request.query_params.get('latest', False)
            today = request.query_params.get('today', False)
            latest_or_today = request.query_params.get('latest_or_today', False)
            
            from .database import attendance_collection
            
            # First try today, then try latest if no results
            if latest_or_today:
                today_response = self._get_today_attendance(employee_id)
                if today_response.data.get('records') and len(today_response.data['records']) > 0:
                    return today_response
                else:
                    return self._get_latest_attendance(employee_id)
                    
            # Nếu yêu cầu bản ghi mới nhất
            if latest:
                return self._get_latest_attendance(employee_id)
                
            # Nếu yêu cầu bản ghi hôm nay
            if today:
                return self._get_today_attendance(employee_id)
                
            # Lấy dữ liệu dựa trên bộ lọc
            query = {'employee_id': employee_id}
            
            if year and month and day:
                # Lọc theo ngày cụ thể
                start_date = datetime(int(year), int(month), int(day), 0, 0, 0)
                end_date = datetime(int(year), int(month), int(day), 23, 59, 59)
                query['datetime'] = {'$gte': start_date, '$lte': end_date}
            elif year and month:
                # Lọc theo tháng
                start_date = datetime(int(year), int(month), 1, 0, 0, 0)
                # Xác định ngày cuối tháng
                if int(month) == 12:
                    end_date = datetime(int(year) + 1, 1, 1, 0, 0, 0)
                else:
                    end_date = datetime(int(year), int(month) + 1, 1, 0, 0, 0)
                end_date = end_date - timedelta(seconds=1)
                query['datetime'] = {'$gte': start_date, '$lte': end_date}
            
            # Thực hiện truy vấn
            attendance_records = list(attendance_collection.find(query).sort('datetime', -1))
            
            # Chuyển đổi ObjectId và datetime thành chuỗi
            for record in attendance_records:
                if '_id' in record:
                    record['_id'] = str(record['_id'])
                if 'datetime' in record:
                    record['datetime'] = record['datetime'].isoformat() if hasattr(record['datetime'], 'isoformat') else str(record['datetime'])
                if 'created_at' in record:
                    record['created_at'] = record['created_at'].isoformat() if hasattr(record['created_at'], 'isoformat') else str(record['created_at'])
            
            return Response({
                'success': True,
                'records': attendance_records,
                'count': len(attendance_records)
            })
            
        except Exception as e:
            logger.error(f"Error getting attendance: {str(e)}")
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    def _get_latest_attendance(self, employee_id):
        """Helper method to get latest attendance"""
        try:
            from .database import attendance_collection
            
            attendance_record = attendance_collection.find_one(
                {'employee_id': employee_id},
                sort=[('datetime', -1)]
            )
            
            if not attendance_record:
                # Change from 404 to 200 with empty data
                return Response({
                    'success': True,
                    'message': 'Không tìm thấy dữ liệu điểm danh',
                    'data': None
                })
                
            # Rest of the method remains unchanged
            attendance_record['_id'] = str(attendance_record['_id'])
            
            # Chuyển datetime sang string
            if 'datetime' in attendance_record:
                attendance_record['datetime'] = attendance_record['datetime'].isoformat() if hasattr(attendance_record['datetime'], 'isoformat') else str(attendance_record['datetime'])
            if 'created_at' in attendance_record:
                attendance_record['created_at'] = attendance_record['created_at'].isoformat() if hasattr(attendance_record['created_at'], 'isoformat') else str(attendance_record['created_at'])
                
            return Response({
                'success': True,
                'data': attendance_record
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _get_today_attendance(self, employee_id):
        """Helper method to get today's attendance"""
        try:
            # Use timezone-aware datetime objects
            now = timezone.now()
            start_of_day = timezone.make_aware(
                datetime(now.year, now.month, now.day, 0, 0, 0),
                timezone.get_current_timezone()
            )
            end_of_day = timezone.make_aware(
                datetime(now.year, now.month, now.day, 23, 59, 59),
                timezone.get_current_timezone()
            )
            
            # Tìm các bản ghi điểm danh trong ngày
            from .database import attendance_collection
            
            
            query_employee_id = str(employee_id)
            
            logger.debug(f"Searching for attendance with query: employee_id={query_employee_id}, datetime between {start_of_day} and {end_of_day}")
            
            today_attendance = list(attendance_collection.find({
                'employee_id': query_employee_id,
                'datetime': {
                    '$gte': start_of_day,
                    '$lte': end_of_day
                }
            }).sort('datetime', -1))
            
            logger.info(f"Found {len(today_attendance)} attendance records for employee {employee_id}")
            
            # Nếu không tìm thấy bản ghi nào, trả về thông báo
            for record in today_attendance:
                if '_id' in record:
                    record['_id'] = str(record['_id'])
                if 'datetime' in record:
                    record['datetime'] = record['datetime'].isoformat() if hasattr(record['datetime'], 'isoformat') else str(record['datetime'])
                if 'created_at' in record:
                    record['created_at'] = record['created_at'].isoformat() if hasattr(record['created_at'], 'isoformat') else str(record['created_at'])
                if 'check_out_time' in record and record['check_out_time']:
                    record['check_out_time'] = record['check_out_time'].isoformat() if hasattr(record['check_out_time'], 'isoformat') else str(record['check_out_time'])
            
            return Response({
                'success': True,
                'message': f'Đã tìm thấy {len(today_attendance)} bản ghi điểm danh hôm nay',
                'records': today_attendance
            })
            
        except Exception as e:
            import traceback
            logger.error(f"Error in get_today_attendance: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'success': False,
                'message': f'Lỗi khi lấy dữ liệu điểm danh: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request, employee_id):
        """POST: Tạo bản ghi điểm danh mới"""
        try:
            data = request.data
            
            # Đảm bảo data có employee_id
            if 'employee_id' not in data:
                data['employee_id'] = str(employee_id)
                
            # Thêm datetime nếu không có
            if 'datetime' not in data:
                data['datetime'] = timezone.now()
            else:
                # Đảm bảo datetime có timezone và sử dụng timezone_offset từ client
                try:
                    # Nếu là string, chuyển thành datetime với timezone
                    if isinstance(data['datetime'], str):
                        datetime_obj = datetime.fromisoformat(data['datetime'].replace('Z', '+00:00'))
                        
                        # Apply timezone offset from client if provided
                        if 'timezone_offset' in data:
                            try:
                                # Convert minutes to seconds
                                offset_seconds = -int(data['timezone_offset']) * 60
                                datetime_obj = datetime_obj + timedelta(seconds=offset_seconds)
                            except (ValueError, TypeError):
                                pass
                                
                        if not timezone.is_aware(datetime_obj):
                            datetime_obj = timezone.make_aware(datetime_obj)
                        data['datetime'] = datetime_obj
                except (ValueError, TypeError):
                    data['datetime'] = timezone.now()
            
            # Thêm các trường khác nếu cần
            if 'created_at' not in data:
                data['created_at'] = timezone.now()
            
            # Xử lý check-out: Tìm và cập nhật bản ghi check-in thay vì tạo record mới
            if data.get('is_check_out'):
                now = data['datetime']
                # Tìm bản ghi check-in gần nhất của ngày hôm nay
                start_of_day = timezone.make_aware(
                    datetime.combine(now.date(), time(0, 0, 0)),
                    timezone.get_current_timezone()
                )
                
                # Tìm bản ghi check-in gần nhất
                check_in_record = attendance_collection.find_one({
                    'employee_id': str(employee_id),
                    'datetime': {'$gte': start_of_day},
                    'is_check_out': {'$ne': True}
                }, sort=[('datetime', -1)])
                
                if check_in_record:
                    # Lấy cấu hình thời gian làm việc
                    work_schedule = get_work_schedule()
                    
                    # Cấu hình giờ làm việc
                    current_tz = timezone.get_current_timezone()
                    end_work_time = timezone.make_aware(
                        datetime.combine(
                            now.date(), 
                            time(
                                hour=work_schedule.get('end_hour', 17),
                                minute=work_schedule.get('end_minute', 0)
                            )
                        ),
                        current_tz
                    )
                    
                    # Tính toán thời gian về sớm/muộn
                    early_leave_minutes = timedelta(0)
                    late_leave_minutes = timedelta(0)
                    
                    # Ensure now is timezone aware
                    if not timezone.is_aware(now):
                        now = timezone.make_aware(now, current_tz)
                        
                    # Ensure end_work_time is timezone aware
                    if not timezone.is_aware(end_work_time):
                        end_work_time = timezone.make_aware(end_work_time, current_tz)
                        
                    if now < end_work_time:
                        early_leave_minutes = end_work_time - now
                    else:
                        late_leave_minutes = now - end_work_time
                    
                    # Ensure check_in_time is timezone aware
                    check_in_time = check_in_record['datetime']
                    if not timezone.is_aware(check_in_time):
                        check_in_time = timezone.make_aware(check_in_time, current_tz)
                        
                    # Tính thời gian làm việc
                    work_duration = now - check_in_time
                    work_time = str(work_duration)
                    
                    # Cập nhật bản ghi check-in
                    update_result = attendance_collection.update_one(
                        {'_id': check_in_record['_id']},
                        {'$set': {
                            'check_out_time': now,
                            'early_leave_minutes': str(early_leave_minutes),
                            'late_leave_minutes': str(late_leave_minutes),
                            'is_check_out': True,
                            'work_time': work_time,
                            'updated_at': timezone.now()
                        }}
                    )
                    
                    # Lấy bản ghi đã cập nhật để trả về
                    updated_record = attendance_collection.find_one({'_id': check_in_record['_id']})
                    
                    if updated_record:
                        updated_record['_id'] = str(updated_record['_id'])
                        for key in updated_record:
                            if isinstance(updated_record[key], datetime):
                                updated_record[key] = updated_record[key].isoformat()
                    
                    return Response({
                        'success': True,
                        'message': 'Đã cập nhật bản ghi điểm danh',
                        'id': str(check_in_record['_id']),
                        'attendance': updated_record
                    }, status=status.HTTP_200_OK)
                else:
                    # Fallback: Create a new check-out record if no check-in found
                    logger.warning(f"No check-in record found for employee {employee_id} for checkout. Creating new record.")
                    
                    # Add checkout flag to data
                    data['is_check_out'] = True
                    data['is_check_out_record'] = True
                    
                    # Insert new record
                    result = attendance_collection.insert_one(data)
                    
                    return Response({
                        'success': True,
                        'message': 'Đã tạo bản ghi check-out mới (không tìm thấy check-in)',
                        'id': str(result.inserted_id),
                        'attendance': data
                    }, status=status.HTTP_201_CREATED)
                    
            # Xử lý check-in: Tính toán thời gian đến sớm/muộn
            else:
                # Tính toán thông số đi muộn, về sớm dựa trên lịch làm việc
                work_schedule = get_work_schedule()
                now = data['datetime']
                
                # Cấu hình giờ làm việc
                current_tz = timezone.get_current_timezone()
                work_hours = {
                    'start': timezone.make_aware(
                        datetime.combine(
                            now.date(), 
                            time(
                                hour=work_schedule.get('start_hour', 7),
                                minute=work_schedule.get('start_minute', 0)
                            )
                        ),
                        current_tz
                    )
                }
                
                # Tính toán các thông số đi muộn, đến sớm
                early_minutes = timedelta(0)
                late_minutes = timedelta(0)
                
                # Nếu đi làm muộn hơn giờ bắt đầu
                if now > work_hours['start']:
                    late_minutes = now - work_hours['start']
                    data['late_minutes'] = str(late_minutes)
                else:
                    early_minutes = work_hours['start'] - now
                    data['early_minutes'] = str(early_minutes)
                    
                # Thêm vào cơ sở dữ liệu
                result = attendance_collection.insert_one(data)
                
                # Lấy bản ghi mới tạo để trả về
                created_record = attendance_collection.find_one({'_id': result.inserted_id})
                if created_record:
                    created_record['_id'] = str(created_record['_id'])
                    for key in created_record:
                        if isinstance(created_record[key], datetime):
                            created_record[key] = created_record[key].isoformat()
                
                return Response({
                    'success': True,
                    'message': 'Đã tạo bản ghi điểm danh',
                    'id': str(result.inserted_id),
                    'attendance': created_record
                }, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            import traceback
            logger.error(f"Error creating attendance: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def employee_attendance_summary(request, employee_id):
    """API lấy tổng hợp thống kê điểm danh theo tháng"""
    try:
        # Get parameters
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        
        if not year or not month:
            return Response({
                'success': False,
                'message': 'Thiếu tham số year hoặc month'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Convert to int
        year = int(year)
        month = int(month)
        
        # Define time range for the month
        start_date = datetime(year, month, 1, 0, 0, 0)
        
        # Calculate end date (first day of next month)
        if month == 12:
            end_date = datetime(year + 1, 1, 1, 0, 0, 0)
        else:
            end_date = datetime(year, month + 1, 1, 0, 0, 0)
        
        # Adjust end date to be the last moment of the current month
        end_date = end_date - timedelta(seconds=1)
        
        # Query attendance records for this employee in the specified month
        from .database import attendance_collection
        
        query = {
            'employee_id': employee_id,
            'datetime': {
                '$gte': start_date,
                '$lte': end_date
            }
        }
        
        attendance_records = list(attendance_collection.find(query))
        
        # Calculate statistics
        total = len(attendance_records)
        onTime = 0
        late = 0
        earlyLeave = 0
        
        for record in attendance_records:
            if record.get('late_minutes') and record.get('late_minutes') != '0:00:00':
                late += 1
            else:
                onTime += 1
                
            if record.get('early_leave_minutes') and record.get('early_leave_minutes') != '0:00:00':
                earlyLeave += 1
        
        return Response({
            'success': True,
            'total': total,
            'onTime': onTime,
            'late': late,
            'earlyLeave': earlyLeave
        })
        
    except Exception as e:
        import traceback
        logger.error(f"Error getting attendance summary: {str(e)}")
        logger.error(traceback.format_exc())
        return Response({
            'success': False,
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AdminAttendanceAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        """GET: Lấy thông tin điểm danh với các bộ lọc thời gian và nhân viên"""
        try:
            # Lấy các tham số query
            employee_id = request.query_params.get('employee_id')
            employee_name = request.query_params.get('employee_name')
            year = request.query_params.get('year')
            month = request.query_params.get('month')
            day = request.query_params.get('day')
            hour = request.query_params.get('hour')
            minute = request.query_params.get('minute')
            second = request.query_params.get('second')
            date_range_start = request.query_params.get('date_range_start')
            date_range_end = request.query_params.get('date_range_end')
            
            # Xây dựng query
            query = {}
            
            # Lọc theo nhân viên
            if employee_id:
                query['employee_id'] = employee_id
            if employee_name:
                query['name'] = {'$regex': employee_name, '$options': 'i'}  # i for case-insensitive
            
            # Lọc theo thời gian
            if date_range_start and date_range_end:
                # Nếu có khoảng thời gian
                start_date = datetime.fromisoformat(date_range_start.replace('Z', '+00:00'))
                end_date = datetime.fromisoformat(date_range_end.replace('Z', '+00:00'))
                query['datetime'] = {'$gte': start_date, '$lte': end_date}
            else:
                # Lọc theo các thành phần thời gian riêng lẻ
                datetime_query = {}
                
                if year:
                    start_year = datetime(int(year), 1, 1)
                    end_year = datetime(int(year) + 1, 1, 1) - timedelta(seconds=1)
                    datetime_query = {'$gte': start_year, '$lte': end_year}
                
                if month:
                    if year:
                        # Nếu đã có năm, tinh chỉnh khoảng thời gian
                        year_val = int(year)
                        month_val = int(month)
                        if month_val == 12:
                            next_month_year = year_val + 1
                            next_month = 1
                        else:
                            next_month_year = year_val
                            next_month = month_val + 1
                            
                        start_month = datetime(year_val, month_val, 1)
                        end_month = datetime(next_month_year, next_month, 1) - timedelta(seconds=1)
                        datetime_query = {'$gte': start_month, '$lte': end_month}
                    else:
                        # Nếu không có năm, lọc theo tháng của năm hiện tại
                        current_year = datetime.now().year
                        month_val = int(month)
                        if month_val == 12:
                            next_month_year = current_year + 1
                            next_month = 1
                        else:
                            next_month_year = current_year
                            next_month = month_val + 1
                            
                        start_month = datetime(current_year, month_val, 1)
                        end_month = datetime(next_month_year, next_month, 1) - timedelta(seconds=1)
                        datetime_query = {'$gte': start_month, '$lte': end_month}
                
                if day:
                    # Lọc theo ngày cụ thể
                    if year and month:
                        day_val = int(day)
                        year_val = int(year)
                        month_val = int(month)
                        
                        start_day = datetime(year_val, month_val, day_val)
                        end_day = datetime(year_val, month_val, day_val, 23, 59, 59)
                        datetime_query = {'$gte': start_day, '$lte': end_day}
                    else:
                        # Nếu không có năm và tháng, lọc theo ngày của tháng hiện tại
                        current_date = datetime.now()
                        day_val = int(day)
                        
                        if day_val <= current_date.day:
                            # Nếu ngày <= ngày hiện tại, lấy tháng hiện tại
                            start_day = datetime(current_date.year, current_date.month, day_val)
                            end_day = datetime(current_date.year, current_date.month, day_val, 23, 59, 59)
                        else:
                            # Nếu ngày > ngày hiện tại, lấy tháng trước
                            if current_date.month == 1:
                                prev_month_year = current_date.year - 1
                                prev_month = 12
                            else:
                                prev_month_year = current_date.year
                                prev_month = current_date.month - 1
                                
                            start_day = datetime(prev_month_year, prev_month, day_val)
                            end_day = datetime(prev_month_year, prev_month, day_val, 23, 59, 59)
                            
                        datetime_query = {'$gte': start_day, '$lte': end_day}
                
                if hour or minute or second:
                    # Lọc theo giờ, phút, giây (sử dụng ngày hiện tại nếu không có ngày được chỉ định)
                    from .database import attendance_collection
                    pipeline = []
                    
                    # Đầu tiên lấy các bản ghi phù hợp với các điều kiện khác
                    match_stage = {'$match': query.copy() if query else {}}
                    pipeline.append(match_stage)
                    
                    # Thêm stage để lọc theo giờ, phút, giây
                    time_conditions = []
                    if hour:
                        time_conditions.append({'$eq': [{'$hour': '$datetime'}, int(hour)]})
                    if minute:
                        time_conditions.append({'$eq': [{'$minute': '$datetime'}, int(minute)]})
                    if second:
                        time_conditions.append({'$eq': [{'$second': '$datetime'}, int(second)]})
                    
                    if time_conditions:
                        time_match = {'$match': {'$expr': {'$and': time_conditions}}}
                        pipeline.append(time_match)
                    
                    # Thực hiện truy vấn pipeline
                    attendance_records = list(attendance_collection.aggregate(pipeline))
                    
                    # Xử lý kết quả
                    for record in attendance_records:
                        if '_id' in record:
                            record['_id'] = str(record['_id'])
                        if 'datetime' in record:
                            record['datetime'] = record['datetime'].isoformat() if hasattr(record['datetime'], 'isoformat') else str(record['datetime'])
                        if 'created_at' in record:
                            record['created_at'] = record['created_at'].isoformat() if hasattr(record['created_at'], 'isoformat') else str(record['created_at'])
                    
                    # Lấy danh sách tất cả nhân viên để hiển thị dropdown
                    employees = get_employees()
                    
                    return Response({
                        'success': True,
                        'records': attendance_records,
                        'employees': employees,
                        'count': len(attendance_records)
                    })
                
                # Nếu có query thời gian và không phải là truy vấn giờ/phút/giây
                if datetime_query:
                    query['datetime'] = datetime_query
            
            # Thực hiện truy vấn
            from .database import attendance_collection
            
            # Sắp xếp theo thời gian giảm dần
            attendance_records = list(attendance_collection.find(query).sort('datetime', -1))
            
            # Xử lý kết quả
            for record in attendance_records:
                if '_id' in record:
                    record['_id'] = str(record['_id'])
                if 'datetime' in record:
                    record['datetime'] = record['datetime'].isoformat() if hasattr(record['datetime'], 'isoformat') else str(record['datetime'])
                if 'created_at' in record:
                    record['created_at'] = record['created_at'].isoformat() if hasattr(record['created_at'], 'isoformat') else str(record['created_at'])
                if 'check_out_time' in record and record['check_out_time']:
                    record['check_out_time'] = record['check_out_time'].isoformat() if hasattr(record['check_out_time'], 'isoformat') else str(record['check_out_time'])
            
            # Lấy danh sách tất cả nhân viên để hiển thị dropdown
            employees = get_employees()
            
            return Response({
                'success': True,
                'records': attendance_records,
                'employees': employees,
                'count': len(attendance_records)
            })
            
        except Exception as e:
            logger.error(f"Error in admin attendance view: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SigninListAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """GET: Lấy danh sách tài khoản"""
        try:
            users = list(signin_collection.find())
            # Chuyển đổi ObjectId sang string
            for user in users:
                user['_id'] = str(user['_id'])
                # Không trả về mật khẩu
                if 'password' in user:
                    del user['password']
            
            return Response(users)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        """POST: Tạo tài khoản mới"""
        try:
            data = request.data
            
            # Kiểm tra xem tên người dùng đã tồn tại chưa
            if signin_collection.find_one({'name': data['name']}):
                return Response({
                    'success': False,
                    'message': 'Tên đăng nhập đã tồn tại'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Mã hóa mật khẩu
            if 'password' in data and data['password']:
                password = data['password'].encode('utf-8')
                salt = bcrypt.gensalt()
                hashed_password = bcrypt.hashpw(password, salt)
                data['password'] = hashed_password
            
            # Tạo document mới trong MongoDB
            result = signin_collection.insert_one(data)
            
            return Response({
                'success': True,
                'message': 'Đã tạo tài khoản',
                'id': str(result.inserted_id)
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SigninDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        """GET: Lấy thông tin tài khoản theo ID"""
        try:
            # Lấy tài khoản theo ID
            account = signin_collection.find_one({'_id': ObjectId(pk)})
            if not account:
                return Response({
                    'success': False,
                    'message': 'Không tìm thấy tài khoản'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Chuyển đổi ObjectId sang string
            account['_id'] = str(account['_id'])
            # Không trả về mật khẩu
            if 'password' in account:
                del account['password']
                
            return Response({
                'success': True,
                'data': account
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def put(self, request, pk):
        """PUT: Cập nhật toàn bộ thông tin tài khoản"""
        try:
            data = request.data
            
            # Kiểm tra xem tài khoản có tồn tại không
            if not signin_collection.find_one({'_id': ObjectId(pk)}):
                return Response({
                    'success': False,
                    'message': 'Không tìm thấy tài khoản'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Mã hóa mật khẩu nếu có
            if 'password' in data and data['password']:
                password = data['password'].encode('utf-8')
                salt = bcrypt.gensalt()
                hashed_password = bcrypt.hashpw(password, salt)
                data['password'] = hashed_password
            
            # Cập nhật document
            signin_collection.update_one(
                {'_id': ObjectId(pk)},
                {'$set': data}
            )
            
            return Response({
                'success': True,
                'message': 'Đã cập nhật tài khoản'
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def patch(self, request, pk):
        """PATCH: Cập nhật một phần thông tin tài khoản"""
        try:
            data = request.data
            
            # Kiểm tra xem tài khoản có tồn tại không
            if not signin_collection.find_one({'_id': ObjectId(pk)}):
                return Response({
                    'success': False,
                    'message': 'Không tìm thấy tài khoản'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Mã hóa mật khẩu nếu có
            if 'password' in data and data['password']:
                password = data['password'].encode('utf-8')
                salt = bcrypt.gensalt()
                hashed_password = bcrypt.hashpw(password, salt)
                data['password'] = hashed_password
            
            # Cập nhật document
            signin_collection.update_one(
                {'_id': ObjectId(pk)},
                {'$set': data}
            )
            
            return Response({
                'success': True,
                'message': 'Đã cập nhật tài khoản'
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def delete(self, request, pk):
        """DELETE: Xóa tài khoản"""
        try:
            # Xóa tài khoản
            result = signin_collection.delete_one({'_id': ObjectId(pk)})
            
            if result.deleted_count == 1:
                return Response({
                    'success': True,
                    'message': 'Đã xóa tài khoản'
                }, status=status.HTTP_204_NO_CONTENT)
                
            return Response({
                'success': False,
                'message': 'Không thể xóa tài khoản'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_face_recognition_api(request):
    """API test nhận diện khuôn mặt với nhân viên đã có sẵn"""
    try:
        employee_id = request.data.get('employee_id')
        
        if not employee_id:
            return Response({
                'success': False,
                'message': 'Thiếu employee_id'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Tìm thông tin nhân viên từ MongoDB
        from pymongo import MongoClient
        from bson.objectid import ObjectId
        
        client = MongoClient(settings.MONGO_URI)
        db = client[settings.MONGO_DB_NAME]
        
        # Tìm nhân viên
        employee = db.employees.find_one({'_id': ObjectId(employee_id)})
        
        if not employee or not employee.get('image_path'):
            return Response({
                'success': False,
                'message': 'Không tìm thấy nhân viên hoặc nhân viên chưa có ảnh'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Lấy đường dẫn ảnh đầy đủ
        import os
        from .face_recognition import test_recognition, BASE_DIR
        
        image_path = os.path.join(BASE_DIR, employee.get('image_path'))
        
        if not os.path.exists(image_path):
            return Response({
                'success': False,
                'message': f'Không tìm thấy ảnh tại đường dẫn'
            }, status=status.HTTP_404_NOT_FOUND)
            
        # Gọi hàm test nhận diện
        result = test_recognition(image_path)
        
        return Response(result)
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({
            'success': False,
            'message': f'Lỗi: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_face_recognition_with_image(request):
    """API test nhận diện khuôn mặt với ảnh được cung cấp và so sánh với nhân viên cụ thể"""
    try:
        employee_id = request.data.get('employee_id')
        image_data = request.data.get('image')
        
        if not employee_id or not image_data:
            return Response({
                'success': False,
                'message': 'Thiếu employee_id hoặc image'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Tìm thông tin nhân viên từ MongoDB
        client = MongoClient(settings.MONGO_URI)
        db = client[settings.MONGO_DB_NAME]
        
        # Tìm nhân viên
        employee = db.employees.find_one({'_id': ObjectId(employee_id)})
        
        if not employee:
            return Response({
                'success': False,
                'message': 'Không tìm thấy nhân viên'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Lấy dữ liệu đặc trưng khuôn mặt của nhân viên từ collection trainner
        trainer_data = db.trainner.find_one({'employee_id': employee_id})
        
        if not trainer_data or 'feature_vector' not in trainer_data:
            return Response({
                'success': False,
                'message': 'Không tìm thấy dữ liệu đặc trưng khuôn mặt của nhân viên'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Trích xuất đặc trưng từ ảnh được gửi lên
        from .face_recognition import extract_face_features
        face_encoding, face, _ = extract_face_features(image_data)
        
        if face_encoding is None:
            return Response({
                'success': False,
                'message': 'Không phát hiện khuôn mặt trong ảnh'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # So sánh đặc trưng với dữ liệu đã lưu
        import numpy as np
        stored_features = np.array(trainer_data['feature_vector'])
        distance = np.linalg.norm(face_encoding - stored_features)
        
        # Sử dụng ngưỡng từ cấu hình hệ thống
        from .face_recognition import RECOGNITION_THRESHOLD
        threshold = request.data.get('threshold', RECOGNITION_THRESHOLD)
        
        # Tạo kết quả
        result = {
            'employee_id': str(employee['_id']),
            'name': employee.get('name', ''),
            'job_position': employee.get('job_position', ''),
            'email': employee.get('email', ''),
            'phone': employee.get('phone', ''),
            'timestamp': datetime.now().isoformat(),
            'confidence': float(1 - distance),
            'distance': float(distance),
            'threshold': threshold,
            'success': distance < threshold
        }
        
        # Lưu kết quả test vào collection testdata nếu cấu hình cho phép
        if result['success'] and request.data.get('save_test_result', False):
            # Lưu ảnh hiện tại vào thư mục test_results
            import os
            from .face_recognition import BASE_DIR
            
            TEST_RESULTS_DIR = os.path.join(BASE_DIR, "test_results")
            os.makedirs(TEST_RESULTS_DIR, exist_ok=True)
            
            # Lưu ảnh với tên người dùng và timestamp
            person_name = employee['name'].lower().replace(' ', '_')
            now = datetime.now()
            img_filename = f"{person_name}_test_{now.strftime('%Y%m%d_%H%M%S')}.jpg"
            img_path = os.path.join(TEST_RESULTS_DIR, img_filename)
            
            # Lưu ảnh nhận diện vào file
            if image_data.startswith('data:image'):
                # Tách phần header và dữ liệu
                format, imgstr = image_data.split(';base64,')
                # Giải mã base64
                imgdata = base64.b64decode(imgstr)
                # Lưu ảnh
                with open(img_path, 'wb') as f:
                    f.write(imgdata)
                
                # Lấy đường dẫn tương đối
                relative_path = os.path.relpath(img_path, BASE_DIR)
                
                # Lưu vào collection testdata
                from .database import save_attendance
                attendance_result = save_attendance(
                    employee['name'], 
                    relative_path,
                    employee
                )
                result['attendance_saved'] = attendance_result
        
        return Response(result)
        
    except Exception as e:
        logger.error(f"Error in test_face_recognition_with_image: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return Response({
            'success': False,
            'message': f'Lỗi: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_trainer_data(request, employee_id=None):
    """API kiểm tra dữ liệu trainner"""
    try:
        query = {}
        if employee_id:
            query['employee_id'] = employee_id
            
        trainers = list(db.trainner.find(query, {
            'employee_id': 1,
            'name': 1,
            'feature_vector': 1,
            'image_path': 1
        }))
        
        result = []
        for trainer in trainers:
            trainer['_id'] = str(trainer['_id'])
            has_features = 'feature_vector' in trainer and trainer['feature_vector'] is not None
            vector_length = len(trainer['feature_vector']) if has_features else 0
            result.append({
                'employee_id': trainer.get('employee_id'),
                'name': trainer.get('name'),
                'has_features': has_features,
                'feature_vector_length': vector_length,
                'image_path': trainer.get('image_path')
            })
            
        return Response({
            'success': True,
            'count': len(result),
            'trainers': result
        })
        
    except Exception as e:
        logger.error(f"Error checking trainer data: {str(e)}")
        return Response({
            'success': False,
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class WorkScheduleListAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """GET: Lấy danh sách lịch làm việc"""
        try:
            schedules = get_all_work_schedules()
            
            # Chuyển ObjectId thành string
            for schedule in schedules:
                if '_id' in schedule:
                    schedule['_id'] = str(schedule['_id'])
                if 'created_at' in schedule:
                    schedule['created_at'] = schedule['created_at'].isoformat() if hasattr(schedule['created_at'], 'isoformat') else str(schedule['created_at'])
                if 'updated_at' in schedule:
                    schedule['updated_at'] = schedule['updated_at'].isoformat() if hasattr(schedule['updated_at'], 'isoformat') else str(schedule['updated_at'])
            
            return Response({
                'success': True,
                'schedules': schedules
            })
        except Exception as e:
            logger.error(f"Error getting work schedules: {str(e)}")
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        """POST: Tạo lịch làm việc mới"""
        try:
            data = request.data
            
            # Thêm timestamp
            data['created_at'] = datetime.now()
            
            # Đảm bảo các trường được định dạng đúng
            if 'start_hour' in data:
                data['start_hour'] = int(data['start_hour'])
            if 'start_minute' in data:
                data['start_minute'] = int(data['start_minute'])
            if 'end_hour' in data:
                data['end_hour'] = int(data['end_hour'])
            if 'end_minute' in data:
                data['end_minute'] = int(data['end_minute'])
            
            # Validate giá trị hợp lệ
            if not all(key in data for key in ['name', 'start_hour', 'start_minute', 'end_hour', 'end_minute']):
                return Response({
                    'success': False,
                    'message': 'Thiếu thông tin bắt buộc'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if data['start_hour'] < 0 or data['start_hour'] > 23 or data['end_hour'] < 0 or data['end_hour'] > 23:
                return Response({
                    'success': False,
                    'message': 'Giờ phải từ 0 đến 23'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if data['start_minute'] < 0 or data['start_minute'] > 59 or data['end_minute'] < 0 or data['end_minute'] > 59:
                return Response({
                    'success': False,
                    'message': 'Phút phải từ 0 đến 59'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Tạo lịch làm việc mới
            schedule_id = create_work_schedule(data)
            
            if schedule_id:
                # Lấy lịch vừa tạo
                new_schedule = get_work_schedule(schedule_id)
                if new_schedule:
                    new_schedule['_id'] = str(new_schedule['_id'])
                
                return Response({
                    'success': True,
                    'message': 'Đã tạo lịch làm việc mới',
                    'schedule': new_schedule
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': False,
                    'message': 'Không thể tạo lịch làm việc'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            logger.error(f"Error creating work schedule: {str(e)}")
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class WorkScheduleDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, schedule_id):
        """GET: Lấy thông tin lịch làm việc theo ID"""
        try:
            schedule = get_work_schedule(schedule_id)
            
            if not schedule:
                return Response({
                    'success': False,
                    'message': 'Không tìm thấy lịch làm việc'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Chuyển ObjectId thành string
            schedule['_id'] = str(schedule['_id'])
            
            # Chuyển datetime sang string
            if 'created_at' in schedule:
                schedule['created_at'] = schedule['created_at'].isoformat() if hasattr(schedule['created_at'], 'isoformat') else str(schedule['created_at'])
            if 'updated_at' in schedule:
                schedule['updated_at'] = schedule['updated_at'].isoformat() if hasattr(schedule['updated_at'], 'isoformat') else str(schedule['updated_at'])
            
            return Response({
                'success': True,
                'schedule': schedule
            })
        except Exception as e:
            logger.error(f"Error getting work schedule: {str(e)}")
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def put(self, request, schedule_id):
        """PUT: Cập nhật lịch làm việc"""
        try:
            data = request.data
            
            # Thêm timestamp
            data['updated_at'] = datetime.now()
            
            # Đảm bảo các trường được định dạng đúng
            if 'start_hour' in data:
                data['start_hour'] = int(data['start_hour'])
            if 'start_minute' in data:
                data['start_minute'] = int(data['start_minute'])
            if 'end_hour' in data:
                data['end_hour'] = int(data['end_hour'])
            if 'end_minute' in data:
                data['end_minute'] = int(data['end_minute'])
            
            # Validate giá trị hợp lệ
            if 'start_hour' in data and (data['start_hour'] < 0 or data['start_hour'] > 23):
                return Response({
                    'success': False,
                    'message': 'Giờ bắt đầu phải từ 0 đến 23'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if 'start_minute' in data and (data['start_minute'] < 0 or data['start_minute'] > 59):
                return Response({
                    'success': False,
                    'message': 'Phút bắt đầu phải từ 0 đến 59'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if 'end_hour' in data and (data['end_hour'] < 0 or data['end_hour'] > 23):
                return Response({
                    'success': False,
                    'message': 'Giờ kết thúc phải từ 0 đến 23'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if 'end_minute' in data and (data['end_minute'] < 0 or data['end_minute'] > 59):
                return Response({
                    'success': False,
                    'message': 'Phút kết thúc phải từ 0 đến 59'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Cập nhật lịch làm việc
            result = update_work_schedule(schedule_id, data)
            
            if result:
                # Lấy lịch làm việc đã cập nhật
                updated_schedule = get_work_schedule(schedule_id)
                if updated_schedule:
                    updated_schedule['_id'] = str(updated_schedule['_id'])
                
                return Response({
                    'success': True,
                    'message': 'Đã cập nhật lịch làm việc',
                    'schedule': updated_schedule
                })
            else:
                return Response({
                    'success': False,
                    'message': 'Không thể cập nhật lịch làm việc'
                }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error updating work schedule: {str(e)}")
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def delete(self, request, schedule_id):
        """DELETE: Xóa lịch làm việc"""
        try:
            result = delete_work_schedule(schedule_id)
            
            if result:
                return Response({
                    'success': True,
                    'message': 'Đã xóa lịch làm việc'
                }, status=status.HTTP_204_NO_CONTENT)
            else:
                return Response({
                    'success': False,
                    'message': 'Không thể xóa lịch làm việc mặc định cuối cùng'
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error deleting work schedule: {str(e)}")
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_active_work_schedule(request):
    """API lấy lịch làm việc đang active"""
    try:
        schedule = get_work_schedule()
        
        if not schedule:
            return Response({
                'success': False,
                'message': 'Không tìm thấy lịch làm việc'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Chuyển ObjectId thành string
        schedule['_id'] = str(schedule['_id'])
        
        # Chuyển datetime sang string
        if 'created_at' in schedule:
            schedule['created_at'] = schedule['created_at'].isoformat() if hasattr(schedule['created_at'], 'isoformat') else str(schedule['created_at'])
        if 'updated_at' in schedule:
            schedule['updated_at'] = schedule['updated_at'].isoformat() if hasattr(schedule['updated_at'], 'isoformat') else str(schedule['updated_at'])
        
        return Response({
            'success': True,
            'schedule': schedule
        })
    except Exception as e:
        logger.error(f"Error getting active work schedule: {str(e)}")
        return Response({
            'success': False,
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_employee_by_custom_id(request, custom_id):
    """API lấy thông tin nhân viên theo employee_id tùy chỉnh"""
    try:
        employee = employees_collection.find_one({'employee_id': custom_id})
        if employee:
            # Chuyển _id thành string để serializable
            if '_id' in employee:
                employee['_id'] = str(employee['_id'])
            return Response(employee)
        else:
            return Response({'error': 'Không tìm thấy nhân viên'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

