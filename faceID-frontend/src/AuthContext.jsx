import React, { createContext, useState, useEffect, useCallback } from 'react';
import { authAPI, employeeAPI,attendanceAPI } from './api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Function to refresh user data - tối ưu hóa
  const refreshUserData = useCallback(async () => {
    const accessToken = localStorage.getItem('access_token');
    
    if (!accessToken) {
      return false;
    }
    
    try {
      setLoading(true);
      
      // Get basic user data
      const userResponse = await authAPI.getCurrentUser();
      
      if (userResponse.data) {
        const signinId = userResponse.data.id || userResponse.data._id;
        const employeeMongoId = userResponse.data.employee_id;

        // If employee_id exists in user data
        if (employeeMongoId) {
          try {
            // Get full employee data
            const employeeResponse = await employeeAPI.getById(employeeMongoId);
            
            if (employeeResponse.data) {
              // Also fetch attendance data
              const attendanceResponse = await attendanceAPI.getLatestOrToday(employeeMongoId);
              const attendanceData = attendanceResponse.data && 
                (attendanceResponse.data.data || 
                (attendanceResponse.data.records && attendanceResponse.data.records.length > 0 ? 
                  attendanceResponse.data.records[0] : null));
              
              // Merge all data
              const mergedData = {
                ...userResponse.data,
                ...employeeResponse.data,
                signin_id: signinId,
                _id: employeeMongoId,
                id: employeeMongoId,
                role: userResponse.data.role || 'employee',
                lastAttendance: attendanceData || null
              };
              
              setCurrentUser(mergedData);
              setIsAdmin(userResponse.data.role === 'admin');
              return true;
            }
          } catch (err) {
            console.error("Error fetching employee data:", err);
            // Try alternative methods if needed
            // Thử một cách khác nếu API getById thất bại
            try {
              // Dùng API tùy chọn để lấy theo custom employee_id
              const customIdResponse = await employeeAPI.getByCustomId(employeeMongoId);
              if (customIdResponse.data) {
                const mergedData = {
                  ...userResponse.data,
                  ...customIdResponse.data,
                  signin_id: signinId,
                  _id: customIdResponse.data._id,
                  id: customIdResponse.data._id
                };
                
                setCurrentUser(mergedData);
                setIsAdmin(userResponse.data.role === 'admin');
                return true;
              }
            } catch (altErr) {
              console.error("Cả hai phương thức đều thất bại:", altErr);
            }
          }
        }
        
        // Fallback nếu không lấy được dữ liệu employee
        setCurrentUser(userResponse.data);
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

  // Check if user is authenticated on app load
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

  const login = async (userData) => {
    setCurrentUser(userData);
    setIsAdmin(userData.role === 'admin');
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