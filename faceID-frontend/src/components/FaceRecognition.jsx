import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Box, Button, Typography, CircularProgress, Alert } from '@mui/material';
import axios from 'axios';

function FaceRecognition({ onRecognitionResult }) {
  const webcamRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);
  
  // Theo dõi đếm ngược
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
  
  // Bắt đầu nhận diện
  const startRecognition = () => {
    setError(null);
    setCountdown(3);
  };
  
  // Chụp ảnh và gửi lên server để nhận diện
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
      const response = await faceAPI.recognize(imageSrc); // Gửi toàn bộ chuỗi base64
      
      // Trả kết quả về component cha
      onRecognitionResult && onRecognitionResult(response.data);
      
      if (!response.data.success) {
        setError(response.data.message || "Không nhận diện được khuôn mặt");
      }
      
    } catch (err) {
      console.error("Lỗi khi nhận diện:", err);
      setError(err.response?.data?.message || "Có lỗi xảy ra");
      onRecognitionResult && onRecognitionResult({
        success: false,
        message: err.response?.data?.message || "Có lỗi xảy ra"
      });
    } finally {
      setIsCapturing(false);
      setProcessing(false);
    }
  };
  
  return (
    <Box sx={{ width: '100%', position: 'relative', mb: 2 }}>
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
        pointerEvents: 'none'
      }} />
      
      {/* Hiển thị đếm ngược */}
      {countdown && (
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.5rem',
          fontWeight: 'bold'
        }}>
          {countdown}
        </Box>
      )}
      
      {/* Hiển thị loading khi đang xử lý */}
      {processing && (
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
          borderRadius: '8px'
        }}>
          <CircularProgress color="primary" />
        </Box>
      )}
      
      {/* Hiển thị lỗi */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* Nút điểm danh */}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={startRecognition}
          disabled={isCapturing || processing || countdown !== null}
          sx={{ minWidth: 150 }}
        >
          {processing ? "Đang xử lý..." : "Điểm danh"}
        </Button>
      </Box>
    </Box>
  );
}

export default FaceRecognition;