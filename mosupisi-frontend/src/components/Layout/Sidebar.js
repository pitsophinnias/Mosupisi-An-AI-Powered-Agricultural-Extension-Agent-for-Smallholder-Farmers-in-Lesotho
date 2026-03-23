// components/Layout/Sidebar.js
import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Divider
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ChatIcon from '@mui/icons-material/Chat';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import PersonIcon from '@mui/icons-material/Person';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import BugReportIcon from '@mui/icons-material/BugReport';
import LanguageIcon from '@mui/icons-material/Language';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

const drawerWidth = 250;

const Sidebar = ({ mobileOpen, handleDrawerToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, toggleLanguage } = useLanguage();

  const menuItems = [
    { text: t('nav.dashboard'), icon: <DashboardIcon />, path: '/' },
    { text: t('nav.chat'), icon: <ChatIcon />, path: '/chat' },
    { text: t('nav.planting'), icon: <AgricultureIcon />, path: '/planting-guide' },
    { text: t('nav.pest'), icon: <BugReportIcon />, path: '/pest-control' },
    { text: t('nav.weather'), icon: <WbSunnyIcon />, path: '/weather' },
    { text: t('nav.profile'), icon: <PersonIcon />, path: '/profile' }
  ];

  return (
    <Drawer
      variant="temporary"
      open={mobileOpen}
      onClose={handleDrawerToggle}
      ModalProps={{ keepMounted: true }}
      sx={{
        display: { xs: 'block', sm: 'none' },
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          borderRight: 'none',
          background: 'linear-gradient(180deg, #0f3d2e 0%, #145a32 100%)',
          color: 'white'
        }
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          🌱 Mosupisi
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          {language === 'en' ? 'AI Agricultural Assistant' : 'Moemeli oa Temo oa AI'}
        </Typography>
      </Box>

      {/* Main Menu Items */}
      <List sx={{ px: 2, flex: 1 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  handleDrawerToggle();
                }}
                sx={{
                  borderRadius: 2,
                  minHeight: 44,
                  backgroundColor: isActive
                    ? 'rgba(255,255,255,0.18)'
                    : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.12)'
                  }
                }}
              >
                <ListItemIcon sx={{ color: 'white', minWidth: 38 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 400
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Language Section at Bottom */}
      <Box sx={{ 
        p: 2,
        borderTop: '1px solid rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(0,0,0,0.2)'
      }}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={toggleLanguage}
            sx={{
              borderRadius: 2,
              minHeight: 44,
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.12)'
              }
            }}
          >
            <ListItemIcon sx={{ color: 'white', minWidth: 38 }}>
              <LanguageIcon />
            </ListItemIcon>
            <ListItemText
              primary={language === 'en' ? 'Sesotho' : 'English'}
              secondary={language === 'en' ? 'Switch language' : 'Fetola puo'}
              primaryTypographyProps={{
                fontWeight: 400,
                fontSize: '0.9rem'
              }}
              secondaryTypographyProps={{
                sx: { color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem' }
              }}
            />
          </ListItemButton>
        </ListItem>
      </Box>
    </Drawer>
  );
};

export default Sidebar;