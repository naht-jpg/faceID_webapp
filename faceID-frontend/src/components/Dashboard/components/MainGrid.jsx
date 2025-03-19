import * as React from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Copyright from '../internals/components/Copyright';
import ChartUserByCountry from './ChartUserByCountry';
import CustomizedTreeView from './CustomizedTreeView';
import CustomizedDataGrid from './CustomizedDataGrid';
import HighlightedCard from './HighlightedCard';
import PageViewsBarChart from './PageViewsBarChart';
import SessionsChart from './SessionsChart';
import StatCard from './StatCard';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventNoteIcon from '@mui/icons-material/EventNote';

// Thay đổi dữ liệu thống kê phù hợp với hệ thống FaceID
const data = [
  {
    title: 'Tổng nhân viên',
    value: '253',
    interval: 'Đang hoạt động',
    trend: 'up',
    icon: <PersonIcon />,
    data: [
      220, 230, 240, 245, 250, 248, 249, 250, 251, 251, 252, 252, 252, 253, 253, 253,
      253, 253, 253, 253, 253, 253, 253, 253, 253, 253, 253, 253, 253, 253,
    ],
  },
  {
    title: 'Điểm danh hôm nay',
    value: '196',
    interval: 'Tỉ lệ: 77.5%',
    trend: 'up',
    icon: <CheckCircleIcon />,
    data: [
      0, 5, 20, 45, 80, 120, 130, 150, 160, 165, 170, 175, 180, 185, 190, 192,
      193, 195, 195, 195, 196, 196, 196, 196, 196, 196, 196, 196, 196, 196,
    ],
  },
  {
    title: 'Thời gian nhận diện',
    value: '1.2s',
    interval: 'Trung bình',
    trend: 'down',
    icon: <AccessTimeIcon />,
    data: [
      2.5, 2.4, 2.3, 2.1, 2.0, 1.9, 1.8, 1.7, 1.6, 1.5, 1.5, 1.4, 1.4, 1.3, 1.3, 1.3,
      1.3, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2,
    ],
  },
];

export default function MainGrid() {
  return (
    <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
      {/* Thay đổi tiêu đề section */}
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        Tổng quan hệ thống
      </Typography>
      <Grid
        container
        spacing={2}
        columns={12}
        sx={{ mb: (theme) => theme.spacing(2) }}
      >
        {data.map((card, index) => (
          <Grid key={index} item xs={12} sm={6} lg={4}>
            <StatCard {...card} />
          </Grid>
        ))}
        <Grid item xs={12} sm={6} lg={4}>
          <HighlightedCard 
            title="Tỉ lệ nhận diện thành công"
            value="99.8%"
            description="Độ chính xác cao, đảm bảo an ninh hệ thống"
            icon={<EventNoteIcon fontSize="large" />}
          />
        </Grid>
        {/* Đổi tên biểu đồ phù hợp với dữ liệu điểm danh */}
        <Grid item xs={12} md={6}>
          <SessionsChart title="Thống kê điểm danh theo tuần" />
        </Grid>
        <Grid item xs={12} md={6}>
          <PageViewsBarChart title="Phân bố thời gian điểm danh" />
        </Grid>
      </Grid>
      
      <Typography component="h2" variant="h6" sx={{ mb: 2, mt: 4 }}>
        Lịch sử điểm danh gần đây
      </Typography>
      <Grid container spacing={2} columns={12}>
        <Grid item xs={12} lg={9}>
          <CustomizedDataGrid 
            title="Nhân viên điểm danh hôm nay"
            columns={[
              { field: 'name', headerName: 'Tên nhân viên', width: 200 },
              { field: 'time', headerName: 'Thời gian điểm danh', width: 200 },
              { field: 'department', headerName: 'Phòng ban', width: 200 },
              { field: 'status', headerName: 'Trạng thái', width: 120 },
            ]}
          />
        </Grid>
        <Grid item xs={12} lg={3}>
          <Stack gap={2} direction={{ xs: 'column', sm: 'row', lg: 'column' }}>
            <CustomizedTreeView title="Cơ cấu phòng ban" />
            <ChartUserByCountry title="Tỉ lệ điểm danh theo bộ phận" />
          </Stack>
        </Grid>
      </Grid>
      <Copyright sx={{ my: 4 }} />
    </Box>
  );
}
