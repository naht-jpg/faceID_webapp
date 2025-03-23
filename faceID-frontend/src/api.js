import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Create an axios instance with the correct base URL
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token in requests
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage (correct key name)
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log("API Error: ", error.response || error);
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: (username, password) => 
    apiClient.post('/token/', { username, password }),
  register: (userData) =>
    apiClient.post('/register/', userData),
  refreshToken: (refreshToken) => 
    apiClient.post('/token/refresh/', { refresh: refreshToken }),
  getCurrentUser: () => apiClient.get('/user/')
};

// Employee API with cache busting
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
    apiClient.post('/api/face-register/', {
      employee_id: employeeId,
      name: name,
      image: imageData
    }),
  recognize: (imageData) => 
    apiClient.post('/api/face-recognition/', {
      image: imageData
    }),
  getAttendanceHistory: (employeeId) => 
    apiClient.get(`/api/attendance/${employeeId}/`)
};

export default apiClient;