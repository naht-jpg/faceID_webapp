import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Create an axios instance with the correct base URL
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Thêm interceptor để tự động gắn token vào mọi request
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

// Authentication API
export const authAPI = {
  login: (credentials) =>
    apiClient.post('/token/', credentials),
  register: (userData) =>
    apiClient.post('/register/', userData),
  refreshToken: (refreshToken) => 
    apiClient.post('/token/refresh/', { refresh: refreshToken }),
  getCurrentUser: () => apiClient.get('/user/')
};

// Employee API
export const employeeAPI = {
  getAll: () => apiClient.get('/employees/', {
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
    params: {
      _t: new Date().getTime() // Add timestamp to prevent caching
    }
  }),
  getById: (id) => apiClient.get(`/employees/${id}/`),
  create: (data) => apiClient.post('/employees/create/', data),
  update: (id, data) => apiClient.put(`/employees/${id}/update/`, data),
  delete: (id) => apiClient.delete(`/employees/${id}/delete/`)
};

// Face API
export const faceAPI = {
  register: (employeeId, name, imageData) => 
    apiClient.post('/face-register/', {
      employee_id: employeeId,
      name: name,
      image: imageData
    }),
  recognize: (imageData) => 
    apiClient.post('/face-recognition/', {
      image: imageData
    }),
  getAttendanceHistory: (employeeId) => 
    apiClient.get(`/attendance/${employeeId}/`)
};

// Attendance API
export const attendanceAPI = {
  getAll: () => apiClient.get('/api/attendance/'),
  getByEmployeeId: (employeeId) => apiClient.get(`/attendance/${employeeId}/`),
  getLatestByEmployeeId: (employeeId) => 
    apiClient.get(`/attendance/${employeeId}/latest/`),
  getTodayByEmployeeId: (employeeId) =>
    apiClient.get(`/attendance/${employeeId}/today/`),
  create: (data) => apiClient.post('/api/attendance/', data)
};

export default apiClient;