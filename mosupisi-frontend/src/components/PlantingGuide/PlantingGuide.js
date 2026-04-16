// components/PlantingGuide/PlantingGuide.js
// Mosupisi – AI Agricultural Extension Agent for Lesotho

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardHeader,
  Button,
  Chip,
  LinearProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  useTheme,
  Avatar,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import {
  Agriculture as AgricultureIcon,
  Add as AddIcon,
  QuestionAnswer as QuestionIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  CalendarToday as CalendarIcon,
  LocalFlorist as PlantIcon,
  Spa as SeedlingIcon,
  LightbulbOutlined as AdviceIcon,
  WbSunny as WeatherIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';
import { dbUtils } from '../../db/db';
import apiConfig from '../../config/api.config';
import { weatherApi } from '../../services/api';

const api = axios.create({
  baseURL: apiConfig.plantingGuide,
  timeout: 300000,
});

const cropGrowthStages = {
  maize: {
    germination: { days: 7,  description: 'Seed sprouting',       description_st: 'Peo e mela',              icon: '🌱' },
    vegetative:  { days: 45, description: 'Leaf development',     description_st: 'Makhasi a hola',           icon: '🌿' },
    tasseling:   { days: 10, description: 'Tassel emergence',     description_st: 'Lithasete li hlaha',       icon: '🌽' },
    silking:     { days: 10, description: 'Silk emergence',       description_st: 'Silika e hlaha',           icon: '🌽' },
    dough:       { days: 20, description: 'Kernel development',   description_st: 'Lithollo li hlaha',        icon: '🌽' },
    dent:        { days: 15, description: 'Kernel denting',       description_st: 'Lithollo li thatafala',    icon: '🌽' },
    mature:      { days: 10, description: 'Ready for harvest',    description_st: 'E butsoitse',              icon: '🌾' },
  },
  sorghum: {
    germination: { days: 7,  description: 'Seed sprouting',       description_st: 'Peo e mela',              icon: '🌱' },
    vegetative:  { days: 35, description: 'Leaf development',     description_st: 'Makhasi a hola',           icon: '🌿' },
    boot:        { days: 10, description: 'Head formation',       description_st: 'Hlooho e hlaha',           icon: '🌾' },
    heading:     { days: 7,  description: 'Head emergence',       description_st: 'Hlooho e hlaha',           icon: '🌾' },
    flowering:   { days: 10, description: 'Flowering',            description_st: 'Lipalesa',                 icon: '🌸' },
    grainFill:   { days: 30, description: 'Grain filling',        description_st: 'Lithollo li tlala',        icon: '🌾' },
    mature:      { days: 10, description: 'Ready for harvest',    description_st: 'E butsoitse',              icon: '🌾' },
  },
  legumes: {
    germination: { days: 7,  description: 'Seed sprouting',       description_st: 'Peo e mela',              icon: '🌱' },
    vegetative:  { days: 30, description: 'Leaf and stem growth', description_st: 'Makhasi le kutu li hola',  icon: '🌿' },
    flowering:   { days: 15, description: 'Flower development',   description_st: 'Lipalesa',                 icon: '🌸' },
    podFill:     { days: 20, description: 'Pod filling',          description_st: 'Likhapetla li tlala',      icon: '🫘' },
    mature:      { days: 15, description: 'Ready for harvest',    description_st: 'E butsoitse',              icon: '🫘' },
  },
};

const cropRotation = {
  maize:   { next: ['legumes', 'sorghum'], soilPrep: 'Add nitrogen-fixing crops, apply compost, deep plowing',   soilPrep_st: 'Kenya lijalo tsa naetrojene, sebelisa manyolo, lema botebo',   reason: 'Maize depletes nitrogen. Legumes will restore it.' },
  sorghum: { next: ['legumes', 'maize'],   soilPrep: 'Incorporate crop residue, add organic matter',             soilPrep_st: 'Kenya masalla, eketsa manyolo a tlhaho',                       reason: 'Sorghum leaves residue that improves soil structure.' },
  legumes: { next: ['maize', 'sorghum'],   soilPrep: 'Minimal tillage, retain nodules for nitrogen',             soilPrep_st: 'Lema hanyane, boloka maqhutsu a naetrojene',                   reason: 'Legumes fix nitrogen, perfect for heavy feeders like maize.' },
};

const PlantingGuide = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const theme = useTheme();

  const [plantings,           setPlantings]           = useState([]);
  const [loading,             setLoading]             = useState(true);
  const [selectedPlanting,    setSelectedPlanting]    = useState(null);
  const [openDialog,          setOpenDialog]          = useState(false);
  const [openActionDialog,    setOpenActionDialog]    = useState(false);
  const [openQuestionDialog,  setOpenQuestionDialog]  = useState(false);
  const [openAdviceDialog,    setOpenAdviceDialog]    = useState(false);
  const [adviceData,          setAdviceData]          = useState(null);
  const [adviceLoading,       setAdviceLoading]       = useState(false);
  const [actionText,          setActionText]          = useState('');
  const [questionText,        setQuestionText]        = useState('');
  const [snackbar,            setSnackbar]            = useState({ open: false, message: '', severity: 'success' });
  const [newPlanting,         setNewPlanting]         = useState({
    crop: '', plantingDate: format(new Date(), 'yyyy-MM-dd'), area: '', location: '',
  });
  const [liveWeather,    setLiveWeather]    = useState(null);
  const [liveForecast,   setLiveForecast]   = useState(null);
  const [actionLogs,     setActionLogs]     = useState([]);
  const [actionAdvice,   setActionAdvice]   = useState(null);
  const [actionLoading,  setActionLoading]  = useState(false);
  // Maps planting.id → { en, st } for the latest advice shown on the card
  const [latestAdviceMap, setLatestAdviceMap] = useState({});
  // History dialog — separate from Log Activity
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);

  // Fetch weather on mount
  useEffect(() => {
    const lat = user?.farm_lat || -29.3167;
    const lon = user?.farm_lon || 27.4833;
    const loc = user?.farm_location || 'Maseru';
    Promise.all([
      weatherApi.getCurrent(lat, lon, loc),
      weatherApi.getForecast(lat, lon, 3, loc),
    ])
      .then(([cur, fore]) => { setLiveWeather(cur); setLiveForecast(fore); })
      .catch((err) => console.warn('PlantingGuide: weather fetch failed', err));
  }, [user]);

  const loadPlantings = useCallback(async () => {
    setLoading(true);
    if (navigator.onLine) {
      try {
        const { data } = await api.get('/plantings');
        setPlantings(data);
        await dbUtils.cachePlantings(data);
      } catch (err) {
        console.error('API error, falling back to IndexedDB cache:', err);
        const cached = await dbUtils.getCachedPlantings();
        setPlantings(cached);
        showSnackbar(
          language === 'en' ? 'Offline mode – showing cached data' : 'Mokhoa oa ho se sebetse – data ea pele e bontsoa',
          'warning',
        );
      }
    } else {
      const cached = await dbUtils.getCachedPlantings();
      setPlantings(cached);
    }
    setLoading(false);
  }, [language]);

  useEffect(() => { loadPlantings(); }, [loadPlantings]);

  const showSnackbar = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

  const getCropIcon = (crop) => {
    switch (crop) {
      case 'maize':   return '🌽';
      case 'sorghum': return '🌾';
      case 'legumes': return '🫘';
      default:        return '🌱';
    }
  };

  const calculateGrowthProgress = (planting) => {
    if (planting.progressPercent !== undefined) return planting.progressPercent;
    if (planting.status === 'harvested') return 100;
    try {
      const daysSincePlanting = differenceInDays(new Date(), parseISO(planting.plantingDate));
      const stages = cropGrowthStages[planting.crop];
      if (!stages) return 0;
      const totalDays = Object.values(stages).reduce((s, st) => s + st.days, 0);
      return Math.min((daysSincePlanting / totalDays) * 100, 99);
    } catch { return 0; }
  };

  const getCurrentStage = (planting) => {
    if (planting.currentStage) return planting.currentStage;
    if (planting.status === 'harvested') return 'harvested';
    try {
      const daysSincePlanting = differenceInDays(new Date(), parseISO(planting.plantingDate));
      const stages = cropGrowthStages[planting.crop];
      if (!stages) return 'unknown';
      let accumulated = 0;
      for (const [stage, info] of Object.entries(stages)) {
        accumulated += info.days;
        if (daysSincePlanting <= accumulated) return stage;
      }
      return 'mature';
    } catch { return 'unknown'; }
  };

  const formatDate = (dateString) => {
    try {
      if (!dateString) return '';
      const d = parseISO(dateString);
      return isValid(d) ? format(d, 'MMM d, yyyy') : '';
    } catch { return ''; }
  };

  const formatShortDate = (dateString) => {
    try {
      if (!dateString) return '';
      const d = parseISO(dateString);
      return isValid(d) ? format(d, 'MMM d') : '';
    } catch { return ''; }
  };

  const handleAddPlanting = async () => {
    if (!newPlanting.crop || !newPlanting.plantingDate) return;
    const payload = {
      ...newPlanting, status: 'growing', growthStage: 'germination',
      lastAction: language === 'en' ? 'Planted' : 'E jalwe',
      lastActionDate: newPlanting.plantingDate,
      notes: language === 'en' ? 'New planting' : 'Sejalo se secha',
    };

    if (navigator.onLine) {
      try {
        const { data } = await api.post('/plantings', payload);
        setPlantings((prev) => [data, ...prev]);
        await dbUtils.savePlanting(data);
        showSnackbar(language === 'en' ? 'Planting added!' : 'Sejalo se kentsoe!');
      } catch (err) {
        console.error('Create planting error:', err);
        const local = { ...payload, id: Date.now(), createdAt: new Date().toISOString() };
        setPlantings((prev) => [local, ...prev]);
        await dbUtils.savePlanting(local);
        await dbUtils.addToSyncQueue('CREATE_PLANTING', local);
        showSnackbar(language === 'en' ? 'Saved offline – will sync when online' : 'E bolokiloe – e tla tsamaisana ha o khutla', 'warning');
      }
    } else {
      const local = { ...payload, id: Date.now(), createdAt: new Date().toISOString() };
      setPlantings((prev) => [local, ...prev]);
      await dbUtils.savePlanting(local);
      await dbUtils.addToSyncQueue('CREATE_PLANTING', local);
      showSnackbar(language === 'en' ? 'Saved offline' : 'E bolokiloe offline', 'warning');
    }

    setOpenDialog(false);
    setNewPlanting({ crop: '', plantingDate: format(new Date(), 'yyyy-MM-dd'), area: '', location: '' });
  };

  const handleAddAction = async () => {
    if (!actionText.trim() || !selectedPlanting) return;
    setActionLoading(true);
    setActionAdvice(null);

    if (navigator.onLine) {
      try {
        const { data } = await api.post(`/plantings/${selectedPlanting.id}/action`, { action: actionText, language });
        setPlantings((prev) => prev.map((p) => (p.id === data.id ? data : p)));
        await dbUtils.savePlanting(data);
        showSnackbar(language === 'en' ? 'Activity logged!' : 'Ketso e ngoliloe!');

        // Fetch the advice generated for this action
        try {
          const logsRes = await api.get(`/plantings/${selectedPlanting.id}/actions`);
          const logs = logsRes.data || [];
          setActionLogs(logs);
          if (logs.length > 0) {
            const latest = logs[0];
            const advice = { en: latest.advice_en, st: latest.advice_st };
            setActionAdvice(advice);
            // Save to card map so it shows on the card immediately
            setLatestAdviceMap((prev) => ({ ...prev, [selectedPlanting.id]: advice }));
          }
        } catch (logErr) {
          console.warn('Could not fetch action logs:', logErr);
        }
      } catch (err) {
        console.error('Log action error:', err);
        const updated = { ...selectedPlanting, lastAction: actionText, lastActionDate: format(new Date(), 'yyyy-MM-dd'), notes: actionText, updatedAt: new Date().toISOString() };
        setPlantings((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        await dbUtils.savePlanting(updated);
        await dbUtils.addToSyncQueue('LOG_ACTION', { id: selectedPlanting.id, action: actionText });
        showSnackbar(language === 'en' ? 'Saved offline' : 'E bolokiloe offline', 'warning');
      }
    } else {
      const updated = { ...selectedPlanting, lastAction: actionText, lastActionDate: format(new Date(), 'yyyy-MM-dd'), notes: actionText, updatedAt: new Date().toISOString() };
      setPlantings((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      await dbUtils.savePlanting(updated);
      await dbUtils.addToSyncQueue('LOG_ACTION', { id: selectedPlanting.id, action: actionText });
    }
    setActionText('');
    setActionLoading(false);
    // Keep dialog open so user sees the advice
  };

  const handleOpenActionDialog = (planting) => {
    // Simple open — no history loading here (history is in separate dialog)
    setSelectedPlanting(planting);
    setActionAdvice(null);
    setActionText('');
    setOpenActionDialog(true);
  };

  const handleOpenHistoryDialog = async (planting) => {
    setSelectedPlanting(planting);
    setActionLogs([]);
    setOpenHistoryDialog(true);
    if (navigator.onLine) {
      try {
        const res = await api.get(`/plantings/${planting.id}/actions`);
        setActionLogs(res.data || []);
      } catch (err) {
        console.warn('Could not load action history:', err);
      }
    }
  };

  const handleAskQuestion = () => {
    if (!questionText.trim()) return;
    const messageToSend = {
      text: questionText.trim(), sender: 'user', timestamp: new Date().toISOString(),
      context: selectedPlanting ? { crop: selectedPlanting.crop, plantingDate: selectedPlanting.plantingDate, location: selectedPlanting.location, stage: getCurrentStage(selectedPlanting) } : null,
    };
    localStorage.setItem('pendingMosupisiQuestion', JSON.stringify(messageToSend));
    localStorage.setItem('pendingQuestion_text', questionText.trim());
    setQuestionText('');
    setOpenQuestionDialog(false);
    navigate('/chat');
  };

  const handleGetAdvice = async (planting) => {
    setSelectedPlanting(planting);
    setAdviceLoading(true);
    setOpenAdviceDialog(true);
    try {
      const { data } = await api.post(`/plantings/${planting.id}/advice`, {
        language,
        userContext: { crop: planting.crop, stage: getCurrentStage(planting) },
        weatherContext: liveWeather ? {
          temperature_c: liveWeather.temperature_c,
          humidity_pct:  liveWeather.humidity_pct,
          description:   liveWeather.description,
          rainfall_mm:   liveWeather.rainfall_mm,
          forecast_days: liveForecast?.days?.slice(0, 3) || [],
        } : null,
      });
      setAdviceData(data);
    } catch (err) {
      console.error('Advice error:', err);
      setAdviceData(null);
      showSnackbar(language === 'en' ? 'Could not fetch advice – check your connection' : 'Ha e khone ho fumana keletso – sheba khokahano ea hau', 'error');
    } finally {
      setAdviceLoading(false);
    }
  };

  // ── PlantingCard ──────────────────────────────────────────────────────────
  const PlantingCard = ({ planting }) => {
    const progress     = calculateGrowthProgress(planting);
    const currentStage = getCurrentStage(planting);
    const stages       = cropGrowthStages[planting.crop] || {};
    const stageInfo    = stages[currentStage] || { description: 'Growing', description_st: 'E ntse e mela', icon: '🌱' };

    return (
      <Card sx={{ mb: 2, position: 'relative', overflow: 'visible' }}>
        <CardHeader
          avatar={<Avatar sx={{ bgcolor: theme.palette.primary.main }}>{getCropIcon(planting.crop)}</Avatar>}
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {t ? t(planting.crop) : planting.crop} — {planting.location}
              </Typography>
              <Chip
                label={planting.status === 'harvested' ? (language === 'en' ? 'Harvested' : 'E Kotutsoeng') : (language === 'en' ? 'Growing' : 'E Mela')}
                size="small" color={planting.status === 'harvested' ? 'default' : 'success'} />
            </Box>
          }
          subheader={`${language === 'en' ? 'Planted' : 'E jalwe'}: ${formatDate(planting.plantingDate)} | ${language === 'en' ? 'Area' : 'Sebaka'}: ${planting.area}`}
          action={
            <Box>
              <IconButton onClick={() => handleOpenActionDialog(planting)} sx={{ color: theme.palette.primary.main }} title={language === 'en' ? 'Log activity' : 'Ngola ketso'}>
                <EditIcon />
              </IconButton>
              <IconButton onClick={() => handleOpenHistoryDialog(planting)} sx={{ color: theme.palette.primary.main }} title={language === 'en' ? 'View history' : 'Bona histori'}>
                <HistoryIcon />
              </IconButton>
              <IconButton onClick={() => handleGetAdvice(planting)} sx={{ color: theme.palette.primary.main }} title={language === 'en' ? 'Get AI advice' : 'Fumana keletso ea AI'}>
                <AdviceIcon />
              </IconButton>
              <IconButton onClick={() => { setSelectedPlanting(planting); setOpenQuestionDialog(true); }} sx={{ color: theme.palette.primary.main }} title={language === 'en' ? 'Ask a question' : 'Botsa potso'}>
                <QuestionIcon />
              </IconButton>
            </Box>
          }
        />
        <CardContent>
          {planting.status !== 'harvested' && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="textSecondary">{language === 'en' ? 'Growth Progress' : 'Tsoelopele'}</Typography>
                <Typography variant="body2" color="textSecondary">{Math.round(progress)}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 5, backgroundColor: theme.palette.grey[300], '& .MuiLinearProgress-bar': { background: `linear-gradient(90deg, ${theme.palette.success.light}, ${theme.palette.success.main})` } }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>{stageInfo.icon}</span>
                  {language === 'en' ? 'Current' : 'Ha joale'}:{' '}
                  {language === 'en' ? stageInfo.description : stageInfo.description_st}
                </Typography>
              </Box>
            </Box>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <Typography variant="caption" color="textSecondary" display="block">{language === 'en' ? 'Last Action' : 'Ketso ea ho qetela'}</Typography>
              <Typography variant="body2">{planting.lastAction} {planting.lastActionDate ? `(${formatShortDate(planting.lastActionDate)})` : ''}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="textSecondary" display="block">{language === 'en' ? 'Notes' : 'Lintlha'}</Typography>
              <Typography variant="body2">{planting.notes}</Typography>
            </Grid>
          </Grid>

          {/* Latest advice — shown after logging an activity */}
          {latestAdviceMap[planting.id] && (
            <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 2 }}>
              <Typography variant="caption" fontWeight={700} color="success.main" display="block" sx={{ mb: 0.5 }}>
                💡 {language === 'en' ? 'Latest advice:' : 'Keletso ea morao-rao:'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                {language === 'en' ? latestAdviceMap[planting.id].en : latestAdviceMap[planting.id].st}
              </Typography>
            </Box>
          )}
          {planting.status === 'harvested' && (
            <Box sx={{ mt: 2, p: 2, bgcolor: theme.palette.success.light, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: 'white' }}>
                {language === 'en' ? 'Next Steps – Soil Preparation' : 'Mehato e latelang – Tokiso ea Mobu'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'white', opacity: 0.9 }}>
                <strong>{language === 'en' ? 'Next crop' : 'Sejalo se latelang'}:</strong> {t(cropRotation[planting.crop]?.next[0])}
              </Typography>
              <Typography variant="body2" sx={{ color: 'white', opacity: 0.9, mt: 0.5 }}>
                <strong>{language === 'en' ? 'Preparation' : 'Tokiso'}:</strong>{' '}
                {language === 'en' ? cropRotation[planting.crop]?.soilPrep : cropRotation[planting.crop]?.soilPrep_st}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AgricultureIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />
          <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
            {language === 'en' ? 'Planting Guide' : 'Tataiso ea Ho Jala'}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)} sx={{ minHeight: 44 }}>
          {language === 'en' ? 'Add Planting' : 'Kenya Sejalo'}
        </Button>
      </Box>

      {/* Live weather strip */}
      {liveWeather && (
        <Paper sx={{ p: 1.5, mb: 3, backgroundColor: '#e8f5e9', border: '1px solid #a5d6a7', display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }} elevation={0}>
          <WeatherIcon sx={{ color: '#2e7d32' }} />
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#2e7d32' }}>{liveWeather.location_name}:</Typography>
          <Typography variant="body2">
            {liveWeather.description}, {liveWeather.temperature_c}°C · 💧 {liveWeather.humidity_pct}% · 💨 {liveWeather.wind_speed_ms} m/s
            {liveWeather.rainfall_mm > 0 && ` · 🌧️ ${liveWeather.rainfall_mm} mm`}
          </Typography>
          {liveForecast?.days?.[0]?.farming_note && (
            <Typography variant="caption" sx={{ color: '#388e3c', fontStyle: 'italic' }}>
              💡 {liveForecast.days[0].farming_note}
            </Typography>
          )}
        </Paper>
      )}

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <SeedlingIcon sx={{ color: theme.palette.success.main, fontSize: 30 }} />
            <Typography variant="h6">{plantings.filter((p) => p.status === 'growing').length}</Typography>
            <Typography variant="caption">{language === 'en' ? 'Active Crops' : 'Lijalo tse Melang'}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ color: theme.palette.warning.main, fontSize: 30 }} />
            <Typography variant="h6">{plantings.filter((p) => p.status === 'harvested').length}</Typography>
            <Typography variant="caption">{language === 'en' ? 'Harvested' : 'Tse Kotutsoeng'}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <CalendarIcon sx={{ color: theme.palette.info.main, fontSize: 30 }} />
            <Typography variant="h6">{plantings.length}</Typography>
            <Typography variant="caption">{language === 'en' ? 'Total Plantings' : 'Lijalo Tsohle'}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Plantings list */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : plantings.length > 0 ? (
        plantings.map((planting) => <PlantingCard key={planting.id} planting={planting} />)
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <PlantIcon sx={{ fontSize: 60, color: theme.palette.grey[400], mb: 2 }} />
          <Typography variant="h6" gutterBottom color="textSecondary">
            {language === 'en' ? 'No plantings yet' : 'Ha ho lijalo tse ngolisitsoeng'}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)} sx={{ mt: 2, minHeight: 44 }}>
            {language === 'en' ? 'Add Your First Planting' : 'Kenya Sejalo sa Pele'}
          </Button>
        </Paper>
      )}

      {/* Add Planting Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{language === 'en' ? 'Add New Planting' : 'Kenya Sejalo se Secha'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField select fullWidth label={language === 'en' ? 'Crop' : 'Sejalo'} value={newPlanting.crop}
                onChange={(e) => setNewPlanting({ ...newPlanting, crop: e.target.value })} SelectProps={{ native: true }}>
                <option value="">{language === 'en' ? 'Select crop' : 'Khetha sejalo'}</option>
                {(user?.crops || ['maize', 'sorghum', 'legumes']).map((crop) => (
                  <option key={crop} value={crop}>{t ? t(crop) : crop}</option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth type="date" label={language === 'en' ? 'Planting Date' : 'Letsatsi la Ho Jala'}
                value={newPlanting.plantingDate} onChange={(e) => setNewPlanting({ ...newPlanting, plantingDate: e.target.value })}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label={language === 'en' ? 'Area (e.g., 2 hectares)' : 'Sebaka (mohlala, lihekthere tse 2)'}
                value={newPlanting.area} onChange={(e) => setNewPlanting({ ...newPlanting, area: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label={language === 'en' ? 'Location/Field Name' : 'Sebaka/Lebitso la Tšimo'}
                value={newPlanting.location} onChange={(e) => setNewPlanting({ ...newPlanting, location: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} sx={{ minHeight: 44 }}>{language === 'en' ? 'Cancel' : 'Hlakola'}</Button>
          <Button onClick={handleAddPlanting} variant="contained" sx={{ minHeight: 44 }}>{language === 'en' ? 'Add' : 'Kenya'}</Button>
        </DialogActions>
      </Dialog>

      {/* Log Activity Dialog — clean input + advice only */}
      <Dialog open={openActionDialog} onClose={() => { setOpenActionDialog(false); setActionAdvice(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>
          {language === 'en' ? 'Log Activity' : 'Ngola Ketso'}
          {selectedPlanting && (
            <Typography variant="caption" display="block" color="textSecondary">
              {t ? t(selectedPlanting.crop) : selectedPlanting.crop} — {selectedPlanting.location}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline rows={3} label={language === 'en' ? 'What did you do?' : 'U entseng?'}
            value={actionText} onChange={(e) => setActionText(e.target.value)} sx={{ mt: 2, mb: 2 }}
            placeholder={language === 'en' ? 'e.g., Watered, applied fertilizer, weeded...' : 'mohlala, Ke noselitse, ke sebelisitse manyolo, ke lehile...'}
            disabled={actionLoading} />

          {actionLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="textSecondary">
                {language === 'en' ? 'Generating advice…' : 'E hlahisa keletso…'}
              </Typography>
            </Box>
          )}

          {actionAdvice && (
            <Alert severity="success">
              <Typography variant="body2" fontWeight={600} gutterBottom>
                💡 {language === 'en' ? 'Recommended next steps:' : 'Mehato e latelang:'}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                {language === 'en' ? actionAdvice.en : actionAdvice.st}
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenActionDialog(false); setActionAdvice(null); }} sx={{ minHeight: 44 }}>
            {language === 'en' ? 'Close' : 'Koala'}
          </Button>
          <Button onClick={handleAddAction} variant="contained" sx={{ minHeight: 44 }}
            disabled={actionLoading || !actionText.trim()}>
            {actionLoading ? <CircularProgress size={20} /> : (language === 'en' ? 'Log & Get Advice' : 'Ngola le Fumana Keletso')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Activity History Dialog — opened separately via History icon */}
      <Dialog open={openHistoryDialog} onClose={() => setOpenHistoryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {language === 'en' ? 'Activity History' : 'Histori ea Liketso'}
          {selectedPlanting && (
            <Typography variant="caption" display="block" color="textSecondary">
              {t ? t(selectedPlanting.crop) : selectedPlanting.crop} — {selectedPlanting.location}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {actionLogs.length === 0 ? (
            <Typography color="textSecondary" sx={{ py: 3, textAlign: 'center' }}>
              {language === 'en' ? 'No activities logged yet.' : 'Ha ho liketso tse ngolisitsoeng.'}
            </Typography>
          ) : (
            <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
              {actionLogs.map((log) => (
                <Box key={log.id} sx={{ mb: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>{log.action}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {log.logged_at ? new Date(log.logged_at).toLocaleDateString('en-LS', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </Typography>
                  </Box>
                  {(log.advice_en || log.advice_st) && (
                    <Box sx={{ mt: 0.75, p: 1, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #bbf7d0' }}>
                      <Typography variant="caption" color="success.main" fontWeight={600} display="block" sx={{ mb: 0.25 }}>
                        💡 {language === 'en' ? 'Advice given:' : 'Keletso e fanoeng:'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                        {language === 'en' ? log.advice_en : log.advice_st}
                      </Typography>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenHistoryDialog(false)} sx={{ minHeight: 44 }}>
            {language === 'en' ? 'Close' : 'Koala'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ask Question Dialog */}
      <Dialog open={openQuestionDialog} onClose={() => setOpenQuestionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{language === 'en' ? 'Ask a Question' : 'Botsa Potso'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline rows={4} label={language === 'en' ? 'Your question' : 'Potso ea hau'}
            value={questionText} onChange={(e) => setQuestionText(e.target.value)} sx={{ mt: 2 }}
            placeholder={language === 'en'
              ? `e.g., When should I water my ${selectedPlanting ? (t ? t(selectedPlanting.crop) : selectedPlanting.crop) : 'crops'}?`
              : `mohlala, Ke nosetse neng ${selectedPlanting ? (t ? t(selectedPlanting.crop) : selectedPlanting.crop) : 'lijalo'} tsa ka?`} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenQuestionDialog(false)} sx={{ minHeight: 44 }}>{language === 'en' ? 'Cancel' : 'Hlakola'}</Button>
          <Button onClick={handleAskQuestion} variant="contained" sx={{ minHeight: 44 }}>{language === 'en' ? 'Ask Mosupisi' : 'Botsa Mosupisi'}</Button>
        </DialogActions>
      </Dialog>

      {/* AI Advice Dialog */}
      <Dialog open={openAdviceDialog} onClose={() => setOpenAdviceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {language === 'en' ? '🌱 AI Planting Advice' : '🌱 Keletso ea AI ea Ho Jala'}
          {selectedPlanting && ` – ${t ? t(selectedPlanting.crop) : selectedPlanting.crop}`}
        </DialogTitle>
        <DialogContent>
          {adviceLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
              <CircularProgress />
              <Typography color="textSecondary">
                {language === 'en' ? 'Generating advice from Agromet Bulletin…' : 'E hlahisa keletso ho tsoa Agromet Bulletin…'}
              </Typography>
            </Box>
          ) : adviceData ? (
            <Box sx={{ mt: 1 }}>
              {liveWeather && (
                <Box sx={{ mb: 2, p: 1.5, bgcolor: '#e8f5e9', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WeatherIcon fontSize="small" sx={{ color: '#2e7d32' }} />
                  <Typography variant="caption" sx={{ color: '#2e7d32' }}>
                    {language === 'en' ? 'Current conditions: ' : 'Maemo ha joale: '}
                    <strong>{liveWeather.description}, {liveWeather.temperature_c}°C</strong>
                    {liveWeather.rainfall_mm > 0 && ` · 🌧️ ${liveWeather.rainfall_mm} mm`}
                  </Typography>
                </Box>
              )}
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>{language === 'en' ? 'Advice' : 'Keletso'}</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>{language === 'en' ? adviceData.advice_en : adviceData.advice_st}</Typography>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>{language === 'en' ? 'Weather Outlook' : 'Boemo ba Leholimo'}</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>{language === 'en' ? adviceData.weather_outlook_en : adviceData.weather_outlook_st}</Typography>
              {adviceData.rotation_recommendation && (
                <>
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>{language === 'en' ? 'Crop Rotation' : 'Phetiso ea Lijalo'}</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>{adviceData.rotation_recommendation.reason}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {language === 'en' ? adviceData.rotation_recommendation.soilPrep : adviceData.rotation_recommendation.soilPrep_st}
                  </Typography>
                </>
              )}
              {adviceData.sources?.length > 0 && (
                <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
                  📄 {adviceData.sources.join(', ')}
                </Typography>
              )}
            </Box>
          ) : (
            <Typography color="error">{language === 'en' ? 'Failed to load advice.' : 'Ho hapolla keletso ho hlolehile.'}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdviceDialog(false)} sx={{ minHeight: 44 }}>{language === 'en' ? 'Close' : 'Koala'}</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PlantingGuide;