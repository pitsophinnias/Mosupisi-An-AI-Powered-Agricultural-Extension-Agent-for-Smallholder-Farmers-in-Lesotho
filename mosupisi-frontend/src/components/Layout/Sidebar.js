import React from 'react';
import {
  Drawer, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Box, Typography, Divider
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ChatIcon from '@mui/icons-material/Chat';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import PersonIcon from '@mui/icons-material/Person';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import BugReportIcon from '@mui/icons-material/BugReport';
import TranslateIcon from '@mui/icons-material/Translate';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

const drawerWidth = 250;

const Sidebar = ({ mobileOpen, handleDrawerToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, toggleLanguage } = useLanguage();
  const { user, logout } = useAuth();

  const menuItems = [
    { text: t('nav.dashboard'), icon: <DashboardIcon />, path: '/' },
    { text: t('nav.chat'), icon: <ChatIcon />, path: '/chat' },
    { text: t('nav.planting'), icon: <AgricultureIcon />, path: '/planting-guide' },
    { text: t('nav.pest'), icon: <BugReportIcon />, path: '/pest-control' },
    { text: t('nav.weather'), icon: <WbSunnyIcon />, path: '/weather' },
    { text: t('nav.profile'), icon: <PersonIcon />, path: '/profile' },
  ];

  const handleNavClick = (path) => {
    navigate(path);
    handleDrawerToggle();
  };

  const handleLogout = () => {
    handleDrawerToggle();
    logout();
    navigate('/login');
  };

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
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          🌱 Mosupisi
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          {language === 'en' ? 'AI Agricultural Assistant' : 'Moemeli oa Temo oa AI'}
        </Typography>
      </Box>

      {/* User info */}
      {user && (
        <>
          <Box sx={{ px: 2, pb: 1.5 }}>
            <Typography variant="body2" fontWeight={600} sx={{ opacity: 0.95 }}>
              {user.name}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              {user.mobile}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        </>
      )}

      {/* Nav items */}
      <List sx={{ px: 2, flex: 1, mt: 1 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => handleNavClick(item.path)}
                sx={{
                  borderRadius: 2, minHeight: 44,
                  backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.12)' }
                }}
              >
                <ListItemIcon sx={{ color: 'white', minWidth: 38 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{ fontWeight: isActive ? 600 : 400 }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Bottom: Language + Logout */}
      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
        {/* Language toggle */}
        <ListItem disablePadding>
          <ListItemButton
            onClick={toggleLanguage}
            sx={{
              minHeight: 44, px: 2,
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.12)' }
            }}
          >
            <ListItemIcon sx={{ color: 'white', minWidth: 38 }}>
              <TranslateIcon />
            </ListItemIcon>
            <ListItemText
              primary={language === 'en' ? '🇬🇧 English' :'🇱🇸 Sesotho' }
              secondary={language === 'en' ? 'Switch language' : 'Fetola puo'}
              primaryTypographyProps={{ fontWeight: 400, fontSize: '0.9rem' }}
              secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem' } }}
            />
          </ListItemButton>
        </ListItem>

        {/* Logout */}
        <ListItem disablePadding>
          <ListItemButton
            onClick={handleLogout}
            sx={{
              minHeight: 44, px: 2,
              '&:hover': { backgroundColor: 'rgba(255,50,50,0.2)' }
            }}
          >
            <ListItemIcon sx={{ color: '#ff6b6b', minWidth: 38 }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText
              primary={language === 'en' ? 'Log Out' : 'Tsoa'}
              primaryTypographyProps={{ fontWeight: 400, fontSize: '0.9rem', color: '#ff6b6b' }}
            />
          </ListItemButton>
        </ListItem>
      </Box>
    </Drawer>
  );
};

export default Sidebar;