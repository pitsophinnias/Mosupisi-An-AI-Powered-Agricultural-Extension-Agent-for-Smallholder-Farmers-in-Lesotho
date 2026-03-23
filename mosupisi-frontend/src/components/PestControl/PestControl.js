// components/PestControl/PestControl.js
import React, { useState, useEffect } from 'react';
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
  IconButton,
  Alert,
  Divider,
  useTheme,
  Avatar,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails
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
  ReportProblem as ReportProblemIcon,
  PhotoCamera as CameraIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';

// Mock pest data
const mockPests = [
  {
    id: 1,
    crop: 'maize',
    pestName: 'Fall Armyworm',
    pestName_st: 'Sesobeng',
    scientificName: 'Spodoptera frugiperda',
    symptoms: 'Holes in leaves, frass, whorl damage',
    symptoms_st: 'Masoba makhasing, mantle, tšenyo',
    treatment: 'Use neem extract, early planting, natural enemies',
    treatment_st: 'Sebelisa motsoako oa neem, jala kapele, lira tsa tlhaho',
    prevention: 'Scout fields regularly, crop rotation, resistant varieties',
    prevention_st: 'Hlahloba masimo khafetsa, potoloha lijalo, mefuta e hanyetsanang',
    season: 'November-March',
    severity: 'high',
    image: '🐛'
  },
  {
    id: 2,
    crop: 'maize',
    pestName: 'Maize Stalk Borer',
    pestName_st: 'Seboko',
    scientificName: 'Busseola fusca',
    symptoms: 'Dead hearts, holes in stalks, broken tassels',
    symptoms_st: 'Makhasi a omileng, masoba lithemong',
    treatment: 'Destroy crop residues, use Bt maize, apply ash',
    treatment_st: 'Chemsa masalla, sebelisa poone ea Bt, kenya molora',
    prevention: 'Early planting, intercropping with legumes',
    prevention_st: 'Jala kapele, kopanya le linaoa',
    season: 'Year-round',
    severity: 'medium',
    image: '🐜'
  },
  {
    id: 3,
    crop: 'sorghum',
    pestName: 'Sorghum Aphid',
    pestName_st: 'Dintsi',
    scientificName: 'Melanaphis sacchari',
    symptoms: 'Yellowing leaves, sticky honeydew, sooty mold',
    symptoms_st: 'Makhasi a mosehla, monko, hloibila',
    treatment: 'Ladybirds as natural predators, neem spray',
    treatment_st: 'Sebelisa bo-mantšiboea, fafatsa neem',
    prevention: 'Resistant varieties, avoid excess nitrogen',
    prevention_st: 'Mefuta e hanyetsanang, qoba manyolo a mangata',
    season: 'Dry season',
    severity: 'high',
    image: '🦟'
  },
  {
    id: 4,
    crop: 'legumes',
    pestName: 'Bean Bruchid',
    pestName_st: 'Boea',
    scientificName: 'Acanthoscelides obtectus',
    symptoms: 'Holes in stored beans, white eggs on seeds',
    symptoms_st: 'Masoba linaoa tse bolokiloeng, mahe a masoeu',
    treatment: 'Hermetic storage, diatomaceous earth, neem leaves',
    treatment_st: 'Boloka ka mekotla e koalehang, sebelisa lehlabathe',
    prevention: 'Harvest early, dry thoroughly, clean storage',
    prevention_st: 'Kotula kapele, omisa hantle, hloekisa polokelo',
    season: 'Post-harvest',
    severity: 'medium',
    image: '🪲'
  }
];

// Mock pest reports from farmer
const mockReports = [
  {
    id: 1,
    crop: 'maize',
    pest: 'Fall Armyworm',
    date: '2026-02-25',
    location: 'Lower Field',
    severity: 'medium',
    action: 'Applied neem spray',
    status: 'monitoring'
  },
  {
    id: 2,
    crop: 'sorghum',
    pest: 'Aphids',
    date: '2026-02-20',
    location: 'Upper Field',
    severity: 'low',
    action: 'Released ladybirds',
    status: 'resolved'
  }
];

