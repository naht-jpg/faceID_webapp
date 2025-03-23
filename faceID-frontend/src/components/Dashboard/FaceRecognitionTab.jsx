import React, { useState, useRef } from 'react';
import { 
  Box, Typography, Paper, Button, Grid, Card,
  CardContent, CircularProgress, Alert, List,
  ListItem, ListItemText, ListItemAvatar, Avatar, 
  Divider, TextField, InputAdornment, IconButton
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CameraIcon from '@mui/icons-material/Camera';
import PersonIcon from '@mui/icons-material/Person';
import { faceAPI } from '../../api';
import { formatDate } from '../../utils/formatters';



export default function FaceRecognitionTab() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stream, setStream] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = async () => {
    setError(null);
    
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        } 
      });
      
      setStream(cameraStream);
      setIsCameraActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = cameraStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập camera của trình duyệt.");
    }
  };
  
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };
  
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to base64 image
    const imageData = canvas.toDataURL('image/jpeg');
    setCapturedImage(imageData);
    
    return imageData;
  };
  
  const recognizeFace = async () => {
    const imageData = captureImage();
    
    if (!imageData) {
      setError("Không thể chụp ảnh. Vui lòng đảm bảo camera đang hoạt động.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setRecognitionResult(null);
    
    try {
      // Convert base64 to format expected by the API
      const base64Data = imageData.split(',')[1];
      
      const response = await faceAPI.recognize(base64Data);
      
      if (response.data.success) {
        setRecognitionResult(response.data);
        
        // If employee is recognized, fetch their attendance records
        if (response.data.employee_id) {
          fetchAttendanceHistory(response.data.employee_id);
        }
      } else {
        setRecognitionResult({ success: false, message: response.data.message || "Không nhận diện được khuôn mặt" });
      }
    } catch (err) {
      console.error("Error recognizing face:", err);
      setError("Lỗi khi nhận diện khuôn mặt. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAttendanceHistory = async (employeeId) => {
    try {
      const response = await faceAPI.getAttendanceHistory(employeeId);
      if (response.data && Array.isArray(response.data)) {
        setAttendanceRecords(response.data);
      } else {
        setAttendanceRecords([]);
      }
    } catch (error) {
      console.error("Error fetching attendance records:", error);
    }
  };
  
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };
  
  // Filter attendance records based on search query
  const filteredAttendanceRecords = attendanceRecords.filter(record => {
    const searchLower = searchQuery.toLowerCase();
    return (
      record.employee_name?.toLowerCase().includes(searchLower) ||
      record.timestamp?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Nhận Diện Khuôn Mặt
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Camera
            </Typography>
            
            <Box sx={{ position: 'relative', width: '100%', mb: 2 }}>
              <Box 
                sx={{ 
                  width: '100%', 
                  aspectRatio: '4/3', 
                  bgcolor: 'black',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: 'white',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                {!isCameraActive ? (
                  <CameraIcon sx={{ fontSize: 60, opacity: 0.5 }} />
                ) : (
                  <video 
                    ref={videoRef}
                    autoPlay 
                    playsInline
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                )}
              </Box>
              
              {/* Hidden canvas for image capture */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              
              {loading && (
                <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                  <CircularProgress size={36} sx={{ position: 'absolute', top: -18, left: 'calc(50% - 18px)' }} />
                </Box>
              )}
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              {!isCameraActive ? (
                <Button 
                  variant="contained" 
                  startIcon={<CameraAltIcon />}
                  onClick={startCamera}
                  disabled={loading}
                >
                  Bật Camera
                </Button>
              ) : (
                <>
                  <Button 
                    variant="outlined" 
                    color="error" 
                    onClick={stopCamera}
                    disabled={loading}
                  >
                    Tắt Camera
                  </Button>
                  <Button 
                    variant="contained" 
                    color="primary"
                    onClick={recognizeFace}
                    disabled={loading}
                  >
                    Nhận Diện
                  </Button>
                </>
              )}
            </Box>
          </Paper>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {recognitionResult && (
            <Card variant={recognitionResult.success ? "outlined" : "elevation"} 
                  sx={{ mb: 2, bgcolor: recognitionResult.success ? 'success.light' : 'error.light' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Kết Quả Nhận Diện
                </Typography>
                
                {recognitionResult.success ? (
                  <Box>
                    <Typography variant="subtitle1">
                      Đã nhận diện: <strong>{recognitionResult.employee_name}</strong>
                    </Typography>
                    <Typography variant="body2">
                      ID: {recognitionResult.employee_id}
                    </Typography>
                    <Typography variant="body2">
                      Chức vụ: {recognitionResult.job_position || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      Thời gian: {new Date().toLocaleString()}
                    </Typography>
                  </Box>
                ) : (
                  <Typography>
                    {recognitionResult.message || "Không nhận diện được khuôn mặt"}
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}
          
          {capturedImage && (
            <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="subtitle2" gutterBottom>
                Ảnh đã chụp
              </Typography>
              <Box 
                component="img"
                src={capturedImage}
                alt="Captured"
                sx={{
                  maxWidth: '100%',
                  maxHeight: '300px',
                  borderRadius: 1
                }}
              />
            </Paper>
          )}
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Lịch Sử Điểm Danh
            </Typography>
            
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
            
            <List sx={{ bgcolor: 'background.paper', mt: 2 }}>
              {attendanceRecords.length > 0 ? (
                filteredAttendanceRecords.map((record, index) => (
                  <React.Fragment key={record._id || index}>
                    <ListItem alignItems="flex-start">
                      <ListItemAvatar>
                        <Avatar>
                          <PersonIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={record.employee_name}
                        secondary={
                          <React.Fragment>
                            <Typography component="span" variant="body2" color="text.primary">
                              {formatDate(record.timestamp)}
                            </Typography>
                            {record.status && (
                              <Typography component="span" variant="body2" sx={{ ml: 1 }}>
                                • {record.status}
                              </Typography>
                            )}
                          </React.Fragment>
                        }
                      />
                    </ListItem>
                    {index < attendanceRecords.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                ))
              ) : (
                <ListItem>
                  <ListItemText primary="Không có dữ liệu điểm danh" />
                </ListItem>
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}