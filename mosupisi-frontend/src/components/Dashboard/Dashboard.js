import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Grid, Paper, Typography, Box, Card, CardContent,
  CardActionArea, Button, Chip, Alert, useTheme, IconButton,
  Tooltip, Skeleton,
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
  Lightbulb as TipIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/db';
import { format, parseISO, isValid } from 'date-fns';
import { getCurrentWeather, getWeatherForecast, descriptionToCondition } from '../../services/weatherService';

// ── Rule‑based advice using current weather values ───────────────────────────
function getOfflineAdvice(weather, crops, language) {
  const temp   = weather?.temperature_c ?? weather?.temp?.max ?? null;
  const rain   = weather?.humidity_pct  ?? weather?.rainChance ?? null;
  const wind   = weather?.wind_speed_ms ?? null;
  const isEn   = language === 'en';

  let cropAdvice = isEn
    ? 'Monitor your crops for signs of stress and ensure soil moisture is adequate.'
    : 'Hlahloba lijalo tsa hau bakeng sa matšoao a khatello ebile u netefatse hore mobu o na le mongobo o lekaneng.';

  let pestAdvice = isEn
    ? 'Inspect fields regularly for pest activity, especially after rain.'
    : 'Hlahloba masimo ka mehla bakeng sa mesebetsi ea likokonyana, haholo kamora pula.';

  if (temp !== null) {
    if (temp > 30) {
      cropAdvice = isEn
        ? `⚠️ High temperature (${Math.round(temp)}°C): irrigate ${crops?.[0] || 'crops'} early morning or evening to prevent heat stress.`
        : `⚠️ Mocheso o phahamile (${Math.round(temp)}°C): nosetsa ${crops?.[0] || 'lijalo'} hoseng kapa mantsiboea ho thibela khatello ea mocheso.`;
      pestAdvice = isEn
        ? '🐛 Hot dry conditions favour aphids and spider mites. Check leaf undersides.'
        : '🐛 Maemo a chesang a omileng a khothaletsa likhothola le likhoto tsa sehatana. Hlahloba ka tlase ha makhasi.';
    } else if (temp < 5) {
      cropAdvice = isEn
        ? `❄️ Near-frost conditions (${Math.round(temp)}°C): cover seedlings overnight and delay irrigation.`
        : `❄️ Maemo a haufi le sekhahla (${Math.round(temp)}°C): apesa lijalo tse tšoeu bosiu ebile u lieha ho nosetsa.`;
      pestAdvice = isEn
        ? '🌡️ Cold conditions reduce pest activity but protect against soil fungi.'
        : '🌡️ Maemo a batang a fokotsa mesebetsi ea likokonyana empa sireletsa khahlano le likhohle tsa mobu.';
    }
  }

  if (rain !== null && rain > 70) {
    cropAdvice = isEn
      ? `🌧️ High humidity (${Math.round(rain)}%): check drainage around ${crops?.[0] || 'crops'} and avoid waterlogging.`
      : `🌧️ Mongobo o phahamile (${Math.round(rain)}%): hlahloba ho tsamaea ha metsi haufi le ${crops?.[0] || 'lijalo'} ebile u qobe ho ama metsi a mangata.`;
    pestAdvice = isEn
      ? '🍄 Wet conditions increase fungal disease risk. Watch for blight and rust on leaves.'
      : '🍄 Maemo a metsi a eketsa kotsi ea mafu a likhohle. Sheba blight le tlhaho ea lerata mathaung.';
  }

  if (wind !== null && wind > 10) {
    pestAdvice = isEn
      ? `💨 High winds (${wind.toFixed(1)} m/s): delay pesticide spraying until winds calm below 5 m/s.`
      : `💨 Meea e matla (${wind.toFixed(1)} m/s): lieha ho ata lithibela-kokonyana ho fihlela meea e khutsoa tlase ho 5 m/s.`;
  }

  return { cropAdvice, pestAdvice };
}

