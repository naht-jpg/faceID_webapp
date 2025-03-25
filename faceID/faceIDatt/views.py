from django.http import JsonResponse
from django.shortcuts import render
from rest_framework.response import Response
from .face_recognition import recognize_face, register_face
from pymongo import MongoClient
from bson import ObjectId
from bson.errors import InvalidId
from rest_framework import generics,status
from .models import Employee,Attendance
from .serializers import EmployeeSerializer
import json
import bcrypt
import logger
from rest_framework.views import APIView
from datetime import datetime
import base64
import numpy as np
import cv2
import dlib
import os
from django.shortcuts import get_object_or_404
from django.conf import settings
from .database import (
    get_employees, get_employee_by_id, add_employee,
    update_employee, delete_employee, get_attendance_history
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.contrib.auth import authenticate
from .auth import MongoDBAuthBackend, get_tokens_for_user
import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser,AllowAny
from .database import signin_collection
from django.contrib.auth.models import User
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

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

class EmployeeListView(generics.ListAPIView):  # Đổi tên class và kế thừa
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer

# API để lấy, cập nhật, hoặc xóa một nhân viên theo ID (GET, PUT, DELETE)
class EmployeeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer

@api_view(['POST'])
def face_check(request):
    image = request.data.get('image')
    name = recognize_face(image)
    return Response({'name': name if name else "Unknown"})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_employees_api(request):
    """API lấy danh sách nhân viên"""
    try:
        employees = get_employees()
        # Make sure employees is a list before returning
        if not isinstance(employees, list):
            employees = []
            
        response = Response(employees)
        # Add headers to prevent caching
        response["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response["Pragma"] = "no-cache"
        response["Expires"] = "0"
        return response
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_employee_api(request, employee_id):
    """API lấy thông tin nhân viên theo ID"""
    try:
        employee = get_employee_by_id(employee_id)
        if employee:
            employee['_id'] = str(employee['_id'])
            return Response(employee)
        else:
            return Response({'error': 'Không tìm thấy nhân viên'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_employee_api(request):
    """API tạo nhân viên mới"""
    try:
        # Debug - in ra dữ liệu nhận được
        print("Received employee data:", request.data)
        
        employee_data = request.data
        employee_id = add_employee(employee_data)
        
        # Debug - in ra kết quả
        print("Created employee with ID:", employee_id)
        
        return Response({
            'success': True,
            '_id': employee_id,
            'message': 'Đã tạo nhân viên mới'
        }, status=201)  # Trả về status 201 Created
    except Exception as e:
        print("Error creating employee:", str(e))
        return Response({'error': str(e)}, status=500)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_employee_api(request, employee_id):
    """API cập nhật thông tin nhân viên"""
    try:
        updated_data = request.data
        result = update_employee(employee_id, updated_data)
        if result:
            return Response({
                'success': True,
                'message': 'Đã cập nhật thông tin nhân viên'
            })
        else:
            return Response({'error': 'Không tìm thấy nhân viên'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['PATCH'])
def patch_employee_api(request, employee_id):
    employee = get_object_or_404(Employee, id=employee_id)
    serializer = EmployeeSerializer(employee, data=request.data, partial=True)  # partial=True để cập nhật từng phần

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
def delete_employee_api(request, employee_id):
    """API xóa nhân viên"""
    try:
        result = delete_employee(employee_id)
        if result:
            return Response({
                'success': True,
                'message': 'Đã xóa nhân viên'
            })
        else:
            return Response({'error': 'Không tìm thấy nhân viên'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def face_register_api(request):
    """API đăng ký khuôn mặt cho nhân viên"""
    try:
        data = request.data
        employee_id = data.get('employee_id')
        name = data.get('name')
        image_data = data.get('image')
        
        if not employee_id or not image_data:
            return Response({
                'success': False,
                'message': 'Thiếu employee_id hoặc image'
            }, status=400)
        
        # Đăng ký khuôn mặt
        result = register_face(employee_id, name, image_data)
        return Response(result)
    
    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=500)

@api_view(['POST'])
def face_recognition_api(request):
    """API nhận diện khuôn mặt"""
    try:
        image_data = request.data.get('image')
        
        if not image_data:
            return Response({
                'success': False,
                'message': 'Thiếu dữ liệu image'
            }, status=400)
        
        # Nhận diện khuôn mặt
        result = recognize_face(image_data)
        return Response(result)
    
    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=500)

@api_view(['GET'])
def attendance_history_api(request, employee_id=None):
    """API lấy lịch sử điểm danh"""
    try:
        if employee_id:
            history = get_attendance_history(employee_id=employee_id)
        else:
            name = request.query_params.get('name')
            if not name:
                return Response({
                    'success': False,
                    'message': 'Thiếu tham số employee_id hoặc name'
                }, status=400)
            history = get_attendance_history(name=name)
        
        return Response({
            'success': True,
            'history': history
        })
    
    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=500)

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
        }, status=500)

# API endpoint đăng nhập từ MongoDB
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
            }, status=400)
        
        # Sử dụng backend tùy chỉnh
        auth_backend = MongoDBAuthBackend()
        user = auth_backend.authenticate(request, username=username, password=password)
        
        if not user:
            return Response({
                'detail': 'Tài khoản hoặc mật khẩu không chính xác'
            }, status=401)
        
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
        }, status=500)

# API endpoint để lấy thông tin người dùng hiện tại
from .database import signin_collection

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
        }, status=500)

@api_view(['GET'])
def test_api(request):
    """API kiểm tra kết nối"""
    return Response({
        'status': 'success',
        'message': 'API is working',
        'timestamp': datetime.now().isoformat()
    })

