import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, Typography, Paper, Button, Grid, Card, CardHeader,
  CardContent, CircularProgress, Alert, List, Chip,
  ListItem, ListItemText, ListItemAvatar, Avatar, Divider,
  TextField, InputAdornment, IconButton, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tooltip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CameraIcon from '@mui/icons-material/Camera';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { faceAPI } from '../../api';
import { formatDate, formatTime } from '../../utils/formatters';

export default function FaceRecognitionTab() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stream, setStream] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [currentTab, setCurrentTab] = useState(0);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Tự động tắt camera khi rời khỏi tab
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

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
      const response = await faceAPI.recognize(imageData);
      
      console.log("Recognition response:", response.data);
      
      if (response.data.success) {
        setRecognitionResult(response.data);
        setCurrentTab(1); // Chuyển sang tab kết quả
        
        // Nếu nhân viên được nhận diện, lấy lịch sử điểm danh
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
      if (response.data && response.data.success && Array.isArray(response.data.history)) {
        setAttendanceRecords(response.data.history);
      } else if (Array.isArray(response.data)) {
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
      (record.name?.toLowerCase() || "").includes(searchLower) ||
      (record.timestamp?.toLowerCase() || "").includes(searchLower)
    );
  });
  
  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Nhận Diện Khuôn Mặt
      </Typography>
      
      <Tabs 
        value={currentTab} 
        onChange={handleTabChange} 
        aria-label="face recognition tabs"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Camera" />
        <Tab label="Kết Quả" />
        <Tab label="Lịch Sử" />
      </Tabs>
      
      {currentTab === 0 && (
        <Card sx={{ mb: 2 }}>
          <CardHeader 
            title="Nhận diện khuôn mặt qua camera" 
            subheader="Chụp ảnh khuôn mặt để nhận diện và điểm danh"
          />
          <CardContent>
            <Box sx={{ position: 'relative', width: '100%', mb: 2 }}>
              <Paper 
                elevation={3} 
                sx={{ 
                  width: '100%', 
                  aspectRatio: '4/3', 
                  bgcolor: 'black',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: 'white',
                  borderRadius: 2,
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
                {!isCameraActive ? (
                  <CameraIcon sx={{ fontSize: 80, opacity: 0.5 }} />
                ) : (
                  <>
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
                    {/* Khung hướng dẫn vị trí khuôn mặt */}
                    <Box sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '45%',
                      height: '60%',
                      border: '2px dashed rgba(255,255,255,0.6)',
                      borderRadius: '50%',
                      pointerEvents: 'none',
                      zIndex: 1
                    }} />
                  </>
                )}
              </Paper>
              
              {/* Hidden canvas for image capture */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              
              {loading && (
                <Box sx={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  bottom: 0, 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  borderRadius: 2,
                  zIndex: 2
                }}>
                  <CircularProgress color="primary" />
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
                  size="large"
                >
                  Bật Camera
                </Button>
              ) : (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button 
                    variant="contained" 
                    color="primary"
                    onClick={recognizeFace}
                    disabled={loading}
                    size="large"
                  >
                    Nhận Diện
                  </Button>
                  <Button 
                    variant="outlined" 
                    color="error" 
                    onClick={stopCamera}
                    disabled={loading}
                    size="large"
                  >
                    Tắt Camera
                  </Button>
                </Box>
              )}
            </Box>
            
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
            
            {capturedImage && (
              <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Ảnh đã chụp
                </Typography>
                <Box 
                  component="img"
                  src={capturedImage}
                  alt="Captured"
                  sx={{
                    maxWidth: '100%',
                    maxHeight: '300px',
                    borderRadius: 2,
                    boxShadow: 1
                  }}
                />
              </Box>
            )}
          </CardContent>
        </Card>
      )}
      
      {currentTab === 1 && (
        <Card sx={{ mb: 2 }}>
          <CardHeader 
            title="Kết Quả Nhận Diện" 
            subheader={recognitionResult ? (
              recognitionResult.success ? 
                `Nhận diện thành công: ${recognitionResult.name}` : 
                "Không nhận diện được khuôn mặt"
            ) : "Chưa có kết quả nhận diện"}
          />
          <CardContent>
            {!recognitionResult && (
              <Alert severity="info">
                Vui lòng chụp ảnh và nhận diện khuôn mặt
              </Alert>
            )}
            
            {recognitionResult && (
              <Box>
                {recognitionResult.success ? (
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Thông tin nhân viên
                          </Typography>
                          <List>
                            <ListItem>
                              <ListItemText 
                                primary="Họ tên" 
                                secondary={recognitionResult.name || "N/A"} 
                              />
                            </ListItem>
                            <Divider component="li" />
                            <ListItem>
                              <ListItemText 
                                primary="Chức vụ" 
                                secondary={recognitionResult.job_position || "N/A"} 
                              />
                            </ListItem>
                            <Divider component="li" />
                            <ListItem>
                              <ListItemText 
                                primary="Email" 
                                secondary={recognitionResult.email || "N/A"} 
                              />
                            </ListItem>
                            <Divider component="li" />
                            <ListItem>
                              <ListItemText 
                                primary="Điện thoại" 
                                secondary={recognitionResult.phone || "N/A"} 
                              />
                            </ListItem>
                            <Divider component="li" />
                            <ListItem>
                              <ListItemText 
                                primary="Độ chính xác" 
                                secondary={`${(recognitionResult.confidence * 100).toFixed(2)}%`} 
                              />
                            </ListItem>
                          </List>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Thông tin điểm danh
                          </Typography>
                          <Alert 
                            icon={<CheckCircleIcon fontSize="inherit" />}
                            severity="success"
                            sx={{ mb: 2 }}
                          >
                            Điểm danh thành công lúc {new Date(recognitionResult.timestamp).toLocaleTimeString()}
                          </Alert>
                          
                          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                            <Button 
                              variant="contained" 
                              color="primary" 
                              onClick={() => setCurrentTab(2)}
                            >
                              Xem lịch sử điểm danh
                            </Button>
                            <Button 
                              variant="outlined" 
                              onClick={() => setCurrentTab(0)}
                            >
                              Quay lại camera
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                ) : (
                  <Alert 
                    severity="warning"
                    icon={<ErrorIcon fontSize="inherit" />}
                    action={
                      <Button 
                        color="inherit" 
                        size="small" 
                        onClick={() => setCurrentTab(0)}
                      >
                        Thử lại
                      </Button>
                    }
                  >
                    {recognitionResult.message || "Không nhận diện được khuôn mặt"}
                  </Alert>
                )}
              </Box>
            )}
            
            {capturedImage && (
              <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Ảnh đã chụp
                </Typography>
                <Box 
                  component="img"
                  src={capturedImage}
                  alt="Captured"
                  sx={{
                    maxWidth: '100%',
                    maxHeight: '300px',
                    borderRadius: 2,
                    boxShadow: 1
                  }}
                />
              </Box>
            )}
          </CardContent>
        </Card>
      )}
      
      {currentTab === 2 && (
        <Card>
          <CardHeader 
            title="Lịch Sử Điểm Danh" 
            subheader={recognitionResult?.name ? `Nhân viên: ${recognitionResult.name}` : "Tất cả nhân viên"}
            action={
              <TextField
                placeholder="Tìm kiếm..."
                variant="outlined"
                size="small"
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
            }
          />
          <CardContent>
            {attendanceRecords.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table sx={{ minWidth: 650 }} size="medium">
                  <TableHead>
                    <TableRow>
                      <TableCell>Thời gian</TableCell>
                      <TableCell>Họ tên</TableCell>
                      <TableCell>Trạng thái</TableCell>
                      <TableCell>Chi tiết</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredAttendanceRecords.map((record, index) => (
                      <TableRow key={record._id || index}>
                        <TableCell>{record.timestamp}</TableCell>
                        <TableCell>{record.name}</TableCell>
                        <TableCell>
                          {record.late_minutes !== '0:00:00' ? (
                            <Chip 
                              icon={<AccessTimeIcon />} 
                              label="Đi muộn" 
                              color="error" 
                              variant="outlined" 
                              size="small"
                            />
                          ) : record.early_minutes !== '0:00:00' ? (
                            <Chip 
                              icon={<AccessTimeIcon />} 
                              label="Đến sớm" 
                              color="success" 
                              variant="outlined" 
                              size="small" 
                            />
                          ) : (
                            <Chip 
                              icon={<CheckCircleIcon />} 
                              label="Đúng giờ" 
                              color="primary" 
                              variant="outlined" 
                              size="small" 
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Chi tiết">
                            <IconButton size="small">
                              <PersonIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">
                Không có dữ liệu điểm danh
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}