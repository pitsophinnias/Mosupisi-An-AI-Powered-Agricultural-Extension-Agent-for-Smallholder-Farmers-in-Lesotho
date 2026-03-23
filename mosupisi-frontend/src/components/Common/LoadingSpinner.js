import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useLanguage } from '../../context/LanguageContext';

const LoadingSpinner = ({ message }) => {
  const { language } = useLanguage();
  
  const defaultMessage = language === 'en' 
    ? 'Loading...' 
    : 'E ntse e jarolla...';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        gap: 2
      }}
    >
      <CircularProgress size={60} thickness={4} />
      <Typography variant="body1" color="textSecondary">
        {message || defaultMessage}
      </Typography>
    </Box>
  );
};

export default LoadingSpinner;