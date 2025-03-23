import * as React from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import HomeIcon from '@mui/icons-material/Home';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import FaceIcon from '@mui/icons-material/Face';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import { useAuth } from '../../../AuthContext';
import { useNavigate } from 'react-router-dom';

const drawerWidth = 240;

export default function SideMenu({ currentTab, onTabChange }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  
  const menuItems = [
    { 
      id: 'home', 
      icon: <HomeIcon />, 
      text: 'Trang chủ' 
    },
    { 
      id: 'employees', 
      icon: <PeopleIcon />, 
      text: 'Quản lý nhân viên' 
    },
    { 
      id: 'face-registration', 
      icon: <PersonAddIcon />, 
      text: 'Đăng ký khuôn mặt' 
    },
    { 
      id: 'face-recognition', 
      icon: <FaceIcon />, 
      text: 'Nhận diện khuôn mặt' 
    },
    { 
      id: 'accounts', 
      icon: <ManageAccountsIcon />, 
      text: 'Quản lý tài khoản' 
    }
  ];
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Drawer
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
        },
      }}
      variant="permanent"
      anchor="left"
    >
      <Box sx={{ height: '64px', display: 'flex', alignItems: 'center', px: 2 }}>
        <img src="/vite.svg" alt="Logo" style={{ height: '32px' }} />
        <Box sx={{ ml: 1, fontWeight: 'bold' }}>Face ID System</Box>
      </Box>
      
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.id} disablePadding>
            <ListItemButton 
              selected={currentTab === item.id}
              onClick={() => onTabChange(item.id)}
            >
              <ListItemIcon>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      
      <Box sx={{ mt: 'auto' }}>
        <List>
          <ListItem disablePadding>
            <ListItemButton>
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText primary="Cài đặt" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary="Đăng xuất" />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Drawer>
  );
}
