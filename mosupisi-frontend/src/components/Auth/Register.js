import React, { useState } from 'react';
import {
  Container, Paper, Typography, TextField, Button, Box, Link,
  Alert, InputAdornment, FormControl, InputLabel, Select, MenuItem,
  Chip, OutlinedInput, useTheme, FormHelperText, IconButton
} from '@mui/material';
import {
  Person as PersonIcon, Phone as PhoneIcon,
  LocationOn as LocationIcon, Agriculture as AgricultureIcon,
  Lock as LockIcon, Visibility, VisibilityOff
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { crops, languages } from '../../data/mockData';

// Use the actual district names that match the backend
const DISTRICTS = [
  "Berea", "Butha-Buthe", "Leribe", "Mafeteng", "Maseru",
  "Mohale's Hoek", "Mokhotlong", "Qacha's Nek", "Quthing", "Thaba-Tseka",
];

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    region: '',
    crops: [],
    language: 'en'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const theme = useTheme();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCropsChange = (event) => {
    const { value } = event.target;
    setFormData(prev => ({
      ...prev,
      crops: typeof value === 'string' ? value.split(',') : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.mobile || !formData.password || !formData.region || formData.crops.length === 0) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const result = await register(formData);
      if (result.success) {
        // If onboarding not done, go to farm setup; otherwise dashboard
        navigate(result.onboarding_complete ? '/' : '/onboarding');
      } else {
        setError(typeof result.error === 'string' ? result.error : 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 2 }}>
        <Box sx={{
          width: 80, height: 80,
          backgroundColor: theme.palette.primary.main,
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          mb: 2, color: 'white', fontSize: '2rem',
        }}>
          🌱
        </Box>

        <Typography component="h1" variant="h5" gutterBottom>
          {t('register.title')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>

          {/* Full Name */}
          <TextField
            margin="normal" required fullWidth
            label={t('register.name')} name="name"
            autoComplete="name" autoFocus
            value={formData.name} onChange={handleChange}
            InputProps={{
              startAdornment: <InputAdornment position="start"><PersonIcon /></InputAdornment>
            }}
          />

          {/* Mobile */}
          <TextField
            margin="normal" required fullWidth
            label={t('register.mobile')} name="mobile"
            autoComplete="tel" placeholder="57123456 or +26657123456"
            value={formData.mobile} onChange={handleChange}
            InputProps={{
              startAdornment: <InputAdornment position="start"><PhoneIcon /></InputAdornment>
            }}
          />

          {/* Password */}
          <TextField
            margin="normal" required fullWidth
            label="Password" name="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password} onChange={handleChange}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockIcon /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(p => !p)} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          {/* Confirm Password */}
          <TextField
            margin="normal" required fullWidth
            label="Confirm Password" name="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            value={formData.confirmPassword} onChange={handleChange}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockIcon /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowConfirm(p => !p)} edge="end">
                    {showConfirm ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          {/* District / Region */}
          <FormControl fullWidth margin="normal" required>
            <InputLabel>{t('register.region')}</InputLabel>
            <Select
              name="region" value={formData.region}
              onChange={handleChange} label={t('register.region')}
              startAdornment={<InputAdornment position="start"><LocationIcon /></InputAdornment>}
            >
              {DISTRICTS.map((district) => (
                <MenuItem key={district} value={district}>{district}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Crops */}
          <FormControl fullWidth margin="normal" required>
            <InputLabel>{t('register.crops')}</InputLabel>
            <Select
              multiple name="crops" value={formData.crops}
              onChange={handleCropsChange}
              input={<OutlinedInput label={t('register.crops')} />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={t(value) || value} size="small"
                      sx={{ backgroundColor: theme.palette.primary.light, color: 'white' }} />
                  ))}
                </Box>
              )}
              startAdornment={<InputAdornment position="start"><AgricultureIcon /></InputAdornment>}
            >
              {crops.map((crop) => (
                <MenuItem key={crop.id} value={crop.id}>{t(crop.id) || crop.name}</MenuItem>
              ))}
            </Select>
            {formData.crops.length === 0 && (
              <FormHelperText>Select at least one crop</FormHelperText>
            )}
          </FormControl>

          {/* Language */}
          <FormControl fullWidth margin="normal">
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

          <Button
            type="submit" fullWidth variant="contained"
            sx={{ mt: 3, mb: 2, py: 1.5 }} disabled={loading}
          >
            {loading ? 'Registering...' : t('register.button')}
          </Button>

          <Box sx={{ textAlign: 'center' }}>
            <Link component={RouterLink} to="/login" variant="body2"
              sx={{ color: theme.palette.primary.main }}>
              Already have an account? Login
            </Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default Register;