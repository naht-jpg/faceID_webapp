FROM python:3.11-slim

# 1. Cài build deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      build-essential cmake python3-dev \
      libboost-python-dev libboost-thread-dev libboost-system-dev \
      libglib2.0-0 libsm6 libxrender1 libxext6 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app/faceID

# 2. Copy requirements trước
COPY faceID/requirements.txt .

# 3. (Tùy chọn) nâng cấp pip
RUN pip install --no-cache-dir --upgrade pip

# 4. Cài Python packages
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy tiếp toàn bộ code
COPY faceID/ .

# 6. Thu gom static
RUN python manage.py collectstatic --noinput

EXPOSE 8000

# 7. Thiết lập biến môi trường Django và chạy
ENV DJANGO_SETTINGS_MODULE=faceID.settings
CMD ["gunicorn", "faceID.wsgi", "--bind", "0.0.0.0:8000"]
