from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Authentication endpoints - Use MongoDB custom authentication
    path('api/token/', views.mongodb_token_obtain, name='token_obtain'),  # Replace standard with MongoDB custom
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', views.register_user, name='register_user'),
    path('user/', views.current_user, name='current_user'),
    
    # Make sure all these URLs are included in the main urls.py with the proper prefix
    path('employees/', views.get_employees_api, name='get_employees'),
    path('employees/create/', views.create_employee_api, name='create_employee'),
    path('employees/<str:employee_id>/', views.get_employee_api, name='get_employee'),
    path('employees/<str:employee_id>/update/', views.update_employee_api, name='update_employee'),
    path('employees/<str:employee_id>/delete/', views.delete_employee_api, name='delete_employee'),
    path('face-register/', views.face_register_api, name='face_register'),
    path('face-recognition/', views.face_recognition_api, name='face_recognition'),
    path('attendance/<str:employee_id>/', views.attendance_history_api, name='get_attendance_history'),
    path('attendance/<str:employee_id>/latest/', views.get_latest_attendance, name='get_latest_attendance'),
    path('attendance/<str:employee_id>/today/', views.get_today_attendance, name='get_today_attendance'),
    path('test/', views.test_api, name='test_api'),  # Added test endpoint

    # Thêm URLs mới cho signin collection
    path('signin/', views.signin_list, name='signin_list'),
    path('signin/<str:pk>/', views.signin_detail, name='signin_detail'),
]
