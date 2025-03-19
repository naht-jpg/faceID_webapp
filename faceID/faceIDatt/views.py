from django.http import JsonResponse
from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .face_recognition import recognize_face
from pymongo import MongoClient
from bson import ObjectId
from bson.errors import InvalidId
from rest_framework import generics
from .models import Employee,Attendance
from .serializers import EmployeeSerializer
import json
from rest_framework.views import APIView
from datetime import datetime
import base64
import numpy as np
import cv2
import dlib
import os
from django.shortcuts import get_object_or_404

client = MongoClient("mongodb://localhost:27017/")
db = client["CongTy"]
collection = db["employees"]

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
def get_employees(request):
    try:
        print("Đang kết nối tới MongoDB...")
        employees = list(collection.find({}))
        print(f"Tìm thấy {len(employees)} nhân viên")
        for emp in employees:
            emp["_id"] = str(emp["_id"])
        return Response(employees)
    except Exception as e:
        print(f"Lỗi MongoDB: {str(e)}")
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_employee(request, emp_id):
    try:
        print(f"Tìm nhân viên với ID: {emp_id}")
        
        # Kiểm tra định dạng ID
        if len(emp_id) != 24:
            return Response({"error": f"Định dạng ID không hợp lệ: {emp_id}"}, status=400)
            
        # Chuyển đổi string ID thành ObjectId
        employee = collection.find_one({"_id": ObjectId(emp_id)})
        
        if employee:
            print(f"Tìm thấy nhân viên: {employee['name']}")
            # Chuyển ObjectId thành string để serialize
            employee["_id"] = str(employee["_id"])
            return Response(employee)
        else:
            print(f"Không tìm thấy nhân viên với ID: {emp_id}")
            return Response({"error": "Không tìm thấy nhân viên"}, status=404)
    except InvalidId:
        print(f"Định dạng ObjectId không hợp lệ: {emp_id}")
        return Response({"error": "Định dạng ID không hợp lệ"}, status=400)
    except Exception as e:
        print(f"Lỗi khi tìm nhân viên: {str(e)}")
        return Response({"error": str(e)}, status=500)


@api_view(['DELETE'])
def delete_employee(request, emp_id):
    try:
        result = collection.delete_one({"_id": ObjectId(emp_id)})
        if result.deleted_count > 0:
            return Response({"message": "Xóa nhân viên thành công"}, status=204)
        else:
            return Response({"error": "Không tìm thấy nhân viên"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['POST'])
def create_employee(request):
    try:
        print("Đang tạo nhân viên mới...")
        employee_data = request.data
        print(f"Dữ liệu nhận: {employee_data}")
        
        # Kiểm tra dữ liệu đầu vào
        if 'name' not in employee_data or 'position' not in employee_data:
            return Response({"error": "Thiếu thông tin bắt buộc (name, position)"}, status=400)
            
        result = collection.insert_one(employee_data)
        print(f"Đã tạo nhân viên với ID: {result.inserted_id}")
        
        # Lấy dữ liệu đã tạo để trả về
        created = collection.find_one({"_id": result.inserted_id})
        if created:
            created["_id"] = str(created["_id"])
            return Response(created, status=201)
        else:
            return Response({"error": "Không thể lấy dữ liệu đã tạo"}, status=500)
    except Exception as e:
        print(f"Lỗi khi tạo nhân viên: {str(e)}")
        return Response({"error": str(e)}, status=400)

@api_view(['GET'])
def test_api(request):
    try:
        # Test MongoDB connection
        info = client.server_info()
        collections = db.list_collection_names()
        count = collection.count_documents({})
        
        sample = None
        if count > 0:
            sample_doc = collection.find_one()
            if sample_doc:
                sample_doc["_id"] = str(sample_doc["_id"])
                sample = sample_doc
        
        return Response({
            "status": "success", 
            "mongodb_version": info.get("version", "unknown"),
            "collections": collections,
            "employee_count": count,
            "sample_document": sample
        })
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=500)

