import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Paper, Typography, Tabs, Tab, Divider,
  AppBar, Toolbar, Button, Avatar, Tooltip, Badge,
  Menu, MenuItem, ListItemIcon, ListItemText, Fade, IconButton,
  Snackbar, Alert, CircularProgress
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  ExitToApp as LogoutIcon,
  CameraAlt as CameraIcon,
  Notifications as NotificationIcon,
  Badge as BadgeIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  ExitToApp as ExitToAppIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import DashboardTab from './components/DashboardTab';
import AttendanceHistoryTab from './components/AttendanceHistoryTab';
import ProfileTab from './components/ProfileTab';
import AttendanceTab from './components/AttendanceTab';
import { employeeAPI, attendanceAPI } from '../../api';  // Sửa import để sử dụng named export

export default function EmployeePortal() {
  const { currentUser, logout, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [showAttendance, setShowAttendance] = useState(false);
  const [lastAttendance, setLastAttendance] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [completeUserData, setCompleteUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasCheckedOut, setHasCheckedOut] = useState(false);
  const [isCheckOut, setIsCheckOut] = useState(false);

  // IMPORTANT: Move this declaration up, before any useEffect that uses it
  const userData = completeUserData || currentUser;

  // Khi component mount, kiểm tra thông tin điểm danh gần nhất
  useEffect(() => {
    const savedAttendance = localStorage.getItem('last_attendance');
    if (savedAttendance && savedAttendance !== 'undefined') {
      try {
        const parsedAttendance = JSON.parse(savedAttendance);
        // Kiểm tra xem điểm danh có phải của hôm nay không
        const attendanceDate = new Date(parsedAttendance.datetime);
        const today = new Date();
        if (attendanceDate.toDateString() === today.toDateString()) {
          setLastAttendance(parsedAttendance);

          // Kiểm tra nếu đã check-out
          if (parsedAttendance.check_out_time || parsedAttendance.is_check_out) {
            setHasCheckedOut(true);
          }
        }
      } catch (err) {
        console.error("Error parsing saved attendance:", err);
        localStorage.removeItem('last_attendance');
      }
    }
  }, []);

  // Tách fetchEmployeeData ra khỏi useEffect để có thể gọi lại khi cần
  const fetchEmployeeData = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
  
    setLoading(true);
    console.log("Current user data:", currentUser);
    
    try {
      // Lấy ID MongoDB từ employee_id hoặc _id
      const employeeMongoId = currentUser.employee_id || currentUser._id;
      
      if (employeeMongoId) {
        console.log("Fetching employee data with ID:", employeeMongoId);
        
        try {
          const employeeResponse = await employeeAPI.getById(employeeMongoId);
          
          if (employeeResponse.data) {
            console.log("Successfully fetched employee data:", employeeResponse.data);
            
            // Lấy attendance data
            const attendanceResponse = await attendanceAPI.getLatestOrToday(employeeMongoId);
            const attendanceData = attendanceResponse.data && 
              (attendanceResponse.data.data || 
              (attendanceResponse.data.records && attendanceResponse.data.records.length > 0 ? 
                attendanceResponse.data.records[0] : null));
            
            // Kết hợp dữ liệu, đảm bảo lưu giữ custom_employee_id
            const completeData = {
              ...currentUser,
              ...employeeResponse.data,
              signin_id: currentUser.id || currentUser._id,
              _id: employeeMongoId,
              id: employeeMongoId,
              // Lưu trữ custom employee ID từ employeeResponse.data.employee_id
              custom_employee_id: employeeResponse.data.employee_id || currentUser.custom_employee_id,
              lastAttendance: attendanceData || null
            };
            
            setCompleteUserData(completeData);
            
            // Update last attendance nếu có
            if (attendanceData) {
              const today = new Date();
              const attendanceDate = new Date(attendanceData.datetime);
              
              if (attendanceDate.toDateString() === today.toDateString()) {
                setLastAttendance(attendanceData);
              }
            }
            
            return;
          }
        } catch (error) {
          console.error("Không thể lấy dữ liệu nhân viên:", error.message || error);
          
          // Thử phương thức thay thế - getByCustomId
          if (currentUser.employee_id && typeof employeeAPI.getByCustomId === 'function') {
            try {
              console.log("Trying alternative method - fetching by custom ID");
              const altResponse = await employeeAPI.getByCustomId(currentUser.employee_id);
              
              if (altResponse.data) {
                console.log("Successfully fetched by custom ID:", altResponse.data);
                setCompleteUserData({
                  ...currentUser,
                  ...altResponse.data,
                  signin_id: currentUser.id || currentUser._id
                });
                return;
              }
            } catch (altError) {
              console.error("Alternative method also failed:", altError);
            }
          }
        }
      } else {
        console.warn("No employee_id found in current user data");
      }
      
      // Fallback với custom_employee_id nếu có
      setCompleteUserData({
        ...currentUser,
        custom_employee_id: currentUser.custom_employee_id
      });
    } catch (error) {
      console.error("Lỗi trong quá trình lấy dữ liệu:", error.message || error);
      setCompleteUserData(currentUser);
    } finally {
      setLoading(false);
    }

    // Sau khi lấy dữ liệu từ API currentUser
    if (currentUser && !currentUser.employee_id) {
      // Sử dụng ID cố định nếu biết chính xác ID employee
      const knownEmployeeId = "67f565efaa5e06c258464fa8"; // ID employee thật của bạn
      
      // Thử fetching với ID này
      try {
        const employeeResponse = await employeeAPI.getById(knownEmployeeId);
        if (employeeResponse.data) {
          // Cập nhật dữ liệu với ID đúng
          setCompleteUserData({
            ...currentUser,
            ...employeeResponse.data,
            employee_id: knownEmployeeId,
            _id: knownEmployeeId,
            id: knownEmployeeId
          });
        }
      } catch (error) {
        console.error("Không thể lấy dữ liệu nhân viên:", error);
      }
    }
  }, [currentUser]);
  
  // Sử dụng trong useEffect
  useEffect(() => {
    fetchEmployeeData();
  }, [fetchEmployeeData]);

  // Cập nhật việc kiểm tra điểm danh ra về
  useEffect(() => {
    const checkAttendanceStatus = async () => {
      if (!userData?.id) return;
      
      try {
        // Lấy dữ liệu điểm danh của ngày hôm nay
        const response = await attendanceAPI.getToday(userData.id);
        
        if (response.data && response.data.success) {
          // Nếu có dữ liệu điểm danh hôm nay
          if (response.data.records && response.data.records.length > 0) {
            // Lấy bản ghi mới nhất
            const latestRecord = response.data.records[0];
            setLastAttendance(latestRecord);
            
            // Kiểm tra xem có check-out chưa
            if (latestRecord.check_out_time || 
                latestRecord.is_check_out_record || 
                latestRecord.is_check_out) {
              setHasCheckedOut(true);
            } else {
              setHasCheckedOut(false);
            }
          } else {
            // Không có dữ liệu điểm danh cho hôm nay, reset lại trạng thái
            setLastAttendance(null);
            setHasCheckedOut(false);
            localStorage.removeItem('last_attendance');
          }
        }
      } catch (error) {
        console.error("Error checking attendance status:", error);
        // Trong trường hợp lỗi, cũng reset lại trạng thái để người dùng có thể điểm danh
        setLastAttendance(null);
        setHasCheckedOut(false);
        localStorage.removeItem('last_attendance');
      }
    };
    
    checkAttendanceStatus();
  }, [userData?.id]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setShowAttendance(false);
  };

  const handleAttendanceSuccess = async (attendance, isCheckOut = false) => {
    if (isCheckOut) {
      setHasCheckedOut(true);
      setSnackbarMessage(`Điểm danh ra về thành công lúc ${new Date().toLocaleTimeString('vi-VN')}`);
      
      // Fetch lại dữ liệu điểm danh mới nhất thay vì chỉ dựa vào dữ liệu cục bộ
      try {
        const employeeId = userData.id || userData._id;
        const response = await attendanceAPI.getToday(employeeId);
        if (response.data.success && response.data.records?.length > 0) {
          setLastAttendance(response.data.records[0]);
        }
      } catch (error) {
        console.error("Không thể cập nhật dữ liệu điểm danh:", error);
      }
    } else {
      setLastAttendance(attendance);
      setSnackbarMessage(`Điểm danh vào làm thành công lúc ${new Date(attendance.datetime).toLocaleTimeString('vi-VN')}`);
    }
    
    // Cập nhật lại toàn bộ dữ liệu
    await fetchEmployeeData();
    
    setSnackbarSeverity('success');
    setOpenSnackbar(true);
    setNotificationCount(prev => prev + 1);
    
    setTimeout(() => {
      setShowAttendance(false);
    }, 2000);
  };

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

  const toggleAttendance = (isCheckOut = false) => {
    setIsCheckOut(isCheckOut);
    setShowAttendance(!showAttendance);
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSnackbar(false);
  };

  // Thêm hàm xử lý cập nhật profile
  const handleProfileUpdate = async () => {
    // Fetch lại dữ liệu nhân viên đầy đủ
    await fetchEmployeeData();
    setSnackbarMessage("Dữ liệu hồ sơ đã được cập nhật");
    setSnackbarSeverity("success");
    setOpenSnackbar(true);
  };

  // Thêm hàm refreshAll
  const refreshAll = async () => {
    try {
      setLoading(true);
      
      await refreshUserData();
      
      await fetchEmployeeData();
      
      setSnackbarMessage("Dữ liệu đã được làm mới");
      setSnackbarSeverity("success");
      setOpenSnackbar(true);
    } catch (error) {
      setSnackbarMessage("Không thể làm mới dữ liệu");
      setSnackbarSeverity("error");
      setOpenSnackbar(true);
    } finally {
      setLoading(false);
    }
  };

  // Hiển thị nội dung tab sử dụng dữ liệu đầy đủ
  const renderContent = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <CircularProgress />
        </Box>
      );
    }
    
    switch(activeTab) {
      case 0:
        return <DashboardTab 
          lastAttendance={lastAttendance} 
          onAttendanceRequest={() => setShowAttendance(true)}
          userData={userData}
        />;
      case 1:
        return <AttendanceHistoryTab employeeId={userData?.id || userData?._id} />;
      case 2:
        return <ProfileTab userData={userData} onProfileUpdate={handleProfileUpdate} />;
      default:
        return <DashboardTab 
          lastAttendance={lastAttendance} 
          onAttendanceRequest={() => setShowAttendance(true)}
          userData={userData}
        />;
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
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title={lastAttendance ? "Bạn đã điểm danh hôm nay" : "Điểm danh vào"}>
              <span> {/* Wrapper span để Tooltip hoạt động với disabled Button */}
                <Button
                  variant={showAttendance && !isCheckOut ? "contained" : "outlined"}
                  color="primary"
                  onClick={() => toggleAttendance(false)}
                  startIcon={<CameraIcon />}
                  disabled={lastAttendance !== null && !showAttendance}
                  sx={{ 
                    borderRadius: 28,
                    px: 2,
                    py: 0.8,
                    fontWeight: 'medium'
                  }}
                >
                  {lastAttendance ? "Đã điểm danh" : (showAttendance && !isCheckOut ? "Đóng Camera" : "Điểm Danh")}
                </Button>
              </span>
            </Tooltip>
            
            {/* Chỉ hiển thị nút điểm danh ra về khi đã điểm danh vào và chưa điểm danh ra */}
            {lastAttendance && !hasCheckedOut && (
              <Tooltip title="Điểm danh ra về">
                <Button
                  variant={showAttendance && isCheckOut ? "contained" : "outlined"}
                  color="secondary"
                  onClick={() => toggleAttendance(true)}
                  startIcon={<ExitToAppIcon />}
                  sx={{ 
                    borderRadius: 28,
                    px: 2,
                    py: 0.8,
                    fontWeight: 'medium'
                  }}
                >
                  {showAttendance && isCheckOut ? "Đóng Camera" : "Điểm Danh Ra"}
                </Button>
              </Tooltip>
            )}
            
            {/* Hiển thị thông báo đã điểm danh ra về khi cả hai đều hoàn tất */}
            {hasCheckedOut && (
              <Tooltip title="Đã điểm danh đầy đủ">
                <Button
                  variant="outlined"
                  color="success"
                  disabled
                  startIcon={<CheckCircleIcon />}
                  sx={{ 
                    borderRadius: 28,
                    px: 2,
                    py: 0.8,
                    fontWeight: 'medium'
                  }}
                >
                  Đã Điểm Danh Đủ
                </Button>
              </Tooltip>
            )}
          </Box>
          
          <Tooltip title="Thông báo">
            <IconButton sx={{ mr: 2 }}>
              <Badge badgeContent={notificationCount} color="error">
                <NotificationIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Làm mới dữ liệu">
            <IconButton 
              onClick={refreshAll} 
              disabled={loading}
              sx={{ mr: 1 }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* Hiển thị thông tin người dùng sử dụng dữ liệu đầy đủ */}
            <Box sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                {userData?.name || 'User'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                <BadgeIcon fontSize="small" sx={{ mr: 0.5, fontSize: 12 }} />
                {userData?.custom_employee_id || userData?.employee_id || 'Chưa có mã NV'}
                {userData?.department && (
                  <>
                    <Box component="span" sx={{ mx: 0.5 }}>•</Box>
                    {userData.department}
                  </>
                )}
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
              {(userData?.name?.charAt(0) || 'U').toUpperCase()}
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
                  {userData?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {userData?.custom_employee_id || userData?.employee_id ? (
                    <>
                      <BadgeIcon fontSize="small" sx={{ mr: 0.5, fontSize: 12, verticalAlign: 'middle' }} />
                      {userData.custom_employee_id || userData.employee_id}
                    </>
                  ) : null}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {userData?.department && (
                    <>
                      <BusinessIcon fontSize="small" sx={{ mr: 0.5, fontSize: 12, verticalAlign: 'middle' }} />
                      {userData.department}
                    </>
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {userData?.email}
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
        {/* Attendance component */}
        {showAttendance && (
          <Paper elevation={3} sx={{ mb: 3, p: 3, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 'medium' }}>
              <CameraIcon sx={{ mr: 1, verticalAlign: 'text-bottom' }} />
              {isCheckOut ? "Điểm Danh Ra Về" : "Điểm Danh Vào Làm"}
            </Typography>
            <Divider sx={{ mb: 3 }} />
            <AttendanceTab 
              onAttendanceSuccess={handleAttendanceSuccess} 
              isCheckOut={isCheckOut}
            />
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
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
              <CircularProgress />
            </Box>
          ) : !userData ? (
            <Alert 
              severity="error" 
              sx={{ mt: 3, mb: 3 }}
              action={
                <Button color="inherit" size="small" onClick={fetchEmployeeData}>
                  Thử lại
                </Button>
              }
            >
              Không thể tải dữ liệu nhân viên. Vui lòng kiểm tra kết nối mạng hoặc liên hệ quản trị viên.
            </Alert>
          ) : (
            renderContent()
          )}
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

      {/* Snackbar for notifications */}
      <Snackbar
        open={openSnackbar}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbarSeverity} 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}