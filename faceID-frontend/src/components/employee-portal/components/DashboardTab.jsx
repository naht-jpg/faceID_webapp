import React, { useState, useEffect } from 'react';
import { 
  Box, Grid, Card, CardContent, Typography, Divider, 
  Paper, CircularProgress, Alert, Button,
  Avatar, Stack, Chip
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  ExitToApp as ExitToAppIcon,
  CalendarToday as CalendarTodayIcon,
  Badge as BadgeIcon,
  AccountBox as AccountBoxIcon
} from '@mui/icons-material';
import { useAuth } from '../../../AuthContext';
import { attendanceAPI } from '../../../api';

export default function DashboardTab({ lastAttendance }) {
  const { currentUser } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workingSummary, setWorkingSummary] = useState({
    daysThisMonth: 0,
    onTimeCount: 0,
    lateCount: 0,
    earlyLeaveCount: 0
  });

  useEffect(() => {
    if (currentUser?.id) {
      fetchTodayAttendance();
      fetchWorkingSummary();
    }
  }, [currentUser]);

  const fetchTodayAttendance = async () => {
    if (!currentUser?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await attendanceAPI.getTodayByEmployeeId(currentUser.id);
      
      if (response.data && response.data.success) {
        setTodayAttendance(response.data.records[0] || null);
      } else {
        setTodayAttendance(null);
      }
    } catch (err) {
      console.error("Lỗi khi lấy dữ liệu điểm danh hôm nay:", err);
      setError("Không thể tải dữ liệu điểm danh. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkingSummary = async () => {
    if (!currentUser?.id) return;
    
    try {
      // Lấy tổng kết tháng hiện tại
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      
      const response = await attendanceAPI.getMonthlySummary(currentUser.id, year, month);
      
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
              onClick={() => document.getElementById('attendance-tab').click()}
            >
              Điểm danh ngay
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
    
    return (
      <Card sx={{ mb: 4, borderLeft: '4px solid', borderColor: 'success.main' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <AccessTimeIcon color="success" sx={{ mr: 1 }} />
            <Typography variant="h6">Thông tin điểm danh hôm nay</Typography>
            <Chip 
              label="Đã điểm danh" 
              color="success" 
              size="small" 
              sx={{ ml: 'auto' }}
            />
          </Box>
          <Divider sx={{ mb: 2 }} />
          
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Stack>
                <Typography variant="caption" color="text.secondary">Thời gian vào</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {new Date(attendance.datetime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </Typography>
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
                <Typography variant="caption" color="text.secondary">Thời gian ra</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {attendance.check_out_time ? 
                    new Date(attendance.check_out_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 
                    '—'
                  }
                </Typography>
              </Stack>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Stack>
                <Typography variant="caption" color="text.secondary">Về sớm/Làm thêm</Typography>
                {attendance.early_leave_minutes && attendance.early_leave_minutes !== '0:00:00' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', color: 'warning.main' }}>
                    <ExitToAppIcon fontSize="small" sx={{ mr: 0.5 }} />
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      Về sớm: {attendance.early_leave_minutes}
                    </Typography>
                  </Box>
                ) : attendance.late_leave_minutes && attendance.late_leave_minutes !== '0:00:00' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', color: 'info.main' }}>
                    <AccessTimeIcon fontSize="small" sx={{ mr: 0.5 }} />
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      Làm thêm: {attendance.late_leave_minutes}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body1">—</Typography>
                )}
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
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
              Xin chào, {currentUser?.name}!
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
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Họ và tên</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{currentUser?.name}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{currentUser?.email || '—'}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Mã nhân viên</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{currentUser?.employee_id || '—'}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Phòng ban</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{currentUser?.department || '—'}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Chức vụ</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{currentUser?.job_position || '—'}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Trạng thái</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                    <Chip label="Đang làm việc" color="success" size="small" />
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