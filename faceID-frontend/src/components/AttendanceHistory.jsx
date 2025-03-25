import React, { useState, useEffect } from 'react';
import {
  Box, Typography, List, ListItem, ListItemText,
  Divider, Paper, CircularProgress, Alert, 
  TextField, InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { attendanceAPI } from '../api';
import { formatDate } from '../utils/formatters';

export default function AttendanceHistory({ employeeId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    if (employeeId) {
      fetchAttendanceHistory();
    }
  }, [employeeId]);
  
  const fetchAttendanceHistory = async () => {
    if (!employeeId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await attendanceAPI.getByEmployeeId(employeeId);
      
      if (response.data && Array.isArray(response.data)) {
        setAttendanceRecords(response.data);
      } else if (response.data && response.data.success) {
        setAttendanceRecords(response.data.history || []);
      } else {
        setAttendanceRecords([]);
      }
    } catch (error) {
      console.error("Lỗi khi tải lịch sử điểm danh:", error);
      setError("Không thể tải lịch sử điểm danh");
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };
  
  // Lọc kết quả dựa trên tìm kiếm
  const filteredRecords = attendanceRecords.filter(record => {
    const searchLower = searchQuery.toLowerCase();
    return (
      record.timestamp?.toLowerCase().includes(searchLower) ||
      record.name?.toLowerCase().includes(searchLower)
    );
  });
  
  return (
    <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" gutterBottom>Lịch Sử Điểm Danh</Typography>
      
      <TextField
        fullWidth
        placeholder="Tìm kiếm..."
        variant="outlined"
        size="small"
        margin="normal"
        value={searchQuery}
        onChange={handleSearchChange}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : filteredRecords.length > 0 ? (
        <List sx={{ bgcolor: 'background.paper', mt: 2 }}>
          {filteredRecords.map((record, index) => (
            <React.Fragment key={record._id || index}>
              <ListItem alignItems="flex-start">
                <ListItemText
                  primary={`${formatDate(record.datetime)} - ${record.timestamp}`}
                  secondary={
                    <>
                      {record.late_minutes !== '0:00:00' && 
                        <Typography variant="body2" color="error">
                          Đi muộn: {record.late_minutes}
                        </Typography>
                      }
                      {record.early_minutes !== '0:00:00' && 
                        <Typography variant="body2" color="primary">
                          Đến sớm: {record.early_minutes}
                        </Typography>
                      }
                    </>
                  }
                />
              </ListItem>
              {index < filteredRecords.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      ) : (
        <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 3 }}>
          {employeeId ? "Không có dữ liệu điểm danh" : "Vui lòng chọn nhân viên để xem lịch sử"}
        </Typography>
      )}
    </Paper>
  );
}