import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, Avatar,
  Divider, Card, CardContent, Alert, Snackbar, CircularProgress,
  IconButton, InputAdornment, Chip
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Work as WorkIcon,
  Badge as BadgeIcon,
  Business as BusinessIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { useAuth } from '../../../hooks/useAuth';
import { employeeAPI } from '../../../api';

export default function ProfileTab({ userData, onProfileUpdate }) {
  const { currentUser, refreshUserData } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    job_position: '',
    department: '',
    employee_id: '',
    password: '',
    confirm_password: ''
  });

  useEffect(() => {
    if (userData) {
      setFormData({
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        job_position: userData.job_position || '',
        department: userData.department || '',
        employee_id: userData.custom_employee_id || userData.employee_id || '',
        password: '',
        confirm_password: ''
      });
    }
  }, [userData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const toggleEditing = () => {
    if (isEditing) {
      // Reset form data when canceling edit
      if (userData) {
        setFormData({
          name: userData.name || '',
          email: userData.email || '',
          phone: userData.phone || '',
          job_position: userData.job_position || '',
          department: userData.department || '',
          employee_id: userData.employee_id || '',
          password: '',
          confirm_password: ''
        });
      }
    }
    setIsEditing(!isEditing);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate passwords if provided
    if (formData.password || formData.confirm_password) {
      if (formData.password !== formData.confirm_password) {
        setError('Mật khẩu không khớp');
        return;
      }
      if (formData.password.length < 6) {
        setError('Mật khẩu phải có ít nhất 6 ký tự');
        return;
      }
    }

    setLoading(true);

    try {
      // Chuẩn bị data
      const dataToSubmit = { ...formData };
      if (!dataToSubmit.password) {
        delete dataToSubmit.password;
        delete dataToSubmit.confirm_password;
      } else {
        delete dataToSubmit.confirm_password;
      }

      console.log("Submitting data:", dataToSubmit);

      // Đảm bảo luôn dùng _id (MongoDB ID)
      const userId = userData._id;
      if (!userId) {
        setError('Không thể xác định ID nhân viên để cập nhật');
        return;
      }

      console.log("To user ID:", userId);

      // Gọi API cập nhật thông tin
      const response = await employeeAPI.update(userId, dataToSubmit);
      console.log("Update API response:", response.data);
      
      // Hiển thị thông báo thành công
      setShowSnackbar(true);
      setSnackbarMessage('Cập nhật thông tin thành công');
      setSnackbarSeverity('success');
      
      setIsEditing(false);
      
      // Cập nhật lại thông tin người dùng
      if (refreshUserData && typeof refreshUserData === 'function') {
        console.log("Calling refreshUserData...");
        const refreshResult = await refreshUserData();
        console.log("Refresh result:", refreshResult);
        
        // Cập nhật lại form data với dữ liệu mới nhất từ currentUser
        if (refreshResult && currentUser) {
          setFormData({
            name: currentUser.name || '',
            email: currentUser.email || '',
            phone: currentUser.phone || '',
            job_position: currentUser.job_position || '',
            department: currentUser.department || '',
            employee_id: currentUser.employee_id || '',
            password: '',
            confirm_password: ''
          });
        }
      }

      // Thông báo cho component cha biết dữ liệu đã được cập nhật
      if (onProfileUpdate && typeof onProfileUpdate === 'function') {
        onProfileUpdate();
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.message || err.response?.data?.error || 'Không thể cập nhật thông tin. Vui lòng thử lại sau.');
      setShowSnackbar(true);
      setSnackbarMessage('Không thể cập nhật thông tin');
      setSnackbarSeverity('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSnackbarClose = () => {
    setShowSnackbar(false);
  };

  return (
    <Box>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
            Hồ Sơ Cá Nhân
          </Typography>
          
          <Button
            variant={isEditing ? "outlined" : "contained"}
            color={isEditing ? "secondary" : "primary"}
            startIcon={isEditing ? <CancelIcon /> : <EditIcon />}
            onClick={toggleEditing}
            disabled={loading}
          >
            {isEditing ? 'Hủy' : 'Chỉnh sửa'}
          </Button>
        </Box>
        
        <Divider sx={{ mb: 4 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Left column - Personal info */}
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                <Avatar
                  sx={{
                    width: 120,
                    height: 120,
                    fontSize: 48,
                    mb: 2,
                    bgcolor: 'primary.main'
                  }}
                >
                  {formData.name?.charAt(0) || 'U'}
                </Avatar>
                <Typography variant="h6" gutterBottom>
                  {formData.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {formData.job_position}
                </Typography>
                
                {formData.employee_id && (
                  <Chip 
                    icon={<BadgeIcon />} 
                    label={formData.employee_id} 
                    color="primary" 
                    variant="outlined"
                    sx={{ mb: 1 }}
                  />
                )}
                
                {formData.department && (
                  <Chip 
                    icon={<BusinessIcon />} 
                    label={formData.department} 
                    color="default" 
                    variant="outlined"
                  />
                )}
              </Box>
            </Grid>

            {/* Right column - Editable fields */}
            <Grid item xs={12} md={8}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Họ và tên"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    disabled={!isEditing || loading}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={!isEditing || loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Số điện thoại"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    disabled={!isEditing || loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Mã nhân viên"
                    name="employee_id"
                    value={formData.employee_id}
                    onChange={handleInputChange}
                    disabled={!isEditing || loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BadgeIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                    helperText={isEditing ? "Để trống để tạo mã tự động theo phòng ban" : ""}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phòng ban"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    disabled={!isEditing || loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BusinessIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Vị trí"
                    name="job_position"
                    value={formData.job_position}
                    onChange={handleInputChange}
                    disabled={!isEditing || loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <WorkIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                
                {isEditing && (
                  <>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Thay đổi mật khẩu (không bắt buộc)
                        </Typography>
                      </Divider>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Mật khẩu mới"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleInputChange}
                        disabled={loading}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                onClick={() => setShowPassword(!showPassword)}
                                edge="end"
                              >
                                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Xác nhận mật khẩu"
                        name="confirm_password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.confirm_password}
                        onChange={handleInputChange}
                        disabled={loading}
                        error={
                          formData.password !== formData.confirm_password &&
                          formData.confirm_password !== ''
                        }
                        helperText={
                          formData.password !== formData.confirm_password &&
                          formData.confirm_password !== ''
                            ? 'Mật khẩu không khớp'
                            : ''
                        }
                      />
                    </Grid>
                  </>
                )}
                
                {isEditing && (
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                      <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                        disabled={loading}
                      >
                        {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                      </Button>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Grid>
          </Grid>
        </form>
      </Paper>
      
      {userData && (
        <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            Thông Tin Bổ Sung
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Đã tham gia từ
                  </Typography>
                  <Typography variant="body1">
                    {userData?.created_at ? new Date(userData.created_at).toLocaleDateString('vi-VN') : 'Không có thông tin'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Trạng thái FaceID
                  </Typography>
                  <Typography variant="body1">
                    {userData?.image_path ? 'Đã đăng ký' : 'Chưa đăng ký'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      )}

      <Snackbar
        open={showSnackbar}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}