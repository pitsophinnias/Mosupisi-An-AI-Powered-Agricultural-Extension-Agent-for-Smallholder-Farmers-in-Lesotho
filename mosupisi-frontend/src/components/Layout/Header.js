import React, { useState } from 'react';
import {
  AppBar, Toolbar, Typography, IconButton, Button, Box,
  useMediaQuery, Menu, MenuItem, Tooltip, Divider, Avatar
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import TranslateIcon from '@mui/icons-material/Translate';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import BugReportIcon from '@mui/icons-material/BugReport';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ChatIcon from '@mui/icons-material/Chat';
import WeatherIcon from '@mui/icons-material/WbSunny';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import { useTheme } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

const Header = ({ handleDrawerToggle }) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('sm'));
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, toggleLanguage } = useLanguage();
  const { user, logout, isAuthenticated } = useAuth();

  const [langAnchorEl, setLangAnchorEl] = useState(null);
  const [userAnchorEl, setUserAnchorEl] = useState(null);
  const langOpen = Boolean(langAnchorEl);
  const userOpen = Boolean(userAnchorEl);

  const handleLanguageClick = (e) => setLangAnchorEl(e.currentTarget);
  const handleLanguageClose = () => setLangAnchorEl(null);
  const handleUserClick = (e) => setUserAnchorEl(e.currentTarget);
  const handleUserClose = () => setUserAnchorEl(null);

  const handleLanguageChange = (lang) => {
    if ((lang === 'en' && language !== 'en') || (lang === 'st' && language !== 'st')) {
      toggleLanguage();
    }
    handleLanguageClose();
  };

  const handleLogout = () => {
    handleUserClose();
    logout();
    navigate('/login');
  };

  const menuItems = [
    { text: t('nav.dashboard'), path: '/', icon: <DashboardIcon sx={{ fontSize: 18 }} /> },
    { text: t('nav.chat'), path: '/chat', icon: <ChatIcon sx={{ fontSize: 18 }} /> },
    { text: t('nav.planting'), path: '/planting-guide', icon: <AgricultureIcon sx={{ fontSize: 18 }} /> },
    { text: t('nav.pest'), path: '/pest-control', icon: <BugReportIcon sx={{ fontSize: 18 }} /> },
    { text: t('nav.weather'), path: '/weather', icon: <WeatherIcon sx={{ fontSize: 18 }} /> },
  ];

  return (
    <AppBar
      position="fixed"
      sx={{
        background: 'linear-gradient(90deg, #0f3d2e, #145a32)',
        zIndex: theme.zIndex.drawer + 1
      }}
    >
      <Toolbar>
        {/* Mobile Menu Button */}
        {!isDesktop && (
          <IconButton
            color="inherit" edge="start" onClick={handleDrawerToggle}
            sx={{ mr: 2, minHeight: 44, minWidth: 44 }}
            aria-label="menu"
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Brand */}
        <Typography
          variant="h6"
          sx={{
            flexGrow: 1, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer'
          }}
          onClick={() => navigate('/')}
        >
          <span role="img" aria-label="sprout">🌱</span>
          {t('app.name')}
        </Typography>

        {/* Desktop Navigation */}
        {isDesktop && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {menuItems.map((item) => (
              <Button
                key={item.path}
                onClick={() => navigate(item.path)}
                startIcon={item.icon}
                sx={{
                  color: 'white',
                  fontWeight: location.pathname === item.path ? 600 : 400,
                  borderBottom: location.pathname === item.path ? '2px solid white' : 'none',
                  borderRadius: 0, mx: 0.5, minHeight: 44, px: 1.5,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                }}
              >
                {item.text}
              </Button>
            ))}

            {/* Language Toggle */}
            <Tooltip title={language === 'en' ? 'Switch to Sesotho' : 'Fetola ho Sesotho'}>
              <Button
                onClick={handleLanguageClick}
                startIcon={<TranslateIcon sx={{ fontSize: '16px !important' }} />}
                sx={{
                  color: 'white',
                  ml: 1,
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 2,
                  minHeight: 34,
                  height: 34,
                  px: 1.5,
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderColor: 'white'
                  }
                }}
              >
                {language === 'en' ? 'English' : 'Sesotho'}
              </Button>
            </Tooltip>

            {/* User Avatar + Menu */}
            {isAuthenticated && (
              <Tooltip title={user?.name || 'Account'}>
                <IconButton onClick={handleUserClick} sx={{ ml: 1 }}>
                  <Avatar
                    sx={{
                      width: 36, height: 36,
                      bgcolor: 'rgba(255,255,255,0.25)',
                      color: 'white', fontSize: '1rem', fontWeight: 600,
                      border: '2px solid rgba(255,255,255,0.4)'
                    }}
                  >
                    {user?.name?.charAt(0)?.toUpperCase() || 'F'}
                  </Avatar>
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}

        {/* Mobile: Language + Avatar */}
        {!isDesktop && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              color="inherit"
              onClick={handleLanguageClick}
              sx={{
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 2,
                width: 30,
                height: 30,
                padding: 0,
              }}
            >
              <TranslateIcon sx={{ fontSize: 14 }} />
            </IconButton>

            {isAuthenticated && (
              <IconButton onClick={handleUserClick} sx={{ p: 0.5 }}>
                <Avatar
                  sx={{
                    width: 34, height: 34,
                    bgcolor: 'rgba(255,255,255,0.25)',
                    color: 'white', fontSize: '0.9rem', fontWeight: 600,
                    border: '2px solid rgba(255,255,255,0.4)'
                  }}
                >
                  {user?.name?.charAt(0)?.toUpperCase() || 'F'}
                </Avatar>
              </IconButton>
            )}
          </Box>
        )}

        {/* Language Menu */}
        <Menu
          anchorEl={langAnchorEl} open={langOpen} onClose={handleLanguageClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { mt: 1, minWidth: 150, borderRadius: 2 } }}
        >
          <MenuItem
            onClick={() => handleLanguageChange('en')} selected={language === 'en'}
            sx={{ minHeight: 44 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <span>🇬🇧</span>
              <Typography>English</Typography>
              {language === 'en' && <Typography variant="caption" sx={{ ml: 'auto', color: '#4CAF50' }}>✓</Typography>}
            </Box>
          </MenuItem>
          <MenuItem
            onClick={() => handleLanguageChange('st')} selected={language === 'st'}
            sx={{ minHeight: 44 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <span>🇱🇸</span>
              <Typography>Sesotho</Typography>
              {language === 'st' && <Typography variant="caption" sx={{ ml: 'auto', color: '#4CAF50' }}>✓</Typography>}
            </Box>
          </MenuItem>
        </Menu>

        {/* User Menu */}
        <Menu
          anchorEl={userAnchorEl} open={userOpen} onClose={handleUserClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { mt: 1, minWidth: 180, borderRadius: 2 } }}
        >
          {/* User info header */}
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              {user?.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.mobile}
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={() => { handleUserClose(); navigate('/profile'); }} sx={{ minHeight: 44, gap: 1.5 }}>
            <PersonIcon fontSize="small" color="action" />
            <Typography>{language === 'en' ? 'My Profile' : 'Boitsebiso baka'}</Typography>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout} sx={{ minHeight: 44, gap: 1.5, color: 'error.main' }}>
            <LogoutIcon fontSize="small" />
            <Typography>{language === 'en' ? 'Log Out' : 'Tsoa'}</Typography>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Header;