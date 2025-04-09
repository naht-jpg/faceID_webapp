import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Card, CardContent, Chip, InputAdornment,
  FormControl, InputLabel, Select, CircularProgress, Alert,
  Tooltip, IconButton
} from '@mui/material';
import {
  Search as SearchIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  AccessTime as AccessTimeIcon,
  FilterAlt as FilterIcon,
  Refresh as RefreshIcon,
  FileDownload as ExportIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { DatePicker, TimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { attendanceAPI, employeeAPI } from '../../api';

export default function AdminAttendanceTab() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Filters
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedHour, setSelectedHour] = useState('');
  const [selectedMinute, setSelectedMinute] = useState('');
  const [selectedSecond, setSelectedSecond] = useState('');
  
  useEffect(() => {
    fetchEmployees();
    fetchAttendanceRecords();
  }, []);
  
  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      if (response.data) {
        let employeesList = Array.isArray(response.data) ? response.data : 
                           (response.data.employees || response.data.data || []);
        setEmployees(employeesList);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      setError("Không thể tải danh sách nhân viên");
    }
  };
  
  const fetchAttendanceRecords = async (filters = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      // Call to our new API endpoint
      const response = await attendanceAPI.getAdminAttendance(filters);
      
      if (response.data && response.data.success) {
        setAttendanceRecords(response.data.records || []);
      } else {
        setAttendanceRecords([]);
        if (response.data && !response.data.success) {
          setError(response.data.message || "Không thể tải dữ liệu điểm danh");
        }
      }
    } catch (error) {
      console.error("Error fetching attendance records:", error);
      setError("Không thể tải dữ liệu điểm danh: " + (error.message || "Lỗi không xác định"));
    } finally {
      setLoading(false);
    }
  };
  
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  const handleSearch = () => {
    const filters = {};
    
    if (employeeId) filters.employee_id = employeeId;
    if (employeeName) filters.employee_name = employeeName;
    
    if (selectedYear) filters.year = selectedYear;
    if (selectedMonth) filters.month = selectedMonth;
    if (selectedDay) filters.day = selectedDay;
    if (selectedHour) filters.hour = selectedHour;
    if (selectedMinute) filters.minute = selectedMinute;
    if (selectedSecond) filters.second = selectedSecond;
    
    if (selectedDate) {
      const date = dayjs(selectedDate);
      filters.year = date.year();
      filters.month = date.month() + 1;
      filters.day = date.date();
    }
    
    if (selectedTime) {
      const time = dayjs(selectedTime);
      filters.hour = time.hour();
      filters.minute = time.minute();
      filters.second = time.second();
    }
    
    fetchAttendanceRecords(filters);
  };
  
  const handleReset = () => {
    setEmployeeId('');
    setEmployeeName('');
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedYear('');
    setSelectedMonth('');
    setSelectedDay('');
    setSelectedHour('');
    setSelectedMinute('');
    setSelectedSecond('');
    fetchAttendanceRecords();
  };
  
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };
  
  const exportToCSV = () => {
    if (attendanceRecords.length === 0) return;
    
    // Tạo header CSV
    const headers = [
      'Thời gian',
      'Nhân viên',
      'Trạng thái',
      'Đến sớm/muộn',
      'Về sớm/muộn',
      'Thời gian làm việc'
    ];
    
    // Tạo các dòng dữ liệu
    const data = attendanceRecords.map(record => [
      formatDate(record.datetime),
      record.name,
      record.is_check_out ? 'Đã checkout' : 
      record.late_minutes !== '0:00:00' ? 'Đi muộn' : 
      record.early_minutes !== '0:00:00' ? 'Đến sớm' : 'Đúng giờ',
      record.late_minutes !== '0:00:00' ? record.late_minutes : 
      record.early_minutes !== '0:00:00' ? record.early_minutes : '',
      record.early_leave_minutes !== '0:00:00' ? record.early_leave_minutes : 
      record.late_leave_minutes !== '0:00:00' ? record.late_leave_minutes : '',
      record.work_time || ''
    ]);
    
    // Tạo nội dung CSV
    const csvContent = [
      headers.join(','),
      ...data.map(row => row.join(','))
    ].join('\n');
    
    // Tạo blob và download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `attendance_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Quản lý điểm danh
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Xuất CSV">
            <IconButton 
              color="primary" 
              onClick={exportToCSV}
              disabled={attendanceRecords.length === 0}
            >
              <ExportIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="In">
            <IconButton 
              color="primary" 
              onClick={handlePrint}
              disabled={attendanceRecords.length === 0}
            >
              <PrintIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      <Card elevation={3} sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            <FilterIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Bộ lọc tìm kiếm
          </Typography>
          
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Nhân viên</InputLabel>
                <Select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  label="Nhân viên"
                >
                  <MenuItem value="">Tất cả nhân viên</MenuItem>
                  {employees.map((employee) => (
                    <MenuItem key={employee._id} value={employee._id}>
                      {employee.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Tên nhân viên"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
          
          <Typography variant="subtitle2" gutterBottom>
            Lọc theo ngày hoàn chỉnh
          </Typography>
          
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Ngày"
                  value={selectedDate}
                  onChange={setSelectedDate}
                  format="DD/MM/YYYY"
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      InputProps: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <CalendarIcon />
                          </InputAdornment>
                        )
                      }
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <TimePicker
                  label="Giờ"
                  value={selectedTime}
                  onChange={setSelectedTime}
                  format="HH:mm:ss"
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      InputProps: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <AccessTimeIcon />
                          </InputAdornment>
                        )
                      }
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>
          </Grid>
          
          <Typography variant="subtitle2" gutterBottom>
            Hoặc lọc theo từng thành phần thời gian
          </Typography>
          
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Năm"
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                placeholder="VD: 2023"
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Tháng"
                type="number"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                placeholder="1-12"
                inputProps={{ min: 1, max: 12 }}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Ngày"
                type="number"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                placeholder="1-31"
                inputProps={{ min: 1, max: 31 }}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Giờ"
                type="number"
                value={selectedHour}
                onChange={(e) => setSelectedHour(e.target.value)}
                placeholder="0-23"
                inputProps={{ min: 0, max: 23 }}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Phút"
                type="number"
                value={selectedMinute}
                onChange={(e) => setSelectedMinute(e.target.value)}
                placeholder="0-59"
                inputProps={{ min: 0, max: 59 }}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Giây"
                type="number"
                value={selectedSecond}
                onChange={(e) => setSelectedSecond(e.target.value)}
                placeholder="0-59"
                inputProps={{ min: 0, max: 59 }}
              />
            </Grid>
          </Grid>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleReset}
            >
              Xóa bộ lọc
            </Button>
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
            >
              Tìm kiếm
            </Button>
          </Box>
        </CardContent>
      </Card>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : (
        <>
          <Paper elevation={3} sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ p: 2, borderBottom: '1px solid #eee' }}>
              Kết quả tìm kiếm: {attendanceRecords.length} bản ghi
            </Typography>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Thời gian</TableCell>
                    <TableCell>Nhân viên</TableCell>
                    <TableCell>Trạng thái</TableCell>
                    <TableCell>Đến sớm/muộn</TableCell>
                    <TableCell>Về sớm/muộn</TableCell>
                    <TableCell>Thời gian làm việc</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {attendanceRecords.length > 0 ? (
                    attendanceRecords
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((record) => (
                        <TableRow key={record._id} hover>
                          <TableCell>{formatDate(record.datetime)}</TableCell>
                          <TableCell>{record.name}</TableCell>
                          <TableCell>
                            {record.is_check_out ? (
                              <Chip label="Đã checkout" color="info" size="small" />
                            ) : record.late_minutes !== '0:00:00' ? (
                              <Chip label="Đi muộn" color="error" size="small" />
                            ) : record.early_minutes !== '0:00:00' ? (
                              <Chip label="Đến sớm" color="success" size="small" />
                            ) : (
                              <Chip label="Đúng giờ" color="primary" size="small" />
                            )}
                          </TableCell>
                          <TableCell>
                            {record.late_minutes !== '0:00:00' ? (
                              <Typography color="error">{record.late_minutes}</Typography>
                            ) : record.early_minutes !== '0:00:00' ? (
                              <Typography color="success.main">{record.early_minutes}</Typography>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            {record.early_leave_minutes !== '0:00:00' ? (
                              <Typography color="warning.main">{record.early_leave_minutes}</Typography>
                            ) : record.late_leave_minutes !== '0:00:00' ? (
                              <Typography color="info.main">{record.late_leave_minutes}</Typography>
                            ) : "—"}
                          </TableCell>
                          <TableCell>{record.work_time || "—"}</TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body1" sx={{ py: 2 }}>
                          Không có dữ liệu điểm danh
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={attendanceRecords.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </Paper>
        </>
      )}
    </Box>
  );
}