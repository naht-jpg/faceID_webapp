import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Alert, Paper, TextField, Grid, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  IconButton, CircularProgress, Dialog, DialogTitle, DialogContent, 
  DialogActions, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, Add as AddIcon } from '@mui/icons-material';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function AccountManagement() {
  const [accounts, setAccounts] = useState([]);
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
    role: 'employee'
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/signin/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      setAccounts(response.data);
    } catch (err) {
      setError('Không thể tải danh sách tài khoản: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (account = null) => {
    if (account) {
      setFormData({
        name: account.name,
        password: '',
        email: account.email || '',
        firstName: account.firstName || '',
        lastName: account.lastName || '',
        role: account.role || 'employee'
      });
      setEditAccount(account);
    } else {
      setFormData({
        name: '',
        password: '',
        email: '',
        firstName: '',
        lastName: '',
        role: 'employee'
      });
      setEditAccount(null);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = {
        name: formData.name,
        password: formData.password,
        email: formData.email,
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: formData.role
      };

      let response;
      if (editAccount) {
        // Update existing account
        response = await axios.put(
          `${API_URL}/api/accounts/${editAccount._id}/`,
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
        response = await axios.post(
          `${API_URL}/api/signin/`,
          data,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
          }
        );
        setSuccess('Tài khoản mới đã được tạo thành công');
      }
      
      handleCloseDialog();
      fetchAccounts();
    } catch (err) {
      setError('Lỗi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (accountId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) {
      return;
    }
    
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/api/signin/${accountId}/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      fetchAccounts();
      setSuccess('Tài khoản đã được xóa thành công');
    } catch (err) {
      setError('Không thể xóa tài khoản: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Quản lý tài khoản</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Thêm tài khoản mới
        </Button>
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
                        onClick={() => handleDelete(account._id)}
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