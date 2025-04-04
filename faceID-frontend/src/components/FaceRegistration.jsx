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
    // Chỉ gọi startCamera một lần khi component mount
    startCamera();
    
    // Cleanup khi component unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Bỏ stream dependency để tránh gọi lại startCamera mỗi khi stream thay đổi

  const startCamera = async () => {
    setError(null);
    try {
      // Dừng stream cũ nếu có
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
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
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    // Đảm bảo kích thước canvas đủ lớn và rõ nét
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Vẽ video frame lên canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Chuyển sang JPEG với chất lượng cao
    const dataURL = canvas.toDataURL('image/jpeg', 0.95);
    
    // Kiểm tra định dạng base64
    if (dataURL.startsWith('data:image/jpeg')) {
      const sizeKB = Math.round(dataURL.length / 1.37 / 1024);
      console.log(`Image captured successfully: ${sizeKB}KB`);
      
      // Nếu ảnh quá lớn, giảm kích thước
      if (sizeKB > 1000) {
        return canvas.toDataURL('image/jpeg', 0.8); // Giảm chất lượng để giảm kích thước
      }
      
      return dataURL;
    } else {
      console.error("Invalid image format:", dataURL.substring(0, 30));
      return null;
    }
  };
  
  const registerFace = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Lấy ảnh dạng base64
      const imageBase64 = captureImage();
      
      if (!imageBase64) {
        setError("Không thể chụp ảnh. Vui lòng kiểm tra camera và thử lại.");
        setLoading(false);
        return;
      }
      
      // Lưu ảnh để hiển thị
      setCapturedImage(imageBase64);
      
      console.log("Sending registration request for:", employee.name);
      
      // Gửi trực tiếp dạng base64
      const response = await faceAPI.register(
        employee._id, 
        employee.name, 
        imageBase64
      );
      
      console.log("Registration response:", response.data);
      
      if (response.data.success) {
        setRegistrationComplete(true);
        if (onSuccess) {
          onSuccess({
            ...response.data,
            imageData: imageBase64
          });
        }
      } else {
        setError(response.data.message || "Đăng ký không thành công. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error("Error registering face:", err);
      
      if (err.response) {
        console.error("Server response:", err.response.data);
        console.error("Status:", err.response.status);
        console.error("Headers:", err.response.headers);
        
        setError(err.response.data.message || "Lỗi server. Vui lòng thử lại sau.");
      } else if (err.request) {
        setError("Không nhận được phản hồi từ server. Vui lòng kiểm tra kết nối mạng.");
      } else {
        setError("Lỗi khi gửi yêu cầu: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDebug = async () => {
    try {
      const imageBase64 = captureImage();
      if (!imageBase64) {
        alert("Không thể chụp ảnh để debug");
        return;
      }
      
      console.log("Debug info:", {
        employee_id: employee._id,
        name: employee.name,
        image_type: "base64",
        image_size: Math.round(imageBase64.length / 1.37 / 1024) + "KB", // Ước tính kích thước
        image_format: imageBase64.substring(0, 30) + "..."
      });
      
      alert(`Thông tin debug đã được ghi vào console.
Employee ID: ${employee._id}
Name: ${employee.name}
Image type: base64
Image size: khoảng ${Math.round(imageBase64.length / 1.37 / 1024)}KB`);
    } catch (err) {
      console.error("Debug error:", err);
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
          
          <Typography variant="body2" component="div" color="text.secondary" sx={{ mt: 2 }}>
            <strong>Lưu ý:</strong>
          </Typography>
          <Box component="ul" sx={{ mt: 1, pl: 4, color: 'text.secondary' }}>
            <Typography component="li" variant="body2">Đảm bảo khuôn mặt nằm trong khung hình tròn</Typography>
            <Typography component="li" variant="body2">Ánh sáng đủ sáng và không bị ngược sáng</Typography>
            <Typography component="li" variant="body2">Nhìn thẳng vào camera, không đeo kính râm</Typography>
            <Typography component="li" variant="body2">Giữ khoảng cách vừa phải (30-50cm từ camera)</Typography>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Button 
              variant="outlined" 
              size="small" 
              onClick={handleDebug}
            >
              Debug
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}