// ── Main component ────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user }        = useAuth();
  const { t, language } = useLanguage();
  const navigate        = useNavigate();
  const theme           = useTheme();

  const [weather, setWeather]               = useState(null);
  const [weatherIsStale, setWeatherStale]   = useState(false);
  const [recentQueries, setRecentQueries]   = useState([]);
  const [alerts, setAlerts]                 = useState([]);
  const [loading, setLoading]               = useState(true);
  const [cropGuides, setCropGuides]         = useState([]);
  const [currentLocation, setCurrentLocation] = useState('');

  // Rule‑based advice state
  const [cropAdvice, setCropAdvice]         = useState('');
  const [pestAdvice, setPestAdvice]         = useState('');
  const [adviceLoading, setAdviceLoading]   = useState(false);

  const adviceFetched = useRef(false);

  // Update advice from current weather (no AI)
  const updateAdviceFromWeather = (wxData) => {
    setAdviceLoading(true);
    const { cropAdvice, pestAdvice } = getOfflineAdvice(wxData, user?.crops, language);
    setCropAdvice(cropAdvice);
    setPestAdvice(pestAdvice);
    setAdviceLoading(false);
  };

  useEffect(() => {
    loadDashboardData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When weather becomes available, update advice and location
  useEffect(() => {
    if (weather && !adviceFetched.current) {
      adviceFetched.current = true;
      updateAdviceFromWeather(weather);
      // Set current location name from weather data (e.g., "Maseru", "Butha-Buthe")
      if (weather?.location_name) {
        setCurrentLocation(weather.location_name);
      }
    }
  }, [weather]);

  const loadDashboardData = async () => {
    adviceFetched.current = false;
    setLoading(true);
    setCropAdvice('');
    setPestAdvice('');
    setCurrentLocation('');

    try {
      try {
        const { data, isStale } = await getCurrentWeather();
        setWeather(data);
        setWeatherStale(isStale);

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
        const cached = await db.weather.orderBy('date').first();
        if (cached) {
          setWeather(cached);
          setWeatherStale(true);
          if (cached.location_name) setCurrentLocation(cached.location_name);
        }
        const weatherAlerts = await db.weather
          .filter(w => w.alert && new Date(w.date) >= new Date())
          .toArray();
        setAlerts(weatherAlerts);
      }

      const queries = await db.queries.orderBy('timestamp').reverse().limit(5).toArray();
      setRecentQueries(queries);

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

  const formatDate = (dateString) => {
    try {
      if (!dateString) return '';
      const date = parseISO(dateString);
      return isValid(date) ? format(date, 'MMM d, yyyy') : '';
    } catch { return ''; }
  };

  const wx = {
    tempMin:     weather?.temp_min_c    ?? weather?.temp?.min    ?? null,
    tempMax:     weather?.temp_max_c    ?? weather?.temp?.max    ?? null,
    tempCurrent: weather?.temperature_c ?? weather?.temp?.max    ?? null,
    humidity:    weather?.humidity_pct  ?? weather?.rainChance   ?? null,
    windMs:      weather?.wind_speed_ms ?? null,
    description: weather?.description   ?? weather?.condition    ?? '',
  };

  const conditionLabel = (desc) => {
    if (language === 'en') return desc;
    const map = { sunny: 'Chesa', rainy: 'Pula', cloudy: 'Khoalifi', stormy: 'Sefefo', 'partly cloudy': 'Khoalifi hanyane' };
    return map[descriptionToCondition(desc)] || desc;
  };

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

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Skeleton variant="rounded" height={180} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={120} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1,2,3,4].map(i => <Grid item xs={6} sm={3} key={i}><Skeleton variant="rounded" height={120} /></Grid>)}
        </Grid>
      </Container>
    );
  }

  // Determine display location: use current location from weather, fallback to user's registered region
  const displayRegion = currentLocation || user?.region || 'Maseru';

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

      {/* ── Welcome Card ──────────────────────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          p: 3, mb: 3, borderRadius: 3,
          background: `linear-gradient(145deg, #0f3d2e 0%, #145a32 60%, #1a6b3a 100%)`,
          border: '1px solid #0a2e22',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -40, right: -40,
            width: 180, height: 180,
            borderRadius: '50%',
            background: 'rgba(76,175,80,0.12)',
            pointerEvents: 'none',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -30, left: '30%',
            width: 120, height: 120,
            borderRadius: '50%',
            background: 'rgba(76,175,80,0.08)',
            pointerEvents: 'none',
          },
        }}
      >
        {/* Greeting row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
          <Box>
            <Typography
              variant="h4"
              sx={{ color: '#ffffff', fontWeight: 600, fontSize: { xs: '1.4rem', sm: '1.9rem' }, lineHeight: 1.2 }}
            >
              {t('welcome')}, {user?.name?.split(' ')[0] || 'Ntate'}! 
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.5 }}>
              {language === 'en' ? 'Current Location' : 'Sebaka sa Hona Joale'}: {displayRegion}
              {user?.crops?.length > 0 && (
                <> &nbsp;·&nbsp; {user.crops.map(c => t(c)).join(', ')}</>
              )}
            </Typography>
          </Box>

          {/* Status badges */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
            {weatherIsStale && (
              <Chip
                icon={<OfflineIcon sx={{ fontSize: '12px !important', color: '#ffe082 !important' }} />}
                label={language === 'en' ? 'Offline' : 'Ha u hokahane'}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,193,7,0.15)',
                  color: '#ffe082',
                  fontSize: '0.7rem', height: 22,
                  border: '1px solid rgba(255,193,7,0.3)',
                }}
              />
            )}
          </Box>
        </Box>

        {/* Section label */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2.5, mb: 1.5 }}>
          <TipIcon sx={{ fontSize: 15, color: '#a5d6a7' }} />
          <Typography variant="caption" sx={{ color: '#a5d6a7', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            {language === 'en' ? "Today's Advice" : 'Keletso ea Kajeno'}
          </Typography>
          <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(165,214,167,0.2)', ml: 1 }} />
        </Box>

        {/* Advice panels */}
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6}>
            <Box sx={{
              bgcolor: 'rgba(0,0,0,0.25)',
              borderRadius: 2,
              p: 2,
              borderLeft: `3px solid ${theme.palette.primary.main}`,
              minHeight: 90,
              backdropFilter: 'blur(4px)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <AgricultureIcon sx={{ fontSize: 15, color: theme.palette.primary.light }} />
                <Typography variant="caption" sx={{
                  fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
                  color: theme.palette.primary.light,
                }}>
                  {language === 'en' ? 'Crops' : 'Lijalo'}
                </Typography>
              </Box>
              {adviceLoading && !cropAdvice ? (
                <>
                  <Skeleton variant="text" sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
                  <Skeleton variant="text" width="75%" sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
                </>
              ) : (
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.88)', lineHeight: 1.55 }}>
                  {cropAdvice || (language === 'en' ? 'Loading crop advice...' : 'E fumana keletso ea lijalo...')}
                </Typography>
              )}
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box sx={{
              bgcolor: 'rgba(0,0,0,0.25)',
              borderRadius: 2,
              p: 2,
              borderLeft: `3px solid ${theme.palette.warning.dark}`,
              minHeight: 90,
              backdropFilter: 'blur(4px)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <PestIcon sx={{ fontSize: 15, color: theme.palette.warning.main }} />
                <Typography variant="caption" sx={{
                  fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
                  color: theme.palette.warning.main,
                }}>
                  {language === 'en' ? 'Pest Risk' : 'Kotsi ea Likokonyana'}
                </Typography>
              </Box>
              {adviceLoading && !pestAdvice ? (
                <>
                  <Skeleton variant="text" sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
                  <Skeleton variant="text" width="75%" sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
                </>
              ) : (
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.88)', lineHeight: 1.55 }}>
                  {pestAdvice || (language === 'en' ? 'Loading pest advice...' : 'E fumana keletso ea likokonyana...')}
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>

        {/* Refresh advice */}
        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="small"
            onClick={() => {
              if (weather) {
                adviceFetched.current = true;
                updateAdviceFromWeather(weather);
              }
            }}
            disabled={adviceLoading}
            sx={{
              color: 'rgba(165,214,167,0.7)',
              fontSize: '0.72rem',
              minHeight: 28,
              height: 28,
              px: 1.5,
              textTransform: 'none',
              borderRadius: 2,
              '&:hover': { color: '#a5d6a7', bgcolor: 'rgba(76,175,80,0.15)' },
              '&:disabled': { color: 'rgba(255,255,255,0.25)' },
            }}
          >
            {adviceLoading
              ? (language === 'en' ? 'Getting advice...' : 'E fumana keletso...')
              : (language === 'en' ? '↻ Refresh advice' : '↻ Nchafatsa keletso')}
          </Button>
        </Box>
      </Paper>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="warning" />
            {language === 'en' ? `Active Alerts (${alerts.length})` : `Litemoso tse Teng (${alerts.length})`}
          </Typography>
          {alerts.slice(0, 2).map((alert, index) => (
            <Alert key={index} severity="warning" sx={{ mb: 1 }}
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
      <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
        {language === 'en' ? 'Quick Actions' : 'Diketsahalo tse Potlakileng'}
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { title: t('chat.title'), icon: <ChatIcon sx={{ fontSize: 40 }} />, path: '/chat', color: theme.palette.primary.main, sub: language === 'en' ? 'Ask questions' : 'Botsa lipotso' },
          { title: t('weather.title'), icon: <WeatherIcon sx={{ fontSize: 40 }} />, path: '/weather', color: theme.palette.info.main, sub: language === 'en' ? 'Check forecast' : 'Sheba boemo' },
          { title: language === 'en' ? 'Planting Guide' : 'Tataiso ea Ho Jala', icon: <AgricultureIcon sx={{ fontSize: 40 }} />, path: '/planting-guide', color: theme.palette.warning.dark, sub: language === 'en' ? 'Crop calendar' : 'Khalendara ea lijalo' },
          { title: language === 'en' ? 'Pest Control' : 'Taolo ea Likokonyana', icon: <PestIcon sx={{ fontSize: 40 }} />, path: '/pest-control', color: theme.palette.secondary.main, sub: language === 'en' ? 'Manage pests' : 'Laola likokonyana' },
        ].map((item) => (
          <Grid item xs={6} sm={3} key={item.path}>
            <QuickActionCard title={item.title} icon={item.icon} onClick={() => navigate(item.path)} color={item.color} subtitle={item.sub} />
          </Grid>
        ))}
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
              <Tooltip title={language === 'en' ? 'Showing cached data' : 'Ho bontsha data e bolokiloeng'}>
                <Chip icon={<OfflineIcon />} label={language === 'en' ? 'Cached' : 'E bolokiloe'} size="small" color="warning" variant="outlined" />
              </Tooltip>
            )}
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center' }}>
                <ThermostatIcon sx={{ color: theme.palette.warning.main, fontSize: 30 }} />
                <Typography variant="body2" color="textSecondary">{language === 'en' ? 'Temperature' : 'Mocheso'}</Typography>
                <Typography variant="h6">
                  {wx.tempCurrent != null
                    ? `${Math.round(wx.tempCurrent)}°C`
                    : `${Math.round(wx.tempMin ?? 0)}–${Math.round(wx.tempMax ?? 0)}°C`}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center' }}>
                <OpacityIcon sx={{ color: theme.palette.info.main, fontSize: 30 }} />
                <Typography variant="body2" color="textSecondary">{language === 'en' ? 'Humidity' : 'Mongobo'}</Typography>
                <Typography variant="h6">{wx.humidity != null ? `${Math.round(wx.humidity)}%` : 'N/A'}</Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center' }}>
                <WindIcon sx={{ color: theme.palette.primary.main, fontSize: 30 }} />
                <Typography variant="body2" color="textSecondary">{language === 'en' ? 'Wind' : 'Moea'}</Typography>
                <Typography variant="h6">{wx.windMs != null ? `${wx.windMs.toFixed(1)} m/s` : 'N/A'}</Typography>
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
                    <Chip label={guide.source} size="small" sx={{ bgcolor: theme.palette.primary.light, color: 'white' }} />
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
                    <Typography variant="caption" color="textSecondary">{formatDate(query.timestamp)}</Typography>
                    {query.isOffline && (
                      <Chip label={language === 'en' ? 'Offline' : 'Ha u hokahane'} size="small" color="warning" variant="outlined" />
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
            <StatCard icon={<ChatIcon />} label={language === 'en' ? 'Queries' : 'Lipotso'} value={recentQueries.length} color={theme.palette.primary.main} />
          </Grid>
          <Grid item xs={4}>
            <StatCard icon={<AgricultureIcon />} label={language === 'en' ? 'Crops' : 'Lijalo'} value={user?.crops?.length || 0} color={theme.palette.warning.dark} />
          </Grid>
          <Grid item xs={4}>
            <StatCard icon={<WeatherIcon />} label={language === 'en' ? 'Alerts' : 'Litemoso'} value={alerts.length} color={theme.palette.error.main} />
          </Grid>
        </Grid>
      </Box>

    </Container>
  );
};

export default Dashboard;