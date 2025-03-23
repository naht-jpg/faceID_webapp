import os
import dlib
import numpy as np
import cv2
import base64
import logging
from datetime import datetime, timedelta
from django.conf import settings
from .database import get_face_features, save_face_feature, save_attendance

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("face_recognition")

# Đường dẫn thư mục
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")
CURRENT_PHOTO_DIR = os.path.join(BASE_DIR, "current_photo")

# Tạo thư mục nếu chưa tồn tại
os.makedirs(CURRENT_PHOTO_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

# Đường dẫn đến các model dlib
PREDICTOR_PATH = os.path.join(MODEL_DIR, "shape_predictor_68_face_landmarks.dat")
FACEREC_PATH = os.path.join(MODEL_DIR, "dlib_face_recognition_resnet_model_v1.dat")

# Kiểm tra model tồn tại và sử dụng fallback nếu cần
def check_model_path(primary_path, backup_dir, filename):
    if os.path.exists(primary_path):
        return primary_path
    
    # Tìm kiếm model ở vị trí dự phòng
    backup_paths = [
        os.path.join(BASE_DIR, backup_dir, filename),
        os.path.join(BASE_DIR, "data", "data_dlib", filename),
        os.path.join(os.path.dirname(BASE_DIR), "models", filename)
    ]
    
    for path in backup_paths:
        if os.path.exists(path):
            logger.info(f"Using backup model at: {path}")
            return path
    
    raise FileNotFoundError(f"Model file not found: {primary_path} or any backup locations")

# Load các models dlib với kiểm tra lỗi
try:
    PREDICTOR_PATH = check_model_path(PREDICTOR_PATH, "data", "shape_predictor_68_face_landmarks.dat")
    FACEREC_PATH = check_model_path(FACEREC_PATH, "data", "dlib_face_recognition_resnet_model_v1.dat")
    
    detector = dlib.get_frontal_face_detector()
    sp = dlib.shape_predictor(PREDICTOR_PATH)
    facerec = dlib.face_recognition_model_v1(FACEREC_PATH)
    
    logger.info("Face recognition models loaded successfully")
except Exception as e:
    logger.error(f"Error loading face recognition models: {str(e)}")
    raise

def extract_face_features(image_data):
    """Trích xuất đặc trưng khuôn mặt từ ảnh"""
    try:
        # Xử lý ảnh từ base64
        if isinstance(image_data, str) and image_data.startswith('data:image'):
            format, imgstr = image_data.split(';base64,')
            decoded_data = base64.b64decode(imgstr)
            np_data = np.frombuffer(decoded_data, np.uint8)
            img = cv2.imdecode(np_data, cv2.IMREAD_COLOR)
        elif isinstance(image_data, str) and os.path.isfile(image_data):
            # Nếu là đường dẫn file
            img = cv2.imread(image_data)
        elif isinstance(image_data, np.ndarray):
            # Nếu đã là numpy array
            img = image_data.copy()
        else:
            logger.error("Invalid image data format")
            return None, None, None
        
        # Chuyển BGR sang RGB (dlib sử dụng RGB)
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Phát hiện khuôn mặt
        faces = detector(rgb_img, 1)
        if not faces:
            logger.warning("No face detected in image")
            return None, None, img
        
        # Lấy khuôn mặt đầu tiên - có thể cải tiến để xử lý nhiều khuôn mặt
        face = faces[0]
        
        # Phát hiện các điểm landmark
        shape = sp(rgb_img, face)
        
        # Tính toán face descriptor (vector 128 chiều)
        face_descriptor = facerec.compute_face_descriptor(rgb_img, shape)
        
        # Chuyển sang numpy array
        return np.array(face_descriptor), face, img
    except Exception as e:
        logger.error(f"Error extracting face features: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return None, None, None

def register_face(employee_id, name, image_data):
    """Đăng ký khuôn mặt cho nhân viên"""
    try:
        face_encoding, face, img = extract_face_features(image_data)
        
        if face_encoding is None:
            return {
                'success': False,
                'message': 'Không phát hiện khuôn mặt trong ảnh'
            }
        
        # Lưu ảnh vào thư mục
        now = datetime.now()
        img_filename = f"{name}_{now.strftime('%Y%m%d_%H%M%S')}.jpg"
        img_path = os.path.join(CURRENT_PHOTO_DIR, img_filename)
        
        # Cắt và lưu khuôn mặt thay vì toàn bộ ảnh
        height = face.bottom() - face.top()
        width = face.right() - face.left()
        # Mở rộng vùng cắt một chút
        padding_factor = 0.3
        top = max(0, face.top() - int(height * padding_factor))
        bottom = min(img.shape[0], face.bottom() + int(height * padding_factor))
        left = max(0, face.left() - int(width * padding_factor))
        right = min(img.shape[1], face.right() + int(width * padding_factor))
        
        face_img = img[top:bottom, left:right]
        cv2.imwrite(img_path, face_img)
        
        # Lưu feature vector vào collection trainner
        save_result = save_face_feature(
            employee_id=employee_id, 
            name=name, 
            feature_vector=face_encoding.tolist(),
            image_path=f"current_photo/{img_filename}"
        )
        
        if save_result:
            return {
                'success': True,
                'message': 'Đã đăng ký khuôn mặt thành công',
                'image_path': f"current_photo/{img_filename}"
            }
        else:
            return {
                'success': False,
                'message': 'Không thể lưu đặc trưng khuôn mặt'
            }
    
    except Exception as e:
        logger.error(f"Error in register_face: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            'success': False,
            'message': f'Lỗi: {str(e)}'
        }

def recognize_face(image_data):
    """Nhận diện khuôn mặt từ ảnh"""
    try:
        face_encoding, face, img = extract_face_features(image_data)
        
        if face_encoding is None:
            return {
                'success': False,
                'message': 'Không phát hiện khuôn mặt'
            }
        
        # Lấy danh sách đặc trưng khuôn mặt từ DB
        face_features = get_face_features()
        
        # Ngưỡng khoảng cách để xác định là cùng 1 người
        # Có thể thay đổi để phù hợp với yêu cầu của bạn
        threshold = 0.45  
        min_distance = float('inf')
        recognized_person = None
        
        # So sánh với các đặc trưng đã lưu
        for person in face_features:
            if 'feature' not in person or person['feature'] is None:
                logger.warning(f"Person {person.get('name', 'unknown')} has no feature")
                continue
                
            # Tính khoảng cách Euclidean
            try:
                stored_encoding = np.array(person['feature'])
                if stored_encoding.shape[0] != 128:
                    logger.warning(f"Invalid feature dimension: {stored_encoding.shape[0]} for {person.get('name')}")
                    continue
                    
                distance = np.linalg.norm(face_encoding - stored_encoding)
                logger.debug(f"Distance to {person.get('name')}: {distance}")
                
                if distance < min_distance:
                    min_distance = distance
                    recognized_person = person
            except Exception as e:
                logger.error(f"Error comparing features for {person.get('name')}: {str(e)}")
        
        # Nếu khoảng cách nhỏ hơn ngưỡng, xem như đã nhận diện thành công
        if recognized_person and min_distance < threshold:
            # Lưu ảnh hiện tại
            now = datetime.now()
            img_filename = f"{recognized_person['name']}_{now.strftime('%Y%m%d_%H%M%S')}.jpg"
            img_path = os.path.join(CURRENT_PHOTO_DIR, img_filename)
            cv2.imwrite(img_path, img)
            
            # Lưu thông tin điểm danh
            attendance_result = save_attendance(
                recognized_person['name'], 
                f"current_photo/{img_filename}", 
                recognized_person
            )
            
            return {
                'success': True,
                'name': recognized_person['name'],
                'employee_id': str(recognized_person.get('_id', '')),
                'job_position': recognized_person.get('job_position', ''),
                'email': recognized_person.get('email', ''),
                'phone': recognized_person.get('phone', ''),
                'timestamp': datetime.now().isoformat(),
                'confidence': float(1 - min_distance),
                'attendance_saved': attendance_result
            }
        else:
            return {
                'success': False,
                'message': 'Không nhận diện được khuôn mặt',
                'min_distance': float(min_distance) if min_distance != float('inf') else None
            }
            
    except Exception as e:
        logger.error(f"Error in recognize_face: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            'success': False,
            'message': f'Lỗi: {str(e)}'
        }

# Hàm tiện ích để kiểm tra chức năng nhận diện khuôn mặt
def test_recognition(image_path):
    """Hàm test nhận diện khuôn mặt từ đường dẫn ảnh"""
    result = recognize_face(image_path)
    logger.info(f"Recognition result: {result}")
    return result
