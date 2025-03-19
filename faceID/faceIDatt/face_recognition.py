import os
import dlib
import numpy as np
import cv2
import base64
from pymongo import MongoClient

# MongoDB connection
client = MongoClient("mongodb://localhost:27017/")
db = client["CongTy"]
collection = db["employees"]

# Lấy đường dẫn thư mục hiện tại của file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")

# Load models
detector = dlib.get_frontal_face_detector()
sp = dlib.shape_predictor(os.path.join(MODEL_DIR, "shape_predictor_68_face_landmarks.dat"))
facerec = dlib.face_recognition_model_v1(os.path.join(MODEL_DIR, "dlib_face_recognition_resnet_model_v1.dat"))

def get_face_encoding(image):
    img = cv2.imdecode(np.frombuffer(base64.b64decode(image), np.uint8), cv2.IMREAD_COLOR)
    dets = detector(img, 1)
    if len(dets) == 0:
        return None

    shape = sp(img, dets[0])
    face_descriptor = facerec.compute_face_descriptor(img, shape)
    return np.array(face_descriptor).tolist()

def recognize_face(image):
    encoding = get_face_encoding(image)
    if encoding is None:
        return None

    # Sử dụng PyMongo thay vì Django ORM
    employees = list(collection.find({}))
    for emp in employees:
        if 'face_encoding' in emp:
            stored_encoding = np.array(emp['face_encoding'])
            distance = np.linalg.norm(stored_encoding - np.array(encoding))
            if distance < 0.6:
                return emp['name']
    return None
