import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Card, CardContent, Chip, Alert, CircularProgress,
  IconButton, Stack, Divider, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, Select, InputAdornment
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  Calculate as CalculateIcon,
  FileDownload as ExportIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon,
  MonetizationOn as SalaryIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
  DateRange as DateRangeIcon
} from '@mui/icons-material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { attendanceAPI, employeeAPI } from '../../api';
import * as XLSX from 'xlsx';

export default function SalaryCalculationTab() {
  // State variables
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().subtract(1, 'month'));
  const [employees, setEmployees] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [salaryData, setSalaryData] = useState([]);
  const [dailyDetails, setDailyDetails] = useState({});
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [hourlyRate, setHourlyRate] = useState(50000);
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [openSettingsDialog, setOpenSettingsDialog] = useState(false);
  const [workHourStart, setWorkHourStart] = useState('07:00');
  const [workHourEnd, setWorkHourEnd] = useState('16:00');
  const [totalSalary, setTotalSalary] = useState(0);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);

  // Fetch employees when component mounts
  useEffect(() => {
    fetchEmployees();
  }, []);

  // Fetch employee data
  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await employeeAPI.getAll();
      if (Array.isArray(response.data)) {
        setEmployees(response.data);
        
        // Extract unique departments for filtering
        const deptSet = new Set(response.data
          .map(emp => emp.department || 'Không xác định')
          .filter(Boolean));
        setDepartments(Array.from(deptSet));
      } else {
        setEmployees([]);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      setError("Không thể tải danh sách nhân viên");
    } finally {
      setLoading(false);
    }
  };

  // Fetch attendance data for the selected month
  const fetchAttendanceData = async () => {
    setLoading(true);
    setError(null);
    setAttendanceData([]);
    
    try {
      const year = selectedMonth.year();
      const month = selectedMonth.month() + 1; // dayjs months are 0-indexed
      
      // Since we need data for all employees, we'll make multiple API calls
      const allAttendanceData = [];
      
      // Filter employees by department if needed
      const employeesToProcess = departmentFilter === 'all' 
        ? employees 
        : employees.filter(emp => emp.department === departmentFilter);
      
      // Show progress message
      setSuccessMessage(`Đang tải dữ liệu điểm danh cho ${employeesToProcess.length} nhân viên...`);
      
      for (const employee of employeesToProcess) {
        const employeeId = employee._id;
        try {
          const response = await attendanceAPI.getByEmployeeId(employeeId, { year, month });
          
          if (response.data && (response.data.success || Array.isArray(response.data))) {
            const records = response.data.records || response.data || [];
            // Add employee info to each record
            const processedRecords = records.map(record => ({
              ...record,
              employee_name: employee.name,
              employee_id: employeeId,  // MongoDB ID
              custom_employee_id: employee.employee_id || employee.custom_employee_id || 'N/A', // Mã nhân viên theo phòng ban
              department: employee.department || 'Không xác định'
            }));
            
            allAttendanceData.push(...processedRecords);
          }
        } catch (err) {
          console.error(`Error fetching attendance for employee ${employee.name}:`, err);
        }
      }
      
      setAttendanceData(allAttendanceData);
      setSuccessMessage(`Đã tải ${allAttendanceData.length} bản ghi điểm danh`);
      setTimeout(() => setSuccessMessage(null), 3000);
      return allAttendanceData;
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      setError("Không thể tải dữ liệu điểm danh");
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Parse time string (HH:MM:SS) to minutes
  const parseTime = (timeStr) => {
    if (!timeStr || timeStr === '0:00:00') {
      return 0;
    }
    
    try {
      const timeParts = timeStr.split(':');
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);
      const seconds = timeParts.length > 2 ? parseFloat(timeParts[2]) : 0;
      const totalMinutes = hours * 60 + minutes + seconds / 60;
      return totalMinutes;
    } catch (e) {
      console.error(`Error parsing time string '${timeStr}':`, e);
      return 0;
    }
  };

  // Calculate standard work hours based on work hour settings
  const calculateStandardWorkHours = () => {
    try {
      const startTime = workHourStart.split(':').map(Number);
      const endTime = workHourEnd.split(':').map(Number);
      
      const startMinutes = startTime[0] * 60 + startTime[1];
      const endMinutes = endTime[0] * 60 + endTime[1];
      
      // Calculate difference in minutes, then convert to hours
      const workMinutes = endMinutes - startMinutes;
      return workMinutes / 60;
    } catch (error) {
      console.error("Error calculating standard work hours:", error);
      return 9; // Default to 9 hours if calculation fails
    }
  };

  // Calculate salary based on attendance data
  const calculateSalary = async () => {
    setCalculating(true);
    setError(null);
    
    try {
      // Fetch fresh attendance data if not already loaded
      const data = attendanceData.length > 0 ? attendanceData : await fetchAttendanceData();
      
      if (data.length === 0) {
        setError("Không có dữ liệu điểm danh cho tháng đã chọn");
        setCalculating(false);
        return;
      }
      
      // Object to store salary data by employee
      const salaryByEmployee = {};
      
      // Object to store daily details by employee
      const detailsByEmployee = {};
      
      // Get standard work hours from settings
      const standardWorkHours = calculateStandardWorkHours();
      console.log(`Standard work hours: ${standardWorkHours}`);
      
      // Process each attendance record
      data.forEach(record => {
        const employeeId = record.employee_id;
        const employeeName = record.employee_name;
        const department = record.department;
        
        // Skip records without employee info
        if (!employeeId || !employeeName) return;
        
        // Format date for display
        const recordDate = new Date(record.datetime);
        const dateStr = recordDate.toLocaleDateString('vi-VN');
        
        // Calculate work hours
        const lateMinutes = parseTime(record.late_minutes);
        const earlyLeaveMinutes = parseTime(record.early_leave_minutes);
        const lateLeaveMinutes = parseTime(record.late_leave_minutes);
        
        // Calculate work duration if check_out_time exists
        let workHours = 0;
        
        if (record.check_out_time) {
          const checkInTime = new Date(record.datetime);
          const checkOutTime = new Date(record.check_out_time);
          
          // Calculate work duration in hours
          const diffMs = checkOutTime - checkInTime;
          workHours = diffMs / (1000 * 60 * 60); // convert ms to hours
        } else {
          // If no checkout, calculate based on the standard formula from Python code
          workHours = standardWorkHours - (lateMinutes + earlyLeaveMinutes) / 60 + lateLeaveMinutes / 60;
        }
        
        // Round to 2 decimal places
        workHours = Math.round(workHours * 100) / 100;
        
        // Calculate daily salary
        const dailySalary = workHours * hourlyRate;
        
        // Initialize employee data if not exists
        if (!salaryByEmployee[employeeId]) {
          salaryByEmployee[employeeId] = {
            id: employeeId,  
            custom_id: record.custom_employee_id || 'N/A',  
            name: employeeName,
            department: department,
            totalHours: 0,
            totalSalary: 0,
            daysWorked: new Set()
          };
          detailsByEmployee[employeeId] = {};
        }
        
        // Update totals
        salaryByEmployee[employeeId].totalHours += workHours;
        salaryByEmployee[employeeId].totalSalary += dailySalary;
        salaryByEmployee[employeeId].daysWorked.add(dateStr);
        
        // Store daily details
        detailsByEmployee[employeeId][dateStr] = {
          date: dateStr,
          checkIn: recordDate.toLocaleTimeString('vi-VN'),
          checkOut: record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString('vi-VN') : 'Không có',
          lateMinutes: lateMinutes > 0 ? `${lateMinutes} phút` : '-',
          earlyLeaveMinutes: earlyLeaveMinutes > 0 ? `${earlyLeaveMinutes} phút` : '-',
          lateLeaveMinutes: lateLeaveMinutes > 0 ? `${lateLeaveMinutes} phút` : '-',
          workHours,
          dailySalary
        };
      });
      
      // Convert to array for table
      const salaryDataArray = Object.values(salaryByEmployee).map(emp => ({
        ...emp,
        daysWorked: emp.daysWorked.size,
        totalHours: Math.round(emp.totalHours * 100) / 100,
        totalSalary: Math.round(emp.totalSalary)
      }));
      
      // Calculate grand total for all employees
      const grandTotal = salaryDataArray.reduce((sum, emp) => sum + emp.totalSalary, 0);
      setTotalSalary(grandTotal);
      
      // Update state
      setSalaryData(salaryDataArray);
      setDailyDetails(detailsByEmployee);
      
      setSuccessMessage(`Đã tính lương thành công cho ${salaryDataArray.length} nhân viên`);
      setTimeout(() => setSuccessMessage(null), 5000);
      
    } catch (error) {
      console.error("Error calculating salary:", error);
      setError("Lỗi khi tính toán lương: " + error.message);
    } finally {
      setCalculating(false);
    }
  };

  // Handle month change
  const handleMonthChange = (newMonth) => {
    setSelectedMonth(newMonth);
    setAttendanceData([]);
    setSalaryData([]);
    setDailyDetails({});
  };

  // Handle hourly rate change
  const handleHourlyRateChange = (event) => {
    const newRate = parseFloat(event.target.value);
    if (!isNaN(newRate) && newRate > 0) {
      setHourlyRate(newRate);
    }
  };

  // Handle work hour change
  const handleWorkHourChange = (type, value) => {
    if (type === 'start') {
      setWorkHourStart(value);
    } else {
      setWorkHourEnd(value);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  // Handle view employee details
  const handleViewDetails = (employee) => {
    setSelectedEmployee(employee);
    setOpenDetailDialog(true);
  };

  // Handle pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Export to Excel
  const exportToExcel = () => {
    try {
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Add summary worksheet
      const summaryData = salaryData.map(employee => ({
        'Mã NV': employee.id,
        'Họ và tên': employee.name,
        'Phòng ban': employee.department,
        'Số ngày làm việc': employee.daysWorked,
        'Tổng giờ làm': employee.totalHours,
        'Lương theo giờ (VND)': hourlyRate,
        'Tổng lương (VND)': employee.totalSalary,
      }));
      
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Bảng Lương Tổng Hợp');
      
      // Add grand total row
      XLSX.utils.sheet_add_aoa(summaryWs, [
        ['Tổng cộng:', '', '', '', '', '', totalSalary]
      ], { origin: -1 });
      
      // Add details worksheets for each employee
      salaryData.forEach(employee => {
        if (dailyDetails[employee.id]) {
          const details = Object.values(dailyDetails[employee.id]);
          
          if (details.length > 0) {
            const detailsData = details.map(detail => ({
              'Ngày': detail.date,
              'Giờ vào': detail.checkIn,
              'Giờ ra': detail.checkOut,
              'Đi muộn': detail.lateMinutes,
              'Về sớm': detail.earlyLeaveMinutes,
              'Làm thêm': detail.lateLeaveMinutes,
              'Số giờ làm': detail.workHours,
              'Lương ngày (VND)': detail.dailySalary,
            }));
            
            const detailsWs = XLSX.utils.json_to_sheet(detailsData);
            XLSX.utils.book_append_sheet(wb, detailsWs, `${employee.name.slice(0, 30)}`);
          }
        }
      });
      
      // Save to file
      const monthYear = selectedMonth.format('MM-YYYY');
      const fileName = `Bang_Luong_${monthYear}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      setSuccessMessage('Đã xuất file Excel thành công!');
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      setError("Lỗi khi xuất file Excel: " + error.message);
    }
  };

  return (
    <Box sx={{ py: 3 }}>
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <SalaryIcon sx={{ fontSize: 28, color: 'primary.main', mr: 1 }} />
          <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
            Tính Lương Nhân Viên
          </Typography>
          
          <IconButton 
            color="primary" 
            onClick={() => setOpenSettingsDialog(true)}
            sx={{ mr: 1 }}
          >
            <SettingsIcon />
          </IconButton>
        </Box>
        
        <Divider sx={{ mb: 3 }} />
        
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={3}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                views={['year', 'month']}
                label="Tháng tính lương"
                minDate={dayjs().subtract(2, 'year')}
                maxDate={dayjs()}
                value={selectedMonth}
                onChange={handleMonthChange}
                slotProps={{
                  textField: { 
                    fullWidth: true,
                    InputProps: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <DateRangeIcon />
                        </InputAdornment>
                      )
                    }
                  }
                }}
              />
            </LocalizationProvider>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <TextField
              label="Đơn giá (VND/giờ)"
              type="number"
              value={hourlyRate}
              onChange={handleHourlyRateChange}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SalaryIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Lọc theo phòng ban</InputLabel>
              <Select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                label="Lọc theo phòng ban"
              >
                <MenuItem value="all">Tất cả phòng ban</MenuItem>
                {departments.map((dept) => (
                  <MenuItem key={dept} value={dept}>
                    {dept}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={calculateSalary}
                disabled={calculating || loading}
                startIcon={<CalculateIcon />}
                fullWidth
              >
                {calculating ? 'Đang tính...' : 'Tính lương'}
              </Button>
              
              <Button
                variant="outlined"
                onClick={fetchAttendanceData}
                disabled={loading || calculating}
                startIcon={<RefreshIcon />}
              >
                Tải dữ liệu
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {successMessage && (
        <Alert 
          severity="success" 
          sx={{ mb: 3 }}
          onClose={() => setSuccessMessage(null)}
        >
          {successMessage}
        </Alert>
      )}
      
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}
      
      {loading || calculating ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
          <CircularProgress size={60} thickness={5} />
        </Box>
      ) : salaryData.length > 0 ? (
        <>
          <Paper elevation={1} sx={{ mb: 3 }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'primary.main', color: 'white' }}>
              <Typography variant="h6">
                Bảng Lương Tháng {selectedMonth.format('MM/YYYY')}
              </Typography>
              
              <Box>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={exportToExcel}
                  startIcon={<ExportIcon />}
                  sx={{ mr: 1 }}
                >
                  Xuất Excel
                </Button>
                
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => window.print()}
                  startIcon={<PrintIcon />}
                >
                  In báo cáo
                </Button>
              </Box>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>STT</TableCell>
                    <TableCell>Mã NV</TableCell>
                    <TableCell>Họ và tên</TableCell>
                    <TableCell>Phòng ban</TableCell>
                    <TableCell align="center">Ngày làm việc</TableCell>
                    <TableCell align="center">Giờ làm việc</TableCell>
                    <TableCell align="right">Tổng lương</TableCell>
                    <TableCell align="center">Chi tiết</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {salaryData
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((employee, index) => (
                      <TableRow key={employee.id} hover>
                        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                        <TableCell>{employee.id}</TableCell>
                        <TableCell>{employee.name}</TableCell>
                        <TableCell>{employee.department}</TableCell>
                        <TableCell align="center">{employee.daysWorked}</TableCell>
                        <TableCell align="center">{employee.totalHours.toFixed(2)}</TableCell>
                        <TableCell align="right">
                          {formatCurrency(employee.totalSalary)}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            color="primary"
                            onClick={() => handleViewDetails(employee)}
                          >
                            <InfoIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  
                  {/* Summary row */}
                  <TableRow sx={{ bgcolor: 'rgba(0, 0, 0, 0.04)' }}>
                    <TableCell colSpan={5} align="right">
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        Tổng cộng:
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {salaryData.reduce((sum, emp) => sum + emp.totalHours, 0).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(totalSalary)}
                      </Typography>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={salaryData.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </Paper>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Thông tin tính lương
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Tháng tính lương
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {selectedMonth.format('MM/YYYY')}
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Đơn giá lương theo giờ
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {formatCurrency(hourlyRate)}/giờ
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Giờ làm việc tiêu chuẩn
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {workHourStart} - {workHourEnd} ({calculateStandardWorkHours()} giờ/ngày)
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Tổng số nhân viên
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {salaryData.length} nhân viên
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Tổng quỹ lương
                      </Typography>
                      <Typography variant="body1" fontWeight="medium" color="primary.main">
                        {formatCurrency(totalSalary)}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={8}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Cách tính lương
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Typography variant="body2" paragraph>
                    Lương của nhân viên được tính theo số giờ làm việc thực tế, dựa trên dữ liệu điểm danh.
                  </Typography>
                  
                  <Box component="ul" sx={{ pl: 2 }}>
                    <Typography component="li" variant="body2" paragraph>
                      <strong>Giờ làm tiêu chuẩn:</strong> {calculateStandardWorkHours()} giờ/ngày ({workHourStart} - {workHourEnd})
                    </Typography>
                    
                    <Typography component="li" variant="body2" paragraph>
                      <strong>Lương theo giờ:</strong> {formatCurrency(hourlyRate)}/giờ
                    </Typography>
                    
                    <Typography component="li" variant="body2" paragraph>
                      <strong>Tính giờ làm:</strong> Giờ làm tiêu chuẩn - Thời gian đi muộn - Thời gian về sớm + Thời gian làm thêm
                    </Typography>
                    
                    <Typography component="li" variant="body2" paragraph>
                      <strong>Tính lương ngày:</strong> Số giờ làm × Lương theo giờ
                    </Typography>
                    
                    <Typography component="li" variant="body2">
                      <strong>Tổng lương tháng:</strong> Tổng lương của các ngày làm việc trong tháng
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      ) : (
        <Paper 
          elevation={0}
          sx={{ 
            p: 5, 
            textAlign: 'center',
            border: '1px dashed',
            borderColor: 'divider'
          }}
        >
          <CalculateIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Chưa có dữ liệu lương
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Vui lòng chọn tháng và nhấn "Tính lương" để xem bảng lương nhân viên
          </Typography>
          <Button
            variant="contained"
            onClick={calculateSalary}
            disabled={calculating || loading}
            startIcon={<CalculateIcon />}
          >
            Tính lương ngay
          </Button>
        </Paper>
      )}
      
      {/* Employee detail dialog */}
      <Dialog
        open={openDetailDialog}
        onClose={() => setOpenDetailDialog(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              Chi tiết lương: {selectedEmployee?.name}
            </Typography>
            <IconButton onClick={() => setOpenDetailDialog(false)}>
              <InfoIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent dividers>
          {selectedEmployee && (
            <>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Nhân viên
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {selectedEmployee.name}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Phòng ban
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {selectedEmployee.department}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Số ngày làm việc
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {selectedEmployee.daysWorked} ngày
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Tổng giờ làm việc
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {selectedEmployee.totalHours.toFixed(2)} giờ
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Tổng lương
                  </Typography>
                  <Typography variant="body1" fontWeight="medium" color="primary.main">
                    {formatCurrency(selectedEmployee.totalSalary)}
                  </Typography>
                </Grid>
              </Grid>
              
              <Typography variant="subtitle1" gutterBottom>
                Chi tiết theo ngày:
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Ngày</TableCell>
                      <TableCell>Giờ vào</TableCell>
                      <TableCell>Giờ ra</TableCell>
                      <TableCell>Đi muộn</TableCell>
                      <TableCell>Về sớm</TableCell>
                      <TableCell>Làm thêm</TableCell>
                      <TableCell align="right">Giờ làm</TableCell>
                      <TableCell align="right">Lương ngày</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dailyDetails[selectedEmployee.id] ? (
                      Object.values(dailyDetails[selectedEmployee.id])
                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                        .map((detail) => (
                          <TableRow key={detail.date} hover>
                            <TableCell>{detail.date}</TableCell>
                            <TableCell>{detail.checkIn}</TableCell>
                            <TableCell>{detail.checkOut}</TableCell>
                            <TableCell>{detail.lateMinutes}</TableCell>
                            <TableCell>{detail.earlyLeaveMinutes}</TableCell>
                            <TableCell>{detail.lateLeaveMinutes}</TableCell>
                            <TableCell align="right">{detail.workHours.toFixed(2)}</TableCell>
                            <TableCell align="right">{formatCurrency(detail.dailySalary)}</TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          Không có dữ liệu chi tiết
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button 
            variant="outlined" 
            onClick={() => setOpenDetailDialog(false)}
          >
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Settings dialog */}
      <Dialog
        open={openSettingsDialog}
        onClose={() => setOpenSettingsDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <SettingsIcon sx={{ mr: 1 }} />
            Cài đặt tính lương
          </Box>
        </DialogTitle>
        
        <DialogContent dividers>
          <Typography variant="subtitle2" gutterBottom>
            Giờ làm việc tiêu chuẩn
          </Typography>
          
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6}>
              <TextField
                label="Giờ bắt đầu"
                type="time"
                value={workHourStart}
                onChange={(e) => handleWorkHourChange('start', e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: 300 }}
                fullWidth
              />
            </Grid>
            
            <Grid item xs={6}>
              <TextField
                label="Giờ kết thúc"
                type="time"
                value={workHourEnd}
                onChange={(e) => handleWorkHourChange('end', e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: 300 }}
                fullWidth
              />
            </Grid>
          </Grid>
          
          <Typography variant="subtitle2" gutterBottom>
            Đơn giá lương
          </Typography>
          
          <TextField
            label="Lương theo giờ (VND)"
            type="number"
            value={hourlyRate}
            onChange={handleHourlyRateChange}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SalaryIcon />
                </InputAdornment>
              )
            }}
          />
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setOpenSettingsDialog(false)}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}