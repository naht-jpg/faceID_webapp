import os
import django

# Thiết lập môi trường Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'faceID.settings')
django.setup()

from django.contrib.auth.models import User
from django.db.utils import IntegrityError
import getpass

def create_user():
    print("\n=== TẠO NGƯỜI DÙNG MỚI ===")
    
    try:
        username = input("Tên đăng nhập: ")
        email = input("Email: ")
        password = getpass.getpass("Mật khẩu: ")
        confirm_password = getpass.getpass("Xác nhận mật khẩu: ")
        
        if password != confirm_password:
            print("❌ Mật khẩu không khớp!")
            return
        
        try:
            user = User.objects.create_user(username, email, password)
            print(f"✅ Tạo người dùng {username} thành công!")
            
            is_staff = input("Đặt làm staff? (y/n): ").lower() == 'y'
            if is_staff:
                user.is_staff = True
                user.save()
                print("✅ Đã đặt làm staff")
                
            is_superuser = input("Đặt làm admin (superuser)? (y/n): ").lower() == 'y'
            if is_superuser:
                user.is_superuser = True
                user.save()
                print("✅ Đã đặt làm admin")
                
        except IntegrityError:
            print(f"❌ Người dùng '{username}' đã tồn tại!")
        
    except KeyboardInterrupt:
        print("\n❌ Đã hủy tạo người dùng.")
    except Exception as e:
        print(f"❌ Lỗi: {str(e)}")

if __name__ == "__main__":
    create_user()