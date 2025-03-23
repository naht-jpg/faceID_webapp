import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import { faceAPI } from './api';

function FaceRecognition({ onRecognitionResult }) {
  const webcamRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);

  // Để tự động bắt đầu nhận diện khi tìm thấy khuôn mặt
  useEffect(() => {
    let faceDetectionTimer;
    
    if (!isCapturing && !processing) {
      // Giả lập phát hiện khuôn mặt
      // Trong thực tế bạn có thể sử dụng thư viện như face-api.js để phát hiện khuôn mặt
      faceDetectionTimer = setTimeout(() => {
        if (!countdown) setCountdown(3);
      }, 2000);
    }
    
    return () => clearTimeout(faceDetectionTimer);
  }, [isCapturing, processing, countdown]);

  // Xử lý đếm ngược và chụp ảnh
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    
    const timer = setTimeout(() => {
      if (countdown === 1) {
        captureAndRecognize();
        setCountdown(null);
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [countdown]);

  const captureAndRecognize = async () => {
    if (!webcamRef.current) return;
    
    try {
      setIsCapturing(true);
      setProcessing(true);
      setError(null);
      
      // Chụp ảnh từ webcam
      const imageSrc = webcamRef.current.getScreenshot();
      
      if (!imageSrc) {
        throw new Error("Không thể chụp ảnh");
      }
      
      // Gửi ảnh lên API để nhận diện
      const response = await faceAPI.recognize(imageSrc);
      
      // Xử lý kết quả
      onRecognitionResult && onRecognitionResult(response.data);
      
      if (!response.data.success) {
        setError(response.data.message || "Không nhận diện được khuôn mặt");
        // Thử lại sau 3 giây
        setTimeout(() => setCountdown(3), 3000);
      }
      
    } catch (err) {
      console.error("Lỗi nhận diện khuôn mặt:", err);
      setError(err.response?.data?.message || "Có lỗi xảy ra khi nhận diện");
      onRecognitionResult && onRecognitionResult({
        success: false,
        message: "Có lỗi xảy ra khi nhận diện"
      });
      
      // Thử lại sau 3 giây
      setTimeout(() => setCountdown(3), 3000);
    } finally {
      setIsCapturing(false);
      setProcessing(false);
    }
  };

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        width="100%"
        height={400}
        videoConstraints={{
          width: 640,
          height: 480,
          facingMode: "user"
        }}
        mirrored={true}
        style={{ borderRadius: '8px' }}
      />
      
      {/* Hướng dẫn vị trí khuôn mặt */}
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '45%',
        height: '60%',
        border: '2px dashed rgba(255,255,255,0.6)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />
      
      {/* Hiển thị đếm ngược */}
      {countdown !== null && (
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 80,
          height: 80,
          borderRadius: '50%',
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          fontWeight: 'bold',
          color: 'white'
        }}>
          {countdown}
        </Box>
      )}
      
      {/* Hiển thị trạng thái xử lý */}
      {processing && (
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px'
        }}>
          <CircularProgress color="primary" />
          <Typography color="white" mt={1}>
            Đang nhận diện...
          </Typography>
        </Box>
      )}
      
      {/* Hiển thị lỗi */}
      {error && (
        <Alert severity="error" sx={{ mt: 1, width: '100%' }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}

export default FaceRecognition;
