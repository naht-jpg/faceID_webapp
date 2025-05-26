from django.contrib.auth.backends import BaseBackend
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
import logging
import bcrypt
from pymongo import MongoClient
from django.conf import settings
from bson import ObjectId

logger = logging.getLogger(__name__)

class MongoDBAuthBackend(BaseBackend):
    """
    Authenticate against the MongoDB 'signin' collection
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        name = username
        
        if not name or not password:
            return None
            
        try:
            # Kết nối MongoDB
            client = MongoClient(settings.MONGO_URI)
            db = client[settings.MONGO_DB_NAME]
            signin_collection = db[settings.MONGO_COLLECTIONS['signin']]
            
            # Tìm user bằng tên
            user_data = signin_collection.find_one({'name': name})
            
            if not user_data:
                logger.warning(f"User not found: {name}")
                return None
                
            # Kiểm tra mật khẩu với bcrypt
            stored_password = user_data.get('password')
            
            if not stored_password:
                logger.warning(f"No password for user: {name}")
                return None
            
            # So sánh mật khẩu
            if not bcrypt.checkpw(password.encode(), stored_password):
                logger.warning(f"Invalid password for user: {name}")
                return None
                
            # Tạo hoặc lấy Django user
            try:
                user = User.objects.get(username=name)
            except User.DoesNotExist:
                # Tạo Django user mới nếu chưa tồn tại
                user = User(username=name)
                user.is_staff = user_data.get('role') == 'admin'
                user.save()
                
            # Lưu thông tin MongoDB user vào request để sử dụng sau này
            if request:
                request.mongo_user = user_data
                
            return user
                
        except Exception as e:
            logger.error(f"MongoDB authentication error: {str(e)}")
            return None
            
    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None

# Helper function để tạo JWT token
def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    
    # Thêm dữ liệu vào token payload
    if hasattr(user, '_wrapped') and hasattr(user._wrapped, 'mongo_user'):
        mongo_user = user._wrapped.mongo_user
    elif hasattr(user, 'mongo_user'):
        mongo_user = user.mongo_user
    else:
        mongo_user = {}
    
    # Thêm role vào token
    refresh['role'] = mongo_user.get('role', 'employee')
    refresh['name'] = str(mongo_user.get('name', user.username))
    
    # Chuyển ObjectId sang string
    if '_id' in mongo_user:
        refresh['user_id'] = str(mongo_user['_id'])
    
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }