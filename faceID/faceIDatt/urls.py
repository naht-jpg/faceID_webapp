from django.urls import path
from .views import (face_check, get_employees, get_employee, delete_employee, 
                   create_employee, test_api, MongoEmployeeDetailView, test_mongo_connection)
from . import views

urlpatterns = [
    # Thêm route test MongoDB
    path('test-mongo-connection/', test_mongo_connection, name='test_mongo_connection'),
    
    # URL MongoDB trực tiếp - sử dụng cho PUT, GET, DELETE
    path("employees/<str:pk>/", MongoEmployeeDetailView.as_view(), name="employee-detail"),
    
    # URL để lấy danh sách nhân viên
    path("employees/", get_employees, name="employee-list"),
    
    # Các URL khác
    path('employees/create/', create_employee, name='create_employee'),
    path('employees/<str:emp_id>/delete/', delete_employee, name='delete_employee'),
    path('face-check/', face_check, name='face_check'),
    path('test-api/', test_api, name='test_api'), 
    path('recognize-face/', views.recognize_face, name='recognize_face'),
    path('attendance/<int:employee_id>/', views.get_attendance_history, name='get_attendance_history'),
    path('attendance/', views.record_attendance, name='record_attendance'),
]
