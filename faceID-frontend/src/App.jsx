import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { useAuth } from './hooks/useAuth';
import SignIn from './components/sign-in/SignIn';
import Dashboard from './components/Dashboard/Dashboard';
import EmployeePortal from './components/employee-portal/EmployeePortal';

// Protected Route component
function ProtectedRoute({ children, requireAdmin = false }) {
  const { currentUser, isAdmin } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/employee-portal" replace />;
  }
  
  return children;
}

function AppRoutes() {
  const { currentUser, isAdmin } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={
        currentUser ? (
          <Navigate to={isAdmin ? "/dashboard" : "/employee-portal"} replace />
        ) : (
          <SignIn />
        )
      } />
      
      <Route path="/forgot-password" element={<div>Trang quên mật khẩu</div>} />
      
      <Route path="/" element={
        <Navigate to={
          currentUser 
            ? (isAdmin ? "/dashboard" : "/employee-portal") 
            : "/login"
        } replace />
      } />
      
      <Route path="/dashboard" element={
        <ProtectedRoute requireAdmin={true}>
          <Dashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/employee-portal" element={
        <ProtectedRoute requireAdmin={false}>
          <EmployeePortal />
        </ProtectedRoute>
      } />
      
      <Route path="*" element={<Navigate to="/" replace />} />
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
