from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Authentication endpoints
    path('auth/token/', views.mongodb_token_obtain, name='token_obtain'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/register/', views.register_user, name='register_user'),
    path('user/', views.current_user, name='current_user'),
    
    # Employee resources
    path('employees/', views.EmployeeListAPIView.as_view(), name='employee_list'),
    path('employees/<str:employee_id>/', views.EmployeeDetailAPIView.as_view(), name='employee_detail'),
    path('employees/<str:employee_id>/attendance/', views.AttendanceAPIView.as_view(), name='employee_attendance'),
    
    # Face recognition resources
    path('faces/register/', views.FaceRegisterAPIView.as_view(), name='face_register'),
    path('faces/recognize/', views.FaceRecognitionAPIView.as_view(), name='face_recognition'),
    
    # Attendance resources - dùng query param thay vì endpoint riêng
    path('attendance/<str:employee_id>/', views.AttendanceAPIView.as_view(), name='attendance'),
    
    # Signin resources
    path('signin/', views.SigninListAPIView.as_view(), name='signin_list'),
    path('signin/<str:pk>/', views.SigninDetailAPIView.as_view(), name='signin_detail'),
    
    # Test endpoint
    path('test/', views.test_api, name='test_api'),
]
