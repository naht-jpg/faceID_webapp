# Hệ Thống Chấm Công Bằng Nhận Diện Khuôn Mặt

Hệ thống chấm công hiện đại sử dụng công nghệ nhận diện khuôn mặt để theo dõi sự hiện diện của nhân viên. Được xây dựng với Django (backend) và React (frontend), tích hợp MongoDB để lưu trữ dữ liệu.

## Tính Năng

- Chấm công tự động bằng nhận diện khuôn mặt
- Theo dõi chấm công theo thời gian thực
- Hệ thống quản lý người dùng (admin và nhân viên)
- Giao diện thân thiện với người dùng
- Bảng điều khiển với thống kê và phân tích dữ liệu chấm công
- Xuất báo cáo chấm công
- Tính lương tự động dựa trên dữ liệu chấm công
- Quản lý lịch làm việc
- Cổng thông tin riêng cho nhân viên

## Yêu Cầu Hệ Thống

### Yêu Cầu Backend
- Python 3.8+ 
- Django 4.2
- OpenCV (xử lý hình ảnh)
- dlib (nhận diện khuôn mặt)
- MongoDB (lưu trữ dữ liệu người dùng và vector khuôn mặt)
- Các thư viện khác được liệt kê trong `requirements.txt`

### Yêu Cầu Frontend
- Node.js 16+
- npm hoặc yarn
- React 18.3+
- Material UI (giao diện người dùng)
- Webcam để chụp và nhận diện khuôn mặt
- Các thư viện khác được liệt kê trong `package.json`

## Cấu Trúc Dự Án

```
faceID_webapp/
├── faceID/                  # Backend Django
│   ├── faceID/              # Ứng dụng Django chính
│   ├── faceIDatt/           # Ứng dụng chấm công
│   │   ├── models/          # Chứa các model nhận diện khuôn mặt
│   │   ├── migrations/      # Các migration của database
│   │   ├── current_photo/   # Lưu ảnh chụp chấm công
│   │   ├── data/            # Dữ liệu huấn luyện khuôn mặt
│   │   ├── face_recognition.py # Xử lý nhận diện khuôn mặt
│   │   └── database.py      # Kết nối và xử lý với MongoDB
│   ├── manage.py            # Script quản lý Django
│   └── requirements.txt     # Các phụ thuộc Python
│
└── faceID-frontend/         # Frontend React
    ├── public/              # Tài nguyên tĩnh
    ├── src/                 # Mã nguồn
    │   ├── components/      # Các component React
    │   │   ├── Dashboard/   # Giao diện quản trị viên
    │   │   └── employee-portal/ # Cổng thông tin nhân viên
    │   ├── pages/           # Các trang chính
    │   └── hooks/           # React hooks
    └── package.json         # Các phụ thuộc Node.js
```

## Cài Đặt

### Cài Đặt Môi Trường Ảo

1. Di chuyển đến thư mục gốc của dự án:
   ```
   cd faceID_webapp
   ```

2. Tạo môi trường ảo:
   ```
   python -m venv .venv
   ```

3. Kích hoạt môi trường ảo:
   - Windows:
     ```
     .venv\Scripts\activate
     ```
   - macOS/Linux:
     ```
     source .venv/bin/activate
     ```

### Cài Đặt Backend

1. Với môi trường ảo đã kích hoạt, cài đặt các gói phụ thuộc backend:
   ```
   pip install -r faceID/requirements.txt
   ```

5. Cấu hình biến môi trường:
   - Tạo tệp `.env` trong thư mục `faceID` với các cấu hình cần thiết
   - Đảm bảo thiết lập kết nối database MongoDB:
     ```
     MONGO_URI=mongodb://username:password@localhost:27017
     MONGO_DB_NAME=faceID_database
     SECRET_KEY=your_secret_key
     DEBUG=True
     ```

### Cài Đặt Frontend

1. Vẫn với môi trường ảo đã kích hoạt, di chuyển đến thư mục frontend:
   ```
   cd faceID-frontend
   ```

2. Cài đặt các gói phụ thuộc:
   ```
   npm install
   ```

## Chạy Ứng Dụng

### Khởi Động Môi Trường Ảo

1. Mở terminal và đi đến thư mục gốc của dự án:
   ```
   cd faceID_webapp
   ```

2. Kích hoạt môi trường ảo:
   ```
   .venv\Scripts\activate   # Windows
   ```

### Khởi Động Backend Server

1. Từ thư mục gốc với môi trường ảo đã kích hoạt, di chuyển đến thư mục faceID:
   ```
   cd faceID
   ```

