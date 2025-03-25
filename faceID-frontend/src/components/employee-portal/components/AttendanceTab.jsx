import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, Paper, Typography, Button, Alert, CircularProgress,
  Card, CardContent, Stepper, Step, StepLabel, Divider,
  IconButton
} from '@mui/material';
import FaceIcon from '@mui/icons-material/Face';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import FaceRecognition from '../../FaceRecognition';
import { faceAPI } from '../../../api';
import { useAuth } from '../../../AuthContext';

export default function AttendanceTab({ onAttendanceSuccess }) {
  const { currentUser } = useAuth();
  const [isCapturing, setIsCapturing] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const steps = ['Chuẩn bị', 'Chụp ảnh', 'Xác nhận điểm danh'];
  
  useEffect(() => {
    // Cleanup camera when component unmounts
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);
  
  const handleStartAttendance = () => {
    setIsCapturing(true);
    setError(null);
    setRecognitionResult(null);
    setCapturedImage(null);
    setActiveStep(1);
    startCamera();
  };
  
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480, 
          facingMode: "user" 
        }, 
        audio: false 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Lỗi khi kết nối camera:", err);
      setError("Không thể kết nối camera. Vui lòng kiểm tra quyền truy cập camera của bạn.");
      setIsCapturing(false);
    }
  };
  
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
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
    
    // Draw the video frame to the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get the image data as base64 encoded string
    const imageData = canvas.toDataURL('image/jpeg');
    setCapturedImage(imageData);
    setActiveStep(2);
  };
  
  const handleCancelAttendance = () => {
    setIsCapturing(false);
    setActiveStep(0);
    stopCamera();
    setCapturedImage(null);
  };
  
  const handleRetakePhoto = () => {
    setCapturedImage(null);
    setActiveStep(1);
  };
  
  const handleConfirmAttendance = async () => {
    if (!capturedImage) {
      setError("Vui lòng chụp ảnh trước khi xác nhận điểm danh");
      return;
    }
    
    setLoading(true);
    
    try {
      // Gọi API nhận diện khuôn mặt với ảnh đã chụp
      const result = await faceAPI.recognize(capturedImage);
      
      if (!result || !result.data || !result.data.success) {
        setError("Không thể nhận diện khuôn mặt. Vui lòng thử lại.");
        setLoading(false);
        return;
      }
      
      // Xử lý kết quả nhận diện và lưu điểm danh
      const attendanceResponse = await faceAPI.saveAttendance(result.data);
      
      if (attendanceResponse.data.success) {
        setRecognitionResult({
          ...result.data,
          attendanceData: attendanceResponse.data.attendance
        });
        
        // Lưu thông tin điểm danh gần nhất
        localStorage.setItem('last_attendance', JSON.stringify(attendanceResponse.data.attendance));
        if (onAttendanceSuccess) {
          onAttendanceSuccess(attendanceResponse.data.attendance);
        }
        
        // Reset các trạng thái
        setIsCapturing(false);
        stopCamera();
      } else {
        setError(attendanceResponse.data.message || "Không thể lưu điểm danh");
      }
    } catch (err) {
      console.error("Lỗi khi xử lý điểm danh:", err);
      setError("Đã xảy ra lỗi khi xử lý điểm danh. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (recognitionResult) {
      return (
        <Card sx={{ textAlign: 'center', py: 3, borderLeft: '4px solid', borderColor: 'success.main' }}>
          <CardContent>
            <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
              Điểm danh thành công!
            </Typography>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Xin chào, {recognitionResult.name}
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ textAlign: 'left', maxWidth: 400, mx: 'auto' }}>
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>Thời gian:</strong> {new Date(recognitionResult.attendanceData?.datetime || recognitionResult.timestamp).toLocaleString('vi-VN')}
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>Trạng thái:</strong> {recognitionResult.attendanceData?.status || 'Đã điểm danh'}
              </Typography>
              <Typography variant="body1">
                <strong>Độ chính xác:</strong> {Math.round((recognitionResult.confidence || 0) * 100)}%
              </Typography>
            </Box>
            
            <Button 
              variant="contained" 
              color="primary"
              onClick={() => setRecognitionResult(null)}
              sx={{ mt: 3 }}
            >
              Điểm Danh Lại
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!isCapturing) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
          <FaceIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom align="center" sx={{ fontWeight: 'medium' }}>
            Điểm danh bằng nhận diện khuôn mặt
          </Typography>
          <Typography variant="body1" gutterBottom align="center" sx={{ mb: 3, maxWidth: 500 }}>
            Hệ thống sẽ sử dụng công nghệ FaceID để xác thực danh tính của bạn.
            Đảm bảo bạn đang ở nơi có ánh sáng tốt và nhìn thẳng vào camera.
          </Typography>
          <Button 
            variant="contained" 
            color="primary" 
            size="large" 
            onClick={handleStartAttendance}
            startIcon={<CameraAltIcon />}
            sx={{ mt: 2, minWidth: 220, py: 1 }}
          >
            Bắt Đầu Điểm Danh
          </Button>
        </Box>
      );
    }

    return (
      <Box>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {activeStep === 1 && (
          <Box>
            <Typography variant="body1" gutterBottom align="center" sx={{ mb: 2 }}>
              Đảm bảo khuôn mặt của bạn nằm trong khung hình và đủ ánh sáng
            </Typography>
            
            <Box sx={{ position: 'relative', width: '100%', maxWidth: 640, mx: 'auto', mb: 3, borderRadius: 2, overflow: 'hidden' }}>
              <video 
                ref={videoRef}
                autoPlay 
                playsInline
                style={{
                  width: '100%',
                  height: 'auto',
                  background: '#000',
                  borderRadius: '8px'
                }}
              />
              
              {/* Khung định vị khuôn mặt */}
              <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '55%',
                height: '70%',
                border: '2px dashed rgba(255,255,255,0.7)',
                borderRadius: '50%',
                pointerEvents: 'none'
              }} />
              
              {/* Canvas ẩn để xử lý ảnh */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button 
                variant="contained" 
                color="primary"
                onClick={captureImage}
                startIcon={<PhotoCameraIcon />}
                size="large"
              >
                Chụp Ảnh
              </Button>
              <Button 
                variant="outlined" 
                color="error" 
                onClick={handleCancelAttendance}
                startIcon={<CancelIcon />}
                size="large"
              >
                Hủy
              </Button>
            </Box>
          </Box>
        )}
        
        {activeStep === 2 && capturedImage && (
          <Box>
            <Typography variant="body1" gutterBottom align="center" sx={{ mb: 2 }}>
              Xác nhận ảnh chụp để tiến hành điểm danh
            </Typography>
            
            <Box 
              component="img"
              src={capturedImage}
              alt="Ảnh đã chụp"
              sx={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: 400,
                mx: 'auto',
                mb: 3,
                borderRadius: 2,
                boxShadow: 2
              }}
            />
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button 
                variant="contained" 
                color="primary"
                onClick={handleConfirmAttendance}
                disabled={loading}
                size="large"
              >
                {loading ? <CircularProgress size={24} /> : 'Xác Nhận Điểm Danh'}
              </Button>
              <Button 
                variant="outlined" 
                onClick={handleRetakePhoto}
                disabled={loading}
                size="large"
              >
                Chụp Lại
              </Button>
              <Button 
                variant="outlined" 
                color="error" 
                onClick={handleCancelAttendance}
                disabled={loading}
                size="large"
              >
                Hủy
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
      <Typography variant="h5" gutterBottom align="center" sx={{ mb: 3, fontWeight: 'medium' }}>
        <FaceIcon sx={{ mr: 1, verticalAlign: 'text-bottom' }} />
        Hệ Thống Điểm Danh FaceID
      </Typography>
      
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }} 
          onClose={() => setError(null)}
          action={
            <Button color="inherit" size="small" onClick={() => setError(null)}>
              Thử lại
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      
      {renderContent()}
    </Paper>
  );
}