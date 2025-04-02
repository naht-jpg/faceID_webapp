import React, { useState, useEffect } from 'react';
import {
  Box, Container, Paper, Typography, Tabs, Tab, Divider,
  AppBar, Toolbar, Button, Avatar, Tooltip, Badge,
  Menu, MenuItem, ListItemIcon, ListItemText, Fade, IconButton
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  ExitToApp as LogoutIcon,
  CameraAlt as CameraIcon,
  Notifications as NotificationIcon
} from '@mui/icons-material';
import { useAuth } from '../../AuthContext';
import { useNavigate } from 'react-router-dom';
import DashboardTab from './components/DashboardTab';
import AttendanceHistoryTab from './components/AttendanceHistoryTab';
import ProfileTab from './components/ProfileTab';
import FaceRecognition from '../FaceRecognition';

export default function EmployeePortal() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [showFaceRecognition, setShowFaceRecognition] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    // Đóng FaceRecognition khi chuyển tab
    setShowFaceRecognition(false);
  };

  const handleRecognitionResult = (result) => {
    if (result.success) {
      setRecognitionResult(result);
      // Cập nhật notification count để thông báo người dùng
      setNotificationCount(prev => prev + 1);
      // Đóng component camera sau khi thành công
      setTimeout(() => {
        setShowFaceRecognition(false);
      }, 3000);
    }
  };

  // Xử lý menu user
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Xử lý hiển thị/ẩn camera điểm danh
  const toggleFaceRecognition = () => {
    setShowFaceRecognition(!showFaceRecognition);
  };

  // Hiển thị nội dung tab
  const renderContent = () => {
    switch(activeTab) {
      case 0:
        return <DashboardTab lastAttendance={recognitionResult} />;
      case 1:
        return <AttendanceHistoryTab employeeId={currentUser?.id} />;
      case 2:
        return <ProfileTab userData={currentUser} />;
      default:
        return <DashboardTab />;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <AppBar position="sticky" elevation={2} sx={{ bgcolor: 'white', color: 'text.primary' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ 
            flexGrow: 1,
            fontWeight: 'bold',
            color: 'primary.main',
            display: 'flex', 
            alignItems: 'center' 
          }}>
            <CameraIcon sx={{ 
              mr: 1.5,
              color: 'primary.main',
              fontSize: 28
            }} />
            FaceID Attendance
          </Typography>
          
          <Tooltip title="Điểm danh ngay">
            <Button
              variant={showFaceRecognition ? "contained" : "outlined"}
              color="primary"
              onClick={toggleFaceRecognition}
              startIcon={<CameraIcon />}
              sx={{ 
                mr: 2, 
                borderRadius: 28,
                px: 2,
                py: 0.8,
                fontWeight: 'medium'
              }}
            >
              {showFaceRecognition ? "Đóng Camera" : "Điểm Danh"}
            </Button>
          </Tooltip>
          
          <Tooltip title="Thông báo">
            <IconButton sx={{ mr: 2 }}>
              <Badge badgeContent={notificationCount} color="error">
                <NotificationIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                {currentUser?.name || 'User'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {currentUser?.job_position || 'Nhân viên'}
              </Typography>
            </Box>
            
            <Avatar
              onClick={handleMenuOpen}
              sx={{ 
                cursor: 'pointer', 
                width: 40, 
                height: 40,
                bgcolor: 'primary.main',
                border: '2px solid white'
              }}
            >
              {(currentUser?.name?.charAt(0) || 'U').toUpperCase()}
            </Avatar>
            
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              PaperProps={{
                elevation: 3,
                sx: { width: 230, mt: 1.5 }
              }}
              TransitionComponent={Fade}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                  {currentUser?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {currentUser?.email}
                </Typography>
              </Box>
              <Divider />
              <MenuItem onClick={() => { setActiveTab(2); handleMenuClose(); }}>
                <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Hồ sơ cá nhân" />
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
                <ListItemText primary="Đăng xuất" primaryTypographyProps={{ color: 'error' }} />
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      
      {/* Main container */}
      <Container maxWidth="xl" sx={{ mt: 3, mb: 3, flexGrow: 1 }}>
        {/* Face Recognition component */}
        {showFaceRecognition && (
          <Paper elevation={3} sx={{ mb: 3, p: 3, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 'medium' }}>
              <CameraIcon sx={{ mr: 1, verticalAlign: 'text-bottom' }} />
              Điểm Danh Khuôn Mặt
            </Typography>
            <Divider sx={{ mb: 3 }} />
            <FaceRecognition onRecognitionResult={handleRecognitionResult} autoCapture={false} />
          </Paper>
        )}
        
        {/* Tabs */}
        <Paper sx={{ borderRadius: 2 }} elevation={2}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
            aria-label="employee portal tabs"
            sx={{
              '& .MuiTab-root': {
                py: 1.5
              }
            }}
          >
            <Tab 
              icon={<DashboardIcon />} 
              iconPosition="start" 
              label="Tổng quan"
              id="dashboard-tab"
            />
            <Tab 
              icon={<HistoryIcon />} 
              iconPosition="start" 
              label="Lịch sử điểm danh"
              id="history-tab"
            />
            <Tab 
              icon={<PersonIcon />} 
              iconPosition="start" 
              label="Hồ sơ cá nhân"
              id="profile-tab"
            />
          </Tabs>
        </Paper>
        
        {/* Tab content */}
        <Box sx={{ mt: 3, mb: 3 }}>
          {renderContent()}
        </Box>
      </Container>
      
      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 2,
          bgcolor: theme => theme.palette.mode === 'dark' ? '#121212' : '#f5f5f5',
          borderTop: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Container maxWidth="xl">
          <Typography variant="body2" color="text.secondary" align="center">
            © {new Date().getFullYear()} FaceID Attendance System - All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}