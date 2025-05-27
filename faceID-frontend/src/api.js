import axios from 'axios';

// Base API URL (from .env or fallback)
const API_URL = import.meta.env.VITE_API_URL;
console.log('Connecting to API at:', API_URL);

// Create axios instance with baseURL and default headers
const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
  withCredentials: true,   // enable sending cookies if using session-auth
});

// Request interceptor to add Bearer token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle network errors, token refresh, server errors, timeouts
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Network / no response
    if (!error.response) {
      return Promise.reject({
        isNetworkError: true,
        message: 'Cannot connect to server. Please check your network.'
      });
    }

    const status = error.response.status;

    // 401 Unauthorized => try refresh token once
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(
            `${API_URL}/auth/token/refresh/`,
            { refresh: refreshToken }
          );
          const { access } = res.data;
          if (access) {
            localStorage.setItem('access_token', access);
            apiClient.defaults.headers.Authorization = `Bearer ${access}`;
            originalRequest.headers.Authorization = `Bearer ${access}`;
            return apiClient(originalRequest);
          }
        } catch (e) {
          console.error('Token refresh failed:', e);
        }
      }
      // If refresh fails or no token => logout
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
      return;
    }

    // 500 Internal Server Error
    if (status === 500) {
      return Promise.reject({
        isServerError: true,
        message: error.response.data.message || 'Internal server error',
        original: error
      });
    }

    // Timeout
    if (error.code === 'ECONNABORTED') {
      return Promise.reject({
        isTimeoutError: true,
        message: 'Request timed out. Please try again.'
      });
    }

    return Promise.reject(error);
  }
);

// --- API modules ---

export const authAPI = {
  login: ({ username, password }) =>
    apiClient.post('/auth/token/', { username, password }),
  register: (data) => apiClient.post('/auth/register/', data),
  refreshToken: (refresh) => apiClient.post('/auth/token/refresh/', { refresh }),
  getCurrentUser: () => apiClient.get('/auth/me/'),
  changePassword: (data) => apiClient.post('/auth/change-password/', data),
};

export const employeeAPI = {
  getAll: () => apiClient.get('/employees/'),
  getById: (id) => apiClient.get(`/employees/${id}/`),
  getByCustomId: (customId) => apiClient.get(`/employees/custom-id/${customId}/`),
  create: (data) => apiClient.post('/employees/', data),
  update: (id, data) => apiClient.put(`/employees/${id}/`, data),
  delete: (id) => apiClient.delete(`/employees/${id}/`),
};

export const faceAPI = {
  register: (employee_id, name, imageData) =>
    apiClient.post(
      '/faces/register/',
      { employee_id, name, image: imageData }
    ),
  recognize: (imageData) =>
    apiClient.post(
      '/faces/recognize/',
      { image: imageData, save_attendance: true }
    ),
  testRecognize: (employeeId) =>
    apiClient.post(
      '/faces/test-recognize/',
      { employee_id: employeeId }
    ),
  testRecognizeWithImage: ({ employee_id, image }) =>
    apiClient.post(
      '/faces/test-recognize-with-image/',
      { employee_id, image, save_test_result: true }
    ),
  getAttendanceHistory: (employeeId) =>
    apiClient.get(`/attendance/${employeeId}/`, { params: { today: true } }),
};

export const attendanceAPI = {
  getByEmployeeId: (id, params) => apiClient.get(`/attendance/${id}/`, { params }),
  create: (id, data, isCheckOut = false) => {
    const now = new Date();
    return apiClient.post(
      `/attendance/${id}/`,
      {
        ...data,
        datetime: now.toISOString(),
        timezone_offset: now.getTimezoneOffset(),
        timezone_name: Intl.DateTimeFormat().resolvedOptions().timeZone,
        local_time: now.toString(),
        is_check_out: isCheckOut,
      }
    );
  },
  getLatest: (id) => apiClient.get(`/attendance/${id}/`, { params: { latest: true } }),
  getToday: (id) => apiClient.get(`/attendance/${id}/`, { params: { today: true } }),
  getLatestOrToday: (id) => apiClient.get(`/attendance/${id}/`, { params: { latest_or_today: true } }),
  getMonthlySummary: (employeeId, year, month) =>
    apiClient.get(`/employees/${employeeId}/attendance/summary`, { params: { year, month } }),
  getAdminAttendance: (filters = {}) => apiClient.get('/admin/attendance/', { params: filters }),
};

export const userAPI = {
  getAll: () => apiClient.get('/users/'),
  getById: (id) => apiClient.get(`/users/${id}/`),
  create: (data) => apiClient.post('/users/', data),
  update: (id, data) => apiClient.put(`/users/${id}/`, data),
  patch: (id, data) => apiClient.patch(`/users/${id}/`, data),
  delete: (id) => apiClient.delete(`/users/${id}/`),
};

export const workScheduleAPI = {
  getAll: () => apiClient.get('/work-schedules/'),
  getById: (id) => apiClient.get(`/work-schedules/${id}/`),
  getActive: () => apiClient.get('/work-schedules/active/'),
  create: (data) => apiClient.post('/work-schedules/', data),
  update: (id, data) => apiClient.put(`/work-schedules/${id}/`, data),
  delete: (id) => apiClient.delete(`/work-schedules/${id}/`),
};

export default apiClient;