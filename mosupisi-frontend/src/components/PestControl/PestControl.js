// components/PestControl/PestControl.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container, Grid, Paper, Typography, Box, Card, CardContent, CardHeader,
  Button, Chip, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, CircularProgress, useTheme, Avatar, Tabs, Tab, Accordion,
  AccordionSummary, AccordionDetails, IconButton, Tooltip, Snackbar,
} from '@mui/material';
import {
  BugReport as PestIcon, Warning as WarningIcon, Add as AddIcon,
  QuestionAnswer as QuestionIcon, Grass as GrassIcon,
  Agriculture as AgricultureIcon, Science as ScienceIcon,
  ExpandMore as ExpandMoreIcon, CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon, DeleteOutline as DeleteIcon, Done as DoneIcon,
  InfoOutlined as InfoIcon, WbSunny as WeatherIcon, Edit as EditIcon,
  History as HistoryIcon, Restore as RestoreIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';
import {
  fetchPests, fetchCrops, fetchGeneralTips, createPestReport,
  fetchUserReports, updatePestReport, deletePestReport,
  askPestQuestion, checkHealth,
} from '../../services/pestControlService';
import { weatherApi } from '../../services/api';
import { useNotifications } from '../../context/NotificationContext';

const SPRAY_RAIN_MM = 5;
const SPRAY_WIND_MS = 10;

// ── District → coordinates ─────────────────────────────────────────────────────
const DISTRICT_COORDS = {
  'maseru':        { lat: -29.32, lon: 27.50, name: 'Maseru' },
  'leribe':        { lat: -28.88, lon: 28.07, name: 'Leribe' },
  'berea':         { lat: -29.16, lon: 27.74, name: 'Berea' },
  'mafeteng':      { lat: -29.83, lon: 27.24, name: 'Mafeteng' },
  "mohale's hoek": { lat: -30.16, lon: 27.47, name: "Mohale's Hoek" },
  'quthing':       { lat: -30.40, lon: 27.70, name: 'Quthing' },
  "qacha's nek":   { lat: -30.12, lon: 28.68, name: "Qacha's Nek" },
  'mokhotlong':    { lat: -29.31, lon: 29.06, name: 'Mokhotlong' },
  'butha-buthe':   { lat: -28.76, lon: 28.27, name: 'Butha-Buthe' },
  'thaba-tseka':   { lat: -29.52, lon: 28.61, name: 'Thaba-Tseka' },
  'semonkong':     { lat: -29.85, lon: 28.05, name: 'Semonkong' },
  'oxbow':         { lat: -28.73, lon: 28.62, name: 'Oxbow' },
  'qholaqhoe':     { lat: -28.76, lon: 28.27, name: 'Butha-Buthe' },
  'lipelaneng':    { lat: -28.76, lon: 28.27, name: 'Butha-Buthe' },
};

function resolveCoords(locationStr) {
  if (!locationStr) return { lat: -29.32, lon: 27.50, name: 'Maseru' };
  const lower = locationStr.toLowerCase();
  for (const [key, val] of Object.entries(DISTRICT_COORDS)) {
    if (lower.includes(key)) return val;
  }
  return { lat: -29.32, lon: 27.50, name: 'Maseru' };
}

const getSeverityColor = (severity, theme) => ({
  low:    theme.palette.success.main,
  medium: theme.palette.warning.main,
  high:   theme.palette.error.main,
}[severity] || theme.palette.grey[500]);

const getSeverityLabel = (severity, language) => ({
  low:    language === 'en' ? 'Low'    : 'Nyane',
  medium: language === 'en' ? 'Medium' : 'Mahareng',
  high:   language === 'en' ? 'High'   : 'Holoholo',
}[severity] || severity);

// ── normaliseAdvice ────────────────────────────────────────────────────────────
// Converts inline numbered points ("1. text 2. text") into one-per-line.
// Handles duplicate numbers the model sometimes emits ("2. 2. text").
const normaliseAdvice = (text) => {
  if (!text) return text;
  let t = text.replace(/(\d+)\.\s+\1\./g, '$1.');
  t = t.replace(/\s+(?=\d+\.\s)/g, '\n');
  return t.trim();
};

// ── AdviceText ─────────────────────────────────────────────────────────────────
// Renders AI advice as numbered cards — same pattern as PlantingGuide
const AdviceText = ({ text }) => {
  if (!text) return null;
  const lines = normaliseAdvice(text).split('\n').filter(l => l.trim());
  const items = [];
  let plainBuffer = [];
  let pointIndex = 0;

  const flushPlain = () => {
    if (plainBuffer.length) {
      items.push({ type: 'plain', text: plainBuffer.join(' ') });
      plainBuffer = [];
    }
  };

  lines.forEach((line) => {
    const numbered       = line.match(/^\d+\.\s+\*\*(.+?)\*\*[:\-]?\s*(.*)/);
    const numberedPlain  = line.match(/^\d+\.\s+([^:*\n]{3,60}):\s*(.*)/);
    const numberedSimple = line.match(/^\d+\.\s+(.*)/);
    if (numbered) {
      flushPlain();
      items.push({ type: 'point', title: numbered[1], body: numbered[2] });
    } else if (numberedPlain) {
      flushPlain();
      items.push({ type: 'point', title: numberedPlain[1], body: numberedPlain[2] });
    } else if (numberedSimple) {
      flushPlain();
      items.push({ type: 'point', title: null, body: numberedSimple[1] });
    } else {
      plainBuffer.push(line.replace(/\*\*(.*?)\*\*/g, '$1'));
    }
  });
  flushPlain();

  return (
    <Box>
      {items.map((item, i) => {
        if (item.type === 'point') {
          pointIndex++;
          const num = pointIndex;
          return (
            <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.25, alignItems: 'flex-start' }}>
              <Box sx={{
                minWidth: 24, height: 24, borderRadius: '50%',
                bgcolor: 'success.main', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, mt: 0.15,
              }}>
                {num}
              </Box>
              <Box>
                {item.title && (
                  <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.5 }}>
                    {item.title}
                  </Typography>
                )}
                {item.body && (
                  <Typography variant="body2" color="text.secondary"
                    sx={{ lineHeight: 1.6, mt: item.title ? 0.2 : 0 }}>
                    {item.body}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        }
        return (
          <Typography key={i} variant="body2" color="text.secondary"
            sx={{ mb: 1, lineHeight: 1.65, whiteSpace: 'pre-line' }}>
            {item.text}
          </Typography>
        );
      })}
    </Box>
  );
};

