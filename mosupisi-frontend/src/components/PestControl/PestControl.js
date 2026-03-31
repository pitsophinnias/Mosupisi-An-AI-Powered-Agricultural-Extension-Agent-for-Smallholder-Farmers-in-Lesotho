// components/PestControl/PestControl.js
import React, { useState, useEffect, useCallback } from 'react';
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
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  useTheme,
  Avatar,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  BugReport as PestIcon,
  Warning as WarningIcon,
  Add as AddIcon,
  QuestionAnswer as QuestionIcon,
  Grass as GrassIcon,
  Agriculture as AgricultureIcon,
  Science as ScienceIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  DeleteOutline as DeleteIcon,
  Done as DoneIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';
import {
  fetchPests,
  fetchCrops,
  fetchGeneralTips,
  createPestReport,
  fetchUserReports,
  updatePestReport,
  deletePestReport,
  askPestQuestion,
  checkHealth,
} from '../../services/pestControlService';

// ─── Severity helpers ─────────────────────────────────────────────────────────

const getSeverityColor = (severity, theme) => {
  switch (severity) {
    case 'low':    return theme.palette.success.main;
    case 'medium': return theme.palette.warning.main;
    case 'high':   return theme.palette.error.main;
    default:       return theme.palette.grey[500];
  }
};

const getSeverityLabel = (severity, language) => {
  const labels = {
    low:    language === 'en' ? 'Low'    : 'Nyane',
    medium: language === 'en' ? 'Medium' : 'Mahareng',
    high:   language === 'en' ? 'High'   : 'Holoholo',
  };
  return labels[severity] || severity;
};

// ─── PestCard ─────────────────────────────────────────────────────────────────

