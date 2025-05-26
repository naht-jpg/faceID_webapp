import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, TablePagination, IconButton, Chip, CircularProgress,
  Alert, Card, CardContent, Grid, ButtonGroup, Button, TextField, InputAdornment
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  AccessTime as AccessTimeIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  PictureAsPdf as PdfIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { attendanceAPI } from '../../../api';

export default function AttendanceHistoryTab({ employeeId }) {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [monthSummary, setMonthSummary] = useState({
    total: 0,
    onTime: 0,
    late: 0,
    earlyLeave: 0
  });

  useEffect(() => {
    if (employeeId) {
      fetchAttendanceHistory();
      fetchMonthlySummary();
    }
  }, [employeeId, selectedMonth]);

  const fetchAttendanceHistory = async () => {
    if (!employeeId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Lấy tháng và năm từ selectedMonth
      const year = selectedMonth.year();
      const month = selectedMonth.month() + 1; 

      const response = await attendanceAPI.getByEmployeeId(employeeId, { year, month });
      
      if (response.data && (response.data.success || Array.isArray(response.data))) {
        // Xử lý dữ liệu trả về
        const records = response.data.records || response.data || [];
        setAttendance(records);
        
        // Tính toán thống kê
        updateStatistics(records);
      } else {
        setAttendance([]);
      }
    } catch (err) {
      console.error("Error fetching attendance history:", err);
      setError("Không thể tải lịch sử điểm danh. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlySummary = async () => {
    if (!employeeId) return;
    
    try {
      const year = selectedMonth.year();
      const month = selectedMonth.month() + 1;
      
      const response = await attendanceAPI.getMonthlySummary(employeeId, year, month);
      
      if (response.data && response.data.success) {
        setMonthSummary({
          total: response.data.total || 0,
          onTime: response.data.onTime || 0,
          late: response.data.late || 0,
          earlyLeave: response.data.earlyLeave || 0
        });
      }
    } catch (err) {
      console.error("Error fetching monthly summary:", err);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleMonthChange = (newMonth) => {
    setSelectedMonth(newMonth);
  };

  // Định dạng ngày tháng để hiển thị
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      return dateString;
    }
  };

  // Lấy chip trạng thái dựa trên dữ liệu điểm danh
  const getStatusChip = (record) => {
    if (!record) return null;
    
    if (record.late_minutes && record.late_minutes !== '0:00:00') {
      return <Chip icon={<ArrowDownwardIcon />} label="Đi muộn" color="error" size="small" />;
    } else if (record.early_minutes && record.early_minutes !== '0:00:00') {
      return <Chip icon={<ArrowUpwardIcon />} label="Đến sớm" color="success" size="small" />;
    } else {
      return <Chip icon={<CheckCircleIcon />} label="Đúng giờ" color="primary" size="small" />;
    }
  };

  // Tạo các thẻ thống kê tổng quan theo tháng
  const renderSummaryCards = () => {
    return (
      <Card sx={{ mb: 3 }} elevation={3}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <CalendarIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6">
              Thống kê tháng {selectedMonth.month() + 1}/{selectedMonth.year()}
            </Typography>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={6} sm={3}>
              <Paper elevation={2} sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light', color: 'white' }}>
                <Typography variant="h5">{monthSummary.total}</Typography>
                <Typography variant="body2">Ngày làm việc</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper elevation={2} sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'white' }}>
                <Typography variant="h5">{monthSummary.onTime}</Typography>
                <Typography variant="body2">Đúng giờ</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper elevation={2} sx={{ p: 2, textAlign: 'center', bgcolor: 'error.light', color: 'white' }}>
                <Typography variant="h5">{monthSummary.late}</Typography>
                <Typography variant="body2">Đi muộn</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper elevation={2} sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light', color: 'white' }}>
                <Typography variant="h5">{monthSummary.earlyLeave}</Typography>
                <Typography variant="body2">Về sớm</Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };

  // Tạo các bộ lọc và tìm kiếm
  const renderFilters = () => {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              views={['year', 'month']}
              label="Chọn tháng"
              minDate={dayjs().subtract(1, 'year')}
              maxDate={dayjs()}
              value={selectedMonth}
              onChange={handleMonthChange}
              renderInput={(params) => <TextField {...params} helperText={null} />}
              slotProps={{
                textField: {
                  size: "small",
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
          
          <TextField
            size="small"
            placeholder="Tìm kiếm..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            size="medium"
          >
            Lọc
          </Button>
        </Box>
      </Box>
    );
  };

  // Tạo mới hàm updateStatistics nếu chưa có
  const updateStatistics = (records) => {
    if (!Array.isArray(records)) return;
    
    const stats = {
      total: records.length,
      onTime: 0,
      late: 0,
      earlyLeave: 0
    };
    
    records.forEach(record => {
      if (record.late_minutes && record.late_minutes !== '0:00:00') {
        stats.late++;
      } else {
        stats.onTime++;
      }
      
      if (record.early_leave_minutes && record.early_leave_minutes !== '0:00:00') {
        stats.earlyLeave++;
      }
    });
    
    // Cập nhật tổng quan thống kê
    setMonthSummary(stats);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Lịch sử điểm danh
      </Typography>
      
      {renderSummaryCards()}
      
      {renderFilters()}
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : (
        <Paper elevation={3}>
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Ngày</TableCell>
                  <TableCell>Giờ vào</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell>Đến sớm/muộn</TableCell>
                  <TableCell>Giờ ra</TableCell>
                  <TableCell>Về sớm/muộn</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {attendance.length > 0 ? (
                  attendance
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((record, index) => (
                      <TableRow key={index} hover>
                        <TableCell>
                          {new Date(record.datetime).toLocaleDateString('vi-VN')}
                        </TableCell>
                        <TableCell>
                          {new Date(record.datetime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell>
                          {getStatusChip(record)}
                        </TableCell>
                        <TableCell>
                          {record.late_minutes && record.late_minutes !== '0:00:00' ? (
                            <Typography color="error">{record.late_minutes}</Typography>
                          ) : record.early_minutes && record.early_minutes !== '0:00:00' ? (
                            <Typography color="success.main">{record.early_minutes}</Typography>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          {record.check_out_time ? (
                            new Date(record.check_out_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          {record.early_leave_minutes && record.early_leave_minutes !== '0:00:00' ? (
                            <Typography color="warning.main">{record.early_leave_minutes}</Typography>
                          ) : record.late_leave_minutes && record.late_leave_minutes !== '0:00:00' ? (
                            <Typography color="info.main">{record.late_leave_minutes}</Typography>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      Không có dữ liệu điểm danh cho tháng này
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={attendance.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      )}
    </Box>
  );
}