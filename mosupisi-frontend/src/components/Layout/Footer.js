import React from 'react';
import { Box, Typography, Link, Container, useTheme } from '@mui/material';
import { useLanguage } from '../../context/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();
  const theme = useTheme();
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        backgroundColor: theme.palette.secondary.light,
        color: 'white',
        width: '100%',
        position: 'relative',
        bottom: 0,
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography variant="body2">
            © {currentYear} {t('app.name')}. All rights reserved.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Link
              href="#"
              color="inherit"
              underline="hover"
              sx={{ cursor: 'pointer' }}
            >
              Privacy Policy
            </Link>
            <Link
              href="#"
              color="inherit"
              underline="hover"
              sx={{ cursor: 'pointer' }}
            >
              Terms of Service
            </Link>
            <Link
              href="#"
              color="inherit"
              underline="hover"
              sx={{ cursor: 'pointer' }}
            >
              Feedback
            </Link>
          </Box>
        </Box>
        
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 2,
            opacity: 0.8,
          }}
        >
          Supporting smallholder farmers in Lesotho with AI-powered agricultural advice
        </Typography>
      </Container>
    </Box>
  );
};

export default Footer;