const PestControl = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const theme = useTheme();

  const [tabValue, setTabValue] = useState(0);
  const [pests, setPests] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedCrop, setSelectedCrop] = useState('all');
  const [openReportDialog, setOpenReportDialog] = useState(false);
  const [openQuestionDialog, setOpenQuestionDialog] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [newReport, setNewReport] = useState({
    crop: '',
    pest: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    location: '',
    severity: 'medium',
    action: '',
    notes: ''
  });

  useEffect(() => {
    // Load pests and reports
    setPests(mockPests);
    setReports(mockReports);
  }, []);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleAddReport = () => {
    // In real app, save to IndexedDB
    const report = {
      id: reports.length + 1,
      ...newReport,
      status: 'monitoring'
    };
    setReports([...reports, report]);
    setOpenReportDialog(false);
    setNewReport({
      crop: '',
      pest: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      location: '',
      severity: 'medium',
      action: '',
      notes: ''
    });
  };

  const handleAskQuestion = () => {
    if (!questionText.trim()) return;
    
    navigate(`/chat?q=${encodeURIComponent(questionText)}&topic=pest-control`);
    setQuestionText('');
    setOpenQuestionDialog(false);
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'low': return theme.palette.success.main;
      case 'medium': return theme.palette.warning.main;
      case 'high': return theme.palette.error.main;
      default: return theme.palette.grey[500];
    }
  };

  const filteredPests = selectedCrop === 'all' 
    ? pests 
    : pests.filter(p => p.crop === selectedCrop);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <PestIcon sx={{ fontSize: 40, color: theme.palette.error.main }} />
          <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
            {language === 'en' ? 'Pest Control' : 'Taolo ea Likokonyana'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<QuestionIcon />}
            onClick={() => setOpenQuestionDialog(true)}
          >
            {language === 'en' ? 'Ask Question' : 'Botsa Potso'}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenReportDialog(true)}
          >
            {language === 'en' ? 'Report Pest' : 'Tlaleha Likokonyana'}
          </Button>
        </Box>
      </Box>

      {/* Crop Filter Tabs */}
      <Box sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab label={language === 'en' ? 'Pest Library' : 'Libuka tsa Likokonyana'} />
          <Tab label={language === 'en' ? 'My Reports' : 'Litlaleho tsa Ka'} />
          <Tab label={language === 'en' ? 'Prevention Tips' : 'Mekhoa ea Thibelo'} />
        </Tabs>
      </Box>

      {/* Pest Library Tab */}
      {tabValue === 0 && (
        <>
          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip 
              label={language === 'en' ? 'All Crops' : 'Lijalo Tsohle'}
              onClick={() => setSelectedCrop('all')}
              color={selectedCrop === 'all' ? 'primary' : 'default'}
              sx={{ minHeight: 44 }}
            />
            {user?.crops?.map(crop => (
              <Chip
                key={crop}
                label={t(crop)}
                onClick={() => setSelectedCrop(crop)}
                color={selectedCrop === crop ? 'primary' : 'default'}
                sx={{ minHeight: 44 }}
              />
            ))}
          </Box>

          <Grid container spacing={2}>
            {filteredPests.map((pest) => (
              <Grid item xs={12} md={6} key={pest.id}>
                <Card>
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: getSeverityColor(pest.severity) }}>
                        {pest.image}
                      </Avatar>
                    }
                    title={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6">
                          {language === 'en' ? pest.pestName : pest.pestName_st}
                        </Typography>
                        <Chip 
                          label={pest.severity}
                          size="small"
                          sx={{ 
                            bgcolor: getSeverityColor(pest.severity),
                            color: 'white'
                          }}
                        />
                      </Box>
                    }
                    subheader={pest.scientificName}
                  />
                  <CardContent>
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <WarningIcon color="warning" fontSize="small" />
                          {language === 'en' ? 'Symptoms' : 'Matšoao'}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography>
                          {language === 'en' ? pest.symptoms : pest.symptoms_st}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>

                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ScienceIcon color="primary" fontSize="small" />
                          {language === 'en' ? 'Treatment' : 'Kalafo'}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography>
                          {language === 'en' ? pest.treatment : pest.treatment_st}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>

                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckCircleIcon color="success" fontSize="small" />
                          {language === 'en' ? 'Prevention' : 'Thibelo'}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography>
                          {language === 'en' ? pest.prevention : pest.prevention_st}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>

                    <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip 
                        label={`Season: ${pest.season}`}
                        size="small"
                        variant="outlined"
                      />
                      <Button 
                        size="small" 
                        onClick={() => {
                          setQuestionText(`How do I control ${language === 'en' ? pest.pestName : pest.pestName_st} on my ${t(pest.crop)}?`);
                          setOpenQuestionDialog(true);
                        }}
                      >
                        {language === 'en' ? 'Ask about this pest' : 'Botsa ka kokonyana ena'}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* My Reports Tab */}
      {tabValue === 1 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">
              {language === 'en' ? 'Your Pest Reports' : 'Litlaleho tsa Hau'}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenReportDialog(true)}
              size="small"
            >
              {language === 'en' ? 'New Report' : 'Tlaleho e Ncha'}
            </Button>
          </Box>

          {reports.length > 0 ? (
            reports.map(report => (
              <Card key={report.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <Box>
                      <Typography variant="subtitle1" gutterBottom>
                        {t(report.crop)} - {report.pest}
                      </Typography>
                      <Typography variant="caption" color="textSecondary" display="block">
                        {format(new Date(report.date), 'MMM d, yyyy')} | {report.location}
                      </Typography>
                    </Box>
                    <Chip 
                      label={report.status}
                      size="small"
                      color={report.status === 'resolved' ? 'success' : 'warning'}
                    />
                  </Box>
                  
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" color="textSecondary">
                      <strong>{language === 'en' ? 'Action taken:' : 'Ketso e nkiloeng:'}</strong> {report.action}
                    </Typography>
                  </Box>

                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                    <Chip 
                      label={`Severity: ${report.severity}`}
                      size="small"
                      sx={{ bgcolor: getSeverityColor(report.severity), color: 'white' }}
                    />
                  </Box>
                </CardContent>
              </Card>
            ))
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <PestIcon sx={{ fontSize: 60, color: theme.palette.grey[400], mb: 2 }} />
              <Typography variant="h6" gutterBottom color="textSecondary">
                {language === 'en' ? 'No pest reports yet' : 'Ha ho litlaleho tsa likokonyana'}
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenReportDialog(true)}
                sx={{ mt: 2 }}
              >
                {language === 'en' ? 'Report a Pest' : 'Tlaleha Likokonyana'}
              </Button>
            </Paper>
          )}
        </>
      )}

      {/* Prevention Tips Tab */}
      {tabValue === 2 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  <AgricultureIcon sx={{ fontSize: 50, color: theme.palette.primary.main }} />
                </Box>
                <Typography variant="h6" gutterBottom align="center">
                  {language === 'en' ? 'Crop Rotation' : 'Ho Potoloha Lijalo'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {language === 'en' ? 
                    'Rotate crops to break pest cycles. Avoid planting same crop in same field each year.' :
                    'Potoloha lijalo ho felisa likokonyana. Qoba ho lema sejalo se le seng sebakeng se le seng selemo le selemo.'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  <GrassIcon sx={{ fontSize: 50, color: theme.palette.success.main }} />
                </Box>
                <Typography variant="h6" gutterBottom align="center">
                  {language === 'en' ? 'Field Sanitation' : 'Ho Hloekisa Masimo'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {language === 'en' ?
                    'Remove crop residues, destroy infected plants, keep field borders clean.' :
                    'Tlosa masalla, chesa limela tse kulang, hloekisa meeli ea masimo.'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  <ScienceIcon sx={{ fontSize: 50, color: theme.palette.warning.main }} />
                </Box>
                <Typography variant="h6" gutterBottom align="center">
                  {language === 'en' ? 'Early Detection' : 'Ho Lemoha Kapele'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {language === 'en' ?
                    'Scout fields weekly, monitor pest traps, act at first sign of infestation.' :
                    'Hlahloba masimo beke le beke, sheba maraba, nka khato ha u bona matšoao.'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Report Pest Dialog */}
      <Dialog open={openReportDialog} onClose={() => setOpenReportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {language === 'en' ? 'Report Pest Infestation' : 'Tlaleha Likokonyana'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label={language === 'en' ? 'Crop' : 'Sejalo'}
                value={newReport.crop}
                onChange={(e) => setNewReport({...newReport, crop: e.target.value})}
                SelectProps={{ native: true }}
              >
                <option value="">{language === 'en' ? 'Select crop' : 'Khetha sejalo'}</option>
                {user?.crops?.map(crop => (
                  <option key={crop} value={crop}>{t(crop)}</option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={language === 'en' ? 'Pest Name' : 'Lebitso la Kokonyana'}
                value={newReport.pest}
                onChange={(e) => setNewReport({...newReport, pest: e.target.value})}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="date"
                label={language === 'en' ? 'Date Observed' : 'Letsatsi le Bonoeng'}
                value={newReport.date}
                onChange={(e) => setNewReport({...newReport, date: e.target.value})}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={language === 'en' ? 'Location/Field' : 'Sebaka/Tšimo'}
                value={newReport.location}
                onChange={(e) => setNewReport({...newReport, location: e.target.value})}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label={language === 'en' ? 'Severity' : 'Boholo'}
                value={newReport.severity}
                onChange={(e) => setNewReport({...newReport, severity: e.target.value})}
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
                value={newReport.action}
                onChange={(e) => setNewReport({...newReport, action: e.target.value})}
                placeholder={language === 'en' ? 'e.g., Applied neem spray' : 'mohlala, Ke fafalitse neem'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label={language === 'en' ? 'Additional Notes' : 'Lintlha tse ling'}
                value={newReport.notes}
                onChange={(e) => setNewReport({...newReport, notes: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReportDialog(false)}>
            {language === 'en' ? 'Cancel' : 'Hlakola'}
          </Button>
          <Button onClick={handleAddReport} variant="contained">
            {language === 'en' ? 'Submit Report' : 'Romela Tlaleho'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ask Question Dialog */}
      <Dialog open={openQuestionDialog} onClose={() => setOpenQuestionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {language === 'en' ? 'Ask about Pest Control' : 'Botsa ka Taolo ea Likokonyana'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label={language === 'en' ? 'Your question' : 'Potso ea hau'}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            sx={{ mt: 2 }}
            placeholder={language === 'en' ?
              'e.g., How do I control fall armyworm organically?' :
              'mohlala, Ke laola liboko joang ntle le meriana?'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenQuestionDialog(false)}>
            {language === 'en' ? 'Cancel' : 'Hlakola'}
          </Button>
          <Button onClick={handleAskQuestion} variant="contained">
            {language === 'en' ? 'Ask Mosupisi' : 'Botsa Mosupisi'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PestControl;