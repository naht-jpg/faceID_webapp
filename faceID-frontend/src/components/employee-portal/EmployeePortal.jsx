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
import { useInterval } from '../../hooks/useInterval';
import { useNavigate } from 'react-router-dom';
import DashboardTab from './components/DashboardTab';
import AttendanceHistoryTab from './components/AttendanceHistoryTab';
import ProfileTab from './components/ProfileTab';
import AttendanceTab from './components/AttendanceTab';
import { employeeAPI, attendanceAPI ,} from '../../api';

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
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [justLoggedIn, setJustLoggedIn] = useState(true);
  const [error, setError] = useState(null);

  const userData = completeUserData || currentUser;

  const tryLocalStorageForAttendance = useCallback(() => {
    const savedAttendance = localStorage.getItem('last_attendance');
    if (savedAttendance && savedAttendance !== 'undefined') {
      try {
        const parsedAttendance = JSON.parse(savedAttendance);
        
        const attendanceDate = new Date(parsedAttendance.datetime);
        const today = new Date();
        
        if (attendanceDate.toDateString() === today.toDateString()) {
          console.log("💾 Using cached attendance data from localStorage:", parsedAttendance);
          
          const hasCheckOutTime = !!parsedAttendance.check_out_time;
          const isCheckOutRecord = parsedAttendance.is_check_out_record === true;
          const isCheckOut = parsedAttendance.is_check_out === true;
          
          const finalCheckoutStatus = hasCheckOutTime || isCheckOutRecord || isCheckOut;
          
          setLastAttendance(parsedAttendance);
          setHasCheckedOut(finalCheckoutStatus);
          return true;
        } else {
          // Điểm danh không phải của hôm nay - xóa dữ liệu
          console.log("🗑️ Cached attendance is not from today - clearing");
          localStorage.removeItem('last_attendance');
          setLastAttendance(null);
          setHasCheckedOut(false);
        }
      } catch (err) {
        console.error("❌ Error parsing saved attendance:", err);
        localStorage.removeItem('last_attendance');
      }
    }
    return false;
  }, []);

  // Kiểm tra xem có dữ liệu điểm danh nào trong localStorage không
  useEffect(() => {
    console.log("🏁 Initial application load, checking localStorage for attendance data");
    
    const savedAttendance = localStorage.getItem('last_attendance');
    if (savedAttendance && savedAttendance !== 'undefined') {
      try {
        const parsedAttendance = JSON.parse(savedAttendance);
        
        // Xác minh định dạng dữ liệu
        if (!parsedAttendance || !parsedAttendance.datetime) {
          console.error("❌ Invalid attendance data format in localStorage");
          localStorage.removeItem('last_attendance');
          return;
        }
        
        // Kiểm tra xem điểm danh có phải của hôm nay không
        const attendanceDate = new Date(parsedAttendance.datetime);
        const today = new Date();
        
        console.log("🗓️ Checking if attendance is from today:", {
          attendance_date: attendanceDate.toISOString(),
          today_date: today.toISOString(),
          attendance_day: attendanceDate.toDateString(),
          today_day: today.toDateString()
        });
        
        if (attendanceDate.toDateString() === today.toDateString()) {
          console.log("💾 Initial load: Found today's attendance in localStorage:", parsedAttendance);
          
          const hasCheckOutTime = !!parsedAttendance.check_out_time;
          const isCheckOutRecord = parsedAttendance.is_check_out_record === true;
          const isCheckOut = parsedAttendance.is_check_out === true;
          
          const finalCheckoutStatus = hasCheckOutTime || isCheckOutRecord || isCheckOut;
          
          console.log("💾 Initial checkout status calculation:", {
            has_checkout_time: hasCheckOutTime,
            is_check_out_record: isCheckOutRecord,
            is_check_out: isCheckOut,
            final_status: finalCheckoutStatus
          });
          
          setLastAttendance(parsedAttendance);
          setHasCheckedOut(finalCheckoutStatus);
        } else {
          console.log("🗑️ Found outdated attendance in localStorage - clearing");
          localStorage.removeItem('last_attendance');
        }
      } catch (err) {
        console.error("❌ Error parsing saved attendance:", err);
        localStorage.removeItem('last_attendance');
      }
    } else {
      console.log("💾 No saved attendance found in localStorage");
    }
  }, []);

  // useEffect để kiểm tra xem người dùng có vừa đăng nhập không
  useEffect(() => {
    const checkIfJustLoggedIn = () => {
      const loginTimestamp = localStorage.getItem('login_timestamp');
      if (loginTimestamp) {
        const loginTime = parseInt(loginTimestamp, 10);
        const currentTime = Date.now();
        const timeDiff = currentTime - loginTime;
        
        // Nếu đăng nhập trong vòng 5 giây gần đây
        if (timeDiff < 5000) {
          console.log("User just logged in - triggering full data refresh");
          setJustLoggedIn(true);
          refreshAll();
        } else {
          setJustLoggedIn(false);
        }
      }
    };
    
    checkIfJustLoggedIn();
  }, []);

  // Lấy dữ liệu nhân viên đầy đủ
  const fetchEmployeeData = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return null;
    }
    console.log("👤 Fetching employee data for (currentUser):", JSON.stringify(currentUser, null, 2));

    try {
      // Sử dụng currentUser.id (hoặc currentUser._id) đã được AuthContext thiết lập là MongoDB ObjectId
      const idForApiCall = currentUser.id || currentUser._id || currentUser.employee_id; 

      console.log("🆔 Using ID for API call:", idForApiCall);

      if (!idForApiCall || typeof idForApiCall !== 'string' || idForApiCall.length < 20) { 
        console.warn("⚠️ Invalid or missing MongoDB ObjectId in currentUser for API call:", idForApiCall, "currentUser was:", currentUser);
        setCompleteUserData(currentUser);
        if (!currentUser || (!currentUser.id && !currentUser._id)) {
            setError("Không thể xác định ID nhân viên hợp lệ để tải dữ liệu chi tiết.");
        }
        return currentUser;
      }

      const failedAttemptsKey = `failed_fetch_${idForApiCall}`;
      const failedAttempts = localStorage.getItem(failedAttemptsKey) || 0;
      
      // Reset lại số lần thất bại nếu đăng nhập lại
      if (justLoggedIn) {
        localStorage.removeItem(failedAttemptsKey);
      } else if (parseInt(failedAttempts) >= 3) {
        console.warn(`⚠️ Skipping fetch for ID ${idForApiCall} after 3 failed attempts`);
        setCompleteUserData(currentUser);
        return currentUser;
      }
      
      try {
        // Thêm timestamp vào URL để tránh cache
        const timestamp = new Date().getTime();
        const employeeResponse = await employeeAPI.getById(`${idForApiCall}?t=${timestamp}`);
        
        if (employeeResponse && employeeResponse.data) {
          console.log("✅ Successfully fetched employee data:", employeeResponse.data);
          // Xóa số lần thất bại khi thành công
          localStorage.removeItem(failedAttemptsKey);
          
          // Lưu custom employee_id
          const customEmployeeId = employeeResponse.data.employee_id || currentUser.custom_employee_id;
          
          // Tạo dữ liệu người dùng hoàn chỉnh
          const completeData = {
            ...currentUser,
            ...employeeResponse.data,
            signin_id: currentUser.id || currentUser._id,
            _id: idForApiCall,
            id: idForApiCall,
            custom_employee_id: customEmployeeId
          };
          
          // Cập nhật state với dữ liệu người dùng hoàn chỉnh
          setCompleteUserData(completeData);
          return completeData;
        }
      } catch (error) {
        console.error("❌ Error fetching employee data:", error);
        
        // Tăng số lần thất bại
        localStorage.setItem(failedAttemptsKey, parseInt(failedAttempts) + 1);
        
        // Nếu lỗi là 404, cần cập nhật ID người dùng trong localStorage
        if (error.response && error.response.status === 404) {
          console.warn(`⚠️ Employee ID ${idForApiCall} not found in database. Using current user data.`);
          
          // Sử dụng dữ liệu hiện có nhưng đánh dấu ID là không hợp lệ
          const updatedUser = {
            ...currentUser,
            invalid_employee_id: idForApiCall
          };
          
          setCompleteUserData(updatedUser);
          return updatedUser;
        }
      }
      
      // Fallback
      const fallbackData = {
        ...currentUser,
        custom_employee_id: currentUser.custom_employee_id
      };
      
      setCompleteUserData(fallbackData);
      return fallbackData;
    } catch (error) {
      console.error("❌ Error in fetchEmployeeData:", error.message || error);
      const fallbackData = currentUser;
      setCompleteUserData(fallbackData);
      return fallbackData;
    }
  }, [currentUser, justLoggedIn, initialDataLoaded]);
  
  // Hàm này sẽ được gọi khi người dùng nhấn nút làm mới
  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      console.log("🔄 Starting initial data load");
      
      try {
        // 1. Lấy dữ liệu người dùng đầy đủ
        await fetchEmployeeData();
        
        // 2. Đợi một chút để đảm bảo userData được cập nhật
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 3. Kiểm tra trạng thái điểm danh
        if (userData?.id || userData?._id) {
          await checkAttendanceStatus();
        }
        
        // 4. Đánh dấu đã tải xong dữ liệu
        setInitialDataLoaded(true);
        console.log("✅ Initial data load completed successfully");
      } catch (error) {
        console.error("❌ Error during initial data load:", error);
      } finally {
        setLoading(false);
      }
    };
    
    // Chỉ load dữ liệu khi component mount lần đầu
    if (currentUser && !initialDataLoaded) {
      loadAllData();
    }
  }, [currentUser, initialDataLoaded]);

  // Kiểm tra trạng thái điểm danh
  const checkAttendanceStatus = useCallback(async () => {
    if (!userData?.id && !userData?._id) return;
    
    const employeeId = userData?.id || userData?._id;
    
    try {
      console.log("⏳ Checking attendance status for employee:", employeeId);
      
      // Thêm timestamp để tránh cache
      const timestamp = new Date().getTime();
      const response = await attendanceAPI.getToday(`${employeeId}?t=${timestamp}`);
      
      console.log("📊 Server response for today's attendance:", response.data);
      
      if (response.data && response.data.success) {
        if (response.data.records && response.data.records.length > 0) {
          const latestRecord = response.data.records[0];
          
          console.log("🔍 Latest attendance record from server:", latestRecord);
          
          localStorage.setItem('last_attendance', JSON.stringify(latestRecord));

          const hasCheckOutTime = !!latestRecord.check_out_time;
          const isCheckOutRecord = latestRecord.is_check_out_record === true;
          const isCheckOut = latestRecord.is_check_out === true;
          
          const finalCheckoutStatus = hasCheckOutTime || isCheckOutRecord || isCheckOut;
          
          console.log("🚪 Checkout status analysis:", {
            has_checkout_time: hasCheckOutTime,
            is_check_out_record: isCheckOutRecord,
            is_check_out: isCheckOut,
            final_status: finalCheckoutStatus
          });
          
          // Cập nhật state
          setLastAttendance(latestRecord);
          setHasCheckedOut(finalCheckoutStatus);
          
          return latestRecord;
        } else {
          // Không có bản ghi nào - xóa dữ liệu trong localStorage
          console.log("📝 No attendance records found for today");
          setLastAttendance(null);
          setHasCheckedOut(false);
          localStorage.removeItem('last_attendance');
          return null;
        }
      } else {
        // Nếu API trả về không thành công, thử lại với localStorage
        console.log("⚠️ API call failed or returned unsuccessful status");
        return tryLocalStorageForAttendance();
      }
    } catch (error) {
      console.error("❌ Error checking attendance status:", error);
      // Nếu có lỗi, thử lại với localStorage
      return tryLocalStorageForAttendance();
    }
  }, [userData, tryLocalStorageForAttendance]);

  // useEffect để tự động làm mới dữ liệu khi userData thay đổi
  useEffect(() => {
    if (userData && !initialDataLoaded) {
      console.log("userData changed - triggering data refresh");
      refreshAll();
    }
  }, [userData, initialDataLoaded]);

  // Cập nhật dữ liệu tự động mỗi 30 giây
  const autoRefreshData = useCallback(async () => {
    if (!userData?.id && !userData?._id) return;
    
    try {
      const employeeId = userData?.id || userData?._id;
      console.log("🔄 Auto-refreshing attendance data for:", employeeId);
      
      const attendanceResponse = await attendanceAPI.getToday(employeeId);
      
      if (attendanceResponse.data?.success && attendanceResponse.data.records?.length > 0) {
        const latestRecord = attendanceResponse.data.records[0]; 
        console.log("🔄 Auto-refresh received data:", latestRecord);
        
        const hasCheckOutTime = !!latestRecord.check_out_time;
        const isCheckOutRecord = latestRecord.is_check_out_record === true;
        const isCheckOut = latestRecord.is_check_out === true;
        const finalCheckoutStatus = hasCheckOutTime || isCheckOutRecord || isCheckOut;
        
        const currentCheckoutStatus = hasCheckedOut;
        
        if (finalCheckoutStatus !== currentCheckoutStatus || 
            !lastAttendance ||
            JSON.stringify(latestRecord) !== JSON.stringify(lastAttendance)) {
          console.log("🔄 Auto-refresh detected data change or checkout status change");
          
          localStorage.setItem('last_attendance', JSON.stringify(latestRecord));

          setLastAttendance(latestRecord);
          setHasCheckedOut(finalCheckoutStatus);
        } else {
          console.log("🔄 Auto-refresh: No significant data change detected");
        }
      } else {
        console.log("🔄 Auto-refresh: No records found or unsuccessful API call");
      }
    } catch (error) {
      console.error("🔄 Auto-refresh error:", error);
    }
  }, [userData, lastAttendance, hasCheckedOut]); 

  useInterval(() => {
    if (userData) {
      autoRefreshData();
    }
  }, 30000);

  // Hàm này sẽ được gọi khi người dùng nhấn vào tab
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setShowAttendance(false);
  };

  // Hàm này sẽ được gọi khi người dùng nhấn nút điểm danh
  const handleAttendanceSuccess = async (attendance, isCheckOut = false) => {
    console.log("🎯 Attendance success handler called with:", { isCheckOut, attendance });
    
    if (isCheckOut) {
      setHasCheckedOut(true);
    }
    
    // Cập nhật trạng thái điểm danh
    setLastAttendance(attendance);
    
    // Cập nhật localStorage
    localStorage.setItem('last_attendance', JSON.stringify(attendance));
    
    // Cập nhật thông báo
    if (isCheckOut) {
      setSnackbarMessage(`Điểm danh ra về thành công lúc ${new Date().toLocaleTimeString('vi-VN')}`);
    } else {
      setSnackbarMessage(`Điểm danh vào làm thành công lúc ${new Date(attendance.datetime).toLocaleTimeString('vi-VN')}`);
    }
    
    // Thông báo thành công
    setSnackbarSeverity('success');
    setOpenSnackbar(true);
    setNotificationCount(prev => prev + 1);
    
    // Ẩn camera sau khi điểm danh thành công
    setTimeout(() => {
      setShowAttendance(false);
    }, 2000);
    
    // Thêm delay 1 giây để đảm bảo dữ liệu đã được cập nhật trên server
    setTimeout(async () => {
      try {
        // Lấy lại dữ liệu điểm danh mới nhất từ server
        const employeeId = userData?.id || userData?._id;
        console.log("🔍 Fetching latest attendance data after success for:", employeeId);
        
        const response = await attendanceAPI.getToday(employeeId);
        
        if (response.data.success && response.data.records?.length > 0) {
          const serverRecord = response.data.records[0];
          console.log("🔍 Latest server record after attendance success:", serverRecord);
          
          // Cập nhật lại localStorage với bản ghi mới nhất
          localStorage.setItem('last_attendance', JSON.stringify(serverRecord));
          
          // Tính toán lại trạng thái điểm danh
          const hasCheckOutTime = !!serverRecord.check_out_time;
          const isCheckOutRecord = serverRecord.is_check_out_record === true;
          const isCheckOut = serverRecord.is_check_out === true;
          
          const finalCheckoutStatus = hasCheckOutTime || isCheckOutRecord || isCheckOut;
          
          // Cập nhật lại trạng thái điểm danh
          setLastAttendance(serverRecord);
          setHasCheckedOut(finalCheckoutStatus);
        } else {
          console.warn("⚠️ No server records found after attendance success");
        }
      } catch (error) {
        console.error("❌ Error updating attendance data after success:", error);
      }
    }, 1000); 
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
      
      console.log("Starting full data refresh");
      
      // Kiểm tra xem có quá nhiều lần làm mới trong thời gian ngắn không
      const now = Date.now();
      const lastRefreshTime = parseInt(localStorage.getItem('last_refresh_time') || 0);
      const refreshCount = parseInt(localStorage.getItem('refresh_count') || 0);
      
      if (now - lastRefreshTime < 10000 && refreshCount > 5) {
        console.warn("Too many refresh attempts in short time, waiting...");
        setSnackbarMessage("Vui lòng đợi giây lát trước khi làm mới lại");
        setSnackbarSeverity("warning");
        setOpenSnackbar(true);
        setLoading(false);
        return;
      }
      
      // Cập nhật bộ đếm làm mới
      if (now - lastRefreshTime < 60000) {
        localStorage.setItem('refresh_count', refreshCount + 1);
      } else {
        localStorage.setItem('refresh_count', 1);
      }
      localStorage.setItem('last_refresh_time', now);
      
      // Đảm bảo chờ đợi refreshUserData hoàn thành trước
      const userDataRefreshed = await refreshUserData();
      console.log("User data refreshed:", userDataRefreshed);
      
      // Sau đó gọi fetchEmployeeData nếu refresh thành công
      if (userDataRefreshed) {
        await fetchEmployeeData();
        
        // Cuối cùng, kiểm tra trạng thái điểm danh
        await checkAttendanceStatus();
      }
      
      setSnackbarMessage("Dữ liệu đã được làm mới");
      setSnackbarSeverity("success");
      setOpenSnackbar(true);
      
      console.log("Full data refresh completed");
    } catch (error) {
      console.error("Error during data refresh:", error);
      setSnackbarMessage("Không thể làm mới dữ liệu: " + (error.message || "Lỗi không xác định"));
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

  // Cập nhật phần render để hiển thị loading rõ ràng hơn
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
              <span> {/* Wrapper span để Tooltip hoạt động với nút bị vô hiệu hóa */}
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
            
            {/* Nút làm mới dữ liệu */}
            <Tooltip title="Làm mới dữ liệu">
              <Button
                variant="outlined"
                color="info"
                onClick={refreshAll}
                disabled={loading}
                startIcon={<RefreshIcon />}
                sx={{ 
                  borderRadius: 28,
                  px: 2,
                  py: 0.8,
                  fontWeight: 'medium'
                }}
              >
                Làm Mới
              </Button>
            </Tooltip>
          </Box>
          
          <Tooltip title="Thông báo">
            <IconButton sx={{ mr: 2 }}>
              <Badge badgeContent={notificationCount} color="error">
                <NotificationIcon />
              </Badge>
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
        {/* Chức năng điểm danh */}
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
        
        {/* Nội dung tab */}
        <Box sx={{ mt: 3, mb: 3 }}>
          {loading ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '300px' 
            }}>
              <CircularProgress size={50} thickness={4} />
              <Typography variant="body1" sx={{ mt: 2 }}>
                Đang tải dữ liệu...
              </Typography>
            </Box>
          ) : !userData ? (
            <Alert 
              severity="error" 
              sx={{ mt: 3, mb: 3 }}
              action={
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={() => {
                    setLoading(true);
                    fetchEmployeeData().finally(() => setLoading(false));
                  }}
                >
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

      {/* Snackbar cho thông báo */}
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