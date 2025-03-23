import React from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent } from '@mui/material';

export default function Home() {
  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Trang chủ hệ thống FaceID
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Chào mừng đến với hệ thống quản lý điểm danh bằng khuôn mặt
              </Typography>
              <Typography variant="body1">
                Sử dụng bảng điều khiển bên trái để điều hướng đến các chức năng của hệ thống.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Chức năng chính
            </Typography>
            <Typography paragraph>
              • Quản lý danh sách nhân viên
            </Typography>
            <Typography paragraph>
              • Đăng ký khuôn mặt nhân viên
            </Typography>
            <Typography paragraph>
              • Nhận diện khuôn mặt và điểm danh tự động
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}