const PestCard = ({ pest, language, onAsk }) => {
  const theme = useTheme();
  const severityColor = getSeverityColor(pest.severity, theme);

  const treatment = pest.treatment || {};
  const allTreatments = [
    ...(treatment.cultural || []),
    ...(treatment.biological || []),
    ...(treatment.chemical || []),
  ];
  const treatmentDisplay = language === 'st'
    ? (treatment.treatment_st || allTreatments)
    : allTreatments;

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
            <Chip
              label={getSeverityLabel(pest.severity, language)}
              size="small"
              sx={{ bgcolor: severityColor, color: 'white', fontWeight: 600 }}
            />
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
        {/* Crops */}
        <Box sx={{ mb: 1.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {pest.crops?.map((crop) => (
            <Chip key={crop} label={crop} size="small" variant="outlined" />
          ))}
        </Box>

        {/* Symptoms */}
        <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 1 }}>
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

        {/* Treatment */}
        <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScienceIcon color="primary" fontSize="small" />
              <Typography variant="body2" fontWeight={600}>
                {language === 'en' ? 'Treatment' : 'Kalafo'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {/* Cultural first */}
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
            {/* Biological */}
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
            {/* Chemical last */}
            {(treatment.chemical || []).length > 0 && (
              <Box>
                <Typography variant="caption" fontWeight={700} color="error.main">
                  {language === 'en' ? 'Chemical (last resort)' : 'Lik\'hemik\'hale (mohato oa ho qetela)'}
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

        {/* Prevention */}
        <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 1.5 }}>
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

        {/* Lesotho context note */}
        {pest.lesotho_context && (
          <Alert severity="info" icon={<InfoIcon fontSize="small" />} sx={{ mb: 1.5, py: 0.5 }}>
            <Typography variant="caption">{pest.lesotho_context}</Typography>
          </Alert>
        )}

        <Button
          size="small"
          variant="outlined"
          fullWidth
          onClick={() => onAsk(pest)}
        >
          {language === 'en' ? `Ask about ${pest.name}` : `Botsa ka ${pest.name_st}`}
        </Button>
      </CardContent>
    </Card>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PestControl = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const theme = useTheme();

  // Data state
  const [pests, setPests] = useState([]);
  const [reports, setReports] = useState([]);
  const [crops, setCrops] = useState([]);
  const [generalTips, setGeneralTips] = useState([]);
  const [serviceReady, setServiceReady] = useState(null);

  // UI state
  const [tabValue, setTabValue] = useState(0);
  const [selectedCrop, setSelectedCrop] = useState('all');
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [askLoading, setAskLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Dialogs
  const [openReportDialog, setOpenReportDialog] = useState(false);
  const [openAskDialog, setOpenAskDialog] = useState(false);
  const [askContext, setAskContext] = useState(null); // pest that triggered the ask
  const [questionText, setQuestionText] = useState('');
  const [askAnswer, setAskAnswer] = useState(null);

  const [newReport, setNewReport] = useState({
    crop: '',
    pest_name: '',
    date_observed: format(new Date(), 'yyyy-MM-dd'),
    location: '',
    severity: 'medium',
    action_taken: '',
    notes: '',
  });

  // ── Load on mount ─────────────────────────────────────────────────────────

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
    checkHealth().then((h) => setServiceReady(h.status === 'healthy'));
    loadPestLibrary();
  }, [loadPestLibrary]);

  useEffect(() => {
    if (tabValue === 1) loadReports();
  }, [tabValue, loadReports]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCropFilter = (crop) => {
    setSelectedCrop(crop);
    loadPestLibrary(crop);
  };

  const handleOpenAsk = (pest = null) => {
    setAskContext(pest);
    setQuestionText(
      pest
        ? (language === 'en'
            ? `How do I control ${pest.name} on my crops?`
            : `Ke laola ${pest.name_st} joang lijelong tsa ka?`)
        : ''
    );
    setAskAnswer(null);
    setOpenAskDialog(true);
  };

  const handleAskQuestion = async () => {
    if (!questionText.trim()) return;
    setAskLoading(true);
    setAskAnswer(null);
    try {
      const response = await askPestQuestion({
        question: questionText,
        language,
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
      await createPestReport({ ...newReport, user_id: user?.id || 'anonymous' });
      setOpenReportDialog(false);
      setNewReport({
        crop: '',
        pest_name: '',
        date_observed: format(new Date(), 'yyyy-MM-dd'),
        location: '',
        severity: 'medium',
        action_taken: '',
        notes: '',
      });
      setSnackbar({ open: true, message: language === 'en' ? 'Report submitted!' : 'Tlaleho e rometsoe!', severity: 'success' });
      if (tabValue === 1) loadReports();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleResolveReport = async (reportId) => {
    try {
      await updatePestReport(reportId, { status: 'resolved' });
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: 'resolved' } : r))
      );
      setSnackbar({ open: true, message: language === 'en' ? 'Marked as resolved' : 'E tibiloe e rarolloa', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleDeleteReport = async (reportId) => {
    try {
      await deletePestReport(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setSnackbar({ open: true, message: language === 'en' ? 'Report deleted' : 'Tlaleho e hlakotsoe', severity: 'info' });
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

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
                {language === 'en' ? 'Service offline – showing cached data' : 'Ts\'ebeletso e koetsoe – data e bolokiloeng e bontšitsoe'}
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<QuestionIcon />}
            onClick={() => handleOpenAsk()}
          >
            {language === 'en' ? 'Ask a Question' : 'Botsa Potso'}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            color="error"
            onClick={() => setOpenReportDialog(true)}
          >
            {language === 'en' ? 'Report Pest' : 'Tlaleha Kokonyana'}
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tabValue}
        onChange={(_, v) => setTabValue(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label={language === 'en' ? 'Pest Library' : 'Libuka tsa Likokonyana'} />
        <Tab label={language === 'en' ? 'My Reports' : 'Litlaleho tsa Ka'} />
        <Tab label={language === 'en' ? 'Prevention Tips' : 'Mekhoa ea Thibelo'} />
      </Tabs>

      {/* ── TAB 0: Pest Library ─────────────────────────────────────────────── */}
      {tabValue === 0 && (
        <>
          {/* Crop filter chips */}
          <Box sx={{ mb: 2.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              label={language === 'en' ? 'All Crops' : 'Lijalo Tsohle'}
              onClick={() => handleCropFilter('all')}
              color={selectedCrop === 'all' ? 'primary' : 'default'}
              sx={{ minHeight: 36 }}
            />
            {crops.map((crop) => (
              <Chip
                key={crop}
                label={t ? t(crop) : crop}
                onClick={() => handleCropFilter(crop)}
                color={selectedCrop === crop ? 'primary' : 'default'}
                sx={{ minHeight: 36, textTransform: 'capitalize' }}
              />
            ))}
            <Tooltip title={language === 'en' ? 'Refresh' : 'Hlazoa'}>
              <IconButton size="small" onClick={() => loadPestLibrary(selectedCrop)}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Loading / error / results */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {language === 'en' ? `Failed to load pests: ${error}` : `Ho hlolehile ho kenya likokonyana: ${error}`}
            </Alert>
          ) : pests.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <PestIcon sx={{ fontSize: 60, color: theme.palette.grey[400], mb: 2 }} />
              <Typography color="text.secondary">
                {language === 'en' ? 'No pests found for this crop' : 'Ha ho likokonyana tse fumanehang bakeng sa sejalo sena'}
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {pests.map((pest) => (
                <Grid item xs={12} md={6} key={pest.id}>
                  <PestCard pest={pest} language={language} onAsk={handleOpenAsk} />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* ── TAB 1: My Reports ───────────────────────────────────────────────── */}
      {tabValue === 1 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
            <Typography variant="h6">
              {language === 'en' ? 'Your Pest Reports' : 'Litlaleho tsa Hau'}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              size="small"
              onClick={() => setOpenReportDialog(true)}
            >
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
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenReportDialog(true)}
                sx={{ mt: 1 }}
              >
                {language === 'en' ? 'Report a Pest' : 'Tlaleha Kokonyana'}
              </Button>
            </Paper>
          ) : (
            reports.map((report) => (
              <Card key={report.id} sx={{ mb: 2 }} elevation={2}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {report.crop} — {report.pest_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {report.date_observed} | {report.location}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={report.status === 'resolved'
                          ? (language === 'en' ? 'Resolved' : 'E rarolotsoe')
                          : (language === 'en' ? 'Monitoring' : 'E hlahlojoa')}
                        size="small"
                        color={report.status === 'resolved' ? 'success' : 'warning'}
                      />
                      {report.status !== 'resolved' && (
                        <Tooltip title={language === 'en' ? 'Mark resolved' : 'Tibibatsa e rarolotsoe'}>
                          <IconButton size="small" color="success" onClick={() => handleResolveReport(report.id)}>
                            <DoneIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title={language === 'en' ? 'Delete' : 'Hlakola'}>
                        <IconButton size="small" color="error" onClick={() => handleDeleteReport(report.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={getSeverityLabel(report.severity, language)}
                      size="small"
                      sx={{ bgcolor: getSeverityColor(report.severity, theme), color: 'white' }}
                    />
                  </Box>

                  {report.action_taken && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>{language === 'en' ? 'Action: ' : 'Ketso: '}</strong>
                      {report.action_taken}
                    </Typography>
                  )}
                  {report.notes && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      <strong>{language === 'en' ? 'Notes: ' : 'Lintlha: '}</strong>
                      {report.notes}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </>
      )}

      {/* ── TAB 2: Prevention Tips ──────────────────────────────────────────── */}
      {tabValue === 2 && (
        <Grid container spacing={2}>
          {generalTips.length === 0 ? (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            </Grid>
          ) : (
            generalTips.map((tip) => {
              const icons = {
                crop_rotation: <AgricultureIcon sx={{ fontSize: 44, color: theme.palette.primary.main }} />,
                field_sanitation: <GrassIcon sx={{ fontSize: 44, color: theme.palette.success.main }} />,
                early_detection: <ScienceIcon sx={{ fontSize: 44, color: theme.palette.warning.main }} />,
                integrated_pest_management: <CheckCircleIcon sx={{ fontSize: 44, color: theme.palette.info.main }} />,
                weather_monitoring: <PestIcon sx={{ fontSize: 44, color: theme.palette.secondary.main }} />,
              };
              const titles = {
                crop_rotation:               { en: 'Crop Rotation',              st: 'Ho Potoloha Lijalo' },
                field_sanitation:            { en: 'Field Sanitation',           st: 'Ho Hloekisa Masimo' },
                early_detection:             { en: 'Early Detection',            st: 'Ho Lemoha Kapele' },
                integrated_pest_management: { en: 'Integrated Pest Management', st: 'Taolo e Kopantsoeng' },
                weather_monitoring:          { en: 'Weather Monitoring',         st: 'Ho Sheba Maemo a Leaera' },
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
      )}

      {/* ── Report Pest Dialog ───────────────────────────────────────────────── */}
      <Dialog open={openReportDialog} onClose={() => setOpenReportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {language === 'en' ? 'Report Pest Infestation' : 'Tlaleha Likokonyana'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label={language === 'en' ? 'Crop *' : 'Sejalo *'}
                value={newReport.crop}
                onChange={(e) => setNewReport({ ...newReport, crop: e.target.value })}
                SelectProps={{ native: true }}
              >
                <option value="">{language === 'en' ? 'Select crop' : 'Khetha sejalo'}</option>
                {crops.map((c) => (
                  <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={language === 'en' ? 'Pest Name *' : 'Lebitso la Kokonyana *'}
                value={newReport.pest_name}
                onChange={(e) => setNewReport({ ...newReport, pest_name: e.target.value })}
                placeholder={language === 'en' ? 'e.g. Fall Armyworm' : 'mohlala: Sesobeng'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label={language === 'en' ? 'Date Observed' : 'Letsatsi le Bonoeng'}
                value={newReport.date_observed}
                onChange={(e) => setNewReport({ ...newReport, date_observed: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={language === 'en' ? 'Location / Field *' : 'Sebaka / Tšimo *'}
                value={newReport.location}
                onChange={(e) => setNewReport({ ...newReport, location: e.target.value })}
                placeholder={language === 'en' ? 'e.g. Lower field, Maseru' : 'mohlala: Tšimo e fatshe'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label={language === 'en' ? 'Severity' : 'Boholo ba Kotsi'}
                value={newReport.severity}
                onChange={(e) => setNewReport({ ...newReport, severity: e.target.value })}
                SelectProps={{ native: true }}
              >
                <option value="low">{language === 'en' ? 'Low' : 'Nyane'}</option>
                <option value="medium">{language === 'en' ? 'Medium' : 'Mahareng'}</option>
                <option value="high">{language === 'en' ? 'High' : 'Holoholo'}</option>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label={language === 'en' ? 'Action Taken' : 'Ketso e Nkiloeng'}
                value={newReport.action_taken}
                onChange={(e) => setNewReport({ ...newReport, action_taken: e.target.value })}
                placeholder={language === 'en' ? 'e.g. Applied neem spray' : 'mohlala: Ke fafalitse neem'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label={language === 'en' ? 'Additional Notes' : 'Lintlha tse ling'}
                value={newReport.notes}
                onChange={(e) => setNewReport({ ...newReport, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReportDialog(false)}>
            {language === 'en' ? 'Cancel' : 'Hlakola'}
          </Button>
          <Button
            onClick={handleAddReport}
            variant="contained"
            disabled={!newReport.crop || !newReport.pest_name || !newReport.location}
          >
            {language === 'en' ? 'Submit Report' : 'Romela Tlaleho'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Ask Question Dialog ──────────────────────────────────────────────── */}
      <Dialog open={openAskDialog} onClose={() => setOpenAskDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {language === 'en' ? 'Ask about Pest Control' : 'Botsa ka Taolo ea Likokonyana'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label={language === 'en' ? 'Your question' : 'Potso ea hau'}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
            placeholder={
              language === 'en'
                ? 'e.g. How do I control fall armyworm organically?'
                : 'mohlala: Ke laola liboko joang ntle le meriana?'
            }
          />

          {askLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                {language === 'en' ? 'Mosupisi is thinking...' : 'Mosupisi o nahana...'}
              </Typography>
            </Box>
          )}

          {askAnswer && (
            <Box sx={{ mt: 1 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {askAnswer.answer}
                </Typography>
              </Alert>

              {askAnswer.relevant_pests?.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    {language === 'en' ? 'Related pests:' : 'Likokonyana tse amanang:'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                    {askAnswer.relevant_pests.map((p) => (
                      <Chip key={p.id} label={`${p.image_emoji} ${language === 'en' ? p.name : p.name_st}`} size="small" />
                    ))}
                  </Box>
                </Box>
              )}

              {askAnswer.sources?.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {language === 'en' ? 'Sources: ' : 'Mehloli: '}
                  {askAnswer.sources.join(', ')}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAskDialog(false)}>
            {language === 'en' ? 'Close' : 'Koala'}
          </Button>
          <Button onClick={handleAskQuestion} variant="outlined" disabled={askLoading || !questionText.trim()}>
            {language === 'en' ? 'Ask Mosupisi' : 'Botsa Mosupisi'}
          </Button>
          <Button onClick={handleSendToChat} variant="contained" disabled={!questionText.trim()}>
            {language === 'en' ? 'Open in Chat' : 'Bula ka Chat'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PestControl;