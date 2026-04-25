import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { seedDatabase } from './db/db';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import Footer from './components/Layout/Footer';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './components/Dashboard/Dashboard';
import ChatInterface from './components/Chat/ChatInterface';
import Profile from './components/Profile/Profile';
import WeatherAlerts from './components/Weather/WeatherAlerts';
import OfflineBanner from './components/Common/OfflineBanner';
import PlantingGuide from './components/PlantingGuide/PlantingGuide';
import PestControl from './components/PestControl/PestControl';
import { Box, CssBaseline, Toolbar, CircularProgress } from '@mui/material';

function App() {
  const { isAuthenticated, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    seedDatabase();
  }, []);

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />

      <Header handleDrawerToggle={handleDrawerToggle} />

      {isAuthenticated && (
        <Sidebar
          mobileOpen={mobileOpen}
          handleDrawerToggle={handleDrawerToggle}
        />
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: '100%',
          backgroundColor: '#f5f5f5',
          minHeight: '100vh',
          ...(!isAuthenticated && {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }),
        }}
      >
        <Toolbar />
        <OfflineBanner />

        <Routes>
          <Route path="/login"    element={!isAuthenticated ? <Login />    : <Navigate to="/" replace />} />
          <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" replace />} />

          <Route path="/"              element={isAuthenticated ? <Dashboard />    : <Navigate to="/login" replace />} />
          <Route path="/chat"          element={isAuthenticated ? <ChatInterface /> : <Navigate to="/login" replace />} />
          <Route path="/profile"       element={isAuthenticated ? <Profile />      : <Navigate to="/login" replace />} />
          <Route path="/weather"       element={isAuthenticated ? <WeatherAlerts /> : <Navigate to="/login" replace />} />
          <Route path="/planting-guide" element={isAuthenticated ? <PlantingGuide /> : <Navigate to="/login" replace />} />
          <Route path="/pest-control"  element={isAuthenticated ? <PestControl />  : <Navigate to="/login" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Footer />
      </Box>
    </Box>
  );
}

export default App;