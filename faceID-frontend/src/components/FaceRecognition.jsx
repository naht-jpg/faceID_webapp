import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Button, CircularProgress, Typography, Alert,
  Card, CardContent, Grid, Chip, Divider, IconButton
} from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
  Cameraswitch as CameraswitchIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Face as FaceIcon
} from '@mui/icons-material';
import Webcam from "react-webcam";
import { faceAPI } from '../api';

const FaceRecognition = ({ onRecognitionResult, autoCapture = false }) => {
  const webcamRef = useRef(null);
  const [isWebcamReady, setIsWebcamReady] = useState(false);
  const [image, setImage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);

  // Cấu hình webcam
  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user"
  };

  // Xử lý khi camera sẵn sàng
  const handleUserMedia = () => {
    setIsWebcamReady(true);
    setError(null);
  };

  // Xử lý lỗi camera
  const handleCameraError = (error) => {
    console.error('Camera error:', error);
    setError('Không thể kết nối với camera. Vui lòng kiểm tra quyền truy cập camera của bạn.');
    setIsWebcamReady(false);
  };

  // Bắt đầu quá trình chụp ảnh với đếm ngược
  const startCapture = () => {
    if (!isWebcamReady) return;

    setIsCapturing(true);
    setCountdown(3);

    const countdownTimer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimer);
          capture();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Chụp ảnh từ camera
  const capture = () => {
    if (!webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    setImage(imageSrc);
    setIsCapturing(false);
  };

  // Xử lý ảnh chụp để nhận diện khuôn mặt
  const processImage = async () => {
    if (!image) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Convert base64 image to blob
      const imageBlob = dataURItoBlob(image);
      
      // Sử dụng API endpoint để nhận diện khuôn mặt
      // API này sẽ lưu kết quả vào testdata nếu nhận diện thành công
      const response = await faceAPI.recognize(imageBlob);
      
      // Xử lý kết quả
      if (response.data && response.data.success) {
        // Gọi callback với kết quả thành công
        if (onRecognitionResult) {
          onRecognitionResult(response.data);
        }
      } else {
        setError(response.data?.message || 'Không thể nhận diện khuôn mặt');
      }
    } catch (err) {
      console.error('Error processing face recognition:', err);
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message ||
                          'Đã xảy ra lỗi khi xử lý nhận diện khuôn mặt';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Chuyển đổi Data URI thành Blob
  const dataURItoBlob = (dataURI) => {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([ab], { type: mimeString });
  };

  // Hủy bỏ và reset
  const resetCapture = () => {
    setImage(null);
    setIsCapturing(false);
    setCountdown(null);
  };

  return (
    <Box>
      <Card sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={image ? 6 : 12}>
              <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: 'black' }}>
                {!image ? (
                  <>
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      videoConstraints={videoConstraints}
                      onUserMedia={handleUserMedia}
                      onUserMediaError={handleCameraError}
                      style={{
                        width: '100%',
                        height: 'auto',
                        borderRadius: '8px'
                      }}
                    />
                    
                    {/* Overlay khuôn mặt để hướng dẫn người dùng */}
                    <Box sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '200px',
                      height: '200px',
                      borderRadius: '50%',
                      border: '2px dashed rgba(255,255,255,0.6)',
                      boxShadow: '0 0 0 1000px rgba(0,0,0,0.3)',
                      pointerEvents: 'none'
                    }} />
                    
                    {/* Hiển thị đếm ngược nếu đang chụp */}
                    {isCapturing && countdown && (
                      <Box sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 2
                      }}>
                        <Typography variant="h1" sx={{ color: 'white', fontSize: '6rem', fontWeight: 'bold' }}>
                          {countdown}
                        </Typography>
                      </Box>
                    )}
                  </>
                ) : (
                  <img
                    src={image}
                    alt="Captured"
                    style={{
                      width: '100%',
                      height: 'auto',
                      borderRadius: '8px'
                    }}
                  />
                )}
              </Box>

              {/* Các nút điều khiển */}
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
                {!image ? (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<PhotoCameraIcon />}
                    onClick={startCapture}
                    disabled={!isWebcamReady || isCapturing}
                    size="large"
                  >
                    Chụp Ảnh
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outlined"
                      color="secondary"
                      startIcon={<CameraswitchIcon />}
                      onClick={resetCapture}
                      size="large"
                    >
                      Chụp Lại
                    </Button>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<CheckCircleIcon />}
                      onClick={processImage}
                      disabled={isProcessing}
                      size="large"
                    >
                      {isProcessing ? (
                        <>
                          <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
                          Đang xử lý...
                        </>
                      ) : (
                        'Xác Nhận'
                      )}
                    </Button>
                  </>
                )}
              </Box>
            </Grid>

            {image && (
              <Grid item xs={12} md={6}>
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="h6" gutterBottom>
                    <FaceIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Hướng dẫn nhận diện khuôn mặt
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="body1" component="div" paragraph>
                    Để đảm bảo độ chính xác cao nhất, vui lòng kiểm tra:
                  </Typography>
                  
                  <Box component="ul" sx={{ pl: 2 }}>
                    <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                      Khuôn mặt được nhìn thấy rõ, không bị che khuất
                    </Typography>
                    <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                      Ánh sáng đủ và đều trên khuôn mặt
                    </Typography>
                    <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                      Không đeo kính râm hoặc vật che mặt
                    </Typography>
                  </Box>
                  
                  <Chip 
                    icon={<CheckCircleIcon />} 
                    label="Hình ảnh sẽ được sử dụng để xác thực danh tính"
                    color="primary"
                    variant="outlined"
                    sx={{ mt: 2, alignSelf: 'flex-start' }}
                  />
                </Box>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {error && (
        <Alert 
          severity="error" 
          sx={{ mt: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setError(null)}>
              Thử lại
            </Button>
          }
        >
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default FaceRecognition;