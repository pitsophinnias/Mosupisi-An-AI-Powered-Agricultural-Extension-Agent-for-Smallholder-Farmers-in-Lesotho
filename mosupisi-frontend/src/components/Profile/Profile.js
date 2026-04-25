import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Paper, Typography, Box, TextField, Button, Grid,
  FormControl, InputLabel, Select, MenuItem, Chip, OutlinedInput,
  Avatar, Divider, List, ListItem, ListItemText, ListItemIcon,
  useTheme, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  Slider,
} from '@mui/material';
import {
  Person as PersonIcon, Phone as PhoneIcon, LocationOn as LocationIcon,
  Agriculture as AgricultureIcon, History as HistoryIcon,
  Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon,
  ZoomIn as ZoomInIcon,
} from '@mui/icons-material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import Cropper from 'react-easy-crop';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { dbUtils } from '../../db/db';
import { crops, languages } from '../../data/mockData';
import { format } from 'date-fns';

const PROFILE_SERVICE_URL = process.env.REACT_APP_PROFILE_SERVICE_URL || 'http://localhost:8003';

const DISTRICTS = [
  "Berea", "Butha-Buthe", "Leribe", "Mafeteng", "Maseru",
  "Mohale's Hoek", "Mokhotlong", "Qacha's Nek", "Quthing", "Thaba-Tseka",
];

// ── Crop helper: convert crop area to a canvas blob ──────────────────────────
const createCroppedImage = (imageSrc, croppedAreaPixels) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      const canvas = document.createElement('canvas');
      const size = 400; // output size in px
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0, 0, size, size,
      );

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas is empty'));
        resolve(blob);
      }, 'image/jpeg', 0.92);
    });
    image.addEventListener('error', reject);
    image.src = imageSrc;
  });

