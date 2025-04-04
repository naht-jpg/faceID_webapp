from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # 1. RESTful resources - Sử dụng class-based views
    path('employees/', views.EmployeeListAPIView.as_view(), name='employee-list'),
    path('employees/<str:employee_id>/', views.EmployeeDetailAPIView.as_view(), name='employee-detail'),
    path('faces/register/', views.FaceRegisterAPIView.as_view(), name='face-register'),
    path('faces/recognize/', views.FaceRecognitionAPIView.as_view(), name='face-recognize'),
    path('faces/test-recognize-with-image/', views.test_face_recognition_with_image, name='test-face-recognition-with-image'),
    path('faces/test-recognize/', views.test_face_recognition_api, name='test-face-recognition'),
    path('attendance/<str:employee_id>/', views.AttendanceAPIView.as_view(), name='attendance'),
    path('users/', views.SigninListAPIView.as_view(), name='user-list'),  # Đổi tên từ signin sang users
    path('users/<str:pk>/', views.SigninDetailAPIView.as_view(), name='user-detail'),
    
    # 2. Authentication endpoints
    path('auth/token/', views.mongodb_token_obtain, name='token-obtain'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/me/', views.current_user, name='current-user'),
    path('auth/register/', views.register_user, name='register-user'),
    
    # 3. Utility endpoints - Đổi sang tiền tố /utils/ cho rõ ràng
    path('utils/test/', views.test_api, name='test-api'),
    path('utils/test-mongo/', views.test_mongo_connection, name='test-mongo'),
    path('utils/face-check/', views.face_check, name='face-check'),
    path('utils/test-face-recognition/', views.test_face_recognition_api, name='test-face-recognition'),

    # 4. Trainer endpoints
    path('trainer/check/', views.check_trainer_data, name='check-trainer-data'),
    path('trainer/check/<str:employee_id>/', views.check_trainer_data, name='check-trainer-data-by-id'),
]