2. Khởi động Django server:
   ```
   python manage.py runserver
   ```
   Backend server sẽ chạy tại `http://127.0.0.1:8000/`.

3. Đảm bảo MongoDB đang chạy (có thể cần cài đặt MongoDB Community Server).

### Khởi Động Frontend Development Server

1. Mở một terminal mới (giữ cho backend server vẫn đang chạy)

2. Di chuyển đến thư mục frontend:
   ```
   cd faceID_webapp/faceID-frontend
   ```

3. Khởi động development server:
   ```
   npm run dev
   ```
   Frontend sẽ chạy tại `http://localhost:5173/` (hoặc cổng khác được cấu hình bởi Vite).

## Truy Cập Ứng Dụng

Khi cả hai server đang chạy:
1. Mở trình duyệt của bạn và truy cập `http://localhost:5173/` (hoặc cổng Vite phù hợp)
2. Bạn sẽ được chuyển hướng đến trang đăng nhập của ứng dụng
3. Sử dụng thông tin đăng nhập của bạn để truy cập:
   - Tài khoản quản trị viên: truy cập bảng điều khiển quản trị
   - Tài khoản nhân viên: truy cập cổng thông tin nhân viên

## Hướng Dẫn Sử Dụng

### Dành Cho Quản Trị Viên (Admin)

1. Đăng nhập với tài khoản quản trị viên
2. Tại bảng điều khiển quản trị, bạn có thể:
   - Quản lý nhân viên (thêm, sửa, xóa)
   - Đăng ký khuôn mặt cho nhân viên mới
   - Xem báo cáo chấm công
   - Quản lý tài khoản người dùng
   - Thiết lập lịch làm việc
   - Tính toán lương dựa trên dữ liệu chấm công
   - Xem dữ liệu thống kê và phân tích

### Dành Cho Nhân Viên

1. Đăng nhập với tài khoản nhân viên
2. Tại cổng thông tin nhân viên, bạn có thể:
   - Chấm công bằng nhận diện khuôn mặt
   - Xem lịch sử chấm công cá nhân
   - Cập nhật thông tin cá nhân
   - Xem lịch làm việc và thông báo

## Xử Lý Sự Cố

### Các Vấn Đề Backend Thường Gặp

- **Lỗi Kết Nối Database**: Đảm bảo MongoDB đang chạy và được cấu hình đúng trong tệp `.env`.
- **Thiếu Phụ Thuộc Nhận Diện Khuôn Mặt**: Thư viện dlib có thể khó cài đặt. Đảm bảo bạn đã cài đặt các công cụ build C++ phù hợp trên hệ thống của mình.
- **Vấn Đề Về Quyền Truy Cập**: Đảm bảo ứng dụng có quyền truy cập vào camera và hệ thống tệp.
- **Mô Hình Nhận Diện**: Đảm bảo đã tải các mô hình dlib vào thư mục `/faceID/faceIDatt/models/` gồm:
  - `shape_predictor_68_face_landmarks.dat`
  - `dlib_face_recognition_resnet_model_v1.dat`

### Các Vấn Đề Frontend Thường Gặp

- **Vấn Đề Về Node Module**: Thử xóa thư mục `node_modules` và chạy lại `npm install`.
- **Quyền Truy Cập Camera**: Cần phải cấp quyền truy cập webcam trên trình duyệt để nhận diện khuôn mặt hoạt động.
- **Vấn Đề CORS**: Nếu gặp lỗi CORS, hãy đảm bảo cấu hình CORS trên backend đã được thiết lập đúng.

## Công Nghệ Sử Dụng

### Backend
- Django: Framework web Python
- Django REST Framework: API RESTful
- dlib & OpenCV: Xử lý và nhận diện khuôn mặt
- MongoDB: Lưu trữ dữ liệu người dùng và vector khuôn mặt
- JWT: Xác thực người dùng

### Frontend
- React: Thư viện JavaScript UI
- Material UI: Framework UI component
- React Webcam: Truy cập webcam
- Axios: HTTP client
- Vite: Công cụ build và development server

## Giấy Phép

[Giấy Phép MIT](LICENSE)

## Người Đóng Góp

- Trần Nguyễn Minh Khôi
- Trần Dương Yến Nhi
- Trần Minh Nhật
---

Đối với câu hỏi hoặc hỗ trợ, vui lòng tạo issue trong kho lưu trữ dự án hoặc liên hệ với người bảo trì dự án.