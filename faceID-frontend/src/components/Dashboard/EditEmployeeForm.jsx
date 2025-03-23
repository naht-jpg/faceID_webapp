import React, { useState, useEffect } from 'react';
import { 
  Box, TextField, Button, Grid, Alert, CircularProgress 
} from '@mui/material';
import { employeeAPI } from '../../api';

export default function EditEmployeeForm({ employee, onEmployeeUpdated }) {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    location: '',
    email: '',
    phone: '',
    job_position: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (employee) {
      setFormData({
        name: employee.name || '',
        age: employee.age || '',
        location: employee.location || '',
        email: employee.email || '',
        phone: employee.phone || '',
        job_position: employee.job_position || ''
      });
    }
  }, [employee]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate inputs
    if (!formData.name || !formData.job_position) {
      setError("Vui lòng nhập tên và chức vụ");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const response = await employeeAPI.update(employee._id, formData);
      
      if (response.data.success || response.status === 200) {
        setSuccess(true);
        setTimeout(() => {
          if (onEmployeeUpdated) onEmployeeUpdated();
        }, 1000);
      } else {
        setError(response.data?.message || "Cập nhật không thành công");
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật thông tin nhân viên:", error);
      setError("Đã xảy ra lỗi khi cập nhật thông tin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Cập nhật thành công!</Alert>}
      
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            label="Họ và tên"
            name="name"
            value={formData.name}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Tuổi"
            name="age"
            type="number"
            value={formData.age}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            label="Chức vụ"
            name="job_position"
            value={formData.job_position}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Địa chỉ"
            name="location"
            value={formData.location}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Số điện thoại"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
          />
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : "Cập nhật"}
        </Button>
      </Box>
    </Box>
  );
}