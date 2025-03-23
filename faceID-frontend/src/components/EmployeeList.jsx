import React, { useState, useEffect } from "react";
import { employeeAPI } from "../api";
import {
  Box, Card, CardContent, Typography, List, ListItem,
  ListItemAvatar, ListItemText, Avatar, IconButton,
  Divider, Grid, CircularProgress, Alert, Chip
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import WorkIcon from "@mui/icons-material/Work";
import FaceIcon from "@mui/icons-material/Face";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import EmployeeForm from "./EmployeeForm";

function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Fetching employees...");
      const response = await employeeAPI.getAll();
      console.log("API response status:", response.status);
      console.log("API response data:", response.data);
      
      // Ensure we always have an array, even with 304 status
      let employeeData;
      
      if (Array.isArray(response.data)) {
        employeeData = response.data;
      } else if (response.data && typeof response.data === 'object') {
        employeeData = response.data.employees || response.data.data || [];
        employeeData = Array.isArray(employeeData) ? employeeData : [];
      } else {
        employeeData = [];
      }
      
      console.log("Final employee data:", employeeData);
      setEmployees(employeeData);
    } catch (error) {
      console.error("Error fetching employees:", error);
      console.error("Error details:", error.response || error);
      setError("Không thể tải danh sách nhân viên. Vui lòng thử lại sau.");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
  };

  const handleDelete = async (id) => {
    try {
      await employeeAPI.delete(id);
      setEmployees(employees.filter(emp => emp._id !== id));
    } catch (error) {
      console.error("Lỗi khi xóa nhân viên:", error);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <EmployeeForm 
                employee={editingEmployee} 
                onEmployeeSaved={() => {
                  setEditingEmployee(null);
                  fetchEmployees();
                }} 
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={8}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                Danh Sách Nhân Viên
              </Typography>
              
              {loading && <CircularProgress size={24} sx={{ display: 'block', m: 'auto', my: 2 }} />}
              
              {error && (
                <Alert severity="error" sx={{ my: 2 }}>
                  {error}
                </Alert>
              )}
              
              <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
                {!loading && Array.isArray(employees) && employees.length > 0 ? (
                  employees.map((employee) => (
                    <Box key={employee._id || `emp-${Math.random()}`}>
                      <ListItem
                        alignItems="flex-start"
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
                          {employee.image_path ? (
                            <Avatar 
                              alt={employee.name} 
                              src={`${import.meta.env.VITE_API_URL}/${employee.image_path}`} 
                            />
                          ) : (
                            <Avatar><FaceIcon /></Avatar>
                          )}
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography component="span" variant="h6">
                              {employee.name} {employee.age && `(${employee.age})`}
                            </Typography>
                          }
                          secondary={
                            <React.Fragment>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <WorkIcon fontSize="small" color="action" />
                                  <Typography component="div" variant="body2">
                                    {employee.job_position || 'Không có chức vụ'}
                                  </Typography>
                                </Box>
                                
                                {employee.email && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <EmailIcon fontSize="small" color="action" />
                                    <Typography component="div" variant="body2">
                                      {employee.email}
                                    </Typography>
                                  </Box>
                                )}
                                
                                {employee.phone && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <PhoneIcon fontSize="small" color="action" />
                                    <Typography component="div" variant="body2">
                                      {employee.phone}
                                    </Typography>
                                  </Box>
                                )}
                                
                                {employee.location && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <LocationOnIcon fontSize="small" color="action" />
                                    <Typography component="div" variant="body2">
                                      {employee.location}
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                            </React.Fragment>
                          }
                        />
                      </ListItem>
                      <Divider variant="inset" component="li" />
                    </Box>
                  ))
                ) : (
                  !loading && (
                    <ListItem>
                      <ListItemText primary="Không có nhân viên nào" />
                    </ListItem>
                  )
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