# Thêm class view mới này để xử lý MongoDB trực tiếp
class MongoEmployeeDetailView(APIView):
    def get(self, request, pk):
        try:
            employee = collection.find_one({"_id": ObjectId(pk)})
            if employee:
                employee["_id"] = str(employee["_id"])
                return Response(employee)
            return Response({"error": "Không tìm thấy nhân viên"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
    
    def put(self, request, pk):
        try:
            print(f"Đang cập nhật nhân viên với ID: {pk}")
            print(f"Dữ liệu cập nhật: {request.data}")
            
            result = collection.update_one(
                {"_id": ObjectId(pk)},
                {"$set": request.data}
            )
            
            if result.matched_count > 0:
                updated = collection.find_one({"_id": ObjectId(pk)})
                if updated:
                    updated["_id"] = str(updated["_id"])
                    print(f"Cập nhật thành công: {updated['name']}")
                    return Response(updated)
                return Response({"error": "Không thể lấy thông tin nhân viên sau khi cập nhật"}, status=500)
            return Response({"error": "Không tìm thấy nhân viên"}, status=404)
        except Exception as e:
            print(f"Lỗi khi cập nhật: {str(e)}")
            return Response({"error": str(e)}, status=500)
    
    def delete(self, request, pk):
        try:
            result = collection.delete_one({"_id": ObjectId(pk)})
            if result.deleted_count > 0:
                return Response({"message": "Xóa nhân viên thành công"}, status=204)
            return Response({"error": "Không tìm thấy nhân viên"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

@api_view(['POST'])
def recognize_face(request):
    try:
        # Lấy ảnh base64 từ request
        base64_image = request.data.get('image', '')
        
        # Giải mã ảnh và chuyển đổi thành mảng numpy
        img = cv2.imdecode(np.frombuffer(base64.b64decode(base64_image), np.uint8), cv2.IMREAD_COLOR)
        
        # Chuyển đổi sang grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Phát hiện khuôn mặt
        faces = detector(gray, 1)
        
        if len(faces) == 0:
            return Response({'success': False, 'message': 'Không tìm thấy khuôn mặt'})
        
        # Sử dụng khuôn mặt đầu tiên nếu phát hiện nhiều khuôn mặt
        face = faces[0]
        
        # Lấy các điểm landmark trên khuôn mặt
        shape = sp(img, face)
        
        # Tính toán face descriptor (128-D vector)
        face_descriptor = facerec.compute_face_descriptor(img, shape)
        current_encoding = np.array(face_descriptor)
        
        # So sánh với các encoding đã lưu trữ
        employees = Employee.objects.filter(face_encoding__isnull=False)
        min_distance = 0.6  # Ngưỡng so sánh, điều chỉnh dựa trên yêu cầu
        recognized_employee = None
        
        for employee in employees:
            stored_encoding = np.array(employee.face_encoding)
            distance = np.linalg.norm(stored_encoding - current_encoding)
            
            if distance < min_distance:
                min_distance = distance
                recognized_employee = employee
        
        if recognized_employee:
            # Tạo bản ghi điểm danh mới
            attendance = Attendance.objects.create(
                employee=recognized_employee,
                timestamp=datetime.now()
            )
            
            return Response({
                'success': True,
                'name': recognized_employee.name,
                'employee_id': recognized_employee.id,
                'timestamp': attendance.timestamp,
            })
        else:
            return Response({'success': False, 'message': 'Không nhận diện được nhân viên'})
            
    except Exception as e:
        print(f"Error: {str(e)}")
        return Response({'success': False, 'message': str(e)}, status=500)

@api_view(['GET'])
def get_attendance_history(request, employee_id):
    """
    Lấy lịch sử điểm danh của nhân viên theo ID
    """
    try:
        # Tìm nhân viên theo ID
        employee = get_object_or_404(Employee, id=employee_id)
        
        # Lấy lịch sử điểm danh, sắp xếp theo thời gian (mới nhất trước)
        attendance_records = Attendance.objects.filter(employee=employee).order_by('-timestamp')
        
        # Chuyển đổi dữ liệu để trả về
        history = []
        for record in attendance_records:
            history.append({
                'id': record.id,
                'timestamp': record.timestamp,
                'status': record.status,
                'date': record.timestamp.strftime('%Y-%m-%d'),
                'time': record.timestamp.strftime('%H:%M:%S')
            })
            
        return Response({
            'success': True,
            'employee': {
                'id': employee.id,
                'name': employee.name,
                'employee_id': getattr(employee, 'employee_id', ''),
                'department': getattr(employee, 'department', '')
            },
            'attendance_history': history
        })
    
    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=400)

@api_view(['POST'])
def record_attendance(request):
    """
    Ghi lại điểm danh thủ công cho nhân viên
    """
    try:
        employee_id = request.data.get('employee_id')
        if not employee_id:
            return Response({
                'success': False,
                'message': 'Thiếu employee_id'
            }, status=400)
        
        # Tìm nhân viên theo ID
        employee = get_object_or_404(Employee, id=employee_id)
        
        # Ghi lại điểm danh
        attendance = Attendance.objects.create(
            employee=employee,
            timestamp=datetime.now(),
            status='present'
        )
        
        return Response({
            'success': True,
            'message': 'Điểm danh thành công',
            'employee_name': employee.name,
            'timestamp': attendance.timestamp
        })
    
    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=400)

