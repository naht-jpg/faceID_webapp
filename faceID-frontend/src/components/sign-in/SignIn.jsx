import React, { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Typography from '@mui/material/Typography';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { Alert, CircularProgress, Card, InputAdornment, IconButton, Container } from '@mui/material';
import { Visibility, VisibilityOff, Face as FaceIcon } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { authAPI } from '../../api';


// Tạo theme với màu sắc phù hợp hơn
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 600,
    },
  },
});

export default function SignIn() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const message = location.state?.message || '';
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleLoginSuccess = async (response) => {
    try {
      // Đăng nhập thành công, lưu token và thông tin người dùng
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
      localStorage.setItem('login_timestamp', Date.now().toString());

      // Reset lại các bộ đếm lỗi khi đăng nhập lại
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('failed_fetch_') || key === 'refresh_count' || key === 'last_refresh_time') {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));

      const userData = response.data.user || {
        name: formData.username,
        role: response.data.role || 'employee'
      };

      // Đảm bảo login hoàn tất trước khi chuyển hướng
      await login(userData);
      
      // Thêm một chút delay để đảm bảo dữ liệu được tải
      setTimeout(() => {
        if (userData.role === 'admin') {
          navigate('/dashboard');
        } else {
          navigate('/employee-portal');
        }
      }, 300);
    } catch (error) {
      console.error("Error during login completion", error);
      setErrorMessage("Lỗi xảy ra trong quá trình đăng nhập");
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await authAPI.login({
        username: formData.username,
        password: formData.password
      });
      
      await handleLoginSuccess(response);
    } catch (err) {
      console.error("Login failed:", err);
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message ||
                          'Đăng nhập không thành công. Vui lòng kiểm tra tên đăng nhập và mật khẩu.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box 
        sx={{ 
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.default',
          py: { xs: 4, md: 0 }
        }}
      >
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <Grid container component={Paper} elevation={6} sx={{ 
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: '0 8px 40px rgba(0,0,0,0.12)'
          }}>
            {/* Left panel with image */}
            <Grid
              item
              xs={false}
              sm={5}
              md={6}
              sx={{
                backgroundImage: 'url(/images/login-bg.jpg)',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  backgroundColor: 'rgba(0,0,0,0.3)',
                }
              }}
            >
              <Box sx={{ 
                position: 'relative', 
                height: '100%', 
                p: 4, 
                display: { xs: 'none', sm: 'flex' },
                flexDirection: 'column',
                justifyContent: 'flex-end',
                color: 'white'
              }}>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 2 }}>
                  FaceID Attendance
                </Typography>
                <Typography variant="body1" sx={{ maxWidth: '80%' }}>
                  Hệ thống điểm danh thông minh sử dụng công nghệ nhận diện khuôn mặt
                </Typography>
              </Box>
            </Grid>
            
            {/* Right panel with login form */}
            <Grid item xs={12} sm={7} md={6} component={Box} sx={{ display: 'flex', flexDirection: 'column' }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: { xs: 3, sm: 4, md: 5 },
                  flex: 1
                }}
              >
                {/* Logo and title */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                  <FaceIcon sx={{ color: 'primary.main', fontSize: 32, mr: 1.5 }} />
                  <Typography 
                    variant="h5" 
                    component="div" 
                    sx={{ 
                      fontWeight: 'bold',
                      color: 'primary.main',
                      letterSpacing: '0.5px'
                    }}
                  >
                    FaceID System
                  </Typography>
                </Box>
                
                {/* Welcome text */}
                <Typography component="h1" variant="h5" sx={{ mb: 1, fontWeight: 'medium' }}>
                  Đăng Nhập
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Nhập thông tin đăng nhập để truy cập hệ thống
                </Typography>
                
                {/* Messages */}
                {message && (
                  <Alert severity="success" sx={{ mb: 3, width: '100%' }}>
                    {message}
                  </Alert>
                )}
                
                {error && (
                  <Alert severity="error" sx={{ mb: 3, width: '100%' }}>
                    {error}
                  </Alert>
                )}
                
                {/* Login form */}
                <Box component="form" noValidate onSubmit={handleSubmit} sx={{ width: '100%' }}>
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    id="username"
                    label="Tên đăng nhập"
                    name="username"
                    autoComplete="username"
                    autoFocus
                    value={formData.username}
                    onChange={handleChange}
                    disabled={loading}
                    sx={{ mb: 2 }}
                    InputProps={{
                      sx: { borderRadius: 1 }
                    }}
                  />
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    name="password"
                    label="Mật khẩu"
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                    sx={{ mb: 3 }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                      sx: { borderRadius: 1 }
                    }}
                  />
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    disabled={loading}
                    sx={{ 
                      mt: 1, 
                      mb: 3, 
                      py: 1.2,
                      fontSize: '1rem',
                      borderRadius: 1,
                      boxShadow: 2,
                      '&:hover': {
                        boxShadow: 4
                      }
                    }}
                  >
                    {loading ? (
                      <CircularProgress size={24} color="inherit" />
                    ) : (
                      'Đăng Nhập'
                    )}
                  </Button>
                  
                  <Box sx={{ textAlign: 'center' }}>
                    <Link component={RouterLink} to="/register" variant="body2" sx={{ 
                      textDecoration: 'none',
                      '&:hover': {
                        textDecoration: 'underline'
                      }
                    }}>
                      Chưa có tài khoản? Đăng ký ngay
                    </Link>
                  </Box>
                </Box>
              </Box>
              
              {/* Footer */}
              <Box 
                sx={{ 
                  borderTop: '1px solid', 
                  borderColor: 'divider',
                  p: 2,
                  textAlign: 'center'
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  © {new Date().getFullYear()} FaceID Attendance System
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </ThemeProvider>
  );
}