import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Paper, Typography, Box, Grid, Card, CardContent,
  Chip, Alert, useTheme, LinearProgress, Divider, IconButton, Tooltip,
} from '@mui/material';
import {
  WbSunny as SunnyIcon, Cloud as CloudyIcon, Grain as RainIcon,
  Thunderstorm as StormIcon, Warning as WarningIcon, Thermostat as TempIcon,
  Opacity as HumidityIcon, Air as WindIcon, CalendarToday as CalendarIcon,
  WifiOff as OfflineIcon, Refresh as RefreshIcon, Agriculture as FarmIcon,
  LightMode as SolarIcon,
} from '@mui/icons-material';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { format } from 'date-fns';
import {
  getWeatherForecast, evaluateAlerts,
  getCurrentWeather, descriptionToCondition,
} from '../../services/weatherService';

const DEFAULT_LAT  = -29.3167;
const DEFAULT_LON  =  27.4833;
const DEFAULT_NAME = 'Maseru';

const WeatherAlerts = () => {
  const [forecastDays, setForecastDays]     = useState([]);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [alerts, setAlerts]                 = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [isOffline, setIsOffline]           = useState(false);
  const [lastUpdated, setLastUpdated]       = useState(null);

  const { t, language }        = useLanguage();
  const { user }               = useAuth();
  const { reportWeatherAlert } = useNotifications();
  const theme                  = useTheme();

  const loadWeatherData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [currentResult, forecastResult] = await Promise.allSettled([
        getCurrentWeather(DEFAULT_LAT, DEFAULT_LON, DEFAULT_NAME),
        getWeatherForecast(DEFAULT_LAT, DEFAULT_LON, 7, DEFAULT_NAME),
      ]);

      let currentData = null;
      if (currentResult.status === 'fulfilled') {
        currentData = currentResult.value.data;
        setCurrentWeather(currentData);
        setIsOffline(currentResult.value.isStale);
      }

      if (forecastResult.status === 'fulfilled') {
        const { data, isStale } = forecastResult.value;
        const days = data.days || [];
        setForecastDays(days);
        setIsOffline(prev => prev || isStale);
        setLastUpdated(new Date());

        if (currentData && !isStale) {
          try {
            const liveAlerts = await evaluateAlerts(currentData, user?.id?.toString());
            setAlerts(liveAlerts);

            // Forward to notification service once per day only
            const sessionKey = `alerts_reported_${new Date().toDateString()}`;
            if (!sessionStorage.getItem(sessionKey)) {
              for (const alert of liveAlerts) {
                await reportWeatherAlert({
                  title:    alert.title,
                  body:     alert.message,
                  severity: alert.severity === 'severe' ? 'critical' : alert.severity,
                });
              }
              sessionStorage.setItem(sessionKey, 'true');
            }
          } catch {
            // Non-fatal: fall back to static alerts from forecast days
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
  }, [user?.id, reportWeatherAlert]);

  useEffect(() => {
    loadWeatherData();
  }, [loadWeatherData]);

  const getWeatherIcon = (description, size = 40) => {
    const condition = descriptionToCondition(description);
    const sx = { fontSize: size };
    switch (condition) {
      case 'sunny':        return <SunnyIcon  sx={{ ...sx, color: theme.palette.warning.main }} />;
      case 'rainy':        return <RainIcon   sx={{ ...sx, color: theme.palette.info.main }} />;
      case 'cloudy':       return <CloudyIcon sx={{ ...sx, color: theme.palette.grey[500] }} />;
      case 'stormy':       return <StormIcon  sx={{ ...sx, color: theme.palette.error.main }} />;
      case 'partly cloudy':return <CloudyIcon sx={{ ...sx, color: theme.palette.grey[400] }} />;
      default:             return <SunnyIcon  sx={{ ...sx, color: theme.palette.warning.main }} />;
    }
  };

  const getConditionText = (description) => {
    if (language === 'en') return description;
    const map = {
      sunny: 'Chesa', rainy: 'Pula', cloudy: 'Khoalifi',
      stormy: 'Sefefo', 'partly cloudy': 'Khoalifi hanyane', clear: 'Bopalami',
    };
    return map[descriptionToCondition(description)] || description;
  };

  const getFarmingTip = (day) => {
    const rain  = day.rainfall_mm  ?? 0;
    const tMax  = day.temp_max_c   ?? 25;
    const tMin  = day.temp_min_c   ?? 10;
    const humid = day.humidity_pct ?? 50;
    if (day.farming_note) return day.farming_note;
    if (rain >= 25)          return language === 'en'
      ? 'Heavy rain expected. Ensure drainage channels are clear and harvest ripe crops.'
      : 'Pula e matla e lebelletsoe. Etsa bonnete ba hore likanaleng tsa metsi li hlakile.';
    if (tMin <= 2)           return language === 'en'
      ? 'Frost risk overnight. Protect seedlings and frost-sensitive crops.'
      : 'Kotsi ea lekhopho bosiu. Sireletsa lijalo tse nyenyane.';
    if (tMax >= 35)          return language === 'en'
      ? 'Heat stress risk. Irrigate early morning or evening.'
      : 'Kotsi ea mocheso. Nosetsa hosasane kapa mantsiboe.';
    if (rain === 0 && humid < 30) return language === 'en'
      ? 'Dry conditions. Monitor soil moisture and consider irrigation.'
      : 'Maemo a omileng. Hlahloba boleng ba metsi mabung.';
    return language === 'en'
      ? 'Normal conditions. Continue with regular farming activities.'
      : 'Maemo a tloaelehileng. Tsoelapele ka mesebetsi e tloaelehileng.';
  };

  const alertSeverityColor = (severity) => ({
    critical: theme.palette.error.dark,
    severe:   theme.palette.error.main,
    warning:  theme.palette.warning.main,
  }[severity] || theme.palette.info.main);

  if (loading) return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <LinearProgress color="primary" />
      <Typography sx={{ mt: 2, textAlign: 'center' }} color="textSecondary">
        {language === 'en' ? 'Loading weather data...' : 'E jarolla boemo ba leholimo...'}
      </Typography>
    </Container>
  );

  if (error) return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Alert severity="error" action={
        <IconButton size="small" onClick={loadWeatherData}><RefreshIcon /></IconButton>
      }>
        {language === 'en' ? `Error loading weather: ${error}` : `Phoso ho jarolla leholimo: ${error}`}
      </Alert>
    </Container>
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          {t('weather.title')}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isOffline && (
            <Tooltip title={language === 'en' ? 'Showing cached data' : 'Ho bontsha data e bolokiloeng'}>
              <Chip icon={<OfflineIcon />}
                label={language === 'en' ? 'Cached' : 'E bolokiloe'}
                size="small" color="warning" variant="outlined" />
            </Tooltip>
          )}
          {lastUpdated && (
            <Typography variant="caption" color="textSecondary">
              {language === 'en'
                ? `Updated ${format(lastUpdated, 'h:mm a')}`
                : `E ntlafalitsoe ${format(lastUpdated, 'h:mm a')}`}
            </Typography>
          )}
          <IconButton onClick={loadWeatherData} color="primary" size="small">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Current weather */}
      {currentWeather && (
        <Paper sx={{
          p: 3, mb: 3, borderRadius: 2, color: 'white',
          background: 'linear-gradient(135deg, #0f3d2e 0%, #145a32 100%)',
        }}>
          <Typography variant="h6" gutterBottom sx={{ opacity: 0.85 }}>
            {language === 'en'
              ? `Current Conditions : ${DEFAULT_NAME}`
              : `Maemo a Joale : ${DEFAULT_NAME}`}
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4} sx={{ textAlign: 'center' }}>
              {getWeatherIcon(currentWeather.description, 60)}
              <Typography variant="h2" sx={{ fontWeight: 700 }}>
                {Math.round(currentWeather.temperature_c ?? 0)}°C
              </Typography>
              <Typography variant="body1" sx={{ textTransform: 'capitalize', opacity: 0.9 }}>
                {getConditionText(currentWeather.description)}
              </Typography>
              {currentWeather.feels_like_c != null && (
                <Typography variant="caption" sx={{ opacity: 0.75 }}>
                  {language === 'en'
                    ? `Feels like ${Math.round(currentWeather.feels_like_c)}°C`
                    : `E ikutloa e le ${Math.round(currentWeather.feels_like_c)}°C`}
                </Typography>
              )}
            </Grid>
            <Grid item xs={4} sm={2} sx={{ textAlign: 'center' }}>
              <HumidityIcon sx={{ opacity: 0.85 }} />
              <Typography variant="body2">{currentWeather.humidity_pct}%</Typography>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                {language === 'en' ? 'Humidity' : 'Boleng ba Metsi'}
              </Typography>
            </Grid>
            <Grid item xs={4} sm={2} sx={{ textAlign: 'center' }}>
              <WindIcon sx={{ opacity: 0.85 }} />
              <Typography variant="body2">{currentWeather.wind_speed_ms?.toFixed(1)} m/s</Typography>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                {language === 'en' ? 'Wind' : 'Moea'}
              </Typography>
            </Grid>
            <Grid item xs={4} sm={2} sx={{ textAlign: 'center' }}>
              <RainIcon sx={{ opacity: 0.85 }} />
              <Typography variant="body2">{currentWeather.rainfall_mm ?? 0} mm</Typography>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                {language === 'en' ? 'Rain (1h)' : 'Pula (1h)'}
              </Typography>
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

      {/* 7-Day Forecast */}
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarIcon color="primary" />
                    <Typography variant="h6">{format(new Date(day.date), 'EEE, MMM d')}</Typography>
                  </Box>
                  {day.alert && <Chip icon={<WarningIcon />} label="Alert" size="small" color="error" />}
                </Box>

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

                {day.alert && (
                  <Alert severity="warning" sx={{ mt: 2 }}>{day.alert}</Alert>
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
            {language === 'en'
              ? 'Weather-Based Farming Tips'
              : 'Likeletso tsa Temo ho latela Boemo ba Leholimo'}
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