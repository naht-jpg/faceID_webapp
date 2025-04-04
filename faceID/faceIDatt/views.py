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
from datetime import datetime, timedelta

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
    signin_collection, attendance_collection
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
        # Get username from the JWT token
        username = request.user.username
        
        # Find user in MongoDB
        user_data = signin_collection.find_one({'name': username})
        
        if not user_data:
            return Response({
                'name': username,
                'role': 'admin' if request.user.is_staff else 'employee'
            })
        
        # Return user data
        return Response({
            'id': str(user_data.get('_id', '')),
            'name': user_data.get('name', username),
            'role': user_data.get('role', 'employee')
        })
    
    except Exception as e:
        logger.error(f"Current user error: {str(e)}")
        return Response({
            'detail': 'Lỗi khi lấy thông tin người dùng'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def test_api(request):
    """API kiểm tra kết nối"""
    return Response({
        'status': 'success',
        'message': 'API is working',
        'timestamp': datetime.now().isoformat()
    })

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
                return Response({
                    'success': True,
                    'message': 'Đã cập nhật thông tin nhân viên'
                })
            else:
                return Response({'error': 'Không tìm thấy nhân viên'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
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
            
            from .database import attendance_collection
            
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
                return Response({
                    'success': False,
                    'message': 'Không tìm thấy dữ liệu điểm danh'
                }, status=status.HTTP_404_NOT_FOUND)
                
            # Chuyển ObjectId thành string
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
            # Lấy thời gian hiện tại
            now = datetime.now()
            start_of_day = datetime(now.year, now.month, now.day, 0, 0, 0)
            end_of_day = datetime(now.year, now.month, now.day, 23, 59, 59)
            
            # Tìm các bản ghi điểm danh trong ngày
            from .database import attendance_collection
            
            today_attendance = list(attendance_collection.find({
                'employee_id': employee_id,
                'datetime': {
                    '$gte': start_of_day,
                    '$lte': end_of_day
                }
            }).sort('datetime', -1))
            
            # Xử lý dữ liệu trả về giống như trong phương thức get
            for record in today_attendance:
                if '_id' in record:
                    record['_id'] = str(record['_id'])
                if 'datetime' in record:
                    record['datetime'] = record['datetime'].isoformat() if hasattr(record['datetime'], 'isoformat') else str(record['datetime'])
                if 'created_at' in record:
                    record['created_at'] = record['created_at'].isoformat() if hasattr(record['created_at'], 'isoformat') else str(record['created_at'])
            
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
                data['employee_id'] = employee_id
                
            # Thêm datetime nếu không có
            if 'datetime' not in data:
                data['datetime'] = datetime.now()
                
            # Thêm vào cơ sở dữ liệu
            from .database import attendance_collection
            result = attendance_collection.insert_one(data)
            
            return Response({
                'success': True,
                'message': 'Đã tạo bản ghi điểm danh',
                'id': str(result.inserted_id)
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
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

