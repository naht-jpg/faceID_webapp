import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  Button, 
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  Alert
} from '@mui/material';
import { 
  Face as FaceIcon, 
  PeopleAlt as PeopleAltIcon, 
  AccessTime as AccessTimeIcon,
  Dashboard as DashboardIcon,
  Notifications as NotificationsIcon,
  EventAvailable as EventAvailableIcon,
  TrendingUp as TrendingUpIcon,
  BarChart as BarChartIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  GroupAdd as GroupAddIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Info as InfoIcon,
  Fingerprint as FingerprintIcon
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { employeeAPI, attendanceAPI } from '../api';
import Chart from 'chart.js/auto';

export default function Home({onTabChange}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    attendanceRate: "0%"
  });
  
  const [employeesWithIssues, setEmployeesWithIssues] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [recentAttendances, setRecentAttendances] = useState([]);
  const [attendanceRates, setAttendanceRates] = useState({
    onTime: 0,
    late: 0,
    absent: 0,
    early: 0,
    recognitionSuccess: 0,
    fullAttendance: 0
  });

  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const employeeResponse = await employeeAPI.getAll();
      const employees = Array.isArray(employeeResponse.data) 
        ? employeeResponse.data 
        : (employeeResponse.data?.employees || []);
        
      const employeeMap = {};
      employees.forEach(emp => {
        employeeMap[emp._id] = {
          name: emp.fullName || emp.name,
          department: emp.department || 'Chưa phân bộ phận',
          employeeId: emp.employeeId
        };
      });
        
      const attendanceResponse = await attendanceAPI.getAdminAttendance({
        fromDate: new Date(new Date().setDate(new Date().getDate() - 30)), // 30 ngày trước
        toDate: new Date(),
      });
      
      const attendanceRecords = attendanceResponse.data?.records || [];
      
      const presentToday = attendanceRecords.filter(record => record.status !== 'absent').length;
      const lateToday = attendanceRecords.filter(record => 
        record.late_minutes && record.late_minutes !== '0:00:00'
      ).length;
      
      const issueEmployees = attendanceRecords
        .filter(record => 
          (record.late_minutes && record.late_minutes !== '0:00:00') || 
          record.status === 'absent' || 
          (record.early_leave_minutes && record.early_leave_minutes !== '0:00:00')
        )
        .map(record => {
          const employeeInfo = employeeMap[record.employee_id] || {};
          return {
            id: record._id,
            name: record.name,
            time: record.datetime ? new Date(record.datetime).toLocaleTimeString('vi-VN') : '-',
            status: record.status === 'absent' ? 'Vắng mặt' : 
                   (record.early_leave_minutes && record.early_leave_minutes !== '0:00:00') ? 'Về sớm' : 'Muộn',
            department: employeeInfo.department || 'Chưa phân bộ phận'
          };
        })
        .slice(0, 4);
      
      const recent = attendanceRecords
        .filter(record => record.status !== 'absent')
        .map(record => {
          const employeeInfo = employeeMap[record.employee_id] || {};
          return {
            id: record._id,
            name: record.name,
            time: record.datetime ? new Date(record.datetime).toLocaleTimeString('vi-VN') : '-',
            status: (record.late_minutes && record.late_minutes !== '0:00:00') ? 'Muộn' : 'Đúng giờ',
            department: employeeInfo.department || 'Chưa phân bộ phận'
          };
        })
        .slice(0, 3);
      
      const totalAttendances = attendanceRecords.length;
      const onTime = attendanceRecords.filter(record => 
        !record.late_minutes || record.late_minutes === '0:00:00'
      ).length;
      const early = attendanceRecords.filter(record => 
        record.early && record.early === true
      ).length;
      
      setStats({
        totalEmployees: employees.length,
        presentToday,
        lateToday,
        absentToday: employees.length - presentToday,
        attendanceRate: totalAttendances > 0 
          ? `${Math.round((presentToday / employees.length) * 100)}%` 
          : "0%"
      });
      
      setEmployeesWithIssues(issueEmployees);
      setRecentAttendances(recent);
      
      setAttendanceRates({
        onTime: totalAttendances > 0 ? Math.round((onTime / totalAttendances) * 100) : 0,
        late: totalAttendances > 0 ? Math.round((lateToday / totalAttendances) * 100) : 0,
        absent: employees.length > 0 ? Math.round(((employees.length - presentToday) / employees.length) * 100) : 0,
        early: totalAttendances > 0 ? Math.round((early / totalAttendances) * 100) : 0,
        recognitionSuccess: 98,
        fullAttendance: 90
      });
      
      setSystemAlerts([
        { 
          type: "warning", 
          message: "Cơ sở dữ liệu đạt 85% dung lượng",
          time: new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})
        },
        { 
          type: "info", 
          message: "Bản cập nhật phần mềm v2.3 sẵn sàng cài đặt",
          time: new Date(Date.now() - 2 * 60 * 60 * 1000).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})
        },
        { 
          type: "error", 
          message: "Lỗi kết nối camera tại vị trí Văn phòng 2",
          time: new Date(Date.now() - 4 * 60 * 60 * 1000).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})
        }
      ]);
      
      updateChart(attendanceRecords);
      
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Không thể tải dữ liệu. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };
  
  const updateChart = (attendanceRecords) => {
    const hours = [
      '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', 
      '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
      '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', 
      '20:00', '21:00', '22:00', '23:00'
    ];
    const data = Array(24).fill(0);
    
    attendanceRecords.forEach(record => {
      if (record.datetime) {
        const date = new Date(record.datetime);
        const hour = date.getHours();
        data[hour] += 1;
      }
    });
    
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    
    if (chartRef.current) {
      const ctx = chartRef.current.getContext('2d');
      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: hours,
          datasets: [{
            label: 'Số lượt điểm danh',
            data: data,
            backgroundColor: 'rgba(33, 150, 243, 0.2)',
            borderColor: 'rgba(33, 150, 243, 1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#fff',
            pointBorderColor: 'rgba(33, 150, 243, 1)',
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                title: (items) => items[0].label,
                label: (item) => `${item.raw} lượt điểm danh`
              }
            },
            title: {
              display: true,
              text: 'Điểm danh theo khung giờ trong ngày',
              color: 'rgba(33, 150, 243, 1)',
              font: {
                size: 14,
                weight: 'bold'
              },
              padding: {
                bottom: 10
              }
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Giờ trong ngày',
                color: '#666',
                font: {
                  size: 12,
                  weight: 'bold'
                },
                padding: {
                  top: 10
                }
              },
              grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.05)'
              },
              ticks: {
                callback: function(val, index) {
                  return index % 3 === 0 ? this.getLabelForValue(val) : '';
                },
                maxRotation: 45,
                minRotation: 45
              }
            },
            y: {
              title: {
                display: true,
                text: 'Số lượt điểm danh',
                color: '#666',
                font: {
                  size: 12,
                  weight: 'bold'
                }
              },
              beginAtZero: true,
              min: 0,
              suggestedMax: Math.max(...data) + 1,
              ticks: {
                precision: 0,
                stepSize: 1
              },
              grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.05)'
              }
            }
          }
        }
      });
    }
  };
  
  useEffect(() => {
    fetchDashboardData();
    
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, []);
  
  const handleRefresh = () => {
    fetchDashboardData();
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 3
        }}
      >
        <Typography variant="h5" fontWeight="bold">
          <DashboardIcon sx={{ mr: 1, verticalAlign: 'top' }} />
          Dashboard Quản trị
        </Typography>
        
        <Box>
          <Typography variant="body2" color="text.secondary" display="inline" sx={{ mr: 2 }}>
            Cập nhật lần cuối: {new Date().toLocaleString('vi-VN')}
          </Typography>
          <Tooltip title="Làm mới dữ liệu">
            <IconButton 
              color="primary" 
              size="small"
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ height: '100%', backgroundColor: '#e3f2fd', borderLeft: '4px solid #1976d2' }}>
            <CardContent>
              <Typography variant="body2" color="info" fontWeight={500}>
                TỔNG NHÂN VIÊN
              </Typography>
              <Typography variant="h4" component="div" color="black" sx={{ mt: 1, fontWeight: 'bold' }}>
                {stats.totalEmployees}
              </Typography>
              <PeopleAltIcon sx={{ position: 'absolute', right: 16, top: 16, color: '#1976d2', opacity: 0.6 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ height: '100%', backgroundColor: '#e8f5e9', borderLeft: '4px solid #4caf50' }}>
            <CardContent>
              <Typography variant="body2" color="info" fontWeight={500}>
                CÓ MẶT
              </Typography>
              <Typography variant="h4" component="div" color="black" sx={{ mt: 1, fontWeight: 'bold' }}>
                {stats.presentToday}
              </Typography>
              <FaceIcon sx={{ position: 'absolute', right: 16, top: 16, color: '#4caf50', opacity: 0.6 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ height: '100%', backgroundColor: '#fff8e1', borderLeft: '4px solid #ff9800' }}>
            <CardContent>
              <Typography variant="body2" color="info" fontWeight={500}>
                ĐI MUỘN
              </Typography>
              <Typography variant="h4" component="div" color="black" sx={{ mt: 1, fontWeight: 'bold' }}>
                {stats.lateToday}
              </Typography>
              <AccessTimeIcon sx={{ position: 'absolute', right: 16, top: 16, color: '#ff9800', opacity: 0.6 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ height: '100%', backgroundColor: '#ffebee', borderLeft: '4px solid #f44336' }}>
            <CardContent>
              <Typography variant="body2" color="info" fontWeight={500}>
                VẮNG MẶT
              </Typography>
              <Typography variant="h4" component="div" color="black" sx={{ mt: 1, fontWeight: 'bold' }}>
                {stats.absentToday}
              </Typography>
              <BarChartIcon sx={{ position: 'absolute', right: 16, top: 16, color: '#f44336', opacity: 0.6 }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    <BarChartIcon sx={{ mr: 1, verticalAlign: 'top' }} />
                    Thống kê điểm danh theo giờ
                  </Typography>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => onTabChange('attendance')}
                    startIcon={<PrintIcon />}
                  >
                    Xuất báo cáo
                  </Button>
                </Box>
                
                <Box sx={{ 
                  height: 210, 
                  position: 'relative',
                  borderRadius: 1
                }}>
                  <canvas ref={chartRef} />
                </Box>
                
                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={3}>
                    <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                      <Typography variant="h5" color="primary" fontWeight="bold">{attendanceRates.onTime}%</Typography>
                      <Typography variant="body2" color="info">Đúng giờ</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={3}>
                    <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#fff8e1', borderRadius: 1 }}>
                      <Typography variant="h5" color="warning.main" fontWeight="bold">{attendanceRates.late}%</Typography>
                      <Typography variant="body2" color="info">Đi muộn</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={3}>
                    <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#ffebee', borderRadius: 1 }}>
                      <Typography variant="h5" color="error.main" fontWeight="bold">{attendanceRates.absent}%</Typography>
                      <Typography variant="body2" color="info">Vắng mặt</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={3}>
                    <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#e8f5e9', borderRadius: 1 }}>
                      <Typography variant="h5" color="success.main" fontWeight="bold">{attendanceRates.early}%</Typography>
                      <Typography variant="body2" color="info">Đến sớm</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <SettingsIcon sx={{ mr: 1, verticalAlign: 'top' }} />
                  Truy cập nhanh
                </Typography>
                
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={6} sm={4}>
                    <Paper
                      component="div"
                      onClick={() => onTabChange('employees')}
                      sx={{
                        p: 2,
                        textAlign: 'center',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        color: 'text.primary',
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'action.hover',
                          transform: 'translateY(-4px)',
                          boxShadow: 2
                        }
                      }}
                    >
                      <GroupAddIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                      <Typography variant="body1" fontWeight={500}>
                        Quản lý nhân viên
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Paper
                      component="div"
                      onClick={() => onTabChange('face-recognition')}
                      sx={{
                        p: 2,
                        textAlign: 'center',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        color: 'text.primary',
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'action.hover',
                          transform: 'translateY(-4px)',
                          boxShadow: 2
                        }
                      }}
                    >
                      <FingerprintIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                      <Typography variant="body1" fontWeight={500}>
                        Nhận diện khuôn mặt
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Paper
                      component="div"
                      onClick={() => onTabChange('attendance')}
                      sx={{
                        p: 2,
                        textAlign: 'center',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        color: 'text.primary',
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'action.hover',
                          transform: 'translateY(-4px)',
                          boxShadow: 2
                        }
                      }}
                    >
                      <EventAvailableIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                      <Typography variant="body1" fontWeight={500}>
                        Quản lý điểm danh
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    <AccessTimeIcon sx={{ mr: 1, verticalAlign: 'top' }} />
                    Điểm danh gần đây
                  </Typography>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => onTabChange('attendance')}
                  >
                    Xem tất cả
                  </Button>
                </Box>
                
                {recentAttendances.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Nhân viên</TableCell>
                          <TableCell>Phòng ban</TableCell>
                          <TableCell>Thời gian</TableCell>
                          <TableCell>Trạng thái</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {recentAttendances.map((attendance) => (
                          <TableRow key={attendance.id}>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Avatar 
                                  sx={{ 
                                    width: 28, 
                                    height: 28, 
                                    mr: 1,
                                    bgcolor: attendance.status === 'Muộn' ? '#ffecb3' : '#e8f5e9'
                                  }}
                                >
                                  {attendance.name.charAt(0)}
                                </Avatar>
                                {attendance.name}
                              </Box>
                            </TableCell>
                            <TableCell>{attendance.department}</TableCell>
                            <TableCell>{attendance.time}</TableCell>
                            <TableCell>
                              <Chip 
                                label={attendance.status} 
                                size="small"
                                sx={{ 
                                  backgroundColor: attendance.status === 'Muộn' ? '#fff8e1' : '#e8f5e9',
                                  color: attendance.status === 'Muộn' ? '#ff9800' : '#4caf50',
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    Không có dữ liệu điểm danh gần đây.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    <WarningIcon sx={{ mr: 1, verticalAlign: 'top' }} />
                    Nhân viên cần chú ý
                  </Typography>
                  <Chip 
                    label={`${employeesWithIssues.length} nhân viên`} 
                    color="warning" 
                    size="small" 
                  />
                </Box>
                
                {employeesWithIssues.length > 0 ? (
                  <List sx={{ py: 0 }}>
                    {employeesWithIssues.map(employee => (
                      <ListItem 
                        key={employee.id} 
                        sx={{ 
                          py: 1,
                          px: 2,
                          mb: 1,
                          bgcolor: employee.status === 'Vắng mặt' ? 'rgba(244, 67, 54, 0.08)' : 
                                  employee.status === 'Về sớm' ? 'rgba(245, 124, 0, 0.08)' : 
                                  'rgba(255, 152, 0, 0.08)',
                          borderRadius: 1,
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: '40px' }}>
                          <Avatar sx={{ 
                            width: 32, 
                            height: 32,
                            bgcolor: employee.status === 'Vắng mặt' ? '#f44336' : 
                                    employee.status === 'Về sớm' ? '#f57c00' : 
                                    '#ff9800'
                          }}>
                            {employee.name.charAt(0)}
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText 
                          primary={<Box sx={{ fontWeight: 500 }}>{employee.name}</Box>} 
                          secondary={
                            <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" component="span">
                                {employee.department}
                                {employee.time !== '-' && ` - ${employee.time}`}
                              </Typography>
                              <Chip
                                label={employee.status}
                                size="small"
                                sx={{
                                  ml: 1,
                                  bgcolor: employee.status === 'Vắng mặt' ? 'rgba(244, 67, 54, 0.2)' : 
                                          employee.status === 'Về sớm' ? 'rgba(245, 124, 0, 0.2)' : 
                                          'rgba(255, 152, 0, 0.2)',
                                  color: employee.status === 'Vắng mặt' ? '#f44336' : 
                                         employee.status === 'Về sớm' ? '#f57c00' : 
                                         '#ff9800',
                                  fontWeight: 500,
                                  fontSize: '0.7rem'
                                }}
                              />
                            </Box>
                          }
                          secondaryTypographyProps={{ component: 'div' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    Không có nhân viên nào cần chú ý.
                  </Typography>
                )}
                
                <Box sx={{ textAlign: 'center', mt: 1 }}>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => onTabChange('employees')}
                  >
                    Xem tất cả nhân viên
                  </Button>
                </Box>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    <ErrorIcon sx={{ mr: 1, verticalAlign: 'top' }} />
                    Cảnh báo hệ thống
                  </Typography>
                  <Chip 
                    label={`${systemAlerts.length} cảnh báo`} 
                    color="error" 
                    size="small" 
                  />
                </Box>
                
                <List sx={{ py: 0 }}>
                  {systemAlerts.map((alert, index) => (
                    <ListItem 
                      key={index} 
                      sx={{ 
                        py: 1,
                        px: 2, 
                        mb: 1,
                        bgcolor: 
                          alert.type === 'error' ? 'rgba(244, 67, 54, 0.08)' : 
                          alert.type === 'warning' ? 'rgba(255, 152, 0, 0.08)' : 
                          'rgba(33, 150, 243, 0.08)',
                        borderRadius: 1
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: '40px' }}>
                        {alert.type === 'error' ? (
                          <ErrorIcon color="error" />
                        ) : alert.type === 'warning' ? (
                          <WarningIcon color="warning" />
                        ) : (
                          <InfoIcon color="info" />
                        )}
                      </ListItemIcon>
                      <ListItemText 
                        primary={alert.message} 
                        secondary={`${alert.time}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'top' }} />
                  Tỷ lệ điểm danh tháng này
                </Typography>
                
                <Box sx={{ py: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" sx={{ minWidth: 180 }}>
                      Tỷ lệ nhận diện thành công:
                    </Typography>
                    <Box sx={{ flexGrow: 1, ml: 2 }}>
                      <Box sx={{ width: '100%', bgcolor: 'rgba(76, 175, 80, 0.2)', borderRadius: 10, height: 8 }}>
                        <Box sx={{ width: `${attendanceRates.recognitionSuccess}%`, bgcolor: '#4caf50', borderRadius: 10, height: 8 }} />
                      </Box>
                    </Box>
                    <Typography variant="body2" sx={{ ml: 2, fontWeight: 500 }}>
                      {attendanceRates.recognitionSuccess}%
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" sx={{ minWidth: 180 }}>
                      Tỷ lệ đi làm đúng giờ:
                    </Typography>
                    <Box sx={{ flexGrow: 1, ml: 2 }}>
                      <Box sx={{ width: '100%', bgcolor: 'rgba(33, 150, 243, 0.2)', borderRadius: 10, height: 8 }}>
                        <Box sx={{ width: `${attendanceRates.onTime}%`, bgcolor: '#2196f3', borderRadius: 10, height: 8 }} />
                      </Box>
                    </Box>
                    <Typography variant="body2" sx={{ ml: 2, fontWeight: 500 }}>
                      {attendanceRates.onTime}%
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" sx={{ minWidth: 180 }}>
                      Tỷ lệ đi làm đủ công:
                    </Typography>
                    <Box sx={{ flexGrow: 1, ml: 2 }}>
                      <Box sx={{ width: '100%', bgcolor: 'rgba(255, 152, 0, 0.2)', borderRadius: 10, height: 8 }}>
                        <Box sx={{ width: `${attendanceRates.fullAttendance}%`, bgcolor: '#ff9800', borderRadius: 10, height: 8 }} />
                      </Box>
                    </Box>
                    <Typography variant="body2" sx={{ ml: 2, fontWeight: 500 }}>
                      {attendanceRates.fullAttendance}%
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ minWidth: 180 }}>
                      Tỷ lệ vắng mặt:
                    </Typography>
                    <Box sx={{ flexGrow: 1, ml: 2 }}>
                      <Box sx={{ width: '100%', bgcolor: 'rgba(244, 67, 54, 0.2)', borderRadius: 10, height: 8 }}>
                        <Box sx={{ width: `${attendanceRates.absent}%`, bgcolor: '#f44336', borderRadius: 10, height: 8 }} />
                      </Box>
                    </Box>
                    <Typography variant="body2" sx={{ ml: 2, fontWeight: 500 }}>
                      {attendanceRates.absent}%
                    </Typography>
                  </Box>
                </Box>
                
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={() => onTabChange('attendance')}
                  sx={{ mt: 1 }}
                  startIcon={<BarChartIcon />}
                  fullWidth
                >
                  Xem báo cáo chi tiết
                </Button>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}