import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Tạo axios instance với baseURL
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // Thêm timeout 15 giây
});

// Interceptor để tự động thêm token vào mọi request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor để xử lý token hết hạn và các lỗi khác
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Xử lý lỗi mạng
    if (!error.response) {
      console.error('Network error or server unavailable');
      // Thông báo lỗi mạng thay vì chỉ reject promise
      return Promise.reject({
        isNetworkError: true,
        message: 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.'
      });
    }
    
    // Nếu lỗi 401 và chưa thử refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/token/refresh/`, {
            refresh: refreshToken
          });
          
          if (response.data.access) {
            localStorage.setItem('access_token', response.data.access);
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${response.data.access}`;
            originalRequest.headers['Authorization'] = `Bearer ${response.data.access}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    
    // Xử lý timeout
    if (error.code === 'ECONNABORTED') {
      return Promise.reject({
        isTimeoutError: true,
        message: 'Yêu cầu hết thời gian. Vui lòng thử lại.'
      });
    }
    
    return Promise.reject(error);
  }
);

// Auth API - Điều chỉnh endpoints phù hợp với urls.py
export const authAPI = {
  login: (credentials) => apiClient.post('/auth/token/', {
    username: credentials.username, // Backend đang mong đợi field username
    password: credentials.password
  }),
  register: (userData) => apiClient.post('/auth/register/', userData),
  refreshToken: (refreshToken) => apiClient.post('/auth/token/refresh/', { refresh: refreshToken }),
  getCurrentUser: () => apiClient.get('/user/')
};

// Employee API
export const employeeAPI = {
  getAll: () => apiClient.get('/employees/'),
  getById: (id) => apiClient.get(`/employees/${id}/`),
  create: (data) => apiClient.post('/employees/', data),
  update: (id, data) => apiClient.put(`/employees/${id}/`),
  patch: (id, data) => apiClient.patch(`/employees/${id}/`),
  delete: (id) => apiClient.delete(`/employees/${id}/`),
  getAttendance: (id, params) => apiClient.get(`/employees/${id}/attendance/`, { params }),
};

// Face API
export const faceAPI = {
  register: function(data, name, imageData) {
    const formData = new FormData();
    
    // Nếu là object với nhiều trường
    if (typeof data === 'object' && !(data instanceof Blob) && !(data instanceof File)) {
      for (const key in data) {
        formData.append(key, data[key]);
      }
    } 
    // Nếu gọi trực tiếp với employee_id, name, và image
    else if (name && imageData) {
      // Kiểm tra và ghi log về params
      console.log("Sending registration data:", {
        employee_id: data,
        name: name,
        image_type: imageData instanceof File ? 'File: ' + imageData.name : 
                   imageData instanceof Blob ? 'Blob' : typeof imageData,
        image_size: imageData.size ? Math.round(imageData.size / 1024) + "KB" : 
                    (typeof imageData === 'string' ? Math.round(imageData.length / 1.37 / 1024) + "KB" : 'unknown')
      });
      
      formData.append('employee_id', data);
      formData.append('name', name);
      formData.append('image', imageData);
    }
    
    // Log FormData để kiểm tra
    console.log("FormData entries:");
    for (let pair of formData.entries()) {
      console.log(pair[0], pair[1] instanceof File ? 
        `File: ${pair[1].name}, ${pair[1].type}, ${Math.round(pair[1].size / 1024)}KB` : 
        pair[1]);
    }
    
    return apiClient.post('/faces/register/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  
  recognize: (imageData) => {
    const formData = new FormData();
    formData.append('image', imageData);
    
    return apiClient.post('/faces/recognize/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  
  // Hàm helper để lấy lịch sử nhận diện khuôn mặt
  getAttendanceHistory: (employeeId) => {
    return apiClient.get(`/attendance/${employeeId}/`, {
      params: { all: true }
    });
  }
};

// Attendance API
export const attendanceAPI = {
  getByEmployeeId: (id, params) => apiClient.get(`/attendance/${id}/`, { params }),
  create: (id, data) => apiClient.post(`/attendance/${id}/`, data),
  
  // Hàm helper cho các trường hợp phổ biến
  getLatest: (id) => apiClient.get(`/attendance/${id}/`, { params: { latest: true }}),
  getToday: (id) => apiClient.get(`/attendance/${id}/`, { params: { today: true }}),
  getByMonth: (id, year, month) => apiClient.get(`/attendance/${id}/`, { 
    params: { year, month }
  }),
  getMonthlySummary: (id, year, month) => apiClient.get(`/employees/${id}/attendance/summary`, {
    params: { year, month }
  }),
};

// Signin API (tài khoản người dùng)
export const signinAPI = {
  getAll: () => apiClient.get('/signin/'),
  getById: (id) => apiClient.get(`/signin/${id}/`),
  create: (data) => apiClient.post('/signin/', data),
  update: (id, data) => apiClient.put(`/signin/${id}/`),
  patch: (id, data) => apiClient.patch(`/signin/${id}/`),
  delete: (id) => apiClient.delete(`/signin/${id}/`),
};

export default apiClient;