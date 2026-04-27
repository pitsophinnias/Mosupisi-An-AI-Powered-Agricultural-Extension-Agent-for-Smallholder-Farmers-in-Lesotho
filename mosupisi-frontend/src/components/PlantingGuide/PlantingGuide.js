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
  const [latestAdviceMap, setLatestAdviceMap] = useState({});
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);
  // Per-plant weather: maps planting.id → { weather, forecast }
  const [plantWeatherMap, setPlantWeatherMap] = useState({});

  // Lesotho town coordinates for per-plant weather lookup
  const LESOTHO_COORDS = {
    // Butha-Buthe district
    'lipelaneng':    { lat: -28.87, lon: 28.09, name: 'Butha-Buthe' },
    'butha-buthe':   { lat: -28.76, lon: 28.27, name: 'Butha-Buthe' },
    'butha buthe':   { lat: -28.76, lon: 28.27, name: 'Butha-Buthe' },
    // Leribe district
    'leribe':        { lat: -28.88, lon: 28.07, name: 'Leribe' },
    'hlotse':        { lat: -28.88, lon: 28.07, name: 'Leribe' },
    'teyateyaneng':  { lat: -29.15, lon: 27.74, name: 'Berea' },
    'thabana-morena':{ lat: -29.15, lon: 27.74, name: 'Berea' },
    // Maseru district
    'maseru':        { lat: -29.32, lon: 27.50, name: 'Maseru' },
    'roma':          { lat: -29.45, lon: 27.80, name: 'Maseru' },
    'moshoeshoe':    { lat: -29.46, lon: 27.56, name: 'Moshoeshoe I' },
    'qholaqhoe':     { lat: -28.76, lon: 28.27, name: 'Butha-Buthe' },
    // Mafeteng district
    'mafeteng':      { lat: -29.83, lon: 27.24, name: 'Mafeteng' },
    // Mohale's Hoek district
    "mohale's hoek": { lat: -30.16, lon: 27.47, name: "Mohale's Hoek" },
    'mohales hoek':  { lat: -30.16, lon: 27.47, name: "Mohale's Hoek" },
    // Quthing district
    'quthing':       { lat: -30.40, lon: 27.70, name: 'Quthing' },
    // Qacha's Nek district
    "qacha's nek":   { lat: -30.12, lon: 28.68, name: "Qacha's Nek" },
    // Thaba-Tseka district
    'thaba-tseka':   { lat: -29.52, lon: 28.61, name: 'Thaba-Tseka' },
    'thaba tseka':   { lat: -29.52, lon: 28.61, name: 'Thaba-Tseka' },
    // Mokhotlong district
    'mokhotlong':    { lat: -29.31, lon: 29.06, name: 'Mokhotlong' },
    'oxbow':         { lat: -28.73, lon: 28.62, name: 'Oxbow' },
    // Semonkong / highlands
    'semonkong':     { lat: -29.85, lon: 28.05, name: 'Semonkong' },
    'katse':         { lat: -29.52, lon: 28.61, name: 'Thaba-Tseka' },
  };

  const _getCoordsForLocation = (locationStr) => {
    if (!locationStr) return null;
    const key = locationStr.toLowerCase().trim();
    if (LESOTHO_COORDS[key]) return LESOTHO_COORDS[key];
    for (const [town, coords] of Object.entries(LESOTHO_COORDS)) {
      if (key.includes(town) || town.includes(key)) return coords;
    }
    return null;
  };

  // Fetch weather on mount for user's default location
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

  // Fetch per-plant weather after plantings load.
  useEffect(() => {
    if (!plantings.length) return;

    const userLat = user?.farm_lat || -29.3167;
    const userLon = user?.farm_lon || 27.4833;

    const townMap = {};
    plantings.forEach(p => {
      if (!p.location || p.status === 'harvested') return;
      const coords = _getCoordsForLocation(p.location);
      if (!coords) return;

      const sameAsDefault =
        Math.abs(coords.lat - userLat) < 0.1 &&
        Math.abs(coords.lon - userLon) < 0.1;
      if (sameAsDefault) return;

      const key = coords.name;
      if (!townMap[key]) townMap[key] = { coords, plantingIds: [] };
      townMap[key].plantingIds.push(p.id);
    });

    const towns = Object.values(townMap);
    if (!towns.length) return;

    const fetchSequentially = async () => {
      for (let i = 0; i < towns.length; i++) {
        const { coords, plantingIds } = towns[i];
        if (i > 0) await new Promise(r => setTimeout(r, 2000));
        try {
          const [cur, fore] = await Promise.all([
            weatherApi.getCurrent(coords.lat, coords.lon, coords.name),
            weatherApi.getForecast(coords.lat, coords.lon, 3, coords.name),
          ]);
          setPlantWeatherMap(prev => {
            const updated = { ...prev };
            plantingIds.forEach(id => {
              updated[id] = { weather: cur, forecast: fore, locationName: coords.name };
            });
            return updated;
          });
        } catch (err) {
          console.warn(`PlantingGuide: weather fetch failed for ${coords.name}:`, err.message);
        }
      }
    };

    fetchSequentially();
  }, [plantings, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // When liveWeather loads, apply it to plantings at the user's default location
  useEffect(() => {
    if (!liveWeather || !plantings.length) return;
    const userLat = user?.farm_lat || -29.3167;
    const userLon = user?.farm_lon || 27.4833;

    setPlantWeatherMap(prev => {
      const updated = { ...prev };
      plantings.forEach(p => {
        if (!p.location || p.status === 'harvested') return;
        const coords = _getCoordsForLocation(p.location);
        if (!coords) return;
        const sameAsDefault =
          Math.abs(coords.lat - userLat) < 0.1 &&
          Math.abs(coords.lon - userLon) < 0.1;
        if (sameAsDefault && !updated[p.id]) {
          updated[p.id] = {
            weather: liveWeather,
            forecast: liveForecast,
            locationName: liveWeather.location_name,
          };
        }
      });
      return updated;
    });
  }, [liveWeather, liveForecast, plantings]); // eslint-disable-line react-hooks/exhaustive-deps

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

        try {
          const logsRes = await api.get(`/plantings/${selectedPlanting.id}/actions`);
          const logs = logsRes.data || [];
          setActionLogs(logs);
          if (logs.length > 0) {
            const latest = logs[0];
            const advice = { en: latest.advice_en, st: latest.advice_st };
            setActionAdvice(advice);
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
  };

  const handleOpenActionDialog = (planting) => {
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

  // ── normaliseAdvice ────────────────────────────────────────────────────────
  // Converts inline numbered points ("1. text 2. text") into one-per-line.
  // Handles duplicate numbers the model sometimes emits ("2. 2. text").
  // Safe to call on already-formatted text — newlines are preserved as-is.
  const normaliseAdvice = (text) => {
    if (!text) return text;
    // Remove duplicate consecutive numbers e.g. "2. 2." → "2."
    let t = text.replace(/(\d+)\.\s+\1\./g, '$1.');
    // Insert newline before each numbered point except the very first
    t = t.replace(/\s+(?=\d+\.\s)/g, '\n');
    return t.trim();
  };

  // ── AdviceText ─────────────────────────────────────────────────────────────
  // Renders AI advice with numbered point cards and clean paragraph formatting
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
              <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'flex-start' }}>
                <Box sx={{
                  minWidth: 26, height: 26, borderRadius: '50%',
                  bgcolor: 'primary.main', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, mt: 0.1,
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
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65, mt: item.title ? 0.25 : 0 }}>
                      {item.body}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          }
          return (
            <Typography key={i} variant="body2" color="text.secondary"
              sx={{ mb: 1.25, lineHeight: 1.7, whiteSpace: 'pre-line' }}>
              {item.text}
            </Typography>
          );
        })}
      </Box>
    );
  };

  // ── WeatherOutlookText ─────────────────────────────────────────────────────
  // Renders weather outlook: numbered points + a summary strip at the end
  const WeatherOutlookText = ({ text }) => {
    if (!text) return null;

    const lines  = normaliseAdvice(text).split('\n').filter(l => l.trim());
    const points = [];
    const summary = [];

    lines.forEach((line) => {
      const numbered       = line.match(/^\d+\.\s+\*\*(.+?)\*\*[:\-]?\s*(.*)/);
      const numberedPlain  = line.match(/^\d+\.\s+([^:*\n]{3,80}):\s*(.*)/);
      const numberedSimple = line.match(/^\d+\.\s+(.*)/);
      if (numbered) {
        points.push({ title: numbered[1].replace(/\s*\(.*?\)\s*/g, ''), body: numbered[2] });
      } else if (numberedPlain) {
        points.push({ title: numberedPlain[1], body: numberedPlain[2] });
      } else if (numberedSimple) {
        points.push({ title: null, body: numberedSimple[1] });
      } else if (line.toLowerCase().includes('in summary') || line.toLowerCase().includes('overall')) {
        summary.push(line.replace(/\*\*(.*?)\*\*/g, '$1'));
      }
    });

    if (points.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
          {text.replace(/\*\*(.*?)\*\*/g, '$1')}
        </Typography>
      );
    }

    const icons = ['🌡️', '🌧️', '📅', '🌤️', '⚠️'];

    return (
      <Box>
        {points.map((p, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1.25, mb: 1.25, alignItems: 'flex-start' }}>
            <Typography sx={{ fontSize: '1rem', lineHeight: 1, mt: 0.1, flexShrink: 0 }}>
              {icons[i] || '🌤️'}
            </Typography>
            <Box>
              {p.title && (
                <Typography variant="body2" fontWeight={700} color="#1565c0" sx={{ lineHeight: 1.4 }}>
                  {p.title}
                </Typography>
              )}
              {p.body && (
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mt: p.title ? 0.2 : 0 }}>
                  {p.body}
                </Typography>
              )}
            </Box>
          </Box>
        ))}
        {summary.length > 0 && (
          <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #bbdefb' }}>
            <Typography variant="body2" color="#1565c0" fontWeight={500} sx={{ lineHeight: 1.6 }}>
              {summary.join(' ')}
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  // ── WeatherAdviceStrip ────────────────────────────────────────────────────
  const getWeatherAdvice = (crop, stage, weather, forecast) => {
    if (!weather) return null;

    const temp  = weather.temperature_c;
    const humid = weather.humidity_pct;
    const wind  = weather.wind_speed_ms;
    const rain  = weather.rainfall_mm || 0;
    const desc  = (weather.description || '').toLowerCase()
      .replace('data from nasa power', '')
      .replace('see nasa power data', '')
      .trim() || 'clear sky';

    const isRainy    = rain > 5 || desc.includes('rain') || desc.includes('thunder') || desc.includes('shower');
    const isWindy    = wind > 8;
    const isNASA     = (weather.source || '').toLowerCase().includes('nasa');
    const isFrost    = temp !== null && temp <= 5 && (!isNASA || temp <= 2);
    const isHot      = temp !== null && temp >= 35;
    const isHumid    = humid >= 85;
    const stressStage = stage === 'tasseling' || stage === 'silking' || stage === 'flowering' || stage === 'podFill' || stage === 'grainFill';

    const alerts = [];

    if (isRainy) {
      alerts.push({ icon: '🌧️', color: '#1565c0', bg: '#e3f2fd',
        en: `Rain today : no need to irrigate. Hold off on foliar feeding until leaves are dry.`,
        st: `Pula kajeno : ha ho hlokahale ho nosetsa. Letha ho atiha ha makhasi pele o sebelisa manyolo.` });
    } else if (isWindy) {
      alerts.push({ icon: '💨', color: '#e65100', bg: '#fff3e0',
        en: `Wind at ${wind.toFixed(1)} m/s : avoid foliar feeding today, apply when wind drops below 5 m/s.`,
        st: `Moea o phahameng (${wind.toFixed(1)} m/s) : emit'a ho sebelisa manyolo a makhasi kajeno.` });
    } else {
      alerts.push({ icon: '✅', color: '#2e7d32', bg: '#e8f5e9',
        en: `Good conditions for foliar feeding or irrigation today (${desc || 'clear'}, ${wind?.toFixed(1)} m/s wind).`,
        st: `Maemo a lokile ho nosetsa kapa ho sebelisa manyolo a makhasi kajeno.` });
    }

    if (isFrost) {
      alerts.push({ icon: '🥶', color: '#1565c0', bg: '#e3f2fd',
        en: `Frost risk at ${temp}°C tonight : cover ${crop} seedlings or young plants if possible.`,
        st: `Kotsing ea shelwe ha ${temp}°C : ко${crop} e nyane bosiu haeba ho khoneha.` });
    }

    if (isHot && stressStage) {
      alerts.push({ icon: '🌡️', color: '#c62828', bg: '#ffebee',
        en: `${temp}°C during ${stage} : ${crop} needs water urgently. Irrigate early morning before 8am.`,
        st: `${temp}°C nakong ea ${stage} : ${crop} e hloka metsi ka potlako. Nosetsa hoseng pele ha 8am.` });
    } else if (isHot) {
      alerts.push({ icon: '🌡️', color: '#e65100', bg: '#fff3e0',
        en: `High temperature (${temp}°C) : water ${crop} early morning to reduce heat stress on roots.`,
        st: `Mocheso o phahami (${temp}°C) : nosetsa ${crop} hoseng ho fokotsa kotsing ea mocheso.` });
    }

    if (isHumid && !isRainy) {
      alerts.push({ icon: '💧', color: '#6a1b9a', bg: '#f3e5f5',
        en: `High humidity (${Math.round(humid)}%) : inspect ${crop} leaves for early signs of fungal disease.`,
        st: `Kelello e phahami (${Math.round(humid)}%) : hlahloba makhasi a ${crop} bakeng sa mafu a fungal.` });
    }

    if (forecast?.days?.length > 0) {
      const rainDays = forecast.days.slice(0, 4).filter(d =>
        (d.rainfall_mm || 0) > 3 || (d.description || '').toLowerCase().includes('rain')
      );
      if (rainDays.length > 0 && !isRainy) {
        const nextRain = rainDays[0];
        const rainDate = new Date(nextRain.date).toLocaleDateString('en-LS', { weekday: 'short', day: 'numeric', month: 'short' });
        alerts.push({ icon: '📅', color: '#1565c0', bg: '#e3f2fd',
          en: `Rain coming ${rainDate} : good time to apply dry fertilizer before it, rain will help it absorb.`,
          st: `Pula e tla ${rainDate} : nako e ntle ea ho sebelisa manyolo e omileng pele, pula e tla e ts'oarisa.` });
      }
    }

    return alerts.slice(0, 2);
  };

  const WeatherAdviceStrip = ({ planting }) => {
    const stage = getCurrentStage(planting);
    const pw      = plantWeatherMap[planting.id];
    const weather = pw?.weather || liveWeather;
    const forecast = pw?.forecast || liveForecast;
    const locationName = pw?.locationName || weather?.location_name || '';

    const alerts = getWeatherAdvice(planting.crop, stage, weather, forecast);
    if (!alerts || alerts.length === 0) return null;

    return (
      <Box sx={{ mt: 1.5 }}>
        {locationName && (
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.75, fontStyle: 'italic' }}>
            🌍 {language === 'en' ? `Weather at ${locationName}` : `Boemo ba leholimo ho ${locationName}`}
          </Typography>
        )}
        {alerts.map((alert, i) => (
          <Box key={i} sx={{
            display: 'flex', alignItems: 'flex-start', gap: 1,
            mb: i < alerts.length - 1 ? 0.75 : 0,
            p: 1.25, borderRadius: 2,
            bgcolor: alert.bg, border: `1px solid ${alert.color}22`,
          }}>
            <Typography sx={{ fontSize: '0.9rem', flexShrink: 0, mt: 0.1 }}>{alert.icon}</Typography>
            <Typography variant="caption" sx={{ color: alert.color, lineHeight: 1.5, fontWeight: 500 }}>
              {language === 'en' ? alert.en : alert.st}
            </Typography>
          </Box>
        ))}
      </Box>
    );
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
                {t ? t(planting.crop) : planting.crop}, {planting.location}
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

          {(plantWeatherMap[planting.id] || liveWeather) && planting.status !== 'harvested' && (
            <WeatherAdviceStrip planting={planting} />
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

      {/* Log Activity Dialog */}
      <Dialog open={openActionDialog} onClose={() => { setOpenActionDialog(false); setActionAdvice(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>
          {language === 'en' ? 'Log Activity' : 'Ngola Ketso'}
          {selectedPlanting && (
            <Typography variant="caption" display="block" color="textSecondary">
              {t ? t(selectedPlanting.crop) : selectedPlanting.crop}, {selectedPlanting.location}
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

      {/* Activity History Dialog */}
      <Dialog open={openHistoryDialog} onClose={() => setOpenHistoryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {language === 'en' ? 'Activity History' : 'Histori ea Liketso'}
          {selectedPlanting && (
            <Typography variant="caption" display="block" color="textSecondary">
              {t ? t(selectedPlanting.crop) : selectedPlanting.crop}, {selectedPlanting.location}
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
        <DialogTitle sx={{ pb: 1 }}>
          {language === 'en' ? '🌱 AI Planting Advice' : '🌱 Keletso ea AI ea Ho Jala'}
          {selectedPlanting && (
            <Typography variant="caption" display="block" color="textSecondary" sx={{ mt: 0.25 }}>
              {t ? t(selectedPlanting.crop) : selectedPlanting.crop}, {selectedPlanting.location}
              {selectedPlanting.currentStage && ` · ${selectedPlanting.currentStage} stage`}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          {adviceLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5, gap: 2 }}>
              <CircularProgress />
              <Typography color="textSecondary" variant="body2">
                {language === 'en' ? 'Generating advice from Agromet Bulletin…' : 'E hlahisa keletso ho tsoa Agromet Bulletin…'}
              </Typography>
            </Box>
          ) : adviceData ? (
            <Box sx={{ mt: 1 }}>

              {/* Live weather strip */}
              {liveWeather && (
                <Box sx={{ mb: 2, p: 1.25, bgcolor: '#e8f5e9', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WeatherIcon fontSize="small" sx={{ color: '#2e7d32' }} />
                  <Typography variant="caption" sx={{ color: '#2e7d32' }}>
                    {language === 'en' ? 'Current conditions: ' : 'Maemo ha joale: '}
                    <strong>{liveWeather.description}, {liveWeather.temperature_c}°C</strong>
                    {liveWeather.rainfall_mm > 0 && ` · 🌧️ ${liveWeather.rainfall_mm} mm`}
                  </Typography>
                </Box>
              )}

              {/* Advice section */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Box sx={{ width: 4, height: 20, bgcolor: 'primary.main', borderRadius: 1 }} />
                  <Typography variant="subtitle1" fontWeight={700}>
                    {language === 'en' ? 'Advice' : 'Keletso'}
                  </Typography>
                </Box>
                <AdviceText text={language === 'en' ? adviceData.advice_en : adviceData.advice_st} />
              </Box>

              {/* Weather Outlook */}
              {(adviceData.weather_outlook_en || adviceData.weather_outlook_st) && (
                <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f0f7ff', borderRadius: 2, border: '1px solid #bbdefb' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <WeatherIcon fontSize="small" sx={{ color: '#1565c0' }} />
                    <Typography variant="subtitle2" fontWeight={700} color="#1565c0">
                      {language === 'en' ? 'Weather Outlook' : 'Boemo ba Leholimo'}
                    </Typography>
                  </Box>
                  <WeatherOutlookText
                    text={language === 'en' ? adviceData.weather_outlook_en : adviceData.weather_outlook_st}
                  />
                </Box>
              )}

              {/* Crop Rotation */}
              {adviceData.rotation_recommendation && (
                <Box sx={{ mb: 2, p: 1.5, bgcolor: '#fff8e1', borderRadius: 2, border: '1px solid #ffe082' }}>
                  <Typography variant="subtitle2" fontWeight={700} color="#e65100" gutterBottom>
                    🔄 {language === 'en' ? 'Crop Rotation' : 'Phetiso ea Lijalo'}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    {adviceData.rotation_recommendation.reason}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>{language === 'en' ? 'Next crops: ' : 'Lijalo tse latelang: '}</strong>
                    {adviceData.rotation_recommendation.next?.join(', ')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>{language === 'en' ? 'Soil prep: ' : 'Tokiso ea mobu: '}</strong>
                    {language === 'en' ? adviceData.rotation_recommendation.soilPrep : adviceData.rotation_recommendation.soilPrep_st}
                  </Typography>
                </Box>
              )}

              {/* Sources */}
              {adviceData.sources?.length > 0 && (
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
                  📄 {adviceData.sources.join(' · ')}
                </Typography>
              )}
            </Box>
          ) : (
            <Typography color="error" sx={{ py: 2 }}>
              {language === 'en' ? 'Failed to load advice.' : 'Ho hapolla keletso ho hlolehile.'}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdviceDialog(false)} sx={{ minHeight: 44 }}>
            {language === 'en' ? 'Close' : 'Koala'}
          </Button>
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