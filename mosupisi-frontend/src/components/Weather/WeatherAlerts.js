// src/components/Weather/WeatherAlerts.js
//
// Fetches live forecast from the weather service backend.
// Falls back to IndexedDB cache when offline.
// All field names match the backend DailyForecast schema.

import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Chip,
  Alert,
  useTheme,
  LinearProgress,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  WbSunny as SunnyIcon,
  Cloud as CloudyIcon,
  Grain as RainIcon,
  Thunderstorm as StormIcon,
  Warning as WarningIcon,
  Thermostat as TempIcon,
  Opacity as HumidityIcon,
  Air as WindIcon,
  CalendarToday as CalendarIcon,
  WifiOff as OfflineIcon,
  Refresh as RefreshIcon,
  Agriculture as FarmIcon,
  LightMode as SolarIcon,
} from '@mui/icons-material';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';
import {
  getWeatherForecast,
  evaluateAlerts,
  getCurrentWeather,
  descriptionToCondition,
} from '../../services/weatherService';

// ── Config ─────────────────────────────────────────────────────────────────
// Default to Maseru; in production, read from farmer profile / geolocation
const DEFAULT_LAT  = -29.3167;
const DEFAULT_LON  =  27.4833;
const DEFAULT_NAME = 'Maseru';

// ── Component ──────────────────────────────────────────────────────────────
const WeatherAlerts = () => {
  const [forecastDays, setForecastDays]   = useState([]);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [alerts, setAlerts]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [isOffline, setIsOffline]         = useState(false);
  const [lastUpdated, setLastUpdated]     = useState(null);

  const { t, language } = useLanguage();
  const theme = useTheme();

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadWeatherData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch current conditions and forecast in parallel
      const [currentResult, forecastResult] = await Promise.allSettled([
        getCurrentWeather(DEFAULT_LAT, DEFAULT_LON, DEFAULT_NAME),
        getWeatherForecast(DEFAULT_LAT, DEFAULT_LON, 7, DEFAULT_NAME),
      ]);

      // Current weather
      if (currentResult.status === 'fulfilled') {
        setCurrentWeather(currentResult.value.data);
        setIsOffline(currentResult.value.isStale);
      }

      // Forecast
      if (forecastResult.status === 'fulfilled') {
        const { data, isStale } = forecastResult.value;
        const days = data.days || [];
        setForecastDays(days);
        setIsOffline(prev => prev || isStale);
        setLastUpdated(new Date());

        // Evaluate alerts from the forecast data
        if (currentResult.status === 'fulfilled' && !isStale) {
          try {
            const liveAlerts = await evaluateAlerts(currentResult.value.data);
            setAlerts(liveAlerts);
          } catch {
            // Alert evaluation failure is non-fatal
            const staticAlerts = days
              .filter(d => d.alert)
              .map(d => ({ title: 'Weather Alert', message: d.alert, severity: 'warning' }));
            setAlerts(staticAlerts);
          }
        }
      } else {
        throw new Error(forecastResult.reason?.message || 'Forecast unavailable');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeatherData();
  }, [loadWeatherData]);

  // ── Icon helpers ──────────────────────────────────────────────────────────
  const getWeatherIcon = (description, size = 40) => {
    const condition = descriptionToCondition(description);
    const sx = { fontSize: size };
    switch (condition) {
      case 'sunny':       return <SunnyIcon sx={{ ...sx, color: theme.palette.warning.main }} />;
      case 'rainy':       return <RainIcon  sx={{ ...sx, color: theme.palette.info.main }} />;
      case 'cloudy':      return <CloudyIcon sx={{ ...sx, color: theme.palette.grey[500] }} />;
      case 'stormy':      return <StormIcon  sx={{ ...sx, color: theme.palette.error.main }} />;
      case 'partly cloudy': return <CloudyIcon sx={{ ...sx, color: theme.palette.grey[400] }} />;
      default:            return <SunnyIcon sx={{ ...sx, color: theme.palette.warning.main }} />;
    }
  };

  const getConditionText = (description) => {
    if (language === 'en') return description;
    const translations = {
      sunny:          'Chesa',
      rainy:          'Pula',
      cloudy:         'Khoalifi',
      stormy:         'Sefefo',
      'partly cloudy':'Khoalifi hanyane',
      clear:          'Bopalami',
    };
    const key = descriptionToCondition(description);
    return translations[key] || description;
  };

  // ── Farming tip generator ─────────────────────────────────────────────────
  const getFarmingTip = (day) => {
    const rain  = day.rainfall_mm  ?? 0;
    const tMax  = day.temp_max_c   ?? 25;
    const tMin  = day.temp_min_c   ?? 10;
    const humid = day.humidity_pct ?? 50;

    // Prefer the backend farming_note if available
    if (day.farming_note) return day.farming_note;

    if (rain >= 25) {
      return language === 'en'
        ? 'Heavy rain expected. Ensure drainage channels are clear and harvest ripe crops.'
        : 'Pula e matla e lebelletsoe. Etsa bonnete ba hore likanaleng tsa metsi li hlakile.';
    }
    if (tMin <= 2) {
      return language === 'en'
        ? 'Frost risk overnight. Protect seedlings and frost-sensitive crops.'
        : 'Kotsi ea lekhopho bosiu. Sireletsa lijalo tse nyenyane.';
    }
    if (tMax >= 35) {
      return language === 'en'
        ? 'Heat stress risk. Irrigate early morning or evening to reduce stress on crops.'
        : 'Kotsi ea mocheso. Nosetsa hosasane kapa mantsiboe.';
    }
    if (rain === 0 && humid < 30) {
      return language === 'en'
        ? 'Dry conditions. Monitor soil moisture and consider irrigation.'
        : 'Maemo a omileng. Hlahloba boleng ba metsi mabung.';
    }
    return language === 'en'
      ? 'Normal conditions. Continue with regular farming activities.'
      : 'Maemo a tloaelehileng. Tsoelapele ka mesebetsi e tloaelehileng.';
  };

  // ── Alert severity colour ─────────────────────────────────────────────────
  const alertSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return theme.palette.error.dark;
      case 'severe':   return theme.palette.error.main;
      case 'warning':  return theme.palette.warning.main;
      default:         return theme.palette.info.main;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <LinearProgress />
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1, textAlign: 'center' }}>
          {language === 'en' ? 'Loading weather data…' : 'E ntse e jarolla boemo ba leholimo…'}
        </Typography>
      </Container>
    );
  }

  if (error && forecastDays.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert
          severity="error"
          action={
            <IconButton color="inherit" size="small" onClick={loadWeatherData}>
              <RefreshIcon />
            </IconButton>
          }
        >
          {language === 'en'
            ? `Could not load weather data: ${error}`
            : `Ha e kone ho jarolla boemo ba leholimo: ${error}`}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">
          {t('weather.title')}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isOffline && (
            <Tooltip title={language === 'en' ? 'Showing cached data' : 'Ho bontsha data e bolokiloeng'}>
              <Chip icon={<OfflineIcon />} label={language === 'en' ? 'Offline' : 'Ha u hokahane'} color="warning" size="small" />
            </Tooltip>
          )}
          <Tooltip title={language === 'en' ? 'Refresh' : 'Ntlafatsa'}>
            <IconButton onClick={loadWeatherData} color="primary" size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {lastUpdated && (
        <Typography variant="caption" color="textSecondary" sx={{ mb: 2, display: 'block' }}>
          {language === 'en'
            ? `Last updated: ${format(lastUpdated, 'HH:mm, MMM d')}`
            : `Ho ntlafatsoa: ${format(lastUpdated, 'HH:mm, MMM d')}`}
        </Typography>
      )}

      {/* Current Conditions Banner */}
      {currentWeather && (
        <Paper
          sx={{
            p: 3,
            mb: 3,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            color: 'white',
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" gutterBottom>
            {language === 'en' ? "Current Conditions" : "Boemo ba Kajeno"}
            {currentWeather.location_name ? ` — ${currentWeather.location_name}` : ''}
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {getWeatherIcon(currentWeather.description, 48)}
              <Box>
                <Typography variant="h3" component="span">
                  {Math.round(currentWeather.temperature_c)}°C
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.85, textTransform: 'capitalize' }}>
                  {getConditionText(currentWeather.description)}
                </Typography>
                {currentWeather.feels_like_c != null && (
                  <Typography variant="caption" sx={{ opacity: 0.75 }}>
                    {language === 'en' ? `Feels like ${Math.round(currentWeather.feels_like_c)}°C` : `E ikutloa e le ${Math.round(currentWeather.feels_like_c)}°C`}
                  </Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={4} sm={2} sx={{ textAlign: 'center' }}>
              <HumidityIcon sx={{ opacity: 0.85 }} />
              <Typography variant="body2">{currentWeather.humidity_pct}%</Typography>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>{language === 'en' ? 'Humidity' : 'Boleng ba Metsi'}</Typography>
            </Grid>
            <Grid item xs={4} sm={2} sx={{ textAlign: 'center' }}>
              <WindIcon sx={{ opacity: 0.85 }} />
              <Typography variant="body2">{currentWeather.wind_speed_ms?.toFixed(1)} m/s</Typography>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>{language === 'en' ? 'Wind' : 'Moea'}</Typography>
            </Grid>
            <Grid item xs={4} sm={2} sx={{ textAlign: 'center' }}>
              <RainIcon sx={{ opacity: 0.85 }} />
              <Typography variant="body2">{currentWeather.rainfall_mm ?? 0} mm</Typography>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>{language === 'en' ? 'Rain (1h)' : 'Pula (1h)'}</Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Paper sx={{ p: 3, mb: 3, border: `2px solid ${theme.palette.error.main}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <WarningIcon color="error" />
            <Typography variant="h6">
              {language === 'en' ? 'Active Weather Alerts' : 'Litemoso tsa Boemo ba Leholimo'}
            </Typography>
          </Box>
          {alerts.map((alert, index) => (
            <Alert
              key={index}
              severity={alert.severity === 'critical' || alert.severity === 'severe' ? 'error' : 'warning'}
              sx={{ mb: 1, borderLeft: `4px solid ${alertSeverityColor(alert.severity)}` }}
              icon={<WarningIcon />}
            >
              <Typography variant="subtitle2">{alert.title}</Typography>
              <Typography variant="body2">{alert.message}</Typography>
            </Alert>
          ))}
        </Paper>
      )}

      {/* 7-Day Forecast Grid */}
      <Typography variant="h6" gutterBottom>
        {language === 'en' ? '7-Day Forecast' : 'Boemo ba Matsatsi a 7'}
      </Typography>
      <Grid container spacing={2}>
        {forecastDays.map((day) => (
          <Grid item xs={12} sm={6} md={4} key={day.date}>
            <Card sx={{
              height: '100%',
              border: day.alert ? `2px solid ${theme.palette.error.main}` : 'none',
            }}>
              <CardContent>
                {/* Date + alert chip */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarIcon color="primary" />
                    <Typography variant="h6">
                      {format(new Date(day.date), 'EEE, MMM d')}
                    </Typography>
                  </Box>
                  {day.alert && (
                    <Chip icon={<WarningIcon />} label="Alert" size="small" color="error" />
                  )}
                </Box>

                {/* Icon + max temp */}
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2 }}>
                  {getWeatherIcon(day.description)}
                  <Typography variant="h3" component="span" sx={{ ml: 1 }}>
                    {Math.round(day.temp_max_c ?? 0)}°
                  </Typography>
                </Box>

                <Typography variant="body1" align="center" gutterBottom sx={{ textTransform: 'capitalize' }}>
                  {getConditionText(day.description)}
                </Typography>

                <Divider sx={{ my: 2 }} />

                {/* Stats grid */}
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <TempIcon sx={{ color: theme.palette.info.main }} />
                      <Typography variant="body2" color="textSecondary">
                        {language === 'en' ? 'Min' : 'Bonyane'}
                      </Typography>
                      <Typography variant="body1">{Math.round(day.temp_min_c ?? 0)}°C</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <TempIcon sx={{ color: theme.palette.error.main }} />
                      <Typography variant="body2" color="textSecondary">
                        {language === 'en' ? 'Max' : 'Boholo'}
                      </Typography>
                      <Typography variant="body1">{Math.round(day.temp_max_c ?? 0)}°C</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <HumidityIcon sx={{ color: theme.palette.info.main }} />
                      <Typography variant="body2" color="textSecondary">
                        {language === 'en' ? 'Humidity' : 'Boleng'}
                      </Typography>
                      <Typography variant="body1">
                        {day.humidity_pct != null ? `${Math.round(day.humidity_pct)}%` : '—'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <WindIcon sx={{ color: theme.palette.primary.main }} />
                      <Typography variant="body2" color="textSecondary">
                        {language === 'en' ? 'Wind' : 'Moea'}
                      </Typography>
                      <Typography variant="body1">
                        {day.wind_speed_ms != null ? `${day.wind_speed_ms.toFixed(1)} m/s` : '—'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <RainIcon sx={{ color: theme.palette.info.dark }} />
                      <Typography variant="body2" color="textSecondary">
                        {language === 'en' ? 'Rain' : 'Pula'}
                      </Typography>
                      <Typography variant="body1">
                        {day.rainfall_mm != null ? `${day.rainfall_mm} mm` : '—'}
                      </Typography>
                    </Box>
                  </Grid>
                  {day.solar_radiation_mj != null && (
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center' }}>
                        <SolarIcon sx={{ color: theme.palette.warning.main }} />
                        <Typography variant="body2" color="textSecondary">
                          {language === 'en' ? 'Solar' : 'Letsatsi'}
                        </Typography>
                        <Typography variant="body1">{day.solar_radiation_mj} MJ</Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>

                {/* Alert inline */}
                {day.alert && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    {day.alert}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Farming Tips */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <FarmIcon color="primary" />
          <Typography variant="h6">
            {language === 'en' ? 'Weather-Based Farming Tips' : 'Likeletso tsa Temo ho latela Boemo ba Leholimo'}
          </Typography>
        </Box>
        <Grid container spacing={2}>
          {forecastDays.slice(0, 3).map((day, index) => (
            <Grid item xs={12} key={index}>
              <Alert severity="info">
                <Typography variant="subtitle2">
                  {format(new Date(day.date), 'EEEE, MMMM d')}:
                </Typography>
                <Typography variant="body2">{getFarmingTip(day)}</Typography>
              </Alert>
            </Grid>
          ))}
        </Grid>
      </Paper>

    </Container>
  );
};

export default WeatherAlerts;