// components/Layout/Header.js
import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Box,
  useMediaQuery,
  Menu,
  MenuItem,
  Tooltip,
  Divider
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LanguageIcon from '@mui/icons-material/Language';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import BugReportIcon from '@mui/icons-material/BugReport';
import { useTheme } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

const Header = ({ handleDrawerToggle }) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('sm'));
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, toggleLanguage } = useLanguage();
  
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleLanguageClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleLanguageClose = () => {
    setAnchorEl(null);
  };

  const handleLanguageChange = (lang) => {
    if ((lang === 'en' && language !== 'en') || (lang === 'st' && language !== 'st')) {
      toggleLanguage();
    }
    handleLanguageClose();
  };

  const menuItems = [
    { text: t('nav.dashboard'), path: '/' },
    { text: t('nav.chat'), path: '/chat' },
    { text: t('nav.planting'), path: '/planting-guide', icon: <AgricultureIcon /> },
    { text: t('nav.pest'), path: '/pest-control', icon: <BugReportIcon /> },
    { text: t('nav.weather'), path: '/weather' },
    { text: t('nav.profile'), path: '/profile' }
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
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ 
              mr: 2,
              minHeight: 44,
              minWidth: 44
            }}
            aria-label="menu"
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Brand */}
        <Typography
          variant="h6"
          sx={{ 
            flexGrow: 1, 
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer'
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
                  borderBottom: location.pathname === item.path
                    ? '2px solid white'
                    : 'none',
                  borderRadius: 0,
                  mx: 0.5,
                  minHeight: 44,
                  minWidth: 44,
                  px: 1.5,
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.1)'
                  }
                }}
              >
                {item.text}
              </Button>
            ))}

            {/* Language Toggle Button - Desktop */}
            <Tooltip title={language === 'en' ? 'Sesotho' : 'English'}>
              <Button
                onClick={handleLanguageClick}
                startIcon={<LanguageIcon />}
                sx={{
                  color: 'white',
                  ml: 1,
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 2,
                  minHeight: 44,
                  minWidth: 44,
                  px: 2,
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderColor: 'white'
                  }
                }}
              >
                {language === 'en' ? 'Sesotho' : 'English'}
              </Button>
            </Tooltip>
          </Box>
        )}

        {/* Mobile Language Button */}
        {!isDesktop && (
          <IconButton
            color="inherit"
            onClick={handleLanguageClick}
            sx={{
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 2,
              minHeight: 44,
              minWidth: 44
            }}
            aria-label="change language"
          >
            <LanguageIcon />
          </IconButton>
        )}

        {/* Language Selection Menu */}
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleLanguageClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          PaperProps={{
            sx: {
              mt: 1,
              minWidth: 150,
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }
          }}
        >
          <MenuItem 
            onClick={() => handleLanguageChange('en')}
            selected={language === 'en'}
            sx={{
              minHeight: 44,
              py: 1,
              '&.Mui-selected': {
                backgroundColor: 'rgba(15, 61, 46, 0.08)',
                '&:hover': {
                  backgroundColor: 'rgba(15, 61, 46, 0.12)',
                }
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <span>🇬🇧</span>
              <Typography>English</Typography>
              {language === 'en' && (
                <Typography variant="caption" sx={{ ml: 'auto', color: '#4CAF50' }}>
                  ✓
                </Typography>
              )}
            </Box>
          </MenuItem>
          
          <MenuItem 
            onClick={() => handleLanguageChange('st')}
            selected={language === 'st'}
            sx={{
              minHeight: 44,
              py: 1,
              '&.Mui-selected': {
                backgroundColor: 'rgba(15, 61, 46, 0.08)',
                '&:hover': {
                  backgroundColor: 'rgba(15, 61, 46, 0.12)',
                }
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <span>🇱🇸</span>
              <Typography>Sesotho</Typography>
              {language === 'st' && (
                <Typography variant="caption" sx={{ ml: 'auto', color: '#4CAF50' }}>
                  ✓
                </Typography>
              )}
            </Box>
          </MenuItem>
          
          <Divider sx={{ my: 0.5 }} />
          
          <MenuItem 
            onClick={handleLanguageClose}
            sx={{ 
              minHeight: 44,
              color: 'text.secondary',
              fontSize: '0.875rem'
            }}
          >
            <Typography variant="caption" sx={{ width: '100%', textAlign: 'center' }}>
              {language === 'en' ? 'Language changed to Sesotho' : 'Puo e fetotsoe ho English'}
            </Typography>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Header;