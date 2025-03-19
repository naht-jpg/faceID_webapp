import { useState, useEffect } from "react";
import axios from "axios";
import EmployeeForm from "./EmployeeForm";
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Divider,
  Grid,
  Paper
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [editingEmployee, setEditingEmployee] = useState(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get("http://localhost:8000/api/employees/");
      setEmployees(response.data);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách nhân viên:", error);
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:8000/api/employees/${id}/`);
      setEmployees(employees.filter(emp => emp._id !== id));
    } catch (error) {
      console.error("Lỗi khi xóa nhân viên:", error);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <EmployeeForm 
            employee={editingEmployee} 
            onEmployeeSaved={() => {
              setEditingEmployee(null);
              fetchEmployees();
            }} 
          />
        </Grid>
        <Grid item xs={12} md={8}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                Danh Sách Nhân Viên
              </Typography>
              <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
                {employees.length > 0 ? (
                  employees.map((employee) => (
                    <Box key={employee._id}>
                      <ListItem
                        secondaryAction={
                          <Box>
                            <IconButton edge="end" aria-label="edit" onClick={() => handleEdit(employee)}>
                              <EditIcon />
                            </IconButton>
                            <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(employee._id)}>
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        }
                      >
                        <ListItemAvatar>
                          <Avatar alt={employee.name} src={employee.photo} />
                        </ListItemAvatar>
                        <ListItemText 
                          primary={employee.name} 
                          secondary={employee.position} 
                        />
                      </ListItem>
                      <Divider variant="inset" component="li" />
                    </Box>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText primary="Không có nhân viên nào" />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default EmployeeList;
