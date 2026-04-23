import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Grid, Paper, Typography, Box, Card, CardContent,
  CardActionArea, Button, Chip, Alert, useTheme, IconButton,
  Tooltip, Skeleton, Divider,
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

// ── Chat service URL ─────────────────────────────────────────────────────────
const CHAT_URL = process.env.REACT_APP_CHAT_SERVICE_URL || 'http://localhost:3002';

// ── Offline fallback rules ────────────────────────────────────────────────────
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

// ── Build the prompt sent to the chat service ─────────────────────────────────
function buildAdvicePrompt(weather, crops, region, language) {
  const temp  = weather?.temperature_c  ?? weather?.temp?.max  ?? 'unknown';
  const rain  = weather?.humidity_pct   ?? weather?.rainChance ?? 'unknown';
  const wind  = weather?.wind_speed_ms  ?? 'unknown';
  const desc  = weather?.description    ?? weather?.condition  ?? 'unknown';
  const cropList = (crops || []).join(', ') || 'maize, sorghum';
  const isEn  = language === 'en';

  return isEn
    ? `You are Mosupisi, an agricultural extension agent for smallholder farmers in Lesotho.
Current conditions for ${region || 'Maseru'}: temperature ${temp}°C, humidity/rain chance ${rain}%, wind ${wind} m/s, conditions: ${desc}.
The farmer grows: ${cropList}.
Give TWO short urgent pieces of advice (1-2 sentences each):
1. CROP ADVICE: What should this farmer do RIGHT NOW for their crops given these weather conditions?
2. PEST ADVICE: What pest or disease risk is HIGH right now and what should they watch for?
Reply in this exact format:
CROP: [advice here]
PEST: [advice here]
Be specific, practical, and urgent. No greetings.`
    : `O Mosupisi, moemeli oa temo bakeng sa balemi ba Lesotho.
Maemo a joale bakeng sa ${region || 'Maseru'}: mocheso ${temp}°C, mongobo/monyetla oa pula ${rain}%, moea ${wind} m/s, maemo: ${desc}.
Molemisi o jala: ${cropList}.
Fana ka LIQHEKU TSE PELI tse khutšoane tse potlakileng (metsotso e 1-2 mong le mong):
1. KELETSO EA LIJALO: Molemisi o lokela ho etsa JOALE'NG bakeng sa lijalo tsa hae ka maemo ana a leholimo?
2. KELETSO EA LIKOKONYANA: Ke kokoana-hloko efe kapa lefu lefe le kotsing e phahameng joale ebile ba lokela ho sheba eng?
Araba ka foromo ena e nepahetseng:
LIJALO: [keletso mona]
LIKOKONYANA: [keletso mona]
Be specific and practical. Ha ho dumediso.`;
}

