// src/components/Dashboard/Dashboard.js

import React, { useState, useEffect } from 'react';
import {
  Container, Grid, Paper, Typography, Box, Card, CardContent,
  CardActionArea, Button, Chip, Alert, useTheme, IconButton, Tooltip,
} from '@mui/material';
import {
  WbSunny as WeatherIcon,
  Chat as ChatIcon,
  Agriculture as AgricultureIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Opacity as OpacityIcon,
  Thermostat as ThermostatIcon,
  Air as WindIcon,
  BugReport as PestIcon,
  WifiOff as OfflineIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/db';
import { format, parseISO, isValid } from 'date-fns';
import { getCurrentWeather, getWeatherForecast, descriptionToCondition } from '../../services/weatherService';

const Dashboard = () => {
  const { user }              = useAuth();
  const { t, language }       = useLanguage();
  const navigate              = useNavigate();
  const theme                 = useTheme();

  const [weather, setWeather]             = useState(null);
  const [weatherIsStale, setWeatherStale] = useState(false);
  const [recentQueries, setRecentQueries] = useState([]);
  const [alerts, setAlerts]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [cropGuides, setCropGuides]       = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // ── Weather: try live API, fall back to cache ──────────────────────
      try {
        const { data, isStale } = await getCurrentWeather();
        setWeather(data);
        setWeatherStale(isStale);

        // Build alerts from the forecast if we're online
        if (!isStale) {
          const forecastResult = await getWeatherForecast(
            data.latitude, data.longitude, 7, data.location_name,
          );
          const forecastAlerts = (forecastResult.data.days || [])
            .filter(d => d.alert)
            .map(d => ({ date: d.date, alert: d.alert }));
          setAlerts(forecastAlerts);
        }
      } catch {
        // Live weather totally unavailable — try IndexedDB fallback
        const cached = await db.weather.orderBy('date').first();
        if (cached) {
          setWeather(cached);
          setWeatherStale(true);
        }
        const weatherAlerts = await db.weather
          .filter(w => w.alert && new Date(w.date) >= new Date())
          .toArray();
        setAlerts(weatherAlerts);
      }

      // ── Recent queries from IndexedDB ─────────────────────────────────
      const queries = await db.queries.orderBy('timestamp').reverse().limit(5).toArray();
      setRecentQueries(queries);

      // ── Crop guides for user's crops ──────────────────────────────────
      if (user?.crops?.length > 0) {
        const guides = [];
        for (const crop of user.crops) {
          const guide = await db.knowledgeBase?.where('crop').equals(crop).first();
          if (guide) guides.push(guide);
        }
        setCropGuides(guides);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const formatDate = (dateString) => {
    try {
      if (!dateString) return '';
      const date = parseISO(dateString);
      return isValid(date) ? format(date, 'MMM d, yyyy') : '';
    } catch {
      return '';
    }
  };

  /**
   * Read a weather value from either the new backend shape (CurrentWeather)
   * or the old IndexedDB mock shape — so the dashboard never crashes during
   * the migration period when stale data may still be in the cache.
   */
  const wx = {
    tempMin:     weather?.temp_min_c     ?? weather?.temp?.min     ?? null,
    tempMax:     weather?.temp_max_c     ?? weather?.temp?.max     ?? null,
    tempCurrent: weather?.temperature_c  ?? weather?.temp?.max     ?? null,
    humidity:    weather?.humidity_pct   ?? weather?.rainChance    ?? null,
    windMs:      weather?.wind_speed_ms  ?? null,
    description: weather?.description    ?? weather?.condition     ?? '',
  };

  const conditionLabel = (desc) => {
    if (language === 'en') return desc;
    const map = { sunny: 'Chesa', rainy: 'Pula', cloudy: 'Khoalifi', stormy: 'Sefefo', 'partly cloudy': 'Khoalifi hanyane' };
    return map[descriptionToCondition(desc)] || desc;
  };

  // ── Sub-components ────────────────────────────────────────────────────────
  const QuickActionCard = ({ title, icon, onClick, color, subtitle }) => (
    <Card sx={{ height: '100%' }}>
      <CardActionArea onClick={onClick} sx={{ height: '100%', p: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 1 }}>
          <Box sx={{ color, fontSize: 40 }}>{icon}</Box>
          <Typography variant="h6" sx={{ fontSize: { xs: '0.9rem', sm: '1.1rem' } }}>{title}</Typography>
          {subtitle && <Typography variant="caption" color="textSecondary">{subtitle}</Typography>}
        </Box>
      </CardActionArea>
    </Card>
  );

  const StatCard = ({ icon, label, value, color }) => (
    <Paper sx={{ p: 2, textAlign: 'center' }}>
      <Box sx={{ color, mb: 1 }}>{icon}</Box>
      <Typography variant="h5">{value}</Typography>
      <Typography variant="body2" color="textSecondary">{label}</Typography>
    </Paper>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <Typography>{language === 'en' ? 'Loading dashboard…' : 'E ntse e jarolla diboto…'}</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          {t('nav.dashboard')}
        </Typography>
        <IconButton onClick={loadDashboardData} color="primary" sx={{ minHeight: 44, minWidth: 44 }}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Welcome */}
      <Paper sx={{
        p: 3, mb: 3, borderRadius: 2, color: 'white',
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
      }}>
        <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.3rem', sm: '2rem' } }}>
          {t('welcome')}, {user?.name || 'Ntate Thabo'}!
        </Typography>
        <Typography variant="body1">
          {language === 'en'
            ? `Your crops: ${user?.crops?.map(c => t(c)).join(', ') || 'Maize, Sorghum'}`
            : `Lijalo tsa hau: ${user?.crops?.map(c => t(c)).join(', ') || 'Poone, Mabele'}`}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
          {language === 'en' ? 'Region' : 'Setereke'}: {user?.region || 'Maseru'}
        </Typography>
      </Paper>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="warning" />
            {language === 'en' ? `Active Alerts (${alerts.length})` : `Litemoso tse Teng (${alerts.length})`}
          </Typography>
          {alerts.slice(0, 2).map((alert, index) => (
            <Alert
              key={index}
              severity="warning"
              icon={<WarningIcon />}
              sx={{ mb: 1 }}
              action={
                <Button color="inherit" size="small" onClick={() => navigate('/weather')} sx={{ minHeight: 44 }}>
                  {language === 'en' ? 'View' : 'Bona'}
                </Button>
              }
            >
              <Typography variant="body2">
                <strong>{formatDate(alert.date)}:</strong> {alert.alert}
              </Typography>
            </Alert>
          ))}
          {alerts.length > 2 && (
            <Button size="small" onClick={() => navigate('/weather')} sx={{ mt: 1, minHeight: 44 }}>
              {language === 'en' ? `View all ${alerts.length} alerts` : `Bona litemoso tse ${alerts.length}`}
            </Button>
          )}
        </Box>
      )}

      {/* Quick Actions */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        {language === 'en' ? 'Quick Actions' : 'Diketsahalo tse Potlakileng'}
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <QuickActionCard title={t('chat.title')} icon={<ChatIcon sx={{ fontSize: 40 }} />}
            onClick={() => navigate('/chat')} color={theme.palette.primary.main}
            subtitle={language === 'en' ? 'Ask questions' : 'Botsa lipotso'} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <QuickActionCard title={t('weather.title')} icon={<WeatherIcon sx={{ fontSize: 40 }} />}
            onClick={() => navigate('/weather')} color={theme.palette.info.main}
            subtitle={language === 'en' ? 'Check forecast' : 'Sheba boemo'} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <QuickActionCard title={language === 'en' ? 'Planting Guide' : 'Tataiso ea Ho Jala'}
            icon={<AgricultureIcon sx={{ fontSize: 40 }} />} onClick={() => navigate('/planting-guide')}
            color={theme.palette.warning.dark}
            subtitle={language === 'en' ? 'Track your crops' : 'Latelela lijalo tsa hau'} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <QuickActionCard title={language === 'en' ? 'Pest Control' : 'Taolo ea Likokonyana'}
            icon={<PestIcon sx={{ fontSize: 40 }} />} onClick={() => navigate('/pest-control')}
            color={theme.palette.secondary.main}
            subtitle={language === 'en' ? 'Manage pests' : 'Laola likokonyana'} />
        </Grid>
      </Grid>

      {/* Weather Summary */}
      {weather && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WeatherIcon sx={{ color: theme.palette.info.main }} />
              {language === 'en' ? "Today's Weather" : 'Boemo ba Leholimo ba Kajeno'}
            </Typography>
            {weatherIsStale && (
              <Tooltip title={language === 'en' ? 'Showing cached data — no connection' : 'Ho bontsha data e bolokiloeng'}>
                <Chip icon={<OfflineIcon />} label={language === 'en' ? 'Cached' : 'E bolokiloe'} size="small" color="warning" variant="outlined" />
              </Tooltip>
            )}
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center' }}>
                <ThermostatIcon sx={{ color: theme.palette.warning.main, fontSize: 30 }} />
                <Typography variant="body2" color="textSecondary">
                  {language === 'en' ? 'Temperature' : 'Mocheso'}
                </Typography>
                {/* Show current temp if available (CurrentWeather), else min–max range (DailyForecast) */}
                <Typography variant="h6">
                  {wx.tempCurrent != null
                    ? `${Math.round(wx.tempCurrent)}°C`
                    : `${Math.round(wx.tempMin ?? 0)}°C – ${Math.round(wx.tempMax ?? 0)}°C`}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center' }}>
                <OpacityIcon sx={{ color: theme.palette.info.main, fontSize: 30 }} />
                <Typography variant="body2" color="textSecondary">
                  {language === 'en' ? 'Humidity' : 'Boleng ba Metsi'}
                </Typography>
                <Typography variant="h6">
                  {wx.humidity != null ? `${Math.round(wx.humidity)}%` : '—'}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center' }}>
                <WindIcon sx={{ color: theme.palette.primary.main, fontSize: 30 }} />
                <Typography variant="body2" color="textSecondary">
                  {language === 'en' ? 'Wind' : 'Moea'}
                </Typography>
                <Typography variant="h6">
                  {wx.windMs != null ? `${wx.windMs.toFixed(1)} m/s` : '—'}
                </Typography>
              </Box>
            </Grid>
            {wx.description && (
              <Grid item xs={12} sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary" sx={{ textTransform: 'capitalize' }}>
                  {conditionLabel(wx.description)}
                </Typography>
              </Grid>
            )}
          </Grid>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <Button variant="outlined" size="small" onClick={() => navigate('/weather')} sx={{ minHeight: 44 }}>
              {language === 'en' ? 'View Full Forecast' : 'Bona Boemo bohle'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Crop Guides */}
      {cropGuides.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {language === 'en' ? 'Your Crop Guides' : 'Litaelo tsa Lijalo tsa Hau'}
          </Typography>
          <Grid container spacing={2}>
            {cropGuides.map((guide) => (
              <Grid item xs={12} sm={6} key={guide.id}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      {language === 'en' ? guide.title : guide.title_st || guide.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" paragraph>
                      {language === 'en' ? guide.content : guide.content_st || guide.content}
                    </Typography>
                    <Chip label={guide.source} size="small"
                      sx={{ backgroundColor: theme.palette.primary.light, color: 'white' }} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Recent Advice */}
      <Typography variant="h6" gutterBottom>
        {language === 'en' ? 'Recent Advice' : 'Likeletso tsa Morao tjena'}
      </Typography>
      <Grid container spacing={2}>
        {recentQueries.length > 0 ? (
          recentQueries.map((query) => (
            <Grid item xs={12} key={query.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="caption" color="textSecondary">
                      {formatDate(query.timestamp)}
                    </Typography>
                    {query.isOffline && (
                      <Chip label={language === 'en' ? 'Offline' : 'Ha u hokahane'}
                        size="small" color="warning" variant="outlined" />
                    )}
                  </Box>
                  <Typography variant="body1" gutterBottom>
                    <strong>Q:</strong> {language === 'en' ? query.question_en || query.question : query.question_st || query.question}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    <strong>A:</strong> {language === 'en' ? query.answer_en || query.answer : query.answer_st || query.answer}
                  </Typography>
                  {query.sources && (
                    <Box sx={{ mt: 1 }}>
                      {query.sources.map((source, idx) => (
                        <Chip key={idx} label={source} size="small" variant="outlined" sx={{ mr: 0.5, mb: 0.5 }} />
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="textSecondary">
                {language === 'en' ? 'No queries yet. Ask Mosupisi a question!' : 'Ha ho lipotso. Botsa Mosupisi potso!'}
              </Typography>
              <Button variant="contained" sx={{ mt: 2, minHeight: 44 }} onClick={() => navigate('/chat')}>
                {language === 'en' ? 'Ask Question' : 'Botsa Potso'}
              </Button>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Stats */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          {language === 'en' ? 'Your Activity' : 'Mesebetsi ea Hau'}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <StatCard icon={<ChatIcon />} label={language === 'en' ? 'Queries' : 'Lipotso'}
              value={recentQueries.length} color={theme.palette.primary.main} />
          </Grid>
          <Grid item xs={4}>
            <StatCard icon={<AgricultureIcon />} label={language === 'en' ? 'Crops' : 'Lijalo'}
              value={user?.crops?.length || 0} color={theme.palette.warning.dark} />
          </Grid>
          <Grid item xs={4}>
            <StatCard icon={<WeatherIcon />} label={language === 'en' ? 'Alerts' : 'Litemoso'}
              value={alerts.length} color={theme.palette.error.main} />
          </Grid>
        </Grid>
      </Box>

    </Container>
  );
};

export default Dashboard;