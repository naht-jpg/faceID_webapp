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

# API để lấy danh sách nhân viên và tạo nhân viên mới (GET, POST)
class EmployeeListCreateView(generics.ListCreateAPIView):
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
def create_employee_api(request):
    """API tạo nhân viên mới"""
    try:
        employee_data = request.data
        employee_id = add_employee(employee_data)
        return Response({
            'success': True,
            '_id': employee_id,
            'message': 'Đã tạo nhân viên mới'
        })
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['PUT'])
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

@api_view(['GET'])
def get_test_employees_api(request):
    """API test cho danh sách nhân viên"""
    test_employees = [
        {
            "_id": "67d05c106b40cef8413b0233",
            "name": "Khoi",
            "age": 22,
            "location": "TPHCM",
            "email": "test@example.com",
            "phone": "0123456789",
            "job_position": "Frontend",
            "image_path": "data/data_faces_from_camera/person_2/img_face_1.jpg",
            "timestamp": "2025-03-11 22:51:44"
        },
        {
            "_id": "67d05c106b40cef8413b0234",
            "name": "Employee 2",
            "age": 25,
            "location": "Hanoi",
            "email": "employee2@example.com",
            "phone": "0987654321",
            "job_position": "Backend",
            "image_path": "",
            "timestamp": "2025-03-11 22:52:44"
        }
    ]
    
    response = Response(test_employees)
    response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response

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

@api_view(['GET', 'POST'])
def signin_list(request):
    if request.method == 'GET':
        users = signin_collection.find()
        # Chuyển đổi ObjectId thành string
        users_list = [{**user, '_id': str(user['_id'])} for user in users]
        return Response(users_list)
    
    elif request.method == 'POST':
        data = request.data
        # Mã hóa mật khẩu
        password = data['password'].encode('utf-8')
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password, salt)
        
        # Tạo document mới để lưu vào MongoDB
        new_user = {
            'name': data['name'],
            'password': hashed_password,
            'role': data.get('role', 'employee')
        }
        
        result = signin_collection.insert_one(new_user)
        return Response({'id': str(result.inserted_id)}, status=201)


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
    # Tìm người dùng theo ID
    user = signin_collection.find_one({'_id': ObjectId(pk)})
    
    if not user:
        return Response({'detail': 'Không tìm thấy tài khoản'}, status=404)
    
    if request.method == 'GET':
        user['_id'] = str(user['_id'])
        if 'password' in user:
            del user['password']
        return JsonResponse(user, encoder=JSONEncoder)
    
    elif request.method == 'PUT':
        data = request.data
        
        # Nếu thay đổi mật khẩu, hãy mã hóa nó
        if 'password' in data and data['password']:
            password = data['password'].encode('utf-8')
            salt = bcrypt.gensalt()
            hashed_password = bcrypt.hashpw(password, salt)
            data['password'] = hashed_password
        elif 'password' in data:
            # Nếu mật khẩu trống, giữ nguyên mật khẩu cũ
            del data['password']
        
        signin_collection.update_one({'_id': ObjectId(pk)}, {'$set': data})
        return Response({'detail': 'Cập nhật thành công'})
    
    elif request.method == 'DELETE':
        signin_collection.delete_one({'_id': ObjectId(pk)})
        return Response({'detail': 'Xóa thành công'})

