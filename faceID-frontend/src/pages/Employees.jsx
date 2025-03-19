import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import EmployeeList from "../components/EmployeeList";

function Employees() {
  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Quản lý nhân viên
      </Typography>
      <EmployeeList />
    </Box>
  );
}

export default Employees;
