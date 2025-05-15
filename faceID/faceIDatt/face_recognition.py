import os
import dlib
import numpy as np
import cv2
import base64
import logging
import time
from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime, timedelta
from django.conf import settings
from .database import get_face_features, save_face_feature, save_attendance, update_dataset_image_path

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("face_recognition")

# Đường dẫn thư mục
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")
DATA_FACES_FROM_CAMERA_DIR = os.path.join(BASE_DIR, "data/data_faces_from_camera")
CURRENT_PHOTO_DIR = os.path.join(BASE_DIR, "current_photo")

# Tạo thư mục nếu chưa tồn tại
os.makedirs(DATA_FACES_FROM_CAMERA_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(CURRENT_PHOTO_DIR, exist_ok=True)

# Đường dẫn đến các model dlib
PREDICTOR_PATH = os.path.join(MODEL_DIR, "shape_predictor_68_face_landmarks.dat")
FACEREC_PATH = os.path.join(MODEL_DIR, "dlib_face_recognition_resnet_model_v1.dat")

# Cache cho việc nhận diện khuôn mặt để tăng hiệu suất
recognition_cache = {}
CACHE_TTL = 60  # Thời gian cache có hiệu lực (giây)

# Ngưỡng nhận diện - có thể điều chỉnh
RECOGNITION_THRESHOLD = 0.45

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
            try:
                # Tách phần header và dữ liệu
                format, imgstr = image_data.split(';base64,')
                # Giải mã base64
                decoded_data = base64.b64decode(imgstr)
                # Chuyển sang numpy array
                np_data = np.frombuffer(decoded_data, np.uint8)
                # Decode thành ảnh
                img = cv2.imdecode(np_data, cv2.IMREAD_COLOR)
                
                # Kiểm tra ảnh có đọc được không
                if img is None or img.size == 0:
                    logger.error("Failed to decode base64 image")
                    return None, None, None
                    
                logger.info(f"Successfully decoded base64 image, shape: {img.shape}")
            except Exception as e:
                logger.error(f"Error decoding base64 image: {str(e)}")
                return None, None, None
        elif isinstance(image_data, str) and os.path.isfile(image_data):
            # Nếu là đường dẫn file
            img = cv2.imread(image_data)
            
            # Kiểm tra ảnh có đọc được không
            if img is None or img.size == 0:
                logger.error(f"Failed to read image from path: {image_data}")
                return None, None, None
                
            logger.info(f"Successfully read image from path: {image_data}")
        elif isinstance(image_data, np.ndarray):
            # Nếu đã là numpy array
            img = image_data.copy()
            logger.info(f"Using provided numpy array image, shape: {img.shape}")
        else:
            logger.error(f"Invalid image data format: {type(image_data)}")
            return None, None, None
            
        # Chuyển BGR sang RGB (dlib sử dụng RGB)
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Phát hiện khuôn mặt
        faces = detector(rgb_img, 1)
        if not faces:
            logger.warning("No face detected in image")
            return None, None, img
        
        logger.info(f"Detected {len(faces)} faces in image")
        
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
        # Kiểm tra dữ liệu đầu vào
        if not employee_id or not name:
            return {"success": False, "message": "Thiếu ID hoặc tên nhân viên"}
            
        if not image_data:
            return {"success": False, "message": "Thiếu dữ liệu ảnh"}
            
        # Kiểm tra định dạng ảnh
        if not isinstance(image_data, str) or not image_data.startswith('data:image'):
            return {"success": False, "message": "Định dạng ảnh không hợp lệ, cần base64"}
        
        # Tách phần header và dữ liệu
        try:
            format, imgstr = image_data.split(';base64,')
            # Giải mã base64
            imgdata = base64.b64decode(imgstr)
            
            # Chuyển từ base64 trực tiếp sang numpy array để kiểm tra trước khi lưu
            np_data = np.frombuffer(imgdata, np.uint8)
            img_check = cv2.imdecode(np_data, cv2.IMREAD_COLOR)
            
            if img_check is None or img_check.size == 0:
                logger.error("Không thể decode ảnh base64")
                return {"success": False, "message": "Ảnh không hợp lệ hoặc bị hỏng"}
                
            logger.info(f"Kiểm tra ảnh thành công, kích thước: {img_check.shape}")
            
        except Exception as e:
            logger.error(f"Error decoding base64 image: {str(e)}")
            return {"success": False, "message": "Không thể giải mã ảnh base64"}
        
        # Xử lý tên thư mục - loại bỏ ký tự đặc biệt có thể gây lỗi đường dẫn
        employee_folder_name = ''.join(c if c.isalnum() or c == '_' else '_' for c in name.lower().replace(' ', '_'))
        employee_folder_path = os.path.join(DATA_FACES_FROM_CAMERA_DIR, employee_folder_name)
        os.makedirs(employee_folder_path, exist_ok=True)
        
        # Tạo tên file ảnh và đường dẫn
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        image_filename = f"img_face_{timestamp}.jpg"
        image_path = os.path.join(employee_folder_path, image_filename)
        
        # Lưu ảnh vào file
        with open(image_path, 'wb') as f:
            f.write(imgdata)
            
        logger.info(f"Saved image to: {image_path}")
        
        # Thay đổi: Lưu ảnh từ numpy array thay vì đọc lại từ file
        face_img = img_check  # Sử dụng ảnh đã decode ở trên
        
        # Cập nhật đường dẫn tương đối cho dataset
        # Sử dụng đường dẫn tương đối với forward slashes (/) cho MongoDB
        relative_path = os.path.relpath(image_path, BASE_DIR).replace('\\', '/')
        relative_folder_path = os.path.relpath(employee_folder_path, BASE_DIR).replace('\\', '/')
        
        client = MongoClient(settings.MONGO_URI)
        db = client[settings.MONGO_DB_NAME]
        
        # Tạo hoặc cập nhật bản ghi trong dataset
        dataset_collection = db['dataset']
        dataset_record = {
            'employee_id': employee_id,
            'name': name,
            'image_path': relative_path,
            'has_face': True,
            'updated_at': datetime.now()
        }
        
        # Kiểm tra xem bản ghi đã tồn tại chưa
        existing_record = dataset_collection.find_one({'employee_id': employee_id})
        if existing_record:
            dataset_collection.update_one(
                {'employee_id': employee_id},
                {'$set': dataset_record}
            )
        else:
            dataset_record['created_at'] = datetime.now()
            dataset_collection.insert_one(dataset_record)
            
        logger.info(f"Updated dataset collection with image path: {relative_path}")
        
        # Xóa đăng ký cũ nếu có
        db.trainner.delete_many({'employee_id': employee_id})
        
        # Trích xuất đặc trưng khuôn mặt từ ảnh đã decode
        face_encoding, face, _ = extract_face_features(face_img)
        
        if face_encoding is None:
            logger.warning(f"No face detected in image")
            return {"success": False, "message": "Không phát hiện khuôn mặt trong ảnh"}
            
        logger.info(f"Successfully extracted face features")
        
        # Đảm bảo face_encoding là numpy array trước khi chuyển thành list
        if not isinstance(face_encoding, np.ndarray):
            logger.error(f"face_encoding is not a numpy array: {type(face_encoding)}")
            return {"success": False, "message": "Lỗi trích xuất đặc trưng khuôn mặt"}
        
        # Lưu đặc trưng khuôn mặt vào collection trainner
        save_result = save_face_feature(
            employee_id, 
            name, 
            face_encoding.tolist(),  # Chuyển numpy array thành list để lưu vào MongoDB
            relative_path
        )
        
        if not save_result:
            logger.error(f"Failed to save face features to trainner collection")
            return {"success": False, "message": "Lỗi lưu đặc trưng khuôn mặt"}
            
        logger.info(f"Saved face features to trainner collection")
        
        # Cập nhật trạng thái has_face trong collection employee
        employees_collection = db['employees']
        
        employees_collection.update_one(
            {'_id': ObjectId(employee_id)},
            {'$set': {
                'has_face': True,
                'image_path': relative_path,
                'face_folder': relative_folder_path
            }}
        )
        logger.info(f"Updated employee record with has_face=True")
        
        # Tính toán đặc trưng trung bình nếu đã có nhiều ảnh
        existing_images = [f for f in os.listdir(employee_folder_path) if f.endswith(('.jpg', '.jpeg', '.png'))]
        if len(existing_images) > 1:
            try:
                average_features, message = calculate_average_features(employee_id, name)
                logger.info(f"Calculated average features for {name}: {message}")
            except Exception as e:
                logger.error(f"Error calculating average features: {str(e)}")
        
        return {
            "success": True,
            "message": "Đăng ký khuôn mặt thành công",
            "image_path": relative_path,
            "folder_path": relative_folder_path
        }
    except Exception as e:
        logger.error(f"Error in face registration: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {"success": False, "message": f"Lỗi: {str(e)}"}

def recognize_face(image_data):
    """Nhận diện khuôn mặt từ ảnh"""
    try:
        # Trích xuất đặc trưng khuôn mặt từ ảnh
        face_encoding, face, img = extract_face_features(image_data)
        
        if face_encoding is None:
            return {
                'success': False,
                'message': 'Không phát hiện khuôn mặt'
            }
        
        # Lấy danh sách đặc trưng khuôn mặt từ trainner collection
        from pymongo import MongoClient
        from bson.objectid import ObjectId
        
        client = MongoClient(settings.MONGO_URI)
        db = client[settings.MONGO_DB_NAME]
        
        trainers = list(db.trainner.find({}, {
            'employee_id': 1,
            'name': 1,
            'feature_vector': 1
        }))
        
        if not trainers:
            logger.warning("No face features found in trainner collection")
            return {
                'success': False,
                'message': 'Không có dữ liệu khuôn mặt trong hệ thống'
            }
        
        best_match = None
        min_distance = float('inf')
        threshold = RECOGNITION_THRESHOLD
        
        for trainer in trainers:
            # Đảm bảo trainer có feature_vector
            if 'feature_vector' not in trainer or not trainer['feature_vector']:
                logger.warning(f"Person {trainer.get('name', 'Unknown')} has no feature")
                continue
                
            # Chuyển feature_vector từ list sang numpy array
            stored_features = np.array(trainer['feature_vector'])
            
            # Tính khoảng cách Euclidean giữa 2 vector
            distance = np.linalg.norm(face_encoding - stored_features)
            
            # Cập nhật best match nếu distance nhỏ hơn min_distance hiện tại
            if distance < min_distance:
                min_distance = distance
                best_match = {
                    'employee_id': trainer.get('employee_id'),
                    'name': trainer.get('name'),
                    'distance': distance
                }
        
        # Nếu không tìm thấy khuôn mặt nào khớp
        if not best_match:
            return {
                'success': False,
                'message': 'Không tìm thấy khuôn mặt nào khớp'
            }
        
        # Nếu khoảng cách quá lớn, coi như không nhận diện được
        if min_distance > threshold:
            return {
                'success': False,
                'message': f'Độ tương đồng thấp (distance={min_distance:.4f}, threshold={threshold})',
                'distance': min_distance,
                'threshold': threshold
            }
        
        # Lấy thông tin nhân viên từ employees collection
        employee_id = best_match['employee_id']
        employee = db.employees.find_one({'_id': ObjectId(employee_id)})
        
        if not employee:
            return {
                'success': False,
                'message': 'Không tìm thấy thông tin nhân viên'
            }
        
        # Lưu thông tin điểm danh
        now = datetime.now()
        
        # Lưu ảnh hiện tại vào thư mục current_photo
        person_name = best_match['name'].lower().replace(' ', '_')
        img_filename = f"{person_name}_{now.strftime('%Y%m%d_%H%M%S')}.jpg"
        img_path = os.path.join(CURRENT_PHOTO_DIR, img_filename)
        
        # Tạo thư mục nếu chưa tồn tại
        os.makedirs(CURRENT_PHOTO_DIR, exist_ok=True)
        
        # Lưu ảnh hiện tại
        cv2.imwrite(img_path, img)
        
        # Lấy đường dẫn tương đối
        relative_path = os.path.relpath(img_path, BASE_DIR)
        
        # Lưu thông tin điểm danh vào collection testdata
        attendance_result = save_attendance(
            best_match['name'], 
            relative_path,
            employee
        )
        
        return {
            'success': True,
            'name': best_match['name'],
            'employee_id': str(employee_id),
            'job_position': employee.get('job_position', ''),
            'email': employee.get('email', ''),
            'phone': employee.get('phone', ''),
            'timestamp': now.isoformat(),
            'confidence': float(1 - min_distance),
            'attendance_saved': attendance_result
        }
    except Exception as e:
        logger.error(f"Error in recognize_face: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            'success': False,
            'message': f'Lỗi: {str(e)}'
        }

def calculate_average_features(employee_id, name=None):
    """
    Tính toán vector đặc trưng trung bình từ nhiều ảnh của một nhân viên
    
    Chức năng tương tự như trong features_extraction_to_csv.py
    """
    try:
        if not employee_id:
            return None, "Thiếu mã nhân viên"
            
        # Lấy thông tin nhân viên
        from pymongo import MongoClient
        from bson.objectid import ObjectId
        
        client = MongoClient(settings.MONGO_URI)
        db = client[settings.MONGO_DB_NAME]
        
        # Kiểm tra employee_id là ObjectId hay string
        if isinstance(employee_id, str):
            employee_id_obj = ObjectId(employee_id)
        else:
            employee_id_obj = employee_id
            
        employee = db.employees.find_one({"_id": employee_id_obj})
        
        if not employee:
            return None, "Không tìm thấy nhân viên"
            
        if not employee.get('has_face'):
            return None, "Nhân viên chưa có dữ liệu khuôn mặt"
            
        face_folder = employee.get('face_folder')
        if not face_folder:
            return None, "Không tìm thấy thư mục ảnh khuôn mặt"
            
        # Đường dẫn đầy đủ đến thư mục ảnh
        folder_path = os.path.join(BASE_DIR, face_folder)
        
        if not os.path.exists(folder_path):
            return None, f"Thư mục {folder_path} không tồn tại"
            
        # Lấy tất cả ảnh trong thư mục
        image_files = []
        for ext in ['jpg', 'jpeg', 'png']:
            image_files.extend([os.path.join(folder_path, f) for f in os.listdir(folder_path) if f.lower().endswith(f'.{ext}')])
            
        if not image_files:
            return None, "Không tìm thấy ảnh trong thư mục"
            
        # Trích xuất đặc trưng từ mỗi ảnh
        features_list = []
        for image_path in image_files:
            face_encoding, _, _ = extract_face_features(image_path)
            if face_encoding is not None:
                features_list.append(face_encoding)
                
        if not features_list:
            return None, "Không thể trích xuất đặc trưng từ ảnh"
            
        # Tính trung bình vector đặc trưng
        avg_features = np.mean(features_list, axis=0)
        
        # Cập nhật đặc trưng trong collection trainner
        employee_name = employee.get('name') if name is None else name
        save_face_feature(str(employee_id), employee_name, avg_features.tolist())
        
        return avg_features, "Cập nhật đặc trưng thành công"
    except Exception as e:
        logger.error(f"Error in calculate_average_features: {str(e)}")
        return None, f"Lỗi: {str(e)}"

def clean_recognition_cache():
    """Xóa bớt cache nhận diện khuôn mặt đã hết hạn"""
    current_time = time.time()
    expired_keys = [k for k, v in recognition_cache.items() if current_time - v['timestamp'] > CACHE_TTL]
    
    for key in expired_keys:
        del recognition_cache[key]
        
    return len(expired_keys)

def test_recognition(image_path, threshold=None):
    """Hàm test nhận diện khuôn mặt từ đường dẫn ảnh"""
    result = recognize_face(image_path)
    logger.info(f"Recognition test result: {result}")
    return result

def recalculate_all_features():
    """
    Tính toán lại tất cả các vector đặc trưng cho tất cả nhân viên
    
    Chức năng tương tự như chạy features_extraction_to_csv.py với tham số extract_all=True
    """
    try:
        from pymongo import MongoClient
        from bson.objectid import ObjectId
        
        client = MongoClient(settings.MONGO_URI)
        db = client[settings.MONGO_DB_NAME]
        
        # Lấy tất cả nhân viên có has_face=True
        employees = list(db.employees.find({"has_face": True}))
        
        if not employees:
            return {"success": False, "message": "Không có nhân viên nào có dữ liệu khuôn mặt"}
        
        results = []
        for employee in employees:
            employee_id = str(employee["_id"])
            employee_name = employee["name"]
            
            try:
                avg_features, message = calculate_average_features(employee_id, employee_name)
                if avg_features is not None:
                    results.append({
                        "employee_id": employee_id,
                        "name": employee_name,
                        "success": True
                    })
                else:
                    results.append({
                        "employee_id": employee_id,
                        "name": employee_name,
                        "success": False,
                        "message": message
                    })
            except Exception as e:
                results.append({
                    "employee_id": employee_id,
                    "name": employee_name,
                    "success": False,
                    "message": str(e)
                })
        
        successful = sum(1 for r in results if r["success"])
        return {
            "success": True,
            "message": f"Đã xử lý {len(results)} nhân viên. Thành công: {successful}, Thất bại: {len(results) - successful}",
            "results": results
        }
    except Exception as e:
        logger.error(f"Error in recalculate_all_features: {str(e)}")
        return {"success": False, "message": f"Lỗi: {str(e)}"}
