import axios from 'axios';

// Sử dụng biến môi trường thay vì hard-code
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export const getEmployees = async () => {
    const response = await axios.get(`${API_URL}/employees/`);
    return response.data;
};


// Gửi ảnh để nhận diện khuôn mặt
export const recognizeFace = async (base64Image) => {
    try {
      const response = await axios.post(`${API_URL}/recognize-face/`, {
        image: base64Image
      });
      return response.data;
    } catch (error) {
      console.error('Error recognizing face:', error);
      throw error;
    }
  };
  
  // Ghi lại thời gian điểm danh
  export const recordAttendance = async (employeeId) => {
    try {
      const response = await axios.post(`${API_URL}/attendance/`, {
        employee_id: employeeId
      });
      return response.data;
    } catch (error) {
      console.error('Error recording attendance:', error);
      throw error;
    }
  };
  
  // Lấy lịch sử điểm danh của nhân viên
  export const getAttendanceHistory = async (employeeId) => {
    try {
      const response = await axios.get(`${API_URL}/attendance/${employeeId}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      throw error;
    }
  };