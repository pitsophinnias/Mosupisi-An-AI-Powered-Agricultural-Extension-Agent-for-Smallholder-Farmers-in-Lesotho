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
import { Box, CssBaseline, Toolbar, useMediaQuery, useTheme } from '@mui/material';

const drawerWidth = 240;

function App() {
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    seedDatabase();
  }, []);

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />

      <Header handleDrawerToggle={handleDrawerToggle} />

      {isAuthenticated && (
        <Sidebar
          mobileOpen={mobileOpen}
          handleDrawerToggle={handleDrawerToggle}
          //setMobileOpen={setMobileOpen}
        />
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: {
            xs: '100%',
            sm: isAuthenticated ? `calc(100% - ${drawerWidth}px)` : '100%',
          },
          backgroundColor: '#f5f5f5',
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <OfflineBanner />

        <Routes>
          <Route
            path="/login"
            element={!isAuthenticated ? <Login /> : <Navigate to="/" />}
          />
          <Route
            path="/register"
            element={!isAuthenticated ? <Register /> : <Navigate to="/" />}
          />

          <Route
            path="/"
            element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />}
          />
          <Route
            path="/chat"
            element={isAuthenticated ? <ChatInterface /> : <Navigate to="/login" />}
          />
          <Route
            path="/profile"
            element={isAuthenticated ? <Profile /> : <Navigate to="/login" />}
          />
          <Route
            path="/weather"
            element={isAuthenticated ? <WeatherAlerts /> : <Navigate to="/login" />}
          />
          <Route
            path="/planting-guide"
            element={isAuthenticated ? <PlantingGuide /> : <Navigate to="/login" />}
          />
          <Route
            path="/pest-control"
            element={isAuthenticated ? <PestControl /> : <Navigate to="/login" />}
          />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>

        <Footer />
      </Box>
    </Box>
  );
}

export default App;