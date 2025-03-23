import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (accessToken) {
        try {
          // Try to get user info with current token
          const userResponse = await axios.get(`${API_URL}/user/`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          
          setCurrentUser(userResponse.data);
          setIsAdmin(userResponse.data.role === 'admin');
        } catch (error) {
          // If token expired, try refresh
          if (error.response?.status === 401 && refreshToken) {
            try {
              const refreshResponse = await axios.post(
                `${API_URL}/token/refresh/`, 
                { refresh: refreshToken }
              );
              
              localStorage.setItem('access_token', refreshResponse.data.access);
              
              // Try again with new token
              const userResponse = await axios.get(`${API_URL}/user/`, {
                headers: { Authorization: `Bearer ${refreshResponse.data.access}` }
              });
              
              setCurrentUser(userResponse.data);
              setIsAdmin(userResponse.data.role === 'admin');
            } catch (refreshError) {
              // Refresh failed, clear auth
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
              setCurrentUser(null);
              setIsAdmin(false);
            }
          } else {
            // Other error, clear auth
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            setCurrentUser(null);
            setIsAdmin(false);
          }
        }
      }
      
      setLoading(false);
    };
    
    checkAuth();
  }, []);

  // Login function now accepts user data directly
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
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}