import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Button, Grid, Card, CardContent,
  List, ListItem, ListItemText, ListItemAvatar, Avatar,
  Divider, CircularProgress, Alert
} from '@mui/material';
import FaceIcon from '@mui/icons-material/Face';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { employeeAPI } from '../../api';
import FaceRegistration from '../FaceRegistration';

export default function FaceRegistrationTab() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [openRegistration, setOpenRegistration] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await employeeAPI.getAll();
      
      if (Array.isArray(response.data)) {
        setEmployees(response.data);
      } else if (response.data && typeof response.data === 'object') {
        const employeesArray = response.data.employees || response.data.data || [];
        setEmployees(Array.isArray(employeesArray) ? employeesArray : []);
      } else {
        setEmployees([]);
      }
    } catch (error) {
      console.error("Lỗi khi lấy danh sách nhân viên:", error);
      setError("Không thể tải danh sách nhân viên. Vui lòng thử lại sau.");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRegistration = (employee) => {
    setSelectedEmployee(employee);
    setOpenRegistration(true);
  };

  const handleCloseRegistration = () => {
    setOpenRegistration(false);
    setSelectedEmployee(null);
  };

  const handleRegistrationSuccess = () => {
    fetchEmployees();
    handleCloseRegistration();
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Đăng Ký Khuôn Mặt Nhân Viên</Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>
              Danh sách nhân viên chưa đăng ký khuôn mặt
            </Typography>
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <List>
                {employees.filter(emp => !emp.image_path).length > 0 ? (
                  employees.filter(emp => !emp.image_path).map((employee) => (
                    <React.Fragment key={employee._id}>
                      <ListItem alignItems="flex-start">
                        <ListItemAvatar>
                          <Avatar><FaceIcon /></Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={employee.name}
                          secondary={employee.job_position}
                        />
                        <Button 
                          variant="contained" 
                          color="primary" 
                          onClick={() => handleOpenRegistration(employee)}
                          startIcon={<CameraAltIcon />}
                          size="small"
                        >
                          Đăng ký
                        </Button>
                      </ListItem>
                      <Divider variant="inset" component="li" />
                    </React.Fragment>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText primary="Tất cả nhân viên đã đăng ký khuôn mặt" />
                  </ListItem>
                )}
              </List>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>
              Danh sách nhân viên đã đăng ký khuôn mặt
            </Typography>
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <List>
                {employees.filter(emp => emp.image_path).length > 0 ? (
                  employees.filter(emp => emp.image_path).map((employee) => (
                    <React.Fragment key={employee._id}>
                      <ListItem alignItems="flex-start">
                        <ListItemAvatar>
                          <Avatar src={`${import.meta.env.VITE_API_URL}/${employee.image_path}`} />
                        </ListItemAvatar>
                        <ListItemText
                          primary={employee.name}
                          secondary={employee.job_position}
                        />
                        <Button 
                          variant="outlined" 
                          color="primary" 
                          onClick={() => handleOpenRegistration(employee)}
                          startIcon={<CameraAltIcon />}
                          size="small"
                        >
                          Cập nhật
                        </Button>
                      </ListItem>
                      <Divider variant="inset" component="li" />
                    </React.Fragment>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText primary="Chưa có nhân viên đăng ký khuôn mặt" />
                  </ListItem>
                )}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
      
      {/* Dialog đăng ký khuôn mặt */}
      {openRegistration && selectedEmployee && (
        <Card sx={{ mt: 3, p: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Đăng ký khuôn mặt: {selectedEmployee.name}
              </Typography>
              <Button onClick={handleCloseRegistration} color="inherit">
                Đóng
              </Button>
            </Box>
            
            <FaceRegistration 
              employee={selectedEmployee}
              onSuccess={handleRegistrationSuccess}
            />
          </CardContent>
        </Card>
      )}
    </Box>
  );
}