import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Grid, Card,
  CardContent, CircularProgress, Alert, List,
  ListItem, ListItemText, Switch, IconButton,
  TextField, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, Divider, Tooltip,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import InfoIcon from '@mui/icons-material/Info';
import { workScheduleAPI } from '../../api';

export default function WorkScheduleTab() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [editingSchedule, setEditingSchedule] = useState(null);
  
  const [scheduleName, setScheduleName] = useState('');
  const [startHour, setStartHour] = useState(7);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(17);
  const [endMinute, setEndMinute] = useState(0);
  const [isActive, setIsActive] = useState(false);
  
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState(null);
  
  // Tải danh sách lịch làm việc khi component được mount
  useEffect(() => {
    fetchSchedules();
  }, []);
  
  const fetchSchedules = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await workScheduleAPI.getAll();
      console.log("Work schedules response:", response.data);
      
      if (response.data && response.data.success) {
        setSchedules(response.data.schedules || []);
        // Tìm lịch làm việc đang hoạt động
        const activeSchedule = response.data.schedules.find(s => s.is_active);
        if (activeSchedule) {
          setActiveId(activeSchedule._id);
        }
      } else {
        setError('Không thể tải danh sách lịch làm việc');
      }
    } catch (err) {
      console.error("Error fetching schedules:", err);
      setError('Lỗi khi tải danh sách lịch làm việc: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  const handleOpenAddDialog = () => {
    setScheduleName('Lịch làm việc mới');
    setStartHour(7);
    setStartMinute(0);
    setEndHour(17);
    setEndMinute(0);
    setIsActive(false);
    setDialogMode('add');
    setOpenDialog(true);
  };
  
  const handleOpenEditDialog = (schedule) => {
    setEditingSchedule(schedule);
    setScheduleName(schedule.name);
    setStartHour(schedule.start_hour);
    setStartMinute(schedule.start_minute);
    setEndHour(schedule.end_hour);
    setEndMinute(schedule.end_minute);
    setIsActive(schedule.is_active || false);
    setDialogMode('edit');
    setOpenDialog(true);
  };
  
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingSchedule(null);
  };
  
  const handleOpenDeleteDialog = (schedule) => {
    setScheduleToDelete(schedule);
    setOpenDeleteDialog(true);
  };
  
  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setScheduleToDelete(null);
  };
  
  const handleSetActive = async (scheduleId) => {
    setLoading(true);
    setError(null);
    try {
      const targetSchedule = schedules.find(s => s._id === scheduleId);
      if (targetSchedule) {
        const response = await workScheduleAPI.update(scheduleId, {
          ...targetSchedule,
          is_active: true
        });
        
        if (response.data && response.data.success) {
          setActiveId(scheduleId);
          fetchSchedules(); 
        } else {
          setError('Không thể cập nhật trạng thái lịch làm việc');
        }
      }
    } catch (err) {
      console.error("Error setting active schedule:", err);
      setError('Lỗi khi cập nhật trạng thái lịch làm việc: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmitForm = async () => {
    // Xác thực dữ liệu
    if (!scheduleName.trim()) {
      setError('Tên lịch làm việc không được để trống');
      return;
    }
    
    if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
      setError('Giờ phải trong khoảng từ 0 đến 23');
      return;
    }
    
    if (startMinute < 0 || startMinute > 59 || endMinute < 0 || endMinute > 59) {
      setError('Phút phải trong khoảng từ 0 đến 59');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    const scheduleData = {
      name: scheduleName,
      start_hour: parseInt(startHour),
      start_minute: parseInt(startMinute),
      end_hour: parseInt(endHour),
      end_minute: parseInt(endMinute),
      is_active: isActive
    };
    
    try {
      if (dialogMode === 'add') {
        // Tạo lịch làm việc mới
        const response = await workScheduleAPI.create(scheduleData);
        if (response.data && response.data.success) {
          fetchSchedules();
          handleCloseDialog();
        } else {
          setError('Không thể tạo lịch làm việc mới');
        }
      } else {
        // Cập nhật lịch làm việc hiện tại
        const response = await workScheduleAPI.update(editingSchedule._id, scheduleData);
        if (response.data && response.data.success) {
          fetchSchedules();
          handleCloseDialog();
        } else {
          setError('Không thể cập nhật lịch làm việc');
        }
      }
    } catch (err) {
      console.error("Error saving schedule:", err);
      setError('Lỗi khi lưu lịch làm việc: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteSchedule = async () => {
    if (!scheduleToDelete) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await workScheduleAPI.delete(scheduleToDelete._id);
      if (response.status === 204 || (response.data && response.data.success)) {
        fetchSchedules();
        handleCloseDeleteDialog();
      } else {
        setError('Không thể xóa lịch làm việc');
      }
    } catch (err) {
      console.error("Error deleting schedule:", err);
      setError('Lỗi khi xóa lịch làm việc: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
      handleCloseDeleteDialog();
    }
  };
  
  // Định dạng thời gian
  const formatTime = (hour, minute) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Quản Lý Lịch Làm Việc</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={handleOpenAddDialog}
        >
          Thêm Lịch Làm Việc
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tên lịch</TableCell>
                <TableCell>Giờ vào làm</TableCell>
                <TableCell>Giờ tan ca</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell>Tùy chọn</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedules.length > 0 ? (
                schedules.map((schedule) => (
                  <TableRow key={schedule._id}>
                    <TableCell>{schedule.name}</TableCell>
                    <TableCell>{formatTime(schedule.start_hour, schedule.start_minute)}</TableCell>
                    <TableCell>{formatTime(schedule.end_hour, schedule.end_minute)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Switch
                          checked={schedule._id === activeId}
                          onChange={() => handleSetActive(schedule._id)}
                          color="primary"
                        />
                        {schedule._id === activeId && (
                          <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
                            Đang sử dụng
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex' }}>
                        <Tooltip title="Chỉnh sửa">
                          <IconButton 
                            color="primary"
                            onClick={() => handleOpenEditDialog(schedule)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Xóa">
                          <IconButton 
                            color="error"
                            onClick={() => handleOpenDeleteDialog(schedule)}
                            disabled={schedule.is_active && schedules.length === 1}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    Chưa có lịch làm việc nào
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* Thêm/chỉnh sửa */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === 'add' ? 'Thêm Lịch Làm Việc Mới' : 'Chỉnh Sửa Lịch Làm Việc'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              label="Tên lịch làm việc"
              value={scheduleName}
              onChange={(e) => setScheduleName(e.target.value)}
            />
            
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="subtitle1" color="primary" sx={{ display: 'flex', alignItems: 'center' }}>
                  <AccessTimeIcon sx={{ mr: 1 }} />
                  Thời gian vào làm
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Giờ"
                  type="number"
                  fullWidth
                  value={startHour}
                  onChange={(e) => setStartHour(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                  inputProps={{ min: 0, max: 23 }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Phút"
                  type="number"
                  fullWidth
                  value={startMinute}
                  onChange={(e) => setStartMinute(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                  inputProps={{ min: 0, max: 59 }}
                />
              </Grid>
            </Grid>
            
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="subtitle1" color="primary" sx={{ display: 'flex', alignItems: 'center' }}>
                  <AccessTimeIcon sx={{ mr: 1 }} />
                  Thời gian tan ca
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Giờ"
                  type="number"
                  fullWidth
                  value={endHour}
                  onChange={(e) => setEndHour(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                  inputProps={{ min: 0, max: 23 }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Phút"
                  type="number"
                  fullWidth
                  value={endMinute}
                  onChange={(e) => setEndMinute(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                  inputProps={{ min: 0, max: 59 }}
                />
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
              <Switch
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                color="primary"
              />
              <Typography variant="body2" sx={{ ml: 1 }}>
                Đặt làm lịch mặc định
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="inherit">
            Hủy
          </Button>
          <Button 
            onClick={handleSubmitForm} 
            variant="contained" 
            color="primary"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Lưu'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Xác nhận xóa */}
      <Dialog
        open={openDeleteDialog}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>Xác nhận xóa</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Bạn có chắc chắn muốn xóa lịch làm việc "{scheduleToDelete?.name}"?
            {scheduleToDelete?.is_active && (
              <Typography color="error" sx={{ mt: 1 }}>
                Đây là lịch làm việc đang được sử dụng làm mặc định.
              </Typography>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} color="inherit">
            Hủy
          </Button>
          <Button 
            onClick={handleDeleteSchedule} 
            color="error" 
            variant="contained"
            disabled={loading || (scheduleToDelete?.is_active && schedules.length === 1)}
          >
            {loading ? <CircularProgress size={24} /> : 'Xóa'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Các thông tin thêm */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <InfoIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6">
              Thông tin về chấm công
            </Typography>
          </Box>
          <Typography variant="body2" paragraph>
            Hệ thống sẽ tự động tính toán các thời gian sau dựa trên lịch làm việc mặc định:
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="Đến sớm (early_minutes)" 
                    secondary="Nhân viên đến sớm hơn giờ bắt đầu làm việc" 
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Đi muộn (late_minutes)" 
                    secondary="Nhân viên đến muộn hơn giờ bắt đầu làm việc" 
                  />
                </ListItem>
              </List>
            </Grid>
            <Grid item xs={12} sm={6}>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="Về sớm (early_leave_minutes)" 
                    secondary="Nhân viên về sớm hơn giờ kết thúc làm việc" 
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Về muộn (late_leave_minutes)" 
                    secondary="Nhân viên làm việc quá giờ kết thúc" 
                  />
                </ListItem>
              </List>
            </Grid>
          </Grid>
          <Divider sx={{ my: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Các thời gian này được lưu trữ trong hệ thống theo định dạng "HH:MM:SS" và được hiển thị trong báo cáo chấm công.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}