import React, { useState, useEffect } from 'react';
import { 
  Box, Grid, Card, CardContent, Typography, Divider, 
  Paper, CircularProgress, Alert, Button,
  Avatar, Stack, Chip, Tooltip, IconButton
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  ExitToApp as ExitToAppIcon,
  CalendarToday as CalendarTodayIcon,
  Badge as BadgeIcon,
  AccountBox as AccountBoxIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { attendanceAPI } from '../../../api';

export default function DashboardTab({ lastAttendance, onAttendanceRequest, userData }) {
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [workingSummary, setWorkingSummary] = useState({
    daysThisMonth: 0,
    onTimeCount: 0,
    lateCount: 0,
    earlyLeaveCount: 0
  });

  useEffect(() => {
    // Use pre-fetched attendance data if available
    if (userData?.lastAttendance) {
      setTodayAttendance(userData.lastAttendance);
    } else {
      // Otherwise fetch it directly
      fetchTodayAttendance();
    }
    
    // Always fetch the monthly summary
    fetchWorkingSummary();
  }, []);

  useEffect(() => {
    // Khởi tạo interval để tự động làm mới mỗi 5 phút (300000ms)
    const refreshInterval = setInterval(() => {
      fetchTodayAttendance(true);
    }, 300000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  const fetchTodayAttendance = async (silent = false) => {
    if (!userData?.id && !userData?._id) return;
    
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    
    try {
      const employeeId = userData.id || userData._id;
      console.log("Fetching attendance with employee ID:", employeeId);
      
      const response = await attendanceAPI.getToday(employeeId);
      
      if (response.data && response.data.success) {
        if (response.data.records && response.data.records.length > 0) {
          setTodayAttendance(response.data.records[0]);
        } else {
          setTodayAttendance(null);
        }
        
        // Cập nhật thời gian làm mới
        setLastRefresh(new Date());
      } else {
        setTodayAttendance(null);
      }
    } catch (err) {
      console.error("Error fetching attendance:", err);
      if (!silent) {
        setError("Không thể tải dữ liệu điểm danh. Vui lòng thử lại sau.");
      }
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchWorkingSummary = async () => {
    if (!userData?.id && !userData?._id) return;
    
    try {
      // Lấy tổng kết tháng hiện tại
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      
      const response = await attendanceAPI.getMonthlySummary(userData.id || userData._id, year, month);
      
      if (response.data && response.data.success) {
        setWorkingSummary({
          daysThisMonth: response.data.total || 0,
          onTimeCount: response.data.onTime || 0,
          lateCount: response.data.late || 0,
          earlyLeaveCount: response.data.earlyLeave || 0
        });
      }
    } catch (err) {
      console.error("Lỗi khi lấy tổng kết tháng:", err);
    }
  };

  const getFormattedTime = (dateString) => {
    try {
      return new Date(dateString).toLocaleTimeString('vi-VN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (e) {
      console.error("Date formatting error:", e);
      return dateString || "—";
    }
  };

  // Hiển thị AttendanceStatus nếu có dữ liệu
  const renderAttendanceStatus = (attendance) => {
    if (!attendance) return (
      <Card sx={{ mb: 4, borderLeft: '4px solid', borderColor: 'warning.main' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <AccessTimeIcon color="warning" sx={{ mr: 1 }} />
            <Typography variant="h6">Thông tin điểm danh hôm nay</Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          
          <Typography variant="body1" sx={{ textAlign: 'center', py: 2 }}>
            Bạn chưa điểm danh hôm nay. Vui lòng truy cập tính năng điểm danh.
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button 
              variant="contained" 
              color="primary"
              onClick={onAttendanceRequest || (() => console.log('onAttendanceRequest not provided'))}            >
              Điểm danh ngay
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
    
    const hasCheckOut = attendance.check_out_time || attendance.is_check_out;
    
    return (
      <Card sx={{ mb: 4, borderLeft: '4px solid', borderColor: hasCheckOut ? 'success.dark' : 'success.main' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <AccessTimeIcon color="success" sx={{ mr: 1 }} />
              <Typography variant="h6">Thông tin điểm danh hôm nay</Typography>
              <Chip 
                label={hasCheckOut ? "Đã điểm danh đầy đủ" : "Đã điểm danh vào"} 
                color={hasCheckOut ? "success" : "warning"}
                size="small" 
                sx={{ ml: 1 }}
              />
            </Box>
            
            <Box>
              <Tooltip title="Làm mới dữ liệu">
                <IconButton
                  onClick={() => fetchTodayAttendance(true)}
                  size="small"
                  disabled={refreshing}
                  sx={{ mr: 1 }}
                >
                  <RefreshIcon fontSize="small" sx={{ animation: refreshing ? 'spin 2s linear infinite' : 'none' }} />
                </IconButton>
              </Tooltip>
              <Typography variant="caption" color="text.secondary">
                Cập nhật lúc: {lastRefresh.toLocaleTimeString('vi-VN')}
              </Typography>
            </Box>
          </Box>
          
          <Divider sx={{ mb: 2 }} />
          
          {renderAttendanceDetails(attendance)}
        </CardContent>
      </Card>
    );
  };

  // Cập nhật lại phần hiển thị thông tin điểm danh chi tiết
  const renderAttendanceDetails = (attendance) => {
    // Tính toán tổng thời gian làm việc nếu có check-out
    const calculateWorkDuration = () => {
      if (!attendance.check_out_time) return null;
      
      const checkInTime = new Date(attendance.datetime);
      const checkOutTime = new Date(attendance.check_out_time);
      const diffMs = checkOutTime - checkInTime;
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      // Giả định cấu hình giờ làm việc tiêu chuẩn là 8 giờ
      // Trong thực tế, nên lấy từ cấu hình hệ thống hoặc API
      const requiredHours = 8; // Có thể thay đổi theo yêu cầu thực tế
      const actualHours = hours + (minutes / 60);
      
      // Đánh dấu xem nhân viên có làm đủ giờ không
      attendance.workedEnoughHours = actualHours >= requiredHours;
      
      return `${hours} giờ ${minutes} phút`;
    };
    
    const workDuration = calculateWorkDuration();
    
    return (
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Stack>
            <Typography variant="caption" color="text.secondary">Thời gian vào</Typography>
            <Typography variant="body1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              {getFormattedTime(attendance.datetime)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {new Date(attendance.datetime).toLocaleDateString('vi-VN')}
            </Typography>
          </Stack>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Stack>
            <Typography variant="caption" color="text.secondary">Thời gian ra</Typography>
            {attendance.check_out_time ? (
              <>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {getFormattedTime(attendance.check_out_time)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(attendance.check_out_time).toLocaleDateString('vi-VN')}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Chưa điểm danh ra về
              </Typography>
            )}
          </Stack>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Stack>
            <Typography variant="caption" color="text.secondary">Trạng thái</Typography>
            {attendance.late_minutes && attendance.late_minutes !== '0:00:00' ? (
              <Box sx={{ display: 'flex', alignItems: 'center', color: 'error.main' }}>
                <ArrowDownwardIcon fontSize="small" sx={{ mr: 0.5 }} />
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  Đi muộn: {attendance.late_minutes}
                </Typography>
              </Box>
            ) : attendance.early_minutes && attendance.early_minutes !== '0:00:00' ? (
              <Box sx={{ display: 'flex', alignItems: 'center', color: 'success.main' }}>
                <ArrowUpwardIcon fontSize="small" sx={{ mr: 0.5 }} />
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  Đến sớm: {attendance.early_minutes}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body1" color="primary.main" sx={{ fontWeight: 'bold' }}>
                Đúng giờ
              </Typography>
            )}
          </Stack>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Stack>
            <Typography variant="caption" color="text.secondary">Thời gian làm việc</Typography>
            {workDuration ? (
              <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                {workDuration}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Đang tính toán...
              </Typography>
            )}
          </Stack>
        </Grid>
        
        {attendance.check_out_time && workDuration && (
          <Grid item xs={12} sm={6} md={3}>
            <Stack>
              <Typography variant="caption" color="text.secondary">Trạng thái làm việc</Typography>
              {attendance.workedEnoughHours ? (
                <Box sx={{ display: 'flex', alignItems: 'center', color: 'success.main' }}>
                  <CheckCircleIcon fontSize="small" sx={{ mr: 0.5 }} />
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    Đủ giờ làm việc
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', color: 'warning.main' }}>
                  <AccessTimeIcon fontSize="small" sx={{ mr: 0.5 }} />
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    Chưa đủ giờ làm việc
                  </Typography>
                </Box>
              )}
            </Stack>
          </Grid>
        )}
        
        {attendance.check_out_time && (
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Thời gian làm việc hôm nay
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {attendance.early_leave_minutes && attendance.early_leave_minutes !== '0:00:00' ? (
                  <Chip 
                    size="small" 
                    color="warning" 
                    label={`Về sớm: ${attendance.early_leave_minutes}`} 
                    sx={{ mr: 1 }}
                  />
                ) : null}
                
                {attendance.late_leave_minutes && attendance.late_leave_minutes !== '0:00:00' ? (
                  <Chip 
                    size="small" 
                    color="info" 
                    label={`Về muộn: ${attendance.late_leave_minutes}`} 
                    sx={{ mr: 1 }}
                  />
                ) : null}
                
                {attendance.workedEnoughHours ? (
                  <Chip 
                    size="small" 
                    color="success" 
                    label="Đủ giờ làm việc"
                  />
                ) : (
                  <Chip 
                    size="small" 
                    color="warning" 
                    label="Chưa đủ giờ làm việc"
                  />
                )}
              </Box>
            </Box>
          </Grid>
        )}
      </Grid>
    );
  };

  return (
    <Box>
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 2, 
          backgroundImage: 'linear-gradient(to right, #3a7bd5, #00d2ff)',
          color: 'white'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar 
            sx={{ 
              width: 64, 
              height: 64, 
              bgcolor: 'white', 
              color: 'primary.main',
              border: '2px solid white'
            }}
          >
            <AccountBoxIcon fontSize="large" />
          </Avatar>
          <Box>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
              Xin chào, {userData?.name}!
            </Typography>
            <Typography variant="body1">
              Hôm nay là {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Typography>
          </Box>
        </Box>
      </Paper>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      ) : (
        renderAttendanceStatus(todayAttendance || lastAttendance)
      )}
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card elevation={2} sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CalendarTodayIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Tổng kết tháng này</Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ 
                    textAlign: 'center', 
                    p: 1.5, 
                    borderRadius: 2,
                    bgcolor: 'primary.light',
                    color: 'white'
                  }}>
                    <Typography variant="h4">
                      {workingSummary.daysThisMonth}
                    </Typography>
                    <Typography variant="body2">Ngày làm việc</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ 
                    textAlign: 'center', 
                    p: 1.5, 
                    borderRadius: 2,
                    bgcolor: 'success.light',
                    color: 'white'
                  }}>
                    <Typography variant="h4">
                      {workingSummary.onTimeCount}
                    </Typography>
                    <Typography variant="body2">Đúng giờ</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ 
                    textAlign: 'center', 
                    p: 1.5, 
                    borderRadius: 2,
                    bgcolor: 'error.light',
                    color: 'white'
                  }}>
                    <Typography variant="h4">
                      {workingSummary.lateCount}
                    </Typography>
                    <Typography variant="body2">Đi muộn</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ 
                    textAlign: 'center', 
                    p: 1.5, 
                    borderRadius: 2,
                    bgcolor: 'warning.light',
                    color: 'white'
                  }}>
                    <Typography variant="h4">
                      {workingSummary.earlyLeaveCount}
                    </Typography>
                    <Typography variant="body2">Về sớm</Typography>
                  </Box>
                </Grid>
              </Grid>
              
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                <Button 
                  variant="outlined" 
                  color="primary"
                  startIcon={<CalendarTodayIcon />}
                  onClick={() => document.getElementById('history-tab').click()}
                >
                  Xem chi tiết lịch sử
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card elevation={2} sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <BadgeIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Thông tin cá nhân</Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Chip 
                      icon={<BadgeIcon />} 
                      label={userData?.employee_id || 'Chưa có mã NV'} 
                      color="primary" 
                      variant="outlined"
                      sx={{ mr: 1 }}
                    />
                    <Chip 
                      icon={<BusinessIcon />} 
                      label={userData?.department || 'Chưa có phòng ban'} 
                      color="default" 
                      variant="outlined"
                    />
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Họ và tên</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{userData?.name}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{userData?.email || '—'}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Chức vụ</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{userData?.job_position || '—'}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Số điện thoại</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{userData?.phone || '—'}</Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="caption" color="text.secondary">Ngày tham gia</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                    {userData?.created_at ? new Date(userData.created_at).toLocaleDateString('vi-VN') : '—'}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}