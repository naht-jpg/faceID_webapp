import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Dashboard from "./components/Dashboard/Dashboard";
import EmployeePortal from "./components/employee-portal/EmployeePortal";
import SignIn from "./components/sign-in/SignIn";

// Bảo vệ route, kiểm tra người dùng đã đăng nhập chưa và có đúng quyền không
const ProtectedRoute = ({ children, requireAdmin }) => {
  const { currentUser, isAdmin } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/portal" replace />;
  }
  
  return children;
};

function AppRoutes() {
  const auth = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={
        auth.currentUser ? 
          <Navigate to={auth.isAdmin ? "/admin" : "/portal"} replace /> : 
          <SignIn />
      } />
      
      <Route path="/" element={
        <Navigate to={auth.currentUser ? (auth.isAdmin ? "/admin" : "/portal") : "/login"} replace />
      } />
      
      <Route path="/admin" element={
        <ProtectedRoute requireAdmin={true}>
          <Dashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/portal" element={
        <ProtectedRoute requireAdmin={false}>
          <EmployeePortal />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
