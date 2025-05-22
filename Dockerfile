```dockerfile
# 1. Chọn base image dùng Python 3.9 để tận dụng wheel prebuilt cho dlib
FROM python:3.9-slim

# 2. Cài các system deps cần thiết cho dlib & OpenCV
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      build-essential cmake python3-dev pkg-config \
      libboost-python-dev libboost-thread-dev libboost-system-dev \
      libglib2.0-0 libsm6 libxrender1 libxext6 \
      libx11-dev libgtk-3-dev libpng-dev libjpeg-dev libopenblas-dev && \
    rm -rf /var/lib/apt/lists/*

# 3. Thiết lập thư mục làm việc
WORKDIR /app

# 4. Copy file requirements và cài Python deps
COPY faceID/requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 5. Copy toàn bộ code backend
COPY faceID/ /app/faceID

# 6. Thiết biến môi trường
ENV PORT=8000 \
    DJANGO_SETTINGS_MODULE=faceID.settings

# 7. Expose port và chạy Gunicorn
EXPOSE 8000
CMD ["gunicorn", "faceID.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2"]
```