# Add this function
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

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def signin_list(request):
    if request.method == 'GET':
        users = list(signin_collection.find())
        # Chuyển đổi ObjectId sang string
        for user in users:
            user['_id'] = str(user['_id'])
            # Không trả về mật khẩu
            if 'password' in user:
                del user['password']
        
        return JsonResponse(users, safe=False, encoder=JSONEncoder)
    
    elif request.method == 'POST':
        data = request.data
        
        # Kiểm tra xem tên người dùng đã tồn tại chưa
        if signin_collection.find_one({'name': data['name']}):
            return Response({'detail': 'Tên đăng nhập đã tồn tại'}, status=400)
        
        # Mã hóa mật khẩu
        if 'password' in data and data['password']:
            password = data['password'].encode('utf-8')
            salt = bcrypt.gensalt()
            hashed_password = bcrypt.hashpw(password, salt)
            data['password'] = hashed_password
        
        # Tạo document mới trong MongoDB
        result = signin_collection.insert_one(data)
        return Response({'id': str(result.inserted_id)}, status=201)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def signin_detail(request, pk):
    try:
        # Lấy tài khoản theo ID
        account = signin_collection.find_one({'_id': ObjectId(pk)})
        if not account:
            return Response({'detail': 'Không tìm thấy tài khoản'}, status=404)
        
        if request.method == 'GET':
            # Chuyển đổi ObjectId sang string
            account['_id'] = str(account['_id'])
            # Không trả về mật khẩu
            if 'password' in account:
                del account['password']
            return Response(account)
        
        elif request.method == 'PUT':
            data = request.data
            
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
            return Response({'detail': 'Cập nhật thành công'})
        
        elif request.method == 'DELETE':
            # Xóa tài khoản
            result = signin_collection.delete_one({'_id': ObjectId(pk)})
            if result.deleted_count == 1:
                return Response({'detail': 'Xóa thành công'})
            return Response({'detail': 'Không thể xóa tài khoản'}, status=400)
            
    except Exception as e:
        return Response({'detail': str(e)}, status=500)

# Sửa lỗi trong hàm get_latest_attendance

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_latest_attendance(request, employee_id):
    try:
        # Lấy bản ghi điểm danh mới nhất
        from .database import attendance_collection 
        
        attendance_record = attendance_collection.find_one(  
            sort=[('datetime', -1)]
        )
        
        if not attendance_record:  
            return Response({
                'success': False,
                'message': 'Không tìm thấy dữ liệu điểm danh'
            }, status=404)
            
        # Chuyển ObjectId thành string
        attendance_record['_id'] = str(attendance_record['_id'])
        
        # Chuyển datetime sang string
        if 'datetime' in attendance_record:
            attendance_record['datetime'] = attendance_record['datetime'].isoformat()
        if 'created_at' in attendance_record:
            attendance_record['created_at'] = attendance_record['created_at'].isoformat()
            
        return Response({
            'success': True,
            'data': attendance_record
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=500)

# Thêm vào cuối file, sau hàm get_latest_attendance

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_today_attendance(request, employee_id):
    """API lấy thông tin điểm danh trong ngày của nhân viên"""
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
        
        if not today_attendance:
            return Response({
                'success': True,
                'message': 'Không có dữ liệu điểm danh hôm nay',
                'records': []
            })
            
        # Chuyển đổi ObjectId và datetime thành chuỗi
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
        }, status=500)



# Class-based view cho Employee List và Create
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
            return Response({'error': str(e)}, status=500)
    
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
            }, status=201)
        except Exception as e:
            print("Error creating employee:", str(e))
            return Response({'error': str(e)}, status=500)


# Class-based view cho Employee Detail, Update và Delete
class EmployeeDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, employee_id):
        """GET method: Lấy thông tin nhân viên theo ID"""
        try:
            employee = get_employee_by_id(employee_id)
            if employee:
                return Response(employee)
            else:
                return Response({'error': 'Không tìm thấy nhân viên'}, status=404)
        except InvalidId:
            return Response({'error': 'ID không hợp lệ'}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
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
                return Response({'error': 'Không tìm thấy nhân viên'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
    def patch(self, request, employee_id):
        """PATCH method: Cập nhật một phần thông tin nhân viên"""
        try:
            employee = get_employee_by_id(employee_id)
            if not employee:
                return Response({'error': 'Không tìm thấy nhân viên'}, status=404)
                
            # Chỉ cập nhật các trường được cung cấp
            updated_data = {k: v for k, v in request.data.items() if v is not None}
            result = update_employee(employee_id, updated_data)
            
            if result:
                return Response({
                    'success': True,
                    'message': 'Đã cập nhật thông tin nhân viên'
                })
            else:
                return Response({'error': 'Không thể cập nhật nhân viên'}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
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
                return Response({'error': 'Không tìm thấy nhân viên'}, status=404)
        except InvalidId:
            return Response({'error': 'ID không hợp lệ'}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

# Tương tự cho các endpoints khác
class FaceRegisterAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """API đăng ký khuôn mặt cho nhân viên"""
        try:
            data = request.data
            employee_id = data.get('employee_id')
            name = data.get('name')
            image_data = data.get('image')
            
            if not employee_id or not image_data:
                return Response({
                    'success': False,
                    'message': 'Thiếu employee_id hoặc image'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Đăng ký khuôn mặt
            result = register_face(employee_id, name, image_data)
            
            # Thống nhất với mã trạng thái HTTP
            if result.get('success'):
                return Response(result, status=status.HTTP_201_CREATED)
            else:
                return Response(result, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
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
            
            # Nhận diện khuôn mặt
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