// ── Parse the chat service response ──────────────────────────────────────────
function parseAdviceResponse(text, language) {
  const isEn = language === 'en';
  const cropKey  = isEn ? 'CROP:'  : 'LIJALO:';
  const pestKey  = isEn ? 'PEST:'  : 'LIKOKONYANA:';

  const cropMatch = text.match(new RegExp(`${cropKey}\\s*(.+?)(?=${pestKey}|$)`, 'is'));
  const pestMatch = text.match(new RegExp(`${pestKey}\\s*(.+?)$`, 'is'));

  return {
    cropAdvice: cropMatch?.[1]?.trim() || null,
    pestAdvice: pestMatch?.[1]?.trim() || null,
  };
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

  // AI advice state
  const [cropAdvice, setCropAdvice]         = useState('');
  const [pestAdvice, setPestAdvice]         = useState('');
  const [adviceLoading, setAdviceLoading]   = useState(false);
  const [adviceIsAI, setAdviceIsAI]         = useState(false);

  const adviceFetched = useRef(false);

  useEffect(() => {
    loadDashboardData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch AI advice whenever weather is ready ───────────────────────────────
  useEffect(() => {
    if (weather && !adviceFetched.current) {
      adviceFetched.current = true;
      fetchAdvice(weather);
    }
  }, [weather]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAdvice = async (wxData) => {
    setAdviceLoading(true);

    // First show offline fallback immediately
    const fallback = getOfflineAdvice(wxData, user?.crops, language);
    setCropAdvice(fallback.cropAdvice);
    setPestAdvice(fallback.pestAdvice);
    setAdviceIsAI(false);

    // Then try AI
    try {
      const prompt = buildAdvicePrompt(wxData, user?.crops, user?.region, language);
      const res = await fetch(`${CHAT_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          conversationId: `dashboard-advice-${Date.now()}`,
          userId: user?.id || 'anonymous',
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.response || data?.message || data?.content || '';
        if (text) {
          const parsed = parseAdviceResponse(text, language);
          if (parsed.cropAdvice) setCropAdvice(parsed.cropAdvice);
          if (parsed.pestAdvice) setPestAdvice(parsed.pestAdvice);
          setAdviceIsAI(true);
        }
      }
    } catch {
      // Fallback already set above — silently keep it
    } finally {
      setAdviceLoading(false);
    }
  };

  const loadDashboardData = async () => {
    adviceFetched.current = false;
    setLoading(true);
    setCropAdvice('');
    setPestAdvice('');
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
        if (cached) { setWeather(cached); setWeatherStale(true); }
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

      {/* ── Welcome Card ──────────────────────────────────────────────────────── */}
      <Paper sx={{
        p: 3, mb: 3, borderRadius: 2, color: 'white',
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
      }}>
        {/* Greeting */}
        <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.3rem', sm: '2rem' } }}>
          {t('welcome')}, {user?.name?.split(' ')[0] }! 
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.85 }}>
          {language === 'en' ? 'Region' : 'Setereke'}: {user?.region || 'Maseru'}
          {user?.crops?.length > 0 && (
            <> &nbsp;·&nbsp; {language === 'en' ? 'Crops' : 'Lijalo'}: {user.crops.map(c => t(c)).join(', ')}</>
          )}
        </Typography>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.25)', my: 2 }} />

        {/* Today's Advice */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <TipIcon sx={{ fontSize: 18, opacity: 0.9 }} />
          <Typography variant="subtitle2" sx={{ opacity: 0.9, fontWeight: 600, letterSpacing: 0.5 }}>
            {language === 'en' ? "TODAY'S ADVICE" : 'KELETSO EA KAJENO'}
          </Typography>
          {adviceIsAI && (
            <Chip
              label="AI"
              size="small"
              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.2)', color: 'white', ml: 'auto' }}
            />
          )}
          {weatherIsStale && (
            <Chip
              icon={<OfflineIcon sx={{ fontSize: '0.7rem !important' }} />}
              label={language === 'en' ? 'Offline' : 'Ha u hokahane'}
              size="small"
              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(255,200,0,0.25)', color: 'white', ml: adviceIsAI ? 0 : 'auto' }}
            />
          )}
        </Box>

        <Grid container spacing={1.5}>
          {/* Crop advice */}
          <Grid item xs={12} sm={6}>
            <Box sx={{
              bgcolor: 'rgba(255,255,255,0.12)',
              borderRadius: 2, p: 1.5,
              borderLeft: '3px solid rgba(255,255,255,0.5)',
              minHeight: 70,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <AgricultureIcon sx={{ fontSize: 14, opacity: 0.8 }} />
                <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {language === 'en' ? 'Crops' : 'Lijalo'}
                </Typography>
              </Box>
              {adviceLoading && !cropAdvice ? (
                <>
                  <Skeleton variant="text" sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
                  <Skeleton variant="text" width="80%" sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
                </>
              ) : (
                <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                  {cropAdvice || (language === 'en' ? 'Loading crop advice...' : 'E ntse e jarolla keletso ea lijalo...')}
                </Typography>
              )}
            </Box>
          </Grid>

          {/* Pest advice */}
          <Grid item xs={12} sm={6}>
            <Box sx={{
              bgcolor: 'rgba(255,150,0,0.2)',
              borderRadius: 2, p: 1.5,
              borderLeft: '3px solid rgba(255,180,0,0.7)',
              minHeight: 70,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <PestIcon sx={{ fontSize: 14, opacity: 0.8 }} />
                <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {language === 'en' ? 'Pest Risk' : 'Kotsi ea Likokonyana'}
                </Typography>
              </Box>
              {adviceLoading && !pestAdvice ? (
                <>
                  <Skeleton variant="text" sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
                  <Skeleton variant="text" width="80%" sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
                </>
              ) : (
                <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                  {pestAdvice || (language === 'en' ? 'Loading pest advice...' : 'E ntse e jarolla keletso ea likokonyana...')}
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>

        {/* Refresh advice button */}
        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="small"
            onClick={() => { adviceFetched.current = false; if (weather) fetchAdvice(weather); }}
            disabled={adviceLoading}
            sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', minHeight: 32, textTransform: 'none',
              '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
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