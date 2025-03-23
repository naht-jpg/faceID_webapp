import React, { useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent,
  Alert, List, ListItem, ListItemText, Divider
} from '@mui/material';
import FaceRecognition from '../FaceRecognition';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import axios from 'axios';

export default function AttendancePortal() {
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);

  const handleRecognitionResult = async (result) => {
    setRecognitionResult(result);
    
    if (result.success) {
      try {
        // Lấy lịch sử điểm danh
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/attendance/${result.employee_id}/`
        );
        
        if (response.data.success) {
          setAttendanceHistory(response.data.history);
        }
      } catch (error) {
        console.error("Lỗi khi lấy lịch sử điểm danh:", error);
      }
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom align="center">
        Hệ thống điểm danh bằng khuôn mặt
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Điểm danh
            </Typography>
            
            {recognitionResult?.success ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CheckCircleIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
                <Typography variant="h5" gutterBottom>
                  Xin chào, {recognitionResult.name}!
                </Typography>
                <Typography variant="body1">
                  Điểm danh thành công lúc: {new Date(recognitionResult.timestamp).toLocaleString()}
                </Typography>
                {recognitionResult.job_position && (
                  <Typography variant="body2" color="textSecondary">
                    Chức vụ: {recognitionResult.job_position}
                  </Typography>
                )}
                <Alert severity="success" sx={{ mt: 2, maxWidth: 400, mx: 'auto' }}>
                  Hệ thống đã ghi nhận thông tin điểm danh của bạn.
                </Alert>
              </Box>
            ) : (
              <FaceRecognition onRecognitionResult={handleRecognitionResult} />
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Lịch sử điểm danh
              </Typography>
              
              {attendanceHistory.length > 0 ? (
                <List>
                  {attendanceHistory.slice(0, 10).map((record, index) => (
                    <React.Fragment key={record._id || index}>
                      <ListItem>
                        <ListItemText
                          primary={record.timestamp ? new Date(record.timestamp).toLocaleDateString() : record.date}
                          secondary={`Thời gian: ${record.timestamp ? new Date(record.timestamp).toLocaleTimeString() : record.time}`}
                        />
                      </ListItem>
                      {index < attendanceHistory.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography color="textSecondary" align="center">
                  {recognitionResult?.success 
                    ? "Đang tải lịch sử điểm danh..." 
                    : "Điểm danh để xem lịch sử"}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}