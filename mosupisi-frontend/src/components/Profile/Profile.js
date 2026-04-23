import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  useTheme,
  Alert,
  //Card,
  //CardContent
} from '@mui/material';
import {
  Person as PersonIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Agriculture as AgricultureIcon,
  History as HistoryIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { dbUtils } from '../../db/db';
import { crops, languages } from '../../data/mockData';
import { format } from 'date-fns';

const DISTRICTS = [
  "Berea", "Butha-Buthe", "Leribe", "Mafeteng", "Maseru",
  "Mohale's Hoek", "Mokhotlong", "Qacha's Nek", "Quthing", "Thaba-Tseka",
];

const Profile = () => {
  const { user, updateUser } = useAuth();
  const { t, language } = useLanguage();
  const theme = useTheme();
  
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    region: '',
    crops: [],
    language: 'en'
  });
  const [queryHistory, setQueryHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        mobile: user.mobile || '',
        region: user.region || '',
        crops: user.crops || [],
        language: user.language || 'en'
      });
    }
    loadQueryHistory();
  }, [user]);

  const loadQueryHistory = async () => {
    try {
      const queries = await dbUtils.getFarmerQueries(20);
      setQueryHistory(queries);
    } catch (error) {
      console.error('Error loading query history:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCropsChange = (event) => {
    const { value } = event.target;
    setFormData(prev => ({
      ...prev,
      crops: typeof value === 'string' ? value.split(',') : value
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await updateUser(formData);
      if (result.success) {
        setSuccess(language === 'en' ? 'Profile updated successfully!' : 'Boitsebiso bo ntlafalitsoe!');
        setEditing(false);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user.name || '',
      mobile: user.mobile || '',
      region: user.region || '',
      crops: user.crops || [],
      language: user.language || 'en'
    });
    setEditing(false);
    setError('');
  };

  if (!user) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="info">Please log in to view your profile.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        {/* Profile Information */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Avatar
              sx={{
                width: 100,
                height: 100,
                margin: '0 auto 16px',
                bgcolor: theme.palette.primary.main,
                fontSize: '2.5rem'
              }}
            >
              {user.name?.charAt(0) || 'F'}
            </Avatar>
            
            <Typography variant="h5" gutterBottom>
              {user.name}
            </Typography>
            
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Member since {format(new Date(user.createdAt || Date.now()), 'MMMM yyyy')}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ textAlign: 'left' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PhoneIcon sx={{ mr: 1, color: theme.palette.primary.main, fontSize: 20 }} />
                <Typography variant="body2">{user.mobile}</Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <LocationIcon sx={{ mr: 1, color: theme.palette.primary.main, fontSize: 20 }} />
                <Typography variant="body2">{user.region}</Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                <AgricultureIcon sx={{ mr: 1, color: theme.palette.primary.main, fontSize: 20 }} />
                <Box>
                  {user.crops?.map(crop => (
                    <Chip
                      key={crop}
                      label={t(crop)}
                      size="small"
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  ))}
                </Box>
              </Box>
            </Box>

            {!editing && (
              <Button
                fullWidth
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => setEditing(true)}
                sx={{ mt: 2 }}
              >
                {language === 'en' ? 'Edit Profile' : 'Ntlafatsa Boitsebiso'}
              </Button>
            )}
          </Paper>
        </Grid>

        {/* Edit Form / Query History */}
        <Grid item xs={12} md={8}>
          {editing ? (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                {language === 'en' ? 'Edit Profile' : 'Ntlafatsa Boitsebiso'}
              </Typography>
              
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              
              {success && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {success}
                </Alert>
              )}

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={t('register.name')}
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    InputProps={{
                      startAdornment: <PersonIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={t('register.mobile')}
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleChange}
                    InputProps={{
                      startAdornment: <PhoneIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('register.region')}</InputLabel>
                    <Select
                      name="region"
                      value={formData.region}
                      onChange={handleChange}
                      label={t('register.region')}
                      startAdornment={<LocationIcon sx={{ mr: 1, color: theme.palette.primary.main }} />}
                    >
                      {DISTRICTS.map((district) => (
                        <MenuItem key={district} value={district}>
                          {district}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('register.crops')}</InputLabel>
                    <Select
                      multiple
                      name="crops"
                      value={formData.crops}
                      onChange={handleCropsChange}
                      input={<OutlinedInput label={t('register.crops')} />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value) => (
                            <Chip key={value} label={t(value)} size="small" />
                          ))}
                        </Box>
                      )}
                    >
                      {crops.map((crop) => (
                        <MenuItem key={crop.id} value={crop.id}>
                          {t(crop.id)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('register.language')}</InputLabel>
                    <Select
                      name="language"
                      value={formData.language}
                      onChange={handleChange}
                      label={t('register.language')}
                    >
                      {languages.map((lang) => (
                        <MenuItem key={lang.id} value={lang.id}>
                          {lang.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      startIcon={<CancelIcon />}
                      onClick={handleCancel}
                      disabled={loading}
                    >
                      {language === 'en' ? 'Cancel' : 'Hlakola'}
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={handleSave}
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : language === 'en' ? 'Save Changes' : 'Boloka'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          ) : (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon />
                {language === 'en' ? 'Recent Queries' : 'Lipotso tsa Morao tjena'}
              </Typography>

              <List>
                {queryHistory.length > 0 ? (
                  queryHistory.map((query) => (
                    <React.Fragment key={query.id}>
                      <ListItem alignItems="flex-start">
                        <ListItemIcon>
                          <HistoryIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={language === 'en' ? query.question_en || query.question : query.question_st || query.question}
                          secondary={
                            <>
                              <Typography component="span" variant="body2" color="textSecondary">
                                {format(new Date(query.timestamp), 'MMM d, yyyy h:mm a')}
                              </Typography>
                              {query.isOffline && (
                                <Chip
                                  label="Offline"
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  sx={{ ml: 1 }}
                                />
                              )}
                            </>
                          }
                        />
                      </ListItem>
                      <Divider variant="inset" component="li" />
                    </React.Fragment>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText
                      primary={language === 'en' ? 'No queries yet' : 'Ha ho lipotso'}
                      secondary={language === 'en' ? 'Ask Mosupisi a question to get started' : 'Botsa Mosupisi potso ho qala'}
                    />
                  </ListItem>
                )}
              </List>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Container>
  );
};

export default Profile;