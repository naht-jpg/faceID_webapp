import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import EmployeeList from "../components/EmployeeList";
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import axios from 'axios';

function Employees() {
  const [dbStatus, setDbStatus] = useState(null);

  const checkDatabaseConnection = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/test-mongo/`);
      setDbStatus(response.data);
    } catch (error) {
      console.error("Database connection check failed:", error);
      setDbStatus({ status: 'error', message: error.message });
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Quản lý nhân viên
      </Typography>
      
      <Button 
        variant="outlined" 
        onClick={checkDatabaseConnection}
        sx={{ mb: 2 }}
      >
        Kiểm tra kết nối database
      </Button>
      
      {dbStatus && (
        <Alert 
          severity={dbStatus.status === 'success' ? 'success' : 'error'}
          sx={{ mb: 2 }}
        >
          {dbStatus.status === 'success' 
            ? `Kết nối thành công - MongoDB v${dbStatus.mongodb_version}` 
            : `Lỗi kết nối: ${dbStatus.message}`
          }
        </Alert>
      )}
      
      <EmployeeList />
    </Box>
  );
}

export default Employees;
