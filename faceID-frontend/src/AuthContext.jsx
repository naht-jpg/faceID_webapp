import React, { createContext, useState, useContext, useEffect } from 'react';

// Tạo context
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Kiểm tra nếu người dùng đã đăng nhập
    const userInfo = localStorage.getItem('userInfo');
    
    if (userInfo) {
      setCurrentUser(JSON.parse(userInfo));
    }
    setLoading(false);
  }, []);

  // Đăng nhập
  const login = async (email, password) => {
    try {
      // Demo: phân biệt admin/employee, thực tế sẽ gọi API
      if (email === 'admin@example.com' && password === 'admin123') {
        const user = { name: 'Admin User', role: 'admin', email };
        localStorage.setItem('userInfo', JSON.stringify(user));
        setCurrentUser(user);
        return user;
      } else if (email === 'user@example.com' && password === 'user123') {
        const user = { name: 'Employee User', role: 'employee', email };
        localStorage.setItem('userInfo', JSON.stringify(user));
        setCurrentUser(user);
        return user;
      }
      throw new Error('Invalid credentials');
    } catch (error) {
      throw error;
    }
  };

  // Đăng xuất
  const logout = () => {
    localStorage.removeItem('userInfo');
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    isAdmin: currentUser?.role === 'admin',
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);