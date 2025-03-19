import React, { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

function FaceRecognition({ onRecognitionResult }) {
    const webcamRef = useRef(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [countdown, setCountdown] = useState(null);
    
    // Video constraints
    const videoConstraints = {
        width: 640,
        height: 480,
        facingMode: "user"
    };

    // Giả lập phát hiện khuôn mặt và đếm ngược
    useEffect(() => {
        let faceDetectionTimer = null;
        let detectedFaceCount = 0;

        const checkForFace = () => {
            // Giả lập phát hiện khuôn mặt
            detectedFaceCount++;
            
            // Nếu phát hiện khuôn mặt liên tục, bắt đầu đếm ngược
            if (detectedFaceCount > 3 && !processing && countdown === null) {
                setCountdown(3);
            }
        };

        // Chạy kiểm tra mỗi 500ms
        faceDetectionTimer = setInterval(checkForFace, 500);

        return () => {
            clearInterval(faceDetectionTimer);
        };
    }, [processing, countdown]);

    // Đếm ngược và chụp ảnh
    useEffect(() => {
        let timer;
        if (countdown !== null && countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        } else if (countdown === 0) {
            captureAndRecognize();
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    // Demo nhận diện khuôn mặt (trong môi trường thực tế, điều này sẽ kết nối với backend)
    const captureAndRecognize = async () => {
        if (webcamRef.current && !processing) {
            setProcessing(true);
            setError(null);
            
            try {
                const imageSrc = webcamRef.current.getScreenshot();
                if (!imageSrc) {
                    throw new Error("Không thể chụp ảnh");
                }
                
                // Trong môi trường thực tế, hãy gửi hình ảnh đến API của bạn
                // Demo cho mục đích hiển thị UI
                setTimeout(() => {
                    const demoResult = {
                        success: true,
                        name: "Nguyễn Văn A",
                        timestamp: new Date().toISOString()
                    };
                    
                    onRecognitionResult && onRecognitionResult(demoResult);
                    setProcessing(false);
                    setCountdown(null);
                }, 2000);
                
                // Trong thực tế:
                /*
                const base64Image = imageSrc.split(',')[1];
                const response = await axios.post(`${API_URL}/recognize-face/`, { image: base64Image });
                
                if (response.data.success) {
                    onRecognitionResult && onRecognitionResult({
                        success: true,
                        name: response.data.name,
                        timestamp: response.data.timestamp
                    });
                } else {
                    setError("Không nhận diện được khuôn mặt. Vui lòng thử lại.");
                }
                setProcessing(false);
                setCountdown(null);
                */
            } catch (err) {
                console.error("Lỗi khi nhận diện:", err);
                setError("Có lỗi xảy ra, vui lòng thử lại.");
                setProcessing(false);
                setCountdown(null);
            }
        }
    };

    return (
        <Box sx={{
            width: '100%',
            height: '100%',
            position: 'relative',
            borderRadius: '8px',
            overflow: 'hidden'
        }}>
            <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                }}
                mirrored={true}
            />
            
            {/* Khung hướng dẫn */}
            <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '60%',
                height: '60%',
                border: '2px dashed rgba(255, 255, 255, 0.7)',
                borderRadius: '50%',
                pointerEvents: 'none'
            }} />
            
            {/* Đếm ngược */}
            {countdown !== null && countdown > 0 && (
                <Box sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '3rem'
                }}>
                    {countdown}
                </Box>
            )}
            
            {/* Hiển thị loading */}
            {processing && (
                <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <CircularProgress color="primary" />
                    <Typography variant="body2" sx={{ mt: 2, color: 'white' }}>
                        Đang xử lý...
                    </Typography>
                </Box>
            )}
            
            {/* Thông báo lỗi */}
            {error && (
                <Box sx={{
                    position: 'absolute',
                    bottom: 10,
                    left: 10,
                    right: 10
                }}>
                    <Alert severity="error">{error}</Alert>
                </Box>
            )}
        </Box>
    );
}

export default FaceRecognition;