// ── Main component ────────────────────────────────────────────────────────────
const Profile = () => {
  const { user, updateUser, uploadAvatar, deleteAvatar } = useAuth();
  const { t, language } = useLanguage();
  const theme = useTheme();

  const [editing, setEditing]     = useState(false);
  const [formData, setFormData]   = useState({
    name: '', mobile: '', region: '', crops: [], language: 'en'
  });
  const [queryHistory, setQueryHistory] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  // ── Crop state ──────────────────────────────────────────────────────────────
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc]       = useState(null);
  const [crop, setCrop]                     = useState({ x: 0, y: 0 });
  const [zoom, setZoom]                     = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropLoading, setCropLoading]       = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name:     user.name     || '',
        mobile:   user.mobile   || '',
        region:   user.region   || '',
        crops:    user.crops    || [],
        language: user.language || 'en',
      });
    }
    loadQueryHistory();
  }, [user]);

  const loadQueryHistory = async () => {
    try {
      const queries = await dbUtils.getFarmerQueries(20);
      setQueryHistory(queries);
    } catch (err) {
      console.error('Error loading query history:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCropsChange = (event) => {
    const { value } = event.target;
    setFormData(prev => ({
      ...prev,
      crops: typeof value === 'string' ? value.split(',') : value,
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
      name:     user.name     || '',
      mobile:   user.mobile   || '',
      region:   user.region   || '',
      crops:    user.crops    || [],
      language: user.language || 'en',
    });
    setEditing(false);
    setError('');
  };

  // ── File selected → open crop dialog ───────────────────────────────────────
  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const onCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  // ── Crop confirmed → upload ─────────────────────────────────────────────────
  const handleCropConfirm = async () => {
    if (!rawImageSrc || !croppedAreaPixels) return;
    setCropLoading(true);
    try {
      const blob = await createCroppedImage(rawImageSrc, croppedAreaPixels);
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      await uploadAvatar(file);
      setCropDialogOpen(false);
      setRawImageSrc(null);
    } catch (err) {
      console.error('Crop error:', err);
    } finally {
      setCropLoading(false);
    }
  };

  const handleCropCancel = () => {
    setCropDialogOpen(false);
    setRawImageSrc(null);
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

        {/* ── Profile card ─────────────────────────────────────────────── */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>

            {/* Avatar */}
            <Box sx={{ position: 'relative', width: 100, margin: '0 auto 16px' }}>
              <Avatar
                src={user.avatar_url ? `${PROFILE_SERVICE_URL}${user.avatar_url}` : undefined}
                sx={{
                  width: 100, height: 100,
                  bgcolor: theme.palette.primary.main,
                  fontSize: '2.5rem', cursor: 'pointer',
                  border: '3px solid',
                  borderColor: theme.palette.primary.light,
                  '&:hover': { opacity: 0.85 },
                }}
                onClick={() => document.getElementById('avatar-upload').click()}
              >
                {!user.avatar_url && (user.name?.charAt(0) || 'F')}
              </Avatar>

              {/* Camera overlay */}
              <Box
                onClick={() => document.getElementById('avatar-upload').click()}
                sx={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 28, height: 28, borderRadius: '50%',
                  bgcolor: theme.palette.primary.main,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', border: '2px solid white',
                  '&:hover': { bgcolor: theme.palette.primary.dark },
                }}
              >
                <CameraAltIcon sx={{ fontSize: 14, color: 'white' }} />
              </Box>

              <input
                id="avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleFileSelected}
              />
            </Box>

            <Typography variant="h5" gutterBottom>{user.name}</Typography>

            {user.avatar_url && (
              <Typography
                variant="caption"
                sx={{ color: 'error.main', cursor: 'pointer', display: 'block', mb: 1,
                  '&:hover': { textDecoration: 'underline' } }}
                onClick={deleteAvatar}
              >
                {language === 'en' ? 'Remove photo' : 'Tlosa setšoantšo'}
              </Typography>
            )}

            <Typography variant="body2" color="textSecondary" gutterBottom>
              {language === 'en' ? 'Member since' : 'Moembere ho tloha'}{' '}
              {format(new Date(user.createdAt || Date.now()), 'MMMM yyyy')}
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
                    <Chip key={crop} label={t(crop)} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                  ))}
                </Box>
              </Box>
            </Box>

            {!editing && (
              <Button
                fullWidth variant="contained" startIcon={<EditIcon />}
                onClick={() => setEditing(true)} sx={{ mt: 2 }}
              >
                {language === 'en' ? 'Edit Profile' : 'Ntlafatsa Boitsebiso'}
              </Button>
            )}
          </Paper>
        </Grid>

        {/* ── Edit form / Query history ─────────────────────────────────── */}
        <Grid item xs={12} md={8}>
          {editing ? (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                {language === 'en' ? 'Edit Profile' : 'Ntlafatsa Boitsebiso'}
              </Typography>

              {error   && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}
              {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth label={t('register.name')} name="name"
                    value={formData.name} onChange={handleChange}
                    InputProps={{ startAdornment: <PersonIcon sx={{ mr: 1, color: theme.palette.primary.main }} /> }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth label={t('register.mobile')} name="mobile"
                    value={formData.mobile} onChange={handleChange}
                    InputProps={{ startAdornment: <PhoneIcon sx={{ mr: 1, color: theme.palette.primary.main }} /> }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('register.region')}</InputLabel>
                    <Select
                      name="region" value={formData.region}
                      onChange={handleChange} label={t('register.region')}
                      startAdornment={<LocationIcon sx={{ mr: 1, color: theme.palette.primary.main }} />}
                    >
                      {DISTRICTS.map((d) => (
                        <MenuItem key={d} value={d}>{d}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('register.crops')}</InputLabel>
                    <Select
                      multiple name="crops" value={formData.crops}
                      onChange={handleCropsChange}
                      input={<OutlinedInput label={t('register.crops')} />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((v) => <Chip key={v} label={t(v)} size="small" />)}
                        </Box>
                      )}
                    >
                      {crops.map((crop) => (
                        <MenuItem key={crop.id} value={crop.id}>{t(crop.id)}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('register.language')}</InputLabel>
                    <Select
                      name="language" value={formData.language}
                      onChange={handleChange} label={t('register.language')}
                    >
                      {languages.map((lang) => (
                        <MenuItem key={lang.id} value={lang.id}>{lang.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button variant="outlined" startIcon={<CancelIcon />}
                      onClick={handleCancel} disabled={loading}>
                      {language === 'en' ? 'Cancel' : 'Hlakola'}
                    </Button>
                    <Button variant="contained" startIcon={<SaveIcon />}
                      onClick={handleSave} disabled={loading}>
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
                        <ListItemIcon><HistoryIcon color="primary" /></ListItemIcon>
                        <ListItemText
                          primary={language === 'en'
                            ? query.question_en || query.question
                            : query.question_st || query.question}
                          secondary={
                            <>
                              <Typography component="span" variant="body2" color="textSecondary">
                                {format(new Date(query.timestamp), 'MMM d, yyyy h:mm a')}
                              </Typography>
                              {query.isOffline && (
                                <Chip label="Offline" size="small" variant="outlined"
                                  color="warning" sx={{ ml: 1 }} />
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
                      secondary={language === 'en'
                        ? 'Ask Mosupisi a question to get started'
                        : 'Botsa Mosupisi potso ho qala'}
                    />
                  </ListItem>
                )}
              </List>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* ── Crop dialog ───────────────────────────────────────────────────── */}
      <Dialog
        open={cropDialogOpen}
        onClose={handleCropCancel}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {language === 'en' ? 'Adjust your photo' : 'Laola setšoantšo sa hau'}
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {/* Cropper area */}
          <Box sx={{ position: 'relative', width: '100%', height: 360, bgcolor: '#111' }}>
            {rawImageSrc && (
              <Cropper
                image={rawImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </Box>

          {/* Zoom slider */}
          <Box sx={{ px: 3, py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ZoomInIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Slider
                value={zoom}
                min={1}
                max={3}
                step={0.05}
                onChange={(_, value) => setZoom(value)}
                sx={{ color: theme.palette.primary.main }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
              {language === 'en'
                ? 'Drag to reposition · Scroll or slide to zoom'
                : 'Hula ho fetola sebaka · Skrola kapa slaeda ho nyolosetsa'}
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            variant="outlined" onClick={handleCropCancel} disabled={cropLoading}
            sx={{ borderRadius: 2 }}
          >
            {language === 'en' ? 'Cancel' : 'Hlakola'}
          </Button>
          <Button
            variant="contained" onClick={handleCropConfirm}
            disabled={cropLoading}
            sx={{ borderRadius: 2, minWidth: 120 }}
          >
            {cropLoading
              ? (language === 'en' ? 'Saving...' : 'E boloka...')
              : (language === 'en' ? 'Save Photo' : 'Boloka Setšoantšo')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Profile;