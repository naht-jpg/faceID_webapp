import React, { useState, useEffect, useCallback } from 'react';
import { authAPI, employeeAPI, attendanceAPI } from './api';
import { AuthContext } from './contexts/auth';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Hàm để làm mới dữ liệu người dùng
  const refreshUserData = useCallback(async () => {
    const accessToken = localStorage.getItem('access_token');
    
    if (!accessToken) {
      return false;
    }
    
    try {
      setLoading(true);
      
      // Lấy thông tin người dùng hiện tại
      const userResponse = await authAPI.getCurrentUser();
      
      if (userResponse.data) {
        const signinId = userResponse.data.id || userResponse.data._id;
        const employeeMongoId = userResponse.data.employee_id;
        const customEmployeeId = userResponse.data.custom_employee_id;

        if (employeeMongoId) {
          try {
            // Lấy thông tin nhân viên từ employee_id
            const employeeResponse = await employeeAPI.getById(employeeMongoId);
            
            if (employeeResponse.data) {
              // Lấy thông tin điểm danh mới nhất hoặc hôm nay
              const attendanceResponse = await attendanceAPI.getLatestOrToday(employeeMongoId);
              const attendanceData = attendanceResponse.data && 
                (attendanceResponse.data.data || 
                (attendanceResponse.data.records && attendanceResponse.data.records.length > 0 ? 
                  attendanceResponse.data.records[0] : null));
              
              // Gộp dữ liệu người dùng và nhân viên
              const mergedData = {
                ...userResponse.data,
                ...employeeResponse.data,
                signin_id: signinId,
                _id: employeeMongoId,
                id: employeeMongoId,
                role: userResponse.data.role || 'employee',
                custom_employee_id: employeeResponse.data.employee_id || customEmployeeId,
                lastAttendance: attendanceData || null
              };
              
              setCurrentUser(mergedData);
              setIsAdmin(userResponse.data.role === 'admin');
              return true;
            }
          } catch (err) {
            console.error("Error fetching employee data:", err);
            // Sử dụng dữ liệu user cơ bản
            setCurrentUser({
              ...userResponse.data,
              custom_employee_id: customEmployeeId 
            });
            setIsAdmin(userResponse.data.role === 'admin');
            return true;
          }
        }
        
        // Fallback nếu không lấy được dữ liệu employee
        setCurrentUser({
          ...userResponse.data,
          custom_employee_id: customEmployeeId 
        });
        setIsAdmin(userResponse.data.role === 'admin');
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error refreshing user data:", error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Kiểm tra và xác thực người dùng khi mới vào ứng dụng
  useEffect(() => {
    const checkAuth = async () => {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (accessToken) {
        try {
          // Sử dụng refreshUserData để lấy thông tin người dùng
          await refreshUserData();
        } catch (error) {
          // Nếu token hết hạn, thử refresh
          if (error.response?.status === 401 && refreshToken) {
            try {
              const refreshResponse = await authAPI.refreshToken(refreshToken);
              localStorage.setItem('access_token', refreshResponse.data.access);
              
              // Thử lại với token mới
              await refreshUserData();
            } catch (refreshError) {
              // Refresh thất bại, xóa auth
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
              setCurrentUser(null);
              setIsAdmin(false);
            }
          } else {
            // Lỗi khác, xóa auth
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            setCurrentUser(null);
            setIsAdmin(false);
          }
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, [refreshUserData]);

  // Cải thiện hàm login để tải đầy đủ dữ liệu ngay sau khi đăng nhập
  const login = async (userData) => {
    setCurrentUser(userData);
    setIsAdmin(userData.role === 'admin');
    
    // Đánh dấu thời điểm đăng nhập
    localStorage.setItem('login_timestamp', Date.now().toString());
    
    // Reset các biến đếm lỗi khi đăng nhập mới
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('failed_fetch_')) {
        localStorage.removeItem(key);
      }
    });
    
    // Thêm dòng này để đảm bảo tải đầy đủ dữ liệu ngay sau khi đăng nhập
    try {
      console.log("Starting comprehensive data refresh after login");
      await refreshUserData();
      console.log("Data refresh completed after login");
      return true;
    } catch (error) {
      console.error("Error refreshing data after login:", error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setCurrentUser(null);
    setIsAdmin(false);
  };

  const value = {
    currentUser,
    isAdmin,
    login,
    logout,
    refreshUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}