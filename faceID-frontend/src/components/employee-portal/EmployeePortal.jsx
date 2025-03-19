import * as React from 'react';
import { useState } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import LogoutIcon from '@mui/icons-material/Logout';
import FaceIcon from '@mui/icons-material/Face';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Divider from '@mui/material/Divider';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import MenuIcon from '@mui/icons-material/Menu';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AppTheme from '../shared-theme/AppTheme';
import { useAuth } from '../../AuthContext';
import { useNavigate } from 'react-router-dom';
import FaceRecognition from '../../FaceRecognition';

function Footer() {
  return (
    <Box sx={{ bgcolor: 'background.paper', p: { xs: 2, sm: 4, md: 6 } }} component="footer">
      <Typography variant="h6" align="center" gutterBottom>
        Face ID System
      </Typography>
      <Typography
        variant="subtitle1"
        align="center"
        color="text.secondary"
        component="p"
      >
        Hệ thống nhận diện khuôn mặt thông minh
      </Typography>
      <Typography variant="body2" color="text.secondary" align="center">
        {'Copyright © '}
        Face ID System {new Date().getFullYear()}
        {'.'}
      </Typography>
    </Box>
  );
}

export default function EmployeePortal(props) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = React.useState(false);
  
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [attendanceSuccess, setAttendanceSuccess] = useState(false);

  const handleRecognitionResult = (result) => {
    setRecognitionResult(result);
    
    if (result.success) {
      setAttendanceSuccess(true);
      // Cập nhật thông tin điểm danh thành công
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar position="static" color="primary">
          <Toolbar>
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
              {isMobile && (
                <IconButton
                  color="inherit"
                  aria-label="open drawer"
                  edge="start"
                  onClick={handleDrawerToggle}
                  sx={{ mr: 1 }}
                >
                  <MenuIcon />
                </IconButton>
              )}
              <FaceIcon sx={{ mr: 1 }} />
              <Typography 
                variant={isMobile ? "subtitle1" : "h6"} 
                color="inherit" 
                noWrap
                sx={{ flexGrow: 1 }}
              >
                Portal Nhân Viên
              </Typography>
            </Box>
            
            {currentUser && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
                {!isMobile && (
                  <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
                    {currentUser.name}
                  </Typography>
                )}
                <Avatar sx={{ bgcolor: 'secondary.main', width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 } }}>
                  {currentUser.name.charAt(0)}
                </Avatar>
                <IconButton 
                  color="inherit" 
                  onClick={handleLogout}
                  size={isMobile ? "small" : "medium"}
                >
                  <LogoutIcon />
                </IconButton>
              </Box>
            )}
          </Toolbar>
        </AppBar>
        
        <Container component="main" maxWidth="lg" sx={{ mt: { xs: 2, sm: 3, md: 4 }, mb: { xs: 2, sm: 3, md: 4 }, flexGrow: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Paper 
                elevation={3} 
                sx={{ 
                  p: { xs: 2, sm: 3 }, 
                  borderRadius: 2,
                  overflow: 'hidden'
                }}
              >
                <Typography 
                  component="h1" 
                  variant={isMobile ? "h5" : "h4"} 
                  align="center" 
                  gutterBottom
                >
                  Hệ thống nhận diện khuôn mặt
                </Typography>
                
                <Typography 
                  variant={isMobile ? "subtitle1" : "h5"} 
                  align="center" 
                  color="text.secondary" 
                  sx={{ mb: { xs: 2, sm: 3, md: 4 } }}
                >
                  Xin chào {currentUser?.name}! Sử dụng hệ thống điểm danh thông minh.
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={8}>
              <Card 
                elevation={2} 
                sx={{ 
                  p: { xs: 1, sm: 2 }, 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <CardContent sx={{ flex: '1 0 auto' }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <Typography variant="h6" gutterBottom align="center">
                      Điểm danh nhanh chóng
                    </Typography>
                    <Box 
                      sx={{ 
                        width: '100%', 
                        maxWidth: isMobile ? '100%' : 500, 
                        my: { xs: 1, sm: 2 }, 
                        mx: 'auto',
                        aspectRatio: '4/3',
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: '8px',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                      }}
                    >
                      {!attendanceSuccess ? (
                        <FaceRecognition onRecognitionResult={handleRecognitionResult} />
                      ) : (
                        <Box 
                          sx={{ 
                            width: '100%', 
                            height: '100%', 
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 2,
                            bgcolor: 'success.light',
                            color: 'white'
                          }}
                        >
                          <CheckCircleIcon sx={{ fontSize: 80, mb: 2 }} />
                          <Typography variant="h6" align="center" gutterBottom>
                            Điểm danh thành công!
                          </Typography>
                          <Typography variant="body2" align="center">
                            Xin chào, {recognitionResult?.name}
                          </Typography>
                          <Typography variant="body2" align="center">
                            Thời gian: {new Date(recognitionResult?.timestamp).toLocaleString()}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <Typography variant="body1" align="center" sx={{ mt: 1 }}>
                      Nhìn vào camera để điểm danh
                    </Typography>
                  </Box>
                </CardContent>
                <CardActions sx={{ justifyContent: 'center', pt: 0, pb: { xs: 2, sm: 3 }, flexWrap: 'wrap', gap: 1 }}>
                  <Button 
                    variant="contained" 
                    sx={{ 
                      minWidth: { xs: '120px', sm: '150px' }, 
                      px: { xs: 1, sm: 2 }
                    }}
                  >
                    Điểm danh
                  </Button>
                  <Button 
                    variant="outlined"
                    sx={{ 
                      minWidth: { xs: '120px', sm: '150px' }, 
                      px: { xs: 1, sm: 2 }
                    }}
                  >
                    Xem lịch sử
                  </Button>
                </CardActions>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Thông tin điểm danh
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AccessTimeIcon color="primary" />
                      <Typography variant="body2">
                        <strong>Thời gian điểm danh:</strong> 08:05:23 19/03/2025
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon color="success" />
                      <Typography variant="body2">
                        <strong>Trạng thái:</strong> Đúng giờ
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarTodayIcon color="info" />
                      <Typography variant="body2">
                        <strong>Số ngày làm việc:</strong> 15/22 ngày
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
        
        <Footer />
      </Box>
    </AppTheme>
  );
}