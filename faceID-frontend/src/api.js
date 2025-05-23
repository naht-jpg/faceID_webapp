import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://awaited-easy-marten.ngrok-free.app/api';
console.log('Connecting to API at:', API_URL);

// Tạo axios instance với baseURL
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // Timeout 15 giây
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
      } catch (error) {
        console.error("Token refresh error:", error.message);

        // Underscore indicates an intentionally unused parameter
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    
    // Xử lý lỗi 500 từ server
    if (error.response?.status === 500) {
      console.error("Server error:", error.response.data);
      return Promise.reject({
        isServerError: true,
        message: error.response.data.message || 'Lỗi máy chủ nội bộ',
        originalError: error
      });
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
    username: credentials.username,
    password: credentials.password
  }),
  register: (userData) => apiClient.post('/auth/register/', userData),
  refreshToken: (refreshToken) => apiClient.post('/auth/token/refresh/', { refresh: refreshToken }),
  getCurrentUser: () => apiClient.get('/auth/me/'),
  changePassword: (data) => apiClient.post('/auth/change-password/', data),
};

// Employee API
export const employeeAPI = {
  getAll: () => apiClient.get('/employees/'),
  getById: (id) => apiClient.get(`/employees/${id}/`),
  getByCustomId: (customId) => apiClient.get(`/employees/custom-id/${customId}/`),
  create: (data) => apiClient.post('/employees/', data),
  update: (id, data) => apiClient.put(`/employees/${id}/`, data),
  delete: (id) => apiClient.delete(`/employees/${id}/`),
};

// Face API
export const faceAPI = {
  register: (employee_id, name, imageData) => apiClient.post('/faces/register/', {
    employee_id,
    name,
    image: imageData
  }, {
    headers: {
      'Content-Type': 'application/json'
    }
  }),
  
  // Cập nhật phương thức recognize để bao gồm thông tin về employee_id
  recognize: (imageData) => apiClient.post('/faces/recognize/', {
    image: imageData,
    save_attendance: true  // Thêm flag để backend biết cần lưu vào attendance
  }, {
    headers: {
      'Content-Type': 'application/json'
    }
  }),
  
  testRecognize: (employeeId) => apiClient.post('/faces/test-recognize/', {
    employee_id: employeeId
  }, {
    headers: {
      'Content-Type': 'application/json'
    }
  }),
  
  testRecognizeWithImage: (data) => apiClient.post('/faces/test-recognize-with-image/', {
    employee_id: data.employee_id,
    image: data.image,
    save_test_result: true // Tùy chọn lưu kết quả test vào testdata
  }, {
    headers: {
      'Content-Type': 'application/json'
    }
  }),
  
  getAttendanceHistory: (employeeId) => apiClient.get(`/attendance/${employeeId}/`, {
    params: { today: true }
  }),
  
  checkTrainerData: () => apiClient.get('/trainer/check/'),
  checkTrainerDataById: (employeeId) => apiClient.get(`/trainer/check/${employeeId}/`),
};

// Attendance API
export const attendanceAPI = {
  getByEmployeeId: (id, params) => apiClient.get(`/attendance/${id}/`, { params }),
  
  // Cập nhật để gửi thông tin múi giờ rõ ràng hơn
  create: (id, data, isCheckOut = false) => {
    // Mốc thời gian UTC để đảm bảo backend hiểu đúng
    const now = new Date();
    const localTime = new Date();
    
    const formattedData = {
      ...data,
      datetime: now.toISOString(),  // UTC time in ISO format
      timezone_offset: now.getTimezoneOffset(), // Negative for timezones ahead of UTC
      timezone_name: Intl.DateTimeFormat().resolvedOptions().timeZone,
      local_time: localTime.toString(), // Thêm thông tin giờ địa phương để debug
      is_check_out: isCheckOut
    };
    
    return apiClient.post(`/attendance/${id}/`, formattedData);
  },
  
  getLatest: (id) => apiClient.get(`/attendance/${id}/`, { params: { latest: true }}),
  getToday: (id) => apiClient.get(`/attendance/${id}/`, { params: { today: true }}),
  getLatestOrToday: (id) => apiClient.get(`/attendance/${id}/`, { 
    params: { latest_or_today: true }
  }),
  // Add this new function:
  getMonthlySummary: (employeeId, year, month) => apiClient.get(`/employees/${employeeId}/attendance/summary`, {
    params: { year, month }
  }),
  // If you need admin-specific attendance functions:
  getAdminAttendance: (filters = {}) => apiClient.get('/admin/attendance/', { params: filters })
};

// User API (tài khoản người dùng)
export const userAPI = {
  getAll: () => apiClient.get('/users/'), // Đổi từ /signin/ sang /users/
  getById: (id) => apiClient.get(`/users/${id}/`),
  create: (data) => apiClient.post('/users/', data),
  update: (id, data) => apiClient.put(`/users/${id}/`, data),
  patch: (id, data) => apiClient.patch(`/users/${id}/`, data),
  delete: (id) => apiClient.delete(`/users/${id}/`),
};

// Work Schedule API
export const workScheduleAPI = {
  getAll: () => apiClient.get('/work-schedules/'),
  getById: (id) => apiClient.get(`/work-schedules/${id}/`),
  getActive: () => apiClient.get('/work-schedules/active/'),
  create: (data) => apiClient.post('/work-schedules/', data),
  update: (id, data) => apiClient.put(`/work-schedules/${id}/`, data),
  delete: (id) => apiClient.delete(`/work-schedules/${id}/`),
};

export default apiClient;