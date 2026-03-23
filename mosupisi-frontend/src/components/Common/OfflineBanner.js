import React, { useState, useEffect } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { WifiOff as WifiOffIcon, Wifi as WifiIcon } from '@mui/icons-material';
import { useLanguage } from '../../context/LanguageContext';

const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };
    
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {/* Offline Banner */}
      <Snackbar
        open={isOffline}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          severity="warning" 
          icon={<WifiOffIcon />}
          sx={{ width: '100%' }}
        >
          {t('offline')}
        </Alert>
      </Snackbar>

      {/* Reconnected Message */}
      <Snackbar
        open={showReconnected}
        autoHideDuration={3000}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={() => setShowReconnected(false)}
      >
        <Alert 
          severity="success" 
          icon={<WifiIcon />}
          sx={{ width: '100%' }}
        >
          {t('online')}
        </Alert>
      </Snackbar>
    </>
  );
};

export default OfflineBanner;