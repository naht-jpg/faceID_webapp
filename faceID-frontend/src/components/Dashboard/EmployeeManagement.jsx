import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Paper, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Tab, Tabs, CircularProgress
} from '@mui/material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Face as FaceIcon, 
  Add as AddIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import FaceRegistration from '../FaceRegistration';
import AddEmployeeForm from './AddEmployeeForm';
import EditEmployeeForm from './EditEmployeeForm';
import { employeeAPI } from '../../api';
import FaceRecognitionTab from './FaceRecognitionTab';

function TabPanel({ children, value, index, ...props }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      {...props}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Sử dụng employeeAPI.getAll() để gọi endpoint /employees/
      const response = await employeeAPI.getAll();
      
      console.log("Employee data:", response.data);
      
      // Xử lý dữ liệu trả về
      if (Array.isArray(response.data)) {
        setEmployees(response.data);
      } else if (response.data && typeof response.data === 'object') {
        // Trường hợp API trả về dạng { employees: [...] } hoặc { data: [...] }
        const employeeData = response.data.employees || response.data.data || [];
        setEmployees(Array.isArray(employeeData) ? employeeData : []);
      } else {
        setEmployees([]);
      }
    } catch (error) {
      console.error("Lỗi khi lấy danh sách nhân viên:", error);
      
      if (error.response?.status === 401) {
        setError("Phiên làm việc hết hạn, vui lòng đăng nhập lại");
      } else {
        setError("Không thể tải danh sách nhân viên. Vui lòng thử lại sau.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFaceRegistration = (employee) => {
    setSelectedEmployee(employee);
    setOpenDialog(true);
  };

  const handleOpenEditDialog = (employee) => {
    setSelectedEmployee(employee);
    setOpenEditDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedEmployee(null);
  };

  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
    setSelectedEmployee(null);
  };

  const handleDeleteConfirmation = (employee) => {
    setSelectedEmployee(employee);
    setDeleteDialog(true);
  };

  const handleCancelDelete = () => {
    setDeleteDialog(false);
    setSelectedEmployee(null);
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/employees/${selectedEmployee._id}/delete/`);
      fetchEmployees();
      setDeleteDialog(false);
      setSelectedEmployee(null);
    } catch (error) {
      console.error("Lỗi khi xóa nhân viên:", error);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  const handleEmployeeAdded = () => {
    fetchEmployees();
    setTabIndex(0); // Switch back to employee list after adding
  };

  const handleEmployeeUpdated = () => {
    fetchEmployees();
    handleCloseEditDialog();
  };

  const handleFaceRegistered = () => {
    fetchEmployees();
    handleCloseDialog();
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Paper elevation={3} sx={{ p: 0 }}>
        <Tabs 
          value={tabIndex} 
          onChange={handleTabChange} 
          sx={{ borderBottom: 1, borderColor: 'divider' }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Danh sách nhân viên" />
          <Tab label="Thêm nhân viên mới" />
          <Tab label="Đăng ký khuôn mặt" />
          <Tab label="Nhận diện khuôn mặt" /> {/* Tab mới */}
        </Tabs>

        {/* Danh sách nhân viên */}
        <TabPanel value={tabIndex} index={0}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Họ tên</TableCell>
                  <TableCell>Chức vụ</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Số điện thoại</TableCell>
                  <TableCell>Khuôn mặt</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <CircularProgress size={24} sx={{ my: 1 }} />
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((employee) => (
                    <TableRow key={employee._id}>
                      <TableCell>{employee.name}</TableCell>
                      <TableCell>{employee.job_position}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.phone}</TableCell>
                      <TableCell>
                        {employee.image_path ? 'Đã đăng ký' : 'Chưa đăng ký'}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton 
                          color="primary" 
                          onClick={() => handleOpenFaceRegistration(employee)}
                          title="Đăng ký khuôn mặt"
                        >
                          <FaceIcon />
                        </IconButton>
                        <IconButton 
                          color="info" 
                          onClick={() => handleOpenEditDialog(employee)}
                          title="Sửa thông tin"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton 
                          color="error" 
                          onClick={() => handleDeleteConfirmation(employee)}
                          title="Xóa nhân viên"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
                
                {!loading && employees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      Chưa có dữ liệu nhân viên
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Form thêm nhân viên mới */}
        <TabPanel value={tabIndex} index={1}>
          <AddEmployeeForm onEmployeeAdded={handleEmployeeAdded} />
        </TabPanel>

        {/* Tab đăng ký khuôn mặt */}
        <TabPanel value={tabIndex} index={2}>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Đăng Ký Khuôn Mặt Cho Nhân Viên
            </Typography>
            
            <Typography variant="body1" paragraph>
              Chọn nhân viên từ danh sách để đăng ký khuôn mặt:
            </Typography>
            
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Họ tên</TableCell>
                    <TableCell>Chức vụ</TableCell>
                    <TableCell>Trạng thái</TableCell>
                    <TableCell align="right">Thao tác</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <CircularProgress size={24} sx={{ my: 1 }} />
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((employee) => (
                      <TableRow key={employee._id}>
                        <TableCell>{employee.name}</TableCell>
                        <TableCell>{employee.job_position}</TableCell>
                        <TableCell>
                          {employee.image_path ? 'Đã đăng ký' : 'Chưa đăng ký'}
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<FaceIcon />}
                            onClick={() => handleOpenFaceRegistration(employee)}
                          >
                            {employee.image_path ? 'Cập nhật' : 'Đăng ký'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  
                  {!loading && employees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2">Chưa có dữ liệu nhân viên</Typography>
                        <Button 
                          variant="outlined" 
                          startIcon={<PersonAddIcon />} 
                          sx={{ mt: 1 }}
                          onClick={() => setTabIndex(1)}
                        >
                          Thêm nhân viên mới
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </TabPanel>

        <TabPanel value={tabIndex} index={3}>
          <FaceRecognitionTab />
        </TabPanel>
      </Paper>

      {/* Dialog đăng ký khuôn mặt */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Đăng ký khuôn mặt cho {selectedEmployee?.name}
        </DialogTitle>
        <DialogContent>
          {selectedEmployee && (
            <FaceRegistration 
              employee={selectedEmployee} 
              onSuccess={handleFaceRegistered}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Đóng</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog chỉnh sửa thông tin nhân viên */}
      <Dialog
        open={openEditDialog}
        onClose={handleCloseEditDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Chỉnh sửa thông tin {selectedEmployee?.name}
        </DialogTitle>
        <DialogContent>
          {selectedEmployee && (
            <Box sx={{ pt: 2 }}>
              <EditEmployeeForm 
                employee={selectedEmployee}
                onEmployeeUpdated={handleEmployeeUpdated}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog xác nhận xóa */}
      <Dialog 
        open={deleteDialog} 
        onClose={handleCancelDelete}
      >
        <DialogTitle>
          Xác nhận xóa nhân viên
        </DialogTitle>
        <DialogContent>
          <Typography>
            Bạn có chắc chắn muốn xóa nhân viên {selectedEmployee?.name}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Hủy</Button>
          <Button onClick={handleDelete} color="error">Xóa</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}