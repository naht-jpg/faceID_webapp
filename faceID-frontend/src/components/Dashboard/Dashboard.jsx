import * as React from 'react';
import { useState } from 'react';
import { alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import AppNavbar from './components/AppNavbar.jsx';
import Header from './components/Header.jsx';
import MainGrid from './components/MainGrid.jsx';
import SideMenu from './components/SideMenu.jsx';
import AppTheme from '../shared-theme/AppTheme.jsx';
import Employees from '../../pages/Employees'; // Import component Employees

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

export default function Dashboard(props) {
  const [currentTab, setCurrentTab] = useState('home');

  const handleTabChange = (tabName) => {
    setCurrentTab(tabName);
    // Cập nhật web title dựa trên tab hiện tại
    updateWebTitle(tabName);
  };

  // Hàm cập nhật tiêu đề trang web
  const updateWebTitle = (tab) => {
    const baseTitle = "Face ID System - ";
    switch(tab) {
      case 'home':
        document.title = baseTitle + "Trang chủ";
        break;
      case 'employees':
        document.title = baseTitle + "Quản lý nhân viên";
        break;
      default:
        document.title = baseTitle + "Dashboard";
    }
  };

  // Cập nhật title khi component mount
  React.useEffect(() => {
    updateWebTitle(currentTab);
  }, []);

  return (
    <AppTheme {...props} themeComponents={xThemeComponents}>
      <CssBaseline enableColorScheme />
      <Box sx={{ display: 'flex' }}>
        <SideMenu currentTab={currentTab} onTabChange={handleTabChange} />
        <AppNavbar currentTab={currentTab} />
        {/* Main content */}
        <Box
          component="main"
          sx={(theme) => ({
            flexGrow: 1,
            backgroundColor: theme.vars
              ? `rgba(${theme.vars.palette.background.defaultChannel} / 1)`
              : alpha(theme.palette.background.default, 1),
            overflow: 'auto',
          })}
        >
          <Stack
            spacing={2}
            sx={{
              alignItems: 'center',
              mx: 3,
              pb: 5,
              mt: { xs: 8, md: 0 },
            }}
          >
            <Header currentTab={currentTab} />
            {/* Hiển thị nội dung dựa trên tab hiện tại */}
            {currentTab === 'home' ? (
              <MainGrid />
            ) : currentTab === 'employees' ? (
              <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
                <Employees />
              </Box>
            ) : null}
          </Stack>
        </Box>
      </Box>
    </AppTheme>
  );
}
