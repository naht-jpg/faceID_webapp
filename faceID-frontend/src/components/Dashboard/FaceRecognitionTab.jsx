import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, Typography, Paper, Button, Grid, Card, CardHeader,
  CardContent, CircularProgress, Alert, List, Chip,
  ListItem, ListItemText, ListItemAvatar, Avatar, Divider,
  TextField, InputAdornment, IconButton, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tooltip, MenuItem, FormControl, InputLabel, Select
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CameraIcon from '@mui/icons-material/Camera';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import VerifiedIcon from '@mui/icons-material/Verified';
import Autocomplete from '@mui/material/Autocomplete';
import ReplayIcon from '@mui/icons-material/Replay';
import InfoIcon from '@mui/icons-material/Info';
import { faceAPI, employeeAPI } from '../../api';
import { alpha } from '@mui/material/styles';

export default function FaceRecognitionTab() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [stream, setStream] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [testMode, setTestMode] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchEmployeesWithFaces();
  
    return () => {
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []); 

  const fetchEmployeesWithFaces = async () => {
    try {
      const response = await employeeAPI.getAll();
      if (response.data) {
        let employeeList = Array.isArray(response.data) ? response.data : 
                          (response.data.employees || response.data.data || []);
        const employeesWithFaces = employeeList.filter(emp => 
          emp.has_face === true || emp.image_path
        );
        setEmployees(employeesWithFaces);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      setError("Không thể tải danh sách nhân viên");
    }
  };

  const startCamera = async () => {
    setError(null);
    
    try {
      // Đảm bảo tắt camera cũ trước
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        setStream(null);
      }
      
      console.log("Requesting camera access...");
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      });
      
      console.log("Camera access granted:", mediaStream);
      
      // Đặt camera là active và lưu stream trước
      setIsCameraActive(true);
      setStream(mediaStream);
      
      // Sử dụng setTimeout để đảm bảo video element đã được render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            console.log("Video metadata loaded");
            videoRef.current.play()
              .then(() => console.log("Video playing"))
              .catch(e => console.error("Video play error:", e));
          };
        } else {
          console.error("videoRef.current is still null after delay");
          setError("Không thể khởi tạo camera. Vui lòng tải lại trang và thử lại.");
        }
      }, 100); // Độ trễ nhỏ để React render
      
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError(`Không thể truy cập camera: ${err.message}. Vui lòng kiểm tra quyền truy cập camera của trình duyệt.`);
    }
  };
  
  const stopCamera = () => {
    console.log("Stopping camera...");
    
    if (stream) {
      try {
        const tracks = stream.getTracks();
        tracks.forEach(track => {
          console.log("Stopping track:", track.kind);
          track.stop();
        });
        
        // Xóa stream khỏi video element
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          console.log("Removed stream from video element");
        }
        
        // Cập nhật state
        setStream(null);
        setIsCameraActive(false);
        console.log("Camera stopped successfully");
      } catch (error) {
        console.error("Error stopping camera:", error);
      }
    } else {
      console.log("No active stream to stop");
    }
  };
  
  const captureImage = () => {
    if (!videoRef.current) {
      setError("Camera chưa được khởi động - video không tồn tại");
      return null;
    }
    
    if (!videoRef.current.srcObject) {
      setError("Camera chưa được khởi động - không có stream");
      return null;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas) {
      setError("Lỗi canvas không khởi tạo được");
      return null;
    }
    
    // Đảm bảo video đã load hoàn toàn trước khi chụp
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Video chưa sẵn sàng để chụp");
      return null;
    }
    
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = canvas.toDataURL('image/jpeg');
    setCapturedImage(imageData);
    
    return imageData;
  };
  
  const recognizeFace = async () => {
    try {
      const imageData = captureImage();
      
      if (!imageData) {
        setError("Không thể chụp ảnh. Vui lòng đảm bảo camera đang hoạt động.");
        return;
      }
      
      setLoading(true);
      setError(null);
      setRecognitionResult(null);
      setTestMode(false);
      
      console.log("Sending recognition request...");
      
      const response = await faceAPI.recognize(imageData);
      console.log("Recognition response:", response.data);
      
      if (response.data.success) {
        setRecognitionResult(response.data);
        setCurrentTab(1);
      } else {
        setRecognitionResult({ 
          success: false, 
          message: response.data.message || "Không nhận diện được khuôn mặt" 
        });
        setCurrentTab(1);
      }
    } catch (err) {
      console.error("Error recognizing face:", err);
      setError("Lỗi khi nhận diện khuôn mặt: " + (err.response?.data?.message || err.message || "Lỗi không xác định"));
    } finally {
      setLoading(false);
    }
  };

  const testFaceRecognition = async () => {
    if (!selectedEmployee) {
      setError("Vui lòng chọn nhân viên để test");
      return;
    }

    // Tìm thông tin nhân viên đã chọn
    const employee = employees.find(emp => emp._id === selectedEmployee);
    if (!employee || !employee.image_path) {
      setError("Không tìm thấy ảnh của nhân viên đã chọn");
      return;
    }

    // Thiết lập trạng thái test
    setError(null);
    setTestMode(true);
    
    // Nếu camera chưa hoạt động, bật camera
    if (!isCameraActive) {
      try {
        await startCamera();
        // Hiển thị hướng dẫn sau khi camera mở
        setError("Camera đã sẵn sàng. Vui lòng nhấn nút \"Nhận Diện\" để thực hiện test với khuôn mặt của bạn.");
      } catch (err) {
        setError("Không thể bật camera. " + err.message);
      }
      return; // Thoát hàm, không tiếp tục test cho đến khi người dùng nhấn "Nhận Diện"
    }
    
    // Nếu camera đã hoạt động, thực hiện chụp và kiểm tra
    try {
      const imageData = captureImage();
      
      if (!imageData) {
        setError("Không thể chụp ảnh. Vui lòng đảm bảo camera đang hoạt động.");
        return;
      }
      
      setLoading(true);
      setRecognitionResult(null);
      
      console.log("Sending test recognition request with image and employee_id:", selectedEmployee);
      
      // Gửi ảnh và employee_id để test nhận diện
      const response = await faceAPI.testRecognizeWithImage({
        employee_id: selectedEmployee,
        image: imageData
      });
      
      console.log("Test recognition response:", response.data);
      
      // Xử lý kết quả...
      if (response.data.success) {
        setRecognitionResult({
          ...response.data,
          test_image_url: imageData // Dùng ảnh vừa chụp
        });
        setCurrentTab(1);
      } else {
        setRecognitionResult({
          success: false,
          message: response.data.message || "Không nhận diện được khuôn mặt hoặc không khớp với nhân viên đã chọn"
        });
        setCurrentTab(1);
      }
    } catch (err) {
      console.error("Error testing face recognition:", err);
      setError("Lỗi khi test nhận diện khuôn mặt: " + (err.response?.data?.message || err.message || "Lỗi không xác định"));
    } finally {
      setLoading(false);
    }
  };
  
  
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
        <Tab label="Nhận Diện" />
        <Tab label="Kết Quả" />
      </Tabs>
      
      {currentTab === 0 && (
        <Card sx={{ mb: 2 }}>
          <CardHeader 
            title="Test nhận diện khuôn mặt" 
            subheader="Chụp ảnh khuôn mặt hoặc chọn nhân viên đã có ảnh để test nhận diện"
          />
          <CardContent>
            <Box sx={{ 
              mb: 3, 
              p: 3, 
              borderRadius: 2,
              background: theme => theme.palette.mode === 'dark' 
                ? 'linear-gradient(to right, rgba(55, 65, 81, 0.7), rgba(17, 24, 39, 0.8))'
                : 'linear-gradient(to right, #e8f5fe, #f0f7ff)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              border: '1px solid',
              borderColor: theme => theme.palette.divider
            }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="medium" 
                sx={{ 
                  color: theme => theme.palette.primary.main, 
                  mb: 2 
                }}
              >
                Test nhận diện với nhân viên đã có ảnh khuôn mặt
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <Box sx={{
                    '& .MuiAutocomplete-listbox': {
                      backgroundColor: theme => theme.palette.background.paper,
                      color: theme => theme.palette.text.primary,
                      '& .MuiAutocomplete-option': {
                        borderBottom: '1px solid',
                        borderColor: theme => theme.palette.divider,
                        '&:hover': {
                          backgroundColor: theme => theme.palette.action.hover,
                        },
                        '&[aria-selected="true"]': {
                          backgroundColor: theme => theme.palette.mode === 'dark'
                            ? 'rgba(25, 118, 210, 0.2)'
                            : 'rgba(25, 118, 210, 0.1)',
                        }
                      }
                    }
                  }}>
                    <Autocomplete
                      id="employee-select"
                      options={employees}
                      getOptionLabel={(option) => option.name}
                      value={employees.find(emp => emp._id === selectedEmployee) || null}
                      onChange={(event, newValue) => {
                        setSelectedEmployee(newValue ? newValue._id : '');
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Tìm và chọn nhân viên"
                          variant="outlined"
                          fullWidth
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <>
                                <InputAdornment position="start">
                                  <PersonSearchIcon color="primary" />
                                </InputAdornment>
                                {params.InputProps.startAdornment}
                              </>
                            )
                          }}
                          sx={{
                            borderRadius: 1,
                            backgroundColor: theme => theme.palette.background.paper,
                            '& .MuiOutlinedInput-root': {
                              '&:hover fieldset': {
                                borderColor: 'primary.main',
                              },
                            },
                            '& .MuiOutlinedInput-input': {
                              color: 'text.primary',
                            },
                            '& .MuiInputLabel-root': {
                              color: 'text.secondary',
                              '&.Mui-focused': {
                                color: 'primary.main'
                              }
                            },
                            '& .MuiInputBase-input::placeholder': {
                              color: 'text.secondary',
                              opacity: 0.7
                            }
                          }}
                        />
                      )}
                      ListboxProps={{
                        sx: {
                          backgroundColor: 'background.paper',
                          '& .MuiAutocomplete-option': {
                            color: 'text.primary',
                            '&:hover': {
                              backgroundColor: 'action.hover',
                            },
                            '&.Mui-focused': {
                              backgroundColor: theme => 
                                theme.palette.mode === 'dark' 
                                  ? alpha(theme.palette.primary.main, 0.2)
                                  : theme.palette.primary.light,
                              color: theme => 
                                theme.palette.mode === 'dark'
                                  ? theme.palette.primary.light
                                  : theme.palette.primary.contrastText,
                            }
                          }
                        }
                      }}
                    />
                  </Box>
                </Grid>

                <Grid item xs={12} md={4}>
                  {selectedEmployee ? (
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        height: '100%',
                        justifyContent: 'center' 
                      }}
                    >
                      <Button 
                        variant="contained" 
                        color="primary"
                        onClick={testFaceRecognition}
                        disabled={loading}
                        startIcon={<CameraAltIcon />}
                        fullWidth
                        sx={{ 
                          mb: 1,
                          py: 1.2,
                          backgroundColor: '#1976d2',
                          '&:hover': {
                            backgroundColor: '#1565c0'
                          }
                        }}
                      >
                        Test Nhận Diện
                      </Button>
                      
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<InfoIcon />}
                        onClick={async () => {
                          try {
                            setLoading(true);
                            const response = await faceAPI.checkTrainerDataById(selectedEmployee);
                            if (response.data.success) {
                              const trainer = response.data.trainers[0];
                              if (trainer && trainer.has_features) {
                                setError(`${trainer.name} đã có dữ liệu đặc trưng khuôn mặt (${trainer.feature_vector_length} điểm đặc trưng)`);
                              } else {
                                setError(`${trainer?.name || 'Nhân viên'} chưa có dữ liệu đặc trưng khuôn mặt. Vui lòng đăng ký lại.`);
                              }
                            }
                          } catch (err) {
                            setError("Không thể kiểm tra dữ liệu đặc trưng: " + err.message);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        fullWidth
                        sx={{ 
                          borderColor: '#1976d2',
                          color: '#1976d2',
                          '&:hover': {
                            borderColor: '#1565c0',
                            backgroundColor: 'rgba(25, 118, 210, 0.04)'
                          }
                        }}
                      >
                        Kiểm tra dữ liệu khuôn mặt
                      </Button>
                    </Box>
                  ) : (
                    <Alert 
                      severity="info" 
                      icon={<PersonIcon />}
                      sx={{ 
                        height: '100%', 
                        display: 'flex', 
                        alignItems: 'center',
                        backgroundColor: theme => theme.palette.mode === 'dark'
                          ? 'rgba(7, 89, 133, 0.15)'
                          : '#e8f4fd',
                        color: theme => theme.palette.mode === 'dark'
                          ? '#90caf9'
                          : '#0277bd'
                      }}
                    >
                      Vui lòng chọn nhân viên để test nhận diện
                    </Alert>
                  )}
                </Grid>
                
                {selectedEmployee && (
                  <Grid item xs={12}>
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        backgroundColor: theme => theme.palette.mode === 'dark' 
                          ? 'rgba(30, 41, 59, 0.8)' 
                          : '#f8fafc',
                        borderColor: theme => theme.palette.divider,
                        transition: 'all 0.2s',
                        '&:hover': {
                          boxShadow: theme => theme.palette.mode === 'dark'
                            ? '0 4px 12px rgba(0,0,0,0.3)'
                            : '0 4px 12px rgba(0,0,0,0.08)'
                        }
                      }}
                    >
                      <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
                        {(() => {
                          const employee = employees.find(emp => emp._id === selectedEmployee);
                          if (!employee) return null;
                          
                          return (
                            <>
                              <Avatar 
                                src={employee.image_path ? `${import.meta.env.VITE_API_URL}/${employee.image_path}` : ''}
                                sx={{ 
                                  width: 64, 
                                  height: 64, 
                                  mr: 2,
                                  boxShadow: '0 3px 6px rgba(0,0,0,0.1)',
                                  border: '2px solid',
                                  borderColor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : '#fff',
                                  bgcolor: employee.image_path ? 'transparent' : theme => theme.palette.mode === 'dark' ? '#1e4976' : '#bbdefb'
                                }}
                              >
                                {!employee.image_path && <PersonIcon fontSize="large" sx={{ 
                                  color: theme => theme.palette.mode === 'dark' ? '#90caf9' : '#1976d2' 
                                }} />}
                              </Avatar>
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="h6" sx={{ 
                                  color: theme => theme.palette.primary.main, 
                                  fontWeight: 500 
                                }}>
                                  {employee.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                  <Chip 
                                    label={employee.job_position || 'Nhân viên'} 
                                    size="small" 
                                    sx={{ 
                                      mr: 1, 
                                      backgroundColor: theme => theme.palette.mode === 'dark'
                                        ? 'rgba(25, 118, 210, 0.15)'
                                        : 'rgba(25, 118, 210, 0.08)',
                                      color: theme => theme.palette.primary.main,
                                      fontWeight: 500,
                                      height: 24
                                    }} 
                                  />
                                  <span style={{ color: '#78909c' }}>•</span>
                                  <span style={{ marginLeft: '8px', color: '#78909c' }}>{employee.department || 'Chưa phân bộ phận'}</span>
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {employee.email || 'Chưa có email'} • {employee.phone || 'Chưa có SĐT'}
                                </Typography>
                              </Box>
                            </>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </Box>

            <Divider sx={{ my: 3 }}>
              <Chip 
                label="HOẶC" 
                sx={{
                  backgroundColor: theme => theme.palette.mode === 'dark' 
                    ? 'rgba(255,255,255,0.08)' 
                    : 'rgba(0,0,0,0.08)',
                  color: 'text.secondary'
                }}
              />
            </Divider>
            
            <Typography variant="subtitle1" gutterBottom sx={{ mb: 2 }} fontWeight="medium">
              Nhận diện qua camera trực tiếp
            </Typography>
            
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
                  position: 'relative',
                  border: '1px solid',
                  borderColor: theme => theme.palette.mode === 'dark' 
                    ? 'rgba(255,255,255,0.1)' 
                    : 'rgba(0,0,0,0.1)'
                }}
              >
                <video 
                  ref={videoRef}
                  autoPlay 
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: isCameraActive ? 1 : 0
                  }}
                />
                
                {!isCameraActive && (
                  <CameraIcon sx={{ fontSize: 80, opacity: 0.5, position: 'absolute' }} />
                )}
                
                {isCameraActive && (
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
                )}
              </Paper>
              
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
                  Ảnh {testMode ? "được sử dụng để test" : "đã chụp"}
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
                            Thông tin {testMode ? "test" : "nhận diện"}
                          </Typography>
                          <Alert 
                            icon={<CheckCircleIcon fontSize="inherit" />}
                            severity="success"
                            sx={{ mb: 2 }}
                          >
                            {testMode 
                              ? `Test nhận diện thành công cho nhân viên ${recognitionResult.name}`
                              : `Nhận diện thành công khuôn mặt của ${recognitionResult.name}`
                            }
                          </Alert>
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
                            {testMode && recognitionResult.distance && (
                              <>
                                <Divider component="li" />
                                <ListItem>
                                  <ListItemText 
                                    primary="Khoảng cách vector" 
                                    secondary={`${recognitionResult.distance.toFixed(4)} (Ngưỡng: ${recognitionResult.threshold})`}
                                  />
                                </ListItem>
                              </>
                            )}
                          </List>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Thông tin khuôn mặt
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                            <Button 
                              variant="outlined" 
                              onClick={() => setCurrentTab(0)}
                              startIcon={<CameraAltIcon />}
                              sx={{
                                color: theme => theme.palette.mode === 'dark' 
                                  ? theme.palette.primary.light 
                                  : theme.palette.primary.main,
                                borderColor: theme => theme.palette.mode === 'dark' 
                                  ? theme.palette.primary.light 
                                  : theme.palette.primary.main,
                              }}
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

                {testMode && recognitionResult.success && (
                  <Alert 
                    severity="info" 
                    sx={{ mt: 2 }}
                  >
                    Khuôn mặt của bạn đã được nhận diện thành công và khớp với khuôn mặt đã đăng ký của {recognitionResult.name}.
                    Điều này xác nhận rằng hệ thống nhận diện hoạt động đúng.
                  </Alert>
                )}

                {testMode && !recognitionResult.success && recognitionResult.distance && (
                  <Alert 
                    severity="warning" 
                    sx={{ mt: 2 }}
                  >
                    Khuôn mặt của bạn không khớp với khuôn mặt đã đăng ký của {employees.find(emp => emp._id === selectedEmployee)?.name}.
                    Khoảng cách vector: {recognitionResult.distance.toFixed(4)} (lớn hơn ngưỡng {recognitionResult.threshold}).
                  </Alert>
                )}
              </Box>
            )}
            
            {capturedImage && (
              <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Ảnh {testMode ? "được sử dụng để test" : "đã chụp"}
                </Typography>
                <Box 
                  component="img"
                  src={capturedImage}
                  alt="Captured"
                  sx={{
                    maxWidth: '100%',
                    maxHeight: '300px',
                    borderRadius: 2,
                    boxShadow: theme => theme.palette.mode === 'dark' 
                      ? '0 4px 12px rgba(255,255,255,0.1)'
                      : '0 4px 12px rgba(0,0,0,0.1)',
                    border: '1px solid',
                    borderColor: theme => theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.1)'
                  }}
                />
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}