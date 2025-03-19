import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Card, 
  CardContent,
  Stack
} from "@mui/material";

function EmployeeForm({ employee, onEmployeeSaved }) {
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [photo, setPhoto] = useState("");

  useEffect(() => {
    if (employee) {
      setName(employee.name);
      setPosition(employee.position);
      setPhoto(employee.photo || "https://via.placeholder.com/100");
    }
  }, [employee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !position) {
      alert("Vui lòng nhập đầy đủ thông tin!");
      return;
    }

    try {
      if (employee) {
        await axios.put(`http://localhost:8000/api/employees/${employee._id}/`, {
          name,
          position,
          photo,
        });
      } else {
        const response = await axios.post("http://localhost:8000/api/employees/create/", {
          name,
          position,
          photo: photo || "https://via.placeholder.com/100",
        });
        onEmployeeSaved(response.data);
      }

      setName("");
      setPosition("");
      setPhoto("");
      onEmployeeSaved(null);
    } catch (error) {
      console.error("Lỗi khi lưu nhân viên:", error);
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          {employee ? "Chỉnh Sửa Nhân Viên" : "Thêm Nhân Viên"}
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="name"
            label="Tên Nhân Viên"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="position"
            label="Chức Vụ"
            name="position"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            size="small"
          />
          <TextField
            margin="normal"
            fullWidth
            id="photo"
            label="Ảnh (URL)"
            name="photo"
            value={photo}
            onChange={(e) => setPhoto(e.target.value)}
            size="small"
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 2 }}
          >
            {employee ? "Cập Nhật" : "Thêm Nhân Viên"}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export default EmployeeForm;