// ── Weather advice per pest + conditions ───────────────────────────────────────
function getPestWeatherAdvice(pestName, weather, language) {
  if (!weather) return null;
  const temp  = weather.temperature_c ?? weather.temp_max_c ?? 20;
  const humid = weather.humidity_pct ?? 50;
  const wind  = weather.wind_speed_ms ?? 0;
  const rain  = weather.rainfall_mm ?? 0;
  const isEn  = language === 'en';
  const name  = pestName?.toLowerCase() || '';
  const tips  = [];

  // Spray window
  if (wind > SPRAY_WIND_MS) {
    tips.push(isEn
      ? `💨 Wind ${wind.toFixed(1)} m/s : avoid spraying until wind drops below ${SPRAY_WIND_MS} m/s`
      : `💨 Moea ${wind.toFixed(1)} m/s : se fifafatse ho fihlela moea o fokotsehile tlase ho ${SPRAY_WIND_MS} m/s`);
  } else if (rain >= SPRAY_RAIN_MM) {
    tips.push(isEn
      ? `🌧️ Rain ${rain} mm : delay spraying until dry`
      : `🌧️ Pula ${rain} mm : lieha ho fifafatsa ho fihlela ho omile`);
  } else {
    tips.push(isEn
      ? `✅ Good spray conditions today (wind ${wind.toFixed(1)} m/s, no heavy rain)`
      : `✅ Maemo a fifafatsa a lokile kajeno (moea ${wind.toFixed(1)} m/s, ha ho pula e matla)`);
  }

  // Pest-specific risk
  if (name.includes('armyworm') || name.includes('sesobeng')) {
    if (temp >= 18 && temp <= 30 && humid >= 65) {
      tips.push(isEn
        ? `⚠️ Warm humid conditions (${temp.toFixed(0)}°C, ${humid.toFixed(0)}%) : HIGH fall armyworm risk. Scout fields daily`
        : `⚠️ Maemo a chesang a mongobo (${temp.toFixed(0)}°C, ${humid.toFixed(0)}%) : KOTSI e PHAHAMENG ea sesobeng. Hlahloba masimo letsatsi le letsatsi`);
    }
  }
  if (name.includes('stalk borer') || name.includes('mobi')) {
    if (temp >= 28 && humid < 50) {
      tips.push(isEn
        ? `⚠️ Hot dry conditions (${temp.toFixed(0)}°C) favour stalk borer. Check for dead hearts`
        : `⚠️ Maemo a chesang a omileng (${temp.toFixed(0)}°C) a khothaletsa mobi oa motse. Hlahloba dipelo tse shoeleng`);
    }
  }
  if (name.includes('aphid') || name.includes('khothola')) {
    if (temp >= 20 && temp <= 32 && humid >= 60) {
      tips.push(isEn
        ? `⚠️ Aphid-friendly conditions. Check leaf undersides carefully`
        : `⚠️ Maemo a khothaletsa likhothola. Hlahloba ka tlase ha makhasi ka hloko`);
    }
  }
  if (humid >= 80) {
    tips.push(isEn
      ? `🍄 High humidity (${humid.toFixed(0)}%) : watch for fungal disease on leaves`
      : `🍄 Mongobo o phahamile (${humid.toFixed(0)}%) : sheba mafu a likhohle mathaung`);
  }

  return tips;
}

