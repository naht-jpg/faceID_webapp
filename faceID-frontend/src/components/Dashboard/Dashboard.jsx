import * as React from 'react';
import { useState, useEffect } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import SideMenu from './components/SideMenu.jsx';
import AppTheme from '../shared-theme/AppTheme.jsx';
import Employees from '../../pages/Employees';
import FaceRegistrationTab from './FaceRegistrationTab';
import FaceRecognitionTab from './FaceRecognitionTab';
import Home from '../../pages/Home';
import AccountManagement from './AccountManagement';
import WorkScheduleTab from './WorkScheduleTab';
import AdminAttendanceTab from './AdminAttendanceTab';
import SalaryCalculationTab from './SalaryCalculationTab';
import { MonetizationOn as MonetizationOnIcon } from '@mui/icons-material';

import {
  chartsCustomizations,
  dataGridCustomizations,
  datePickersCustomizations,
  treeViewCustomizations,
} from './theme/customizations';

const xThemeComponents = {
  ...chartsCustomizations,
  ...dataGridCustomizations,
  ...datePickersCustomizations,
  ...treeViewCustomizations,
};

// Define tabTitles outside the component for clarity
const tabTitles = {
  'home': 'Trang chủ',
  'employees': 'Quản lý nhân viên',
  'face-registration': 'Đăng ký khuôn mặt',
  'face-recognition': 'Nhận diện khuôn mặt',
  'accounts': 'Quản lý tài khoản',
  'work-schedule': 'Lịch làm việc',
  'salary-calculation': 'Tính lương',
  'attendance': 'Quản lý Điểm danh',
  'settings': 'Cài đặt',
  
};

export default function Dashboard(props) {
  const [currentTab, setCurrentTab] = useState('home');
  
  const handleMenuTabChange = (tabName) => {
    setCurrentTab(tabName);
    updateWebTitle(tabName);
  };

  // Hàm cập nhật tiêu đề trang web
  const updateWebTitle = (tab) => {
    const baseTitle = "Face ID System - ";
    document.title = baseTitle + (tabTitles[tab] || "Dashboard");
  };

  // Cập nhật title khi component mount
  useEffect(() => {
    updateWebTitle(currentTab);
  }, [currentTab]);

  // Hàm render nội dung dựa trên tab hiện tại
  const renderContent = () => {
    switch (currentTab) {
      case 'home':
        return <Home onTabChange={handleMenuTabChange}  />;
      case 'employees':
        return <Employees />;
      case 'face-registration':
        return <FaceRegistrationTab />;
      case 'face-recognition':
        return <FaceRecognitionTab />;
      case 'accounts':
        return <AccountManagement />;
      case 'work-schedule':
        return <WorkScheduleTab />;
      case 'attendance':
        return <AdminAttendanceTab />;
      case 'salary-calculation':
        return <SalaryCalculationTab />;
      case 'settings':
        return <Typography variant="h6">Cài đặt</Typography>;
      default:
        return <Home />;
    }
  };

  return (
    <AppTheme {...props} themeComponents={xThemeComponents}>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline enableColorScheme />
        <AppBar position="fixed" sx={{ width: `calc(100% - 240px)`, ml: '240px' }}>
          <Toolbar>
            <Typography variant="h6" noWrap component="div">
              {tabTitles[currentTab]}
            </Typography>
          </Toolbar>
        </AppBar>
        <SideMenu currentTab={currentTab} onTabChange={handleMenuTabChange} />
        <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
          {renderContent()}
        </Box>
      </Box>
    </AppTheme>
  );
}
