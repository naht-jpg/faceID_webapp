import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Card, 
  CardContent,
  Stack,
  Alert
} from "@mui/material";
import { employeeAPI } from "../api";



function EmployeeForm({ employee, onEmployeeSaved }) {
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    location: "",
    email: "",
    phone: "",
    job_position: "",
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (employee) {
      setFormData({
        name: employee.name || "",
        age: employee.age || "",
        location: employee.location || "",
        email: employee.email || "",
        phone: employee.phone || "",
        job_position: employee.job_position || "",
      });
    } else {
      // Reset form when not editing
      setFormData({
        name: "",
        age: "",
        location: "",
        email: "",
        phone: "",
        job_position: "",
      });
    }
  }, [employee]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    if (!formData.name || !formData.job_position) {
      setError("Vui lòng nhập tên và chức vụ!");
      return;
    }
  
    setLoading(true);
    setError(null);
    setSuccess(false);
  
    // Convert age to a number if provided
    const dataToSend = {
      ...formData,
      age: formData.age ? parseInt(formData.age, 10) : null,
    };
  
    try {
      if (employee) {
        // Update existing employee (optional improvement)
        await employeeAPI.update(employee._id, dataToSend);
      } else {
        // Create new employee
        const response = await employeeAPI.create(dataToSend);
        console.log("Employee created:", response.data);
        // Clear form after successful creation
        setFormData({
          name: "",
          age: "",
          location: "",
          email: "",
          phone: "",
          job_position: "",
        });
      }
  
      setSuccess(true);
      if (onEmployeeSaved) onEmployeeSaved();
    } catch (err) {
      console.error("Lỗi khi lưu thông tin nhân viên:", err);
      if (err.response) {
        console.error("Response data:", err.response.data);
        console.error("Response status:", err.response.status);
      }
      setError(err.response?.data?.detail || "Không thể lưu thông tin nhân viên. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          {employee ? "Cập Nhật Nhân Viên" : "Thêm Nhân Viên Mới"}
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {employee ? "Cập nhật thành công!" : "Thêm nhân viên thành công!"}
          </Alert>
        )}
        
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            margin="normal"
            required
            fullWidth
            id="name"
            label="Họ Tên"
            name="name"
            value={formData.name}
            onChange={handleChange}
            autoFocus
          />
          
          <TextField
            margin="normal"
            fullWidth
            id="age"
            label="Tuổi"
            name="age"
            type="number"
            value={formData.age}
            onChange={handleChange}
          />
          
          <TextField
            margin="normal"
            fullWidth
            id="job_position"
            label="Chức Vụ"
            name="job_position"
            required
            value={formData.job_position}
            onChange={handleChange}
          />
          
          <TextField
            margin="normal"
            fullWidth
            id="location"
            label="Địa Chỉ"
            name="location"
            value={formData.location}
            onChange={handleChange}
          />
          
          <TextField
            margin="normal"
            fullWidth
            id="email"
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
          />
          
          <TextField
            margin="normal"
            fullWidth
            id="phone"
            label="Số Điện Thoại"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
          />
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? "Đang xử lý..." : employee ? "Cập Nhật" : "Thêm Nhân Viên"}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export default EmployeeForm;
