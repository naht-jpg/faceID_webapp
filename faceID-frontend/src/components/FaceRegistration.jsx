import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, Typography, Button, Alert, Paper,
  LinearProgress, Grid 
} from '@mui/material';
import CameraIcon from '@mui/icons-material/Camera';
import { faceAPI } from '../api';

export default function FaceRegistration({ employee, onSuccess }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  useEffect(() => {
    startCamera();
    
    return () => {
      // Cleanup camera stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
      
      if (videoRef.current) {
        videoRef.current.srcObject = cameraStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập camera của trình duyệt.");
    }
  };
  
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
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
  
  const registerFace = async () => {
    // Capture the current frame
    const imageData = captureImage();
    
    if (!imageData) {
      setError("Không thể chụp ảnh. Vui lòng thử lại.");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Gửi toàn bộ chuỗi base64, không cắt bỏ prefix
      const response = await faceAPI.register(employee._id, employee.name, imageData);
      
      if (response.data.success) {
        setRegistrationComplete(true);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(response.data.message || "Đăng ký không thành công. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error("Error registering face:", err);
      setError("Lỗi khi đăng ký khuôn mặt. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ textAlign: 'center' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {registrationComplete ? (
        <Box sx={{ mb: 2 }}>
          <Alert severity="success" sx={{ mb: 2 }}>
            Đăng ký khuôn mặt thành công!
          </Alert>
          
          <Typography variant="subtitle1" gutterBottom>
            Nhân viên: {employee.name}
          </Typography>
          
          {capturedImage && (
            <Box sx={{ mt: 2, mb: 2 }}>
              <img 
                src={capturedImage} 
                alt="Captured face" 
                style={{ 
                  maxWidth: '100%',
                  maxHeight: '300px',
                  borderRadius: '8px'
                }}
              />
            </Box>
          )}
        </Box>
      ) : (
        <>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Paper 
                elevation={3} 
                sx={{ 
                  position: 'relative',
                  width: '100%',
                  maxWidth: '640px',
                  margin: '0 auto 16px auto',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ position: 'relative', paddingBottom: '75%' }}>
                  <video 
                    ref={videoRef}
                    autoPlay 
                    playsInline
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: '8px'
                    }}
                  />
                </Box>
                
                {/* Hidden canvas for image capture */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                
                {loading && (
                  <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                    <LinearProgress />
                  </Box>
                )}
              </Paper>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={loading || !!error}
                  onClick={registerFace}
                  startIcon={<CameraIcon />}
                  size="large"
                >
                  {loading ? 'Đang xử lý...' : 'Chụp và Đăng ký'}
                </Button>
              </Box>
            </Grid>
          </Grid>
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            <strong>Lưu ý:</strong>
            <ul>
              <li>Đảm bảo khuôn mặt nằm trong khung hình tròn</li>
              <li>Ánh sáng đủ sáng và không bị ngược sáng</li>
              <li>Nhìn thẳng vào camera, không đeo kính râm</li>
              <li>Giữ khoảng cách vừa phải (30-50cm từ camera)</li>
            </ul>
          </Typography>
        </>
      )}
    </Box>
  );
}