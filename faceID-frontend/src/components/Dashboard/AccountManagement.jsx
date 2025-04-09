import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Grid, Alert, CircularProgress,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import { employeeAPI } from '../../api';
import axios from 'axios';

// API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function AccountManagement() {
  const [accounts, setAccounts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [unregisteredEmployees, setUnregisteredEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'employee',
    employee_id: ''
  });

  useEffect(() => {
    fetchAccounts();
    fetchEmployees();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL.replace('/api', '')}/api/users/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      
      // Chuyển đổi dữ liệu để hiển thị đúng trong giao diện
      const processedAccounts = response.data.map(account => ({
        _id: account._id,
        name: account.name || '',
        firstName: account.first_name || '',
        lastName: account.last_name || '',
        email: account.email || '',
        role: account.role || 'employee',
        employee_id: account.employee_id || ''
      }));
      
      setAccounts(processedAccounts);
    } catch (err) {
      setError('Không thể tải danh sách tài khoản: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      if (Array.isArray(response.data)) {
        setEmployees(response.data);
      } else {
        setEmployees([]);
      }
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };

  useEffect(() => {
    if (employees.length > 0 && accounts.length > 0) {
      // Tìm những nhân viên chưa có tài khoản
      const employeesWithoutAccounts = employees.filter(employee => 
        !accounts.some(account => account.employee_id === employee._id)
      );
      setUnregisteredEmployees(employeesWithoutAccounts);
    } else if (employees.length > 0) {
      setUnregisteredEmployees(employees);
    }
  }, [employees, accounts]);

  const handleOpenDialog = (account = null) => {
    if (account) {
      // Chế độ chỉnh sửa
      setFormData({
        name: account.name || '',
        password: '', // Không hiển thị password cũ
        email: account.email || '',
        firstName: account.first_name || '',
        lastName: account.last_name || '',
        role: account.role || 'employee',
        employee_id: account.employee_id || ''
      });
      setEditAccount(account);
    } else {
      // Chế độ tạo mới
      setFormData({
        name: '',
        password: '',
        email: '',
        firstName: '',
        lastName: '',
        role: 'employee',
        employee_id: ''
      });
      setEditAccount(null);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditAccount(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleEmployeeSelect = (e) => {
    const employeeId = e.target.value;
    const employee = employees.find(emp => emp._id === employeeId);
    
    if (employee) {
      // Thiết lập tên đăng nhập mặc định từ email hoặc tên nhân viên
      const defaultUsername = employee.email 
        ? employee.email.split('@')[0] 
        : employee.name.toLowerCase().replace(/\s+/g, '.');
        
      setFormData({
        ...formData,
        name: defaultUsername,
        firstName: employee.name.split(' ').slice(-1)[0] || '',
        lastName: employee.name.split(' ').slice(0, -1).join(' ') || '',
        email: employee.email || '',
        employee_id: employeeId
      });
    }
  };

  const handleDeleteAccount = async (accountId) => {
    if (!window.confirm('Bạn có chắc muốn xóa tài khoản này?')) return;
    
    setLoading(true);
    try {
      await axios.delete(`${API_URL.replace('/api', '')}/api/users/${accountId}/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      setSuccess('Tài khoản đã được xóa thành công');
      fetchAccounts();
    } catch (err) {
      setError('Không thể xóa tài khoản: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validate
    if (!formData.name || !formData.employee_id || (!editAccount && !formData.password)) {
      setError("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const data = {
        name: formData.name,
        email: formData.email,
        first_name: formData.firstName,  
        last_name: formData.lastName,    
        role: formData.role,
        employee_id: formData.employee_id
      };

      // Chỉ gửi password khi tạo mới hoặc khi có nhập password mới
      if (formData.password) {
        data.password = formData.password;
      }

      if (editAccount) {
        // Update existing account
        await axios.put(
          `${API_URL.replace('/api', '')}/api/users/${editAccount._id}/`,
          data,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
          }
        );
        setSuccess('Tài khoản đã được cập nhật thành công');
      } else {
        // Create new account
        await axios.post(
          `${API_URL.replace('/api', '')}/api/users/`,
          data,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
          }
        );
        setSuccess('Tài khoản đã được tạo thành công');
      }
      
      handleCloseDialog();
      fetchAccounts();
    } catch (err) {
      setError('Lỗi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAccountCreation = async () => {
    if (unregisteredEmployees.length === 0) {
      setError("Không có nhân viên nào chưa có tài khoản!");
      return;
    }
    
    if (!window.confirm(`Bạn muốn tạo ${unregisteredEmployees.length} tài khoản cho nhân viên chưa đăng ký?`)) {
      return;
    }
    
    setLoading(true);
    setError(null);
    let successCount = 0;
    let errorCount = 0;
    const createdAccountDetails = [];
    
    try {
      // Tạo các tài khoản song song
      const createPromises = unregisteredEmployees.map(async (employee) => {
        try {
          // Chuẩn hóa tên không dấu
          const normalizedName = employee.name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Loại bỏ dấu
            .toLowerCase();
          
          // Tạo username từ email hoặc từ tên
          const username = employee.email 
            ? employee.email.split('@')[0] 
            : normalizedName.replace(/\s+/g, '.');
          
          // Tạo mật khẩu thông minh: Kết hợp phần đầu của tên + 4 số cuối điện thoại
          let defaultPassword = "Welcome@123";
          if (employee.phone && employee.phone.length >= 4) {
            const lastFourDigits = employee.phone.slice(-4);
            defaultPassword = `${normalizedName.split(' ')[0]}${lastFourDigits}`;
          }
          
          // Tạo tài khoản với liên kết đến employee_id
          await axios.post(
            `${API_URL.replace('/api', '')}/api/users/`,
            {
              name: username,
              password: defaultPassword,
              email: employee.email || '',
              first_name: employee.name.split(' ').slice(-1)[0] || '',
              last_name: employee.name.split(' ').slice(0, -1).join(' ') || '',
              role: 'employee',
              employee_id: employee._id  // Đây là trường kết nối quan trọng
            },
            {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
              }
            }
          );
          
          createdAccountDetails.push({
            name: employee.name,
            username: username,
            password: defaultPassword
          });
          
          successCount++;
        } catch (err) {
          console.error(`Error creating account for ${employee.name}:`, err);
          errorCount++;
        }
      });
      
      await Promise.all(createPromises);
      
      // Hiển thị thông tin chi tiết tài khoản đã tạo
      const accountDetailsText = createdAccountDetails.map(acc => 
        `${acc.name}: Tên đăng nhập: ${acc.username}, Mật khẩu: ${acc.password}`
      ).join('\n');
      
      setSuccess(`Đã tạo thành công ${successCount} tài khoản${errorCount > 0 ? `, ${errorCount} lỗi` : ''}\n\nThông tin đăng nhập:\n${accountDetailsText}`);
      fetchAccounts();
    } catch (err) {
      setError('Lỗi khi tạo tài khoản: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Quản lý tài khoản</Typography>
        <Box>
          <Button 
            variant="outlined" 
            startIcon={<PersonAddIcon />}
            onClick={handleBulkAccountCreation}
            sx={{ mr: 1 }}
            disabled={unregisteredEmployees.length === 0}
          >
            Tạo tài khoản cho {unregisteredEmployees.length} nhân viên
          </Button>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Thêm tài khoản mới
          </Button>
        </Box>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 440 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Tên đăng nhập</TableCell>
                <TableCell>Họ tên</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Vai trò</TableCell>
                <TableCell>Hành động</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : accounts.length > 0 ? (
                accounts.map((account) => (
                  <TableRow key={account._id}>
                    <TableCell>{account.name}</TableCell>
                    <TableCell>{`${account.firstName || ''} ${account.lastName || ''}`}</TableCell>
                    <TableCell>{account.email || 'N/A'}</TableCell>
                    <TableCell>
                      {account.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}
                    </TableCell>
                    <TableCell>
                      <IconButton 
                        size="small" 
                        onClick={() => handleOpenDialog(account)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error" 
                        onClick={() => handleDeleteAccount(account._id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    Không có dữ liệu
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editAccount ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {!editAccount && (
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Chọn nhân viên</InputLabel>
                  <Select
                    value={formData.employee_id || ''}
                    onChange={handleEmployeeSelect}
                    label="Chọn nhân viên"
                  >
                    {unregisteredEmployees.map((employee) => (
                      <MenuItem key={employee._id} value={employee._id}>
                        {employee.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Tên đăng nhập"
                name="name"
                value={formData.name}
                onChange={handleChange}
                disabled={!!editAccount}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Họ"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Tên"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Mật khẩu"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                helperText={editAccount ? "Để trống nếu không muốn thay đổi mật khẩu" : ""}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Vai trò</InputLabel>
                <Select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  label="Vai trò"
                >
                  <MenuItem value="employee">Nhân viên</MenuItem>
                  <MenuItem value="admin">Quản trị viên</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Hủy</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : (editAccount ? 'Cập nhật' : 'Tạo')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}