// ── SprayWindowBanner ──────────────────────────────────────────────────────────
const SprayWindowBanner = ({ forecast, language }) => {
  if (!forecast?.days?.length) return null;

  const todayStr   = new Date().toISOString().split('T')[0];
  const futureDays = forecast.days.filter(d => d.date >= todayStr);

  const suitable   = [];
  const unsuitable = [];

  futureDays.forEach((d) => {
    const rainBad = (d.rainfall_mm ?? 0) >= SPRAY_RAIN_MM;
    const windBad = (d.wind_speed_ms ?? 0) >= SPRAY_WIND_MS;
    const reasons = [
      rainBad && (language === 'en' ? 'heavy rain' : 'pula e matla'),
      windBad && (language === 'en' ? 'strong wind' : 'moea o matla'),
    ].filter(Boolean);
    if (reasons.length) unsuitable.push({ ...d, reason: reasons.join(' + ') });
    else suitable.push(d);
  });

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString(language === 'en' ? 'en-LS' : 'st-LS', {
      weekday: 'short', month: 'short', day: 'numeric',
    });

  return (
    <Box sx={{ mb: 2, p: 1.5, backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <WeatherIcon fontSize="small" sx={{ color: '#2e7d32' }} />
        <Typography variant="body2" fontWeight={700}>
          {language === 'en' ? '🌬️ Spray Window (Next 7 Days)' : '🌬️ Nako ea Ho Fifafatsa (Matsatsi a 7)'}
        </Typography>
      </Box>

      {suitable.length > 0 && (
        <Box sx={{ mb: 0.75 }}>
          <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 600 }}>
            {language === 'en' ? '✅ Suitable:' : '✅ E Loketse:'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
            {suitable.map((d) => (
              <Chip key={d.date} label={fmtDate(d.date)} size="small"
                sx={{ bgcolor: '#dcfce7', border: '1px solid #86efac', fontSize: '0.72rem' }} />
            ))}
          </Box>
        </Box>
      )}

      {unsuitable.length > 0 && (
        <Box>
          <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 600 }}>
            {language === 'en' ? '⚠️ Avoid spraying:' : '⚠️ Se fifafatse:'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
            {unsuitable.map((d) => (
              <Chip key={d.date} label={`${fmtDate(d.date)} (${d.reason})`} size="small"
                sx={{ bgcolor: '#fef9c3', border: '1px solid #fde047', fontSize: '0.72rem' }} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

// ── WeatherAdviceStrip (My Reports cards) ──────────────────────────────────────
// Fix: use location as the key for the ref so each unique location gets its own fetch
const WeatherAdviceStrip = ({ pestName, location, language }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  // Use a ref keyed to location so re-mounting with a different location re-fetches
  const fetchedLocation = useRef(null);

  useEffect(() => {
    if (fetchedLocation.current === location) return;
    fetchedLocation.current = location;
    setLoading(true);
    setWeather(null);
    const { lat, lon, name } = resolveCoords(location);
    weatherApi.getCurrent(lat, lon, name)
      .then(w => setWeather(w))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [location]);

  if (loading) return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, opacity: 0.6 }}>
      <CircularProgress size={12} />
      <Typography variant="caption" color="text.secondary">
        {language === 'en' ? 'Loading weather advice…' : 'E jarolla keletso ea leholimo…'}
      </Typography>
    </Box>
  );

  if (!weather) return null;

  const tips = getPestWeatherAdvice(pestName, weather, language);
  if (!tips?.length) return null;

  const temp  = weather.temperature_c ?? weather.temp_max_c;
  const humid = weather.humidity_pct;
  const wind  = weather.wind_speed_ms;
  const { name } = resolveCoords(location);

  return (
    <Box sx={{ mt: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75, flexWrap: 'wrap' }}>
        <WeatherIcon sx={{ fontSize: 14, color: '#2e7d32' }} />
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {language === 'en' ? `Weather at ${name}` : `Leholimo ha ${name}`}
        </Typography>
        {temp != null && (
          <Chip label={`${Math.round(temp)}°C`} size="small"
            sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#fff3cd' }} />
        )}
        {humid != null && (
          <Chip label={`${Math.round(humid)}%`} size="small"
            sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#d1ecf1' }} />
        )}
        {wind != null && (
          <Chip label={`${wind.toFixed(1)} m/s`} size="small"
            sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#d4edda' }} />
        )}
      </Box>

      {tips.map((tip, i) => {
        const isGood   = tip.startsWith('✅');
        const isWarn   = tip.startsWith('⚠️');
        const isFungal = tip.startsWith('🍄');
        const bgColor  = isGood ? '#f0fdf4' : isWarn ? '#fff8e1' : isFungal ? '#f3e5f5' : '#e3f2fd';
        const border   = isGood ? '#86efac'  : isWarn ? '#fde047'  : isFungal ? '#ce93d8'  : '#90caf9';
        return (
          <Box key={i} sx={{ mb: 0.5, px: 1, py: 0.5, bgcolor: bgColor, border: `1px solid ${border}`, borderRadius: 1 }}>
            <Typography variant="caption" sx={{ lineHeight: 1.4 }}>{tip}</Typography>
          </Box>
        );
      })}
    </Box>
  );
};

// ── PestCard ───────────────────────────────────────────────────────────────────
const PestCard = ({ pest, language, onAsk, onReport }) => {
  const theme         = useTheme();
  const severityColor = getSeverityColor(pest.severity, theme);
  const treatment     = pest.treatment || {};
  const symptomsDisplay = language === 'st'
    ? (pest.symptoms_st?.length ? pest.symptoms_st : pest.symptoms)
    : pest.symptoms;

  return (
    <Card elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        avatar={
          <Avatar sx={{ bgcolor: severityColor, fontSize: '1.4rem', width: 48, height: 48 }}>
            {pest.image_emoji}
          </Avatar>
        }
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
              {language === 'en' ? pest.name : pest.name_st}
            </Typography>
            <Chip label={getSeverityLabel(pest.severity, language)} size="small"
              sx={{ bgcolor: severityColor, color: 'white', fontWeight: 600 }} />
          </Box>
        }
        subheader={
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {pest.scientific_name}
            </Typography>
            <br />
            <Typography variant="caption" color="text.secondary">
              {language === 'en' ? 'Season: ' : 'Nako: '}{pest.season}
            </Typography>
          </Box>
        }
      />
      <CardContent sx={{ flex: 1, pt: 0 }}>
        <Box sx={{ mb: 1.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {pest.crops?.map((crop) => (
            <Chip key={crop} label={crop} size="small" variant="outlined" />
          ))}
        </Box>

        <Accordion disableGutters elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="warning" fontSize="small" />
              <Typography variant="body2" fontWeight={600}>
                {language === 'en' ? 'Symptoms' : 'Matšoao'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {(symptomsDisplay || []).map((s, i) => (
                <li key={i}><Typography variant="body2">{s}</Typography></li>
              ))}
            </ul>
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScienceIcon color="primary" fontSize="small" />
              <Typography variant="body2" fontWeight={600}>
                {language === 'en' ? 'Treatment' : 'Kalafo'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {(treatment.cultural || []).length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" fontWeight={700} color="success.main">
                  {language === 'en' ? 'Cultural / Traditional' : 'Mekhoa ea setso'}
                </Typography>
                <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                  {treatment.cultural.map((t, i) => (
                    <li key={i}><Typography variant="body2">{t}</Typography></li>
                  ))}
                </ul>
              </Box>
            )}
            {(treatment.biological || []).length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" fontWeight={700} color="info.main">
                  {language === 'en' ? 'Biological' : 'Bioloji'}
                </Typography>
                <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                  {treatment.biological.map((t, i) => (
                    <li key={i}><Typography variant="body2">{t}</Typography></li>
                  ))}
                </ul>
              </Box>
            )}
            {(treatment.chemical || []).length > 0 && (
              <Box>
                <Typography variant="caption" fontWeight={700} color="error.main">
                  {language === 'en' ? 'Chemical (last resort)' : "Lik'hemik'hale (mohato oa ho qetela)"}
                </Typography>
                <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                  {treatment.chemical.map((t, i) => (
                    <li key={i}><Typography variant="body2">{t}</Typography></li>
                  ))}
                </ul>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', mb: 1.5 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon color="success" fontSize="small" />
              <Typography variant="body2" fontWeight={600}>
                {language === 'en' ? 'Prevention' : 'Thibelo'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {(pest.prevention || []).map((p, i) => (
                <li key={i}><Typography variant="body2">{p}</Typography></li>
              ))}
            </ul>
          </AccordionDetails>
        </Accordion>

        {pest.lesotho_context && (
          <Alert severity="info" icon={<InfoIcon fontSize="small" />} sx={{ mb: 1.5, py: 0.5 }}>
            <Typography variant="caption">{pest.lesotho_context}</Typography>
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
          <Button size="small" variant="outlined" fullWidth onClick={() => onAsk(pest)}>
            {language === 'en' ? `Ask about ${pest.name}` : `Botsa ka ${pest.name_st}`}
          </Button>
          <Button size="small" variant="contained" color="error" fullWidth
            onClick={() => onReport(pest)} startIcon={<AddIcon />}>
            {language === 'en' ? 'Report' : 'Tlaleha'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const PestControl = () => {
  const { user }        = useAuth();
  const { fetchNotifications } = useNotifications();
  const { t, language } = useLanguage();
  const navigate        = useNavigate();
  const theme           = useTheme();

  const [tabValue,       setTabValue]       = useState(0);
  const [pests,          setPests]          = useState([]);
  const [reports,        setReports]        = useState([]);
  const [crops,          setCrops]          = useState([]);
  const [generalTips,    setGeneralTips]    = useState([]);
  const [serviceReady,   setServiceReady]   = useState(null);
  const [selectedCrop,   setSelectedCrop]   = useState('all');
  const [loading,        setLoading]        = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [askLoading,     setAskLoading]     = useState(false);
  const [error,          setError]          = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [openReportDialog, setOpenReportDialog] = useState(false);
  const [openAskDialog,    setOpenAskDialog]    = useState(false);
  const [askContext,       setAskContext]       = useState(null);
  const [questionText,     setQuestionText]     = useState('');
  const [askAnswer,        setAskAnswer]        = useState(null);
  const [newReport, setNewReport] = useState({
    crop: '', pest_name: '', date_observed: format(new Date(), 'yyyy-MM-dd'),
    location: '', severity: 'medium', action_taken: '', notes: '',
  });

  const [sprayForecast,  setSprayForecast]  = useState(null);
  const [weatherAlerts,  setWeatherAlerts]  = useState([]);

  const [openPestActionDialog,  setOpenPestActionDialog]  = useState(false);
  const [openPestHistoryDialog, setOpenPestHistoryDialog] = useState(false);
  const [selectedReport,        setSelectedReport]        = useState(null);
  const [pestActionText,        setPestActionText]        = useState('');
  const [pestActionLogs,        setPestActionLogs]        = useState([]);
  const [pestActionAdvice,      setPestActionAdvice]      = useState(null);
  const [pestActionLoading,     setPestActionLoading]     = useState(false);
  const [pestLatestAdviceMap,   setPestLatestAdviceMap]   = useState({});

  // ── Fetch spray forecast + weather alerts from notification service ────────
  useEffect(() => {
    const { lat, lon, name } = resolveCoords(user?.region || 'Maseru');

    // Spray forecast
    weatherApi.getForecast(lat, lon, 7, name)
      .then((forecast) => {
        const todayStr = new Date().toISOString().split('T')[0];
        if (forecast?.days) {
          forecast.days = forecast.days.filter(d => d.date >= todayStr);
        }
        setSprayForecast(forecast);
      })
      .catch(err => console.warn('PestControl: forecast fetch failed', err));

    // Weather alerts — fetch from notification service using the same URL pattern
    // as NotificationContext.apiFetch: /path?farmer_id=N (no extra query params
    // that the service might not support, filter client-side instead)
    if (user?.id) {
      const NOTIF_URL = process.env.REACT_APP_NOTIFICATION_SERVICE_URL || 'http://localhost:8004';
      const todayStr  = new Date().toISOString().split('T')[0];
      fetch(`${NOTIF_URL}/notifications/?farmer_id=${user.id}`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          const list = Array.isArray(data) ? data : [];
          const recent = list.filter(n =>
            n.type === 'weather' &&
            ['warning', 'critical'].includes(n.severity) &&
            n.created_at?.startsWith(todayStr)
          );
          setWeatherAlerts(recent);
        })
        .catch(() => {}); // non-fatal — alerts are a nice-to-have
    }
  }, [user]);

  const loadPestLibrary = useCallback(async (crop = 'all') => {
    setLoading(true);
    setError(null);
    try {
      const [pestsData, cropsData, tipsData] = await Promise.all([
        fetchPests({ crop: crop === 'all' ? null : crop }),
        fetchCrops(),
        fetchGeneralTips(),
      ]);
      setPests(pestsData);
      setCrops(cropsData);
      setGeneralTips(tipsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    if (!user?.id) return;
    setReportsLoading(true);
    try {
      const data = await fetchUserReports(user.id);
      setReports(data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setReportsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    checkHealth().then(h => setServiceReady(h.status === 'healthy'));
    loadPestLibrary();
    loadReports();
  }, [loadPestLibrary, loadReports]);

  useEffect(() => {
    if (tabValue === 0) loadReports();
  }, [tabValue, loadReports]);

  useEffect(() => {
    if (tabValue === 1) loadPestLibrary(selectedCrop);
  }, [tabValue]); // eslint-disable-line

  const handleCropFilter = (crop) => { setSelectedCrop(crop); loadPestLibrary(crop); };

  const handleOpenAsk = (pest = null) => {
    setAskContext(pest);
    setQuestionText(pest
      ? (language === 'en'
          ? `How do I control ${pest.name} on my crops?`
          : `Ke laola ${pest.name_st} joang lijelong tsa ka?`)
      : '');
    setAskAnswer(null);
    setOpenAskDialog(true);
  };

  const handleOpenReportFromPest = (pest) => {
    setNewReport({
      crop:          pest.crops?.[0] || '',
      pest_name:     pest.name,
      date_observed: format(new Date(), 'yyyy-MM-dd'),
      location:      '',
      severity:      pest.severity || 'medium',
      action_taken:  '',
      notes:         '',
    });
    setOpenReportDialog(true);
  };

  const handleAskQuestion = async () => {
    if (!questionText.trim()) return;
    setAskLoading(true);
    setAskAnswer(null);
    try {
      const response = await askPestQuestion({
        question: questionText, language,
        crop: askContext?.crops?.[0] || null,
      });
      setAskAnswer(response);
    } catch (err) {
      setAskAnswer({ answer: `Error: ${err.message}`, relevant_pests: [], sources: [] });
    } finally {
      setAskLoading(false);
    }
  };

  const handleSendToChat = () => {
    navigate(`/chat?q=${encodeURIComponent(questionText)}&topic=pest-control`);
    setOpenAskDialog(false);
  };

  const handleAddReport = async () => {
    if (!newReport.crop || !newReport.pest_name || !newReport.location) return;
    try {
      const payload = {
        user_id:       user?.id ? String(user.id) : 'anonymous',
        crop:          newReport.crop,
        pest_name:     newReport.pest_name,
        date_observed: newReport.date_observed || format(new Date(), 'yyyy-MM-dd'),
        location:      newReport.location,
        severity:      newReport.severity || 'medium',
        action_taken:  newReport.action_taken?.trim() || 'None recorded',
        notes:         newReport.notes || '',
      };
      await createPestReport(payload);
      setOpenReportDialog(false);
      setNewReport({
        crop: '', pest_name: '', date_observed: format(new Date(), 'yyyy-MM-dd'),
        location: '', severity: 'medium', action_taken: '', notes: '',
      });
      setSnackbar({ open: true, message: language === 'en' ? 'Report submitted!' : 'Tlaleho e rometsoe!', severity: 'success' });
      if (tabValue === 0) loadReports();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleResolveReport = async (reportId) => {
    try {
      await updatePestReport(reportId, { status: 'resolved' });
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
      setSnackbar({ open: true, message: language === 'en' ? 'Marked as resolved' : 'E tibiloe e rarolloa', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleReopenReport = async (reportId) => {
    try {
      await updatePestReport(reportId, { status: 'monitoring' });
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'monitoring' } : r));
      setSnackbar({ open: true, message: language === 'en' ? 'Report reopened, now monitoring' : 'Tlaleho e buletstoe, e hlahlojoa', severity: 'info' });
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleChangeSeverity = async (reportId, newSeverity) => {
    try {
      const BASE = process.env.REACT_APP_PEST_CONTROL_SERVICE_URL || 'http://localhost:8001';
      await fetch(`${BASE}/api/pests/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ severity: newSeverity, status: 'monitoring' }),
      });
      setReports(prev => prev.map(r =>
        r.id === reportId ? { ...r, severity: newSeverity, status: 'monitoring' } : r
      ));
      setSnackbar({ open: true, message: language === 'en' ? `Severity updated to ${newSeverity}` : `Boholo bo fetotsoe ho ${newSeverity}`, severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleDeleteReport = async (reportId) => {
    try {
      await deletePestReport(reportId);
      setReports(prev => prev.filter(r => r.id !== reportId));
      setSnackbar({ open: true, message: language === 'en' ? 'Report deleted' : 'Tlaleho e hlakotsoe', severity: 'info' });
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleOpenPestActionDialog = (report) => {
    setSelectedReport(report);
    setPestActionText('');
    setPestActionAdvice(null);
    setOpenPestActionDialog(true);
  };

  const handleOpenPestHistoryDialog = async (report) => {
    setSelectedReport(report);
    setPestActionLogs([]);
    setOpenPestHistoryDialog(true);
    try {
      const BASE = process.env.REACT_APP_PEST_CONTROL_SERVICE_URL || 'http://localhost:8001';
      const res = await fetch(`${BASE}/api/pests/reports/${report.id}/actions`);
      if (res.ok) { const data = await res.json(); setPestActionLogs(data); }
    } catch (err) { console.warn('Could not load pest action logs:', err); }
  };

  const handleLogPestAction = async () => {
    if (!pestActionText.trim() || !selectedReport) return;
    setPestActionLoading(true);
    setPestActionAdvice(null);
    try {
      const BASE = process.env.REACT_APP_PEST_CONTROL_SERVICE_URL || 'http://localhost:8001';
      const res = await fetch(`${BASE}/api/pests/reports/${selectedReport.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:    pestActionText,
          language:  language,
          pest_name: selectedReport.pest_name,
          crop:      selectedReport.crop,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const logEntry = await res.json();
      const advice = { en: logEntry.advice_en, st: logEntry.advice_st };
      setPestActionAdvice(advice);
      setPestLatestAdviceMap(prev => ({ ...prev, [selectedReport.id]: advice }));
      setReports(prev => prev.map(r =>
        r.id === selectedReport.id ? { ...r, action_taken: pestActionText } : r
      ));
      setPestActionText('');
      setSnackbar({ open: true, message: language === 'en' ? 'Action logged!' : 'Ketso e ngoliloe!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setPestActionLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <PestIcon sx={{ fontSize: 40, color: theme.palette.error.main }} />
          <Box>
            <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' }, fontWeight: 700 }}>
              {language === 'en' ? 'Pest Control' : 'Taolo ea Likokonyana'}
            </Typography>
            {serviceReady === false && (
              <Typography variant="caption" color="error">
                {language === 'en'
                  ? 'Service offline – showing cached data'
                  : "Ts'ebeletso e koetsoe – data e bolokiloeng e bontšitsoe"}
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button variant="outlined" startIcon={<QuestionIcon />} onClick={() => handleOpenAsk()}>
            {language === 'en' ? 'Ask a Question' : 'Botsa Potso'}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} color="error"
            onClick={() => setOpenReportDialog(true)}>
            {language === 'en' ? 'Report Pest' : 'Tlaleha Kokonyana'}
          </Button>
        </Box>
      </Box>

      {/* Weather alerts from notification service */}
      {weatherAlerts.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {weatherAlerts.map((alert, i) => (
            <Alert key={i}
              severity={alert.severity === 'critical' ? 'error' : 'warning'}
              icon={<WeatherIcon fontSize="small" />}
              sx={{ mb: 1 }}>
              <strong>{alert.title}:</strong> {alert.body}
            </Alert>
          ))}
        </Box>
      )}

      {/* Tabs */}
      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}
        variant="scrollable" scrollButtons="auto"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label={language === 'en' ? 'My Reports'      : 'Litlaleho tsa Ka'} />
        <Tab label={language === 'en' ? 'Pest Library'    : 'Libuka tsa Likokonyana'} />
        <Tab label={language === 'en' ? 'Prevention Tips' : 'Mekhoa ea Thibelo'} />
      </Tabs>

      {/* ── TAB 0: My Reports ───────────────────────────────────────────────── */}
      {tabValue === 0 && (
        <>
          <SprayWindowBanner forecast={sprayForecast} language={language} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
            <Typography variant="h6">
              {language === 'en' ? 'Your Pest Reports' : 'Litlaleho tsa Hau'}
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} size="small"
              onClick={() => setOpenReportDialog(true)}>
              {language === 'en' ? 'New Report' : 'Tlaleho e Ncha'}
            </Button>
          </Box>

          {reportsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : reports.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <PestIcon sx={{ fontSize: 60, color: theme.palette.grey[400], mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {language === 'en' ? 'No pest reports yet' : 'Ha ho litlaleho tsa likokonyana'}
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />}
                onClick={() => setOpenReportDialog(true)} sx={{ mt: 1 }}>
                {language === 'en' ? 'Report your first pest' : 'Tlaleha kokonyana ea pele'}
              </Button>
            </Paper>
          ) : (
            reports.map(report => (
              <Card key={report.id} elevation={2} sx={{
                mb: 2,
                borderLeft: `4px solid ${getSeverityColor(report.severity, theme)}`,
                opacity: report.status === 'resolved' ? 0.75 : 1,
              }}>
                <CardContent>
                  {/* Header row */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {report.crop}: {report.pest_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {report.date_observed
                          ? format(new Date(report.date_observed), 'yyyy-MM-dd')
                          : ''} | {report.location}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip
                        label={report.status === 'resolved'
                          ? (language === 'en' ? 'Resolved'   : 'E rarolloa')
                          : (language === 'en' ? 'Monitoring' : 'E hlahlojoa')}
                        size="small"
                        color={report.status === 'resolved' ? 'success' : 'warning'}
                      />
                      <Tooltip title={language === 'en' ? 'Log action & get advice' : 'Ngola ketso le fumana keletso'}>
                        <IconButton size="small" color="primary"
                          onClick={() => handleOpenPestActionDialog(report)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={language === 'en' ? 'View action history' : 'Bona histori ea liketso'}>
                        <IconButton size="small"
                          onClick={() => handleOpenPestHistoryDialog(report)}>
                          <HistoryIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {report.status !== 'resolved' ? (
                        <Tooltip title={language === 'en' ? 'Mark resolved' : 'Tiba e rarolloa'}>
                          <IconButton size="small" color="success"
                            onClick={() => handleResolveReport(report.id)}>
                            <DoneIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title={language === 'en' ? 'Reopen' : 'Bula hape'}>
                          <IconButton size="small" color="warning"
                            onClick={() => handleReopenReport(report.id)}>
                            <RestoreIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title={language === 'en' ? 'Delete' : 'Hlakola'}>
                        <IconButton size="small" color="error"
                          onClick={() => handleDeleteReport(report.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Severity chips */}
                  <Box sx={{ mt: 1, display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Typography variant="caption" color="textSecondary" sx={{ mr: 0.5 }}>
                      {language === 'en' ? 'Severity:' : 'Boholo:'}
                    </Typography>
                    {['low', 'medium', 'high'].map(level => (
                      <Chip key={level}
                        label={getSeverityLabel(level, language)}
                        size="small"
                        onClick={() => report.severity !== level && handleChangeSeverity(report.id, level)}
                        sx={{
                          bgcolor:    report.severity === level ? getSeverityColor(level, theme) : 'transparent',
                          color:      report.severity === level ? 'white' : getSeverityColor(level, theme),
                          border:     `1px solid ${getSeverityColor(level, theme)}`,
                          fontWeight: report.severity === level ? 700 : 400,
                          cursor:     report.severity === level ? 'default' : 'pointer',
                          transition: 'all 0.15s',
                        }}
                      />
                    ))}
                  </Box>

                  {/* Latest action */}
                  {report.action_taken && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>{language === 'en' ? 'Latest action: ' : 'Ketso ea morao-rao: '}</strong>
                      {report.action_taken}
                    </Typography>
                  )}

                  {/* Latest logged advice */}
                  {pestLatestAdviceMap[report.id] && (
                    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 2 }}>
                      <Typography variant="caption" fontWeight={700} color="success.main" display="block" sx={{ mb: 0.75 }}>
                        💡 {language === 'en' ? 'Latest advice:' : 'Keletso ea morao-rao:'}
                      </Typography>
                      <AdviceText
                        text={language === 'en'
                          ? pestLatestAdviceMap[report.id].en
                          : pestLatestAdviceMap[report.id].st}
                      />
                    </Box>
                  )}

                  {/* Weather advice strip */}
                  {report.status !== 'resolved' && (
                    <WeatherAdviceStrip
                      key={report.id}
                      pestName={report.pest_name}
                      location={report.location}
                      language={language}
                    />
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </>
      )}

      {/* ── TAB 1: Pest Library ─────────────────────────────────────────────── */}
      {tabValue === 1 && (
        <>
          <SprayWindowBanner forecast={sprayForecast} language={language} />
          <Box sx={{ mb: 2.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              label={language === 'en' ? 'All Crops' : 'Lijalo Tsohle'}
              onClick={() => handleCropFilter('all')}
              color={selectedCrop === 'all' ? 'primary' : 'default'}
              sx={{ minHeight: 36 }}
            />
            {crops.map(crop => (
              <Chip key={crop} label={t ? t(crop) : crop}
                onClick={() => handleCropFilter(crop)}
                color={selectedCrop === crop ? 'primary' : 'default'}
                sx={{ minHeight: 36, textTransform: 'capitalize' }} />
            ))}
            <Tooltip title={language === 'en' ? 'Refresh' : 'Hlazoa'}>
              <IconButton size="small" onClick={() => loadPestLibrary(selectedCrop)}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {language === 'en'
                ? `Failed to load pests: ${error}`
                : `Ho hlolehile ho kenya likokonyana: ${error}`}
            </Alert>
          ) : pests.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <PestIcon sx={{ fontSize: 60, color: theme.palette.grey[400], mb: 2 }} />
              <Typography color="text.secondary">
                {language === 'en'
                  ? 'No pests found for this crop'
                  : 'Ha ho likokonyana tse fumanehang bakeng sa sejalo sena'}
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {pests.map(pest => (
                <Grid item xs={12} md={6} key={pest.id}>
                  <PestCard pest={pest} language={language}
                    onAsk={handleOpenAsk} onReport={handleOpenReportFromPest} />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* ── TAB 2: Prevention Tips ──────────────────────────────────────────── */}
      {tabValue === 2 && (
        <>
          <SprayWindowBanner forecast={sprayForecast} language={language} />
          <Grid container spacing={2}>
            {generalTips.length === 0 ? (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={28} />
                </Box>
              </Grid>
            ) : (
              generalTips.map(tip => {
                const icons = {
                  crop_rotation:              <AgricultureIcon sx={{ fontSize: 44, color: theme.palette.primary.main }} />,
                  field_sanitation:           <GrassIcon       sx={{ fontSize: 44, color: theme.palette.success.main }} />,
                  early_detection:            <ScienceIcon     sx={{ fontSize: 44, color: theme.palette.warning.main }} />,
                  integrated_pest_management: <CheckCircleIcon sx={{ fontSize: 44, color: theme.palette.info.main }} />,
                  weather_monitoring:         <WeatherIcon     sx={{ fontSize: 44, color: theme.palette.secondary.main }} />,
                };
                const titles = {
                  crop_rotation:              { en: 'Crop Rotation',              st: 'Ho Potoloha Lijalo' },
                  field_sanitation:           { en: 'Field Sanitation',           st: 'Ho Hloekisa Masimo' },
                  early_detection:            { en: 'Early Detection',            st: 'Ho Lemoha Kapele' },
                  integrated_pest_management: { en: 'Integrated Pest Management', st: 'Taolo e Kopantsoeng' },
                  weather_monitoring:         { en: 'Weather Monitoring',         st: 'Ho Sheba Maemo a Leaera' },
                };
                return (
                  <Grid item xs={12} sm={6} md={4} key={tip.key}>
                    <Card elevation={2} sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ textAlign: 'center', mb: 1.5 }}>
                          {icons[tip.key] || <PestIcon sx={{ fontSize: 44 }} />}
                        </Box>
                        <Typography variant="h6" align="center" gutterBottom fontWeight={600}>
                          {language === 'en'
                            ? titles[tip.key]?.en || tip.key
                            : titles[tip.key]?.st || tip.key}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {language === 'en' ? tip.en : tip.st}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })
            )}
          </Grid>
        </>
      )}

      {/* ── Report Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={openReportDialog} onClose={() => setOpenReportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{language === 'en' ? 'Report Pest Infestation' : 'Tlaleha Likokonyana'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label={language === 'en' ? 'Crop *' : 'Sejalo *'}
                value={newReport.crop}
                onChange={e => setNewReport({ ...newReport, crop: e.target.value })}
                SelectProps={{ native: true }}>
                <option value="">{language === 'en' ? 'Select crop' : 'Khetha sejalo'}</option>
                {crops.map(c => (
                  <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={language === 'en' ? 'Pest Name *' : 'Lebitso la Kokonyana *'}
                value={newReport.pest_name}
                onChange={e => setNewReport({ ...newReport, pest_name: e.target.value })}
                placeholder={language === 'en' ? 'e.g. Fall Armyworm' : 'mohlala: Sesobeng'} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="date"
                label={language === 'en' ? 'Date Observed' : 'Letsatsi le Bonoeng'}
                value={newReport.date_observed}
                onChange={e => setNewReport({ ...newReport, date_observed: e.target.value })}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={language === 'en' ? 'Location / Field *' : 'Sebaka / Tšimo *'}
                value={newReport.location}
                onChange={e => setNewReport({ ...newReport, location: e.target.value })}
                placeholder={language === 'en' ? 'e.g. Lower field, Maseru' : 'mohlala: Tšimo e fatshe'} />
            </Grid>
            <Grid item xs={12}>
              <TextField select fullWidth label={language === 'en' ? 'Severity' : 'Boholo ba Kotsi'}
                value={newReport.severity}
                onChange={e => setNewReport({ ...newReport, severity: e.target.value })}
                SelectProps={{ native: true }}>
                <option value="low">{language === 'en' ? 'Low' : 'Nyane'}</option>
                <option value="medium">{language === 'en' ? 'Medium' : 'Mahareng'}</option>
                <option value="high">{language === 'en' ? 'High' : 'Holoholo'}</option>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={2}
                label={language === 'en' ? 'Action Taken' : 'Ketso e Nkiloeng'}
                value={newReport.action_taken}
                onChange={e => setNewReport({ ...newReport, action_taken: e.target.value })}
                placeholder={language === 'en' ? 'e.g. Applied neem spray' : 'mohlala: Ke fafalitse neem'} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={2}
                label={language === 'en' ? 'Additional Notes' : 'Lintlha tse ling'}
                value={newReport.notes}
                onChange={e => setNewReport({ ...newReport, notes: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReportDialog(false)}>
            {language === 'en' ? 'Cancel' : 'Hlakola'}
          </Button>
          <Button onClick={handleAddReport} variant="contained"
            disabled={!newReport.crop || !newReport.pest_name || !newReport.location}>
            {language === 'en' ? 'Submit Report' : 'Romela Tlaleho'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Ask Dialog ────────────────────────────────────────────────────────── */}
      <Dialog open={openAskDialog} onClose={() => setOpenAskDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {language === 'en' ? 'Ask about Pest Control' : 'Botsa ka Taolo ea Likokonyana'}
        </DialogTitle>
        <DialogContent>
          <SprayWindowBanner forecast={sprayForecast} language={language} />
          <TextField fullWidth multiline rows={3}
            label={language === 'en' ? 'Your question' : 'Potso ea hau'}
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            sx={{ mb: 2 }}
            placeholder={language === 'en'
              ? 'e.g. How do I control fall armyworm organically?'
              : 'mohlala: Ke laola liboko joang ntle le meriana?'} />

          {askLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="textSecondary">
                {language === 'en' ? 'Mosupisi is thinking...' : 'Mosupisi o nahana...'}
              </Typography>
            </Box>
          )}

          {askAnswer && (
            <Box sx={{ mt: 1 }}>
              <Box sx={{ p: 1.5, bgcolor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 2, mb: 2 }}>
                <AdviceText text={askAnswer.answer} />
              </Box>
              {askAnswer.relevant_pests?.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    {language === 'en' ? 'Related pests:' : 'Likokonyana tse amanang:'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                    {askAnswer.relevant_pests.map(p => (
                      <Chip key={p.id}
                        label={`${p.image_emoji} ${language === 'en' ? p.name : p.name_st}`}
                        size="small" />
                    ))}
                  </Box>
                </Box>
              )}
              {askAnswer.sources?.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {language === 'en' ? 'Sources: ' : 'Mehloli: '}{askAnswer.sources.join(', ')}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAskDialog(false)}>
            {language === 'en' ? 'Close' : 'Koala'}
          </Button>
          <Button onClick={handleAskQuestion} variant="outlined"
            disabled={askLoading || !questionText.trim()}>
            {language === 'en' ? 'Ask Mosupisi' : 'Botsa Mosupisi'}
          </Button>
          <Button onClick={handleSendToChat} variant="contained" disabled={!questionText.trim()}>
            {language === 'en' ? 'Open in Chat' : 'Bula ka Chat'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Pest Action Log Dialog ────────────────────────────────────────────── */}
      <Dialog open={openPestActionDialog}
        onClose={() => { setOpenPestActionDialog(false); setPestActionAdvice(null); }}
        maxWidth="sm" fullWidth>
        <DialogTitle>
          {language === 'en' ? '🐛 Log Pest Control Action' : '🐛 Ngola Ketso ea Taolo ea Likokonyana'}
          {selectedReport && (
            <Typography variant="caption" display="block" color="textSecondary">
              {selectedReport.pest_name} on {selectedReport.crop} | {selectedReport.location}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline rows={3}
            label={language === 'en' ? 'What did you do?' : 'U entseng?'}
            value={pestActionText}
            onChange={e => setPestActionText(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
            placeholder={language === 'en'
              ? 'e.g., Applied neem spray, removed egg clusters, set traps...'
              : 'mohlala, Ke fafalitse neem, ke tlohile litsoale, ke beile mekanyo...'}
            disabled={pestActionLoading}
          />
          {pestActionLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="textSecondary">
                {language === 'en' ? 'Generating advice…' : 'E hlahisa keletso…'}
              </Typography>
            </Box>
          )}
          {pestActionAdvice && (
            <Box sx={{ p: 1.5, bgcolor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ width: 4, height: 18, bgcolor: 'success.main', borderRadius: 1 }} />
                <Typography variant="body2" fontWeight={700} color="success.main">
                  💡 {language === 'en' ? 'Recommended next steps:' : 'Mehato e latelang:'}
                </Typography>
              </Box>
              <AdviceText
                text={language === 'en' ? pestActionAdvice.en : pestActionAdvice.st}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenPestActionDialog(false); setPestActionAdvice(null); }}>
            {language === 'en' ? 'Close' : 'Koala'}
          </Button>
          <Button onClick={handleLogPestAction} variant="contained"
            disabled={pestActionLoading || !pestActionText.trim()}>
            {pestActionLoading
              ? <CircularProgress size={20} />
              : (language === 'en' ? 'Log & Get Advice' : 'Ngola le Fumana Keletso')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Pest Action History Dialog ────────────────────────────────────────── */}
      <Dialog open={openPestHistoryDialog}
        onClose={() => setOpenPestHistoryDialog(false)}
        maxWidth="sm" fullWidth>
        <DialogTitle>
          {language === 'en' ? 'Action History' : 'Histori ea Liketso'}
          {selectedReport && (
            <Typography variant="caption" display="block" color="textSecondary">
              {selectedReport.pest_name} on {selectedReport.crop} | {selectedReport.location}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {pestActionLogs.length === 0 ? (
            <Typography color="textSecondary" sx={{ py: 3, textAlign: 'center' }}>
              {language === 'en'
                ? 'No actions logged yet. Use the ✏️ button to log actions and get advice.'
                : 'Ha ho liketso tse ngolisitsoeng. Sebelisa konopo ea ✏️ ho ngola liketso.'}
            </Typography>
          ) : (
            <Box sx={{ maxHeight: 440, overflowY: 'auto' }}>
              {pestActionLogs.map(log => (
                <Box key={log.id} sx={{ mb: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>{log.action}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {log.logged_at
                        ? new Date(log.logged_at).toLocaleDateString('en-LS', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : ''}
                    </Typography>
                  </Box>
                  {(log.advice_en || log.advice_st) && (
                    <Box sx={{ mt: 0.75, p: 1.25, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #bbf7d0' }}>
                      <Typography variant="caption" color="success.main" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
                        💡 {language === 'en' ? 'Advice given:' : 'Keletso e fanoeng:'}
                      </Typography>
                      <AdviceText
                        text={language === 'en' ? log.advice_en : log.advice_st}
                      />
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPestHistoryDialog(false)} sx={{ minHeight: 44 }}>
            {language === 'en' ? 'Close' : 'Koala'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PestControl;