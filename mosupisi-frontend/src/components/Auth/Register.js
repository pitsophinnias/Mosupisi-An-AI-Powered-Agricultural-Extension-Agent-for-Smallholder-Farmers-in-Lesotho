import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Link,
  Alert,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  useTheme,
  FormHelperText
} from '@mui/material';
import {
  Person as PersonIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Agriculture as AgricultureIcon
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { regions, crops, languages } from '../../data/mockData';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    region: '',
    crops: [],
    language: 'en'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const theme = useTheme();

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Basic validation
    if (!formData.name || !formData.mobile || !formData.region || formData.crops.length === 0) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    try {
      const result = await register(formData);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
      <Paper
        elevation={3}
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            backgroundColor: theme.palette.primary.main,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
            color: 'white',
            fontSize: '2rem',
          }}
        >
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
          <TextField
            margin="normal"
            required
            fullWidth
            id="name"
            label={t('register.name')}
            name="name"
            autoComplete="name"
            autoFocus
            value={formData.name}
            onChange={handleChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            margin="normal"
            required
            fullWidth
            id="mobile"
            label={t('register.mobile')}
            name="mobile"
            autoComplete="tel"
            value={formData.mobile}
            onChange={handleChange}
            placeholder="266-XXXX-XXXX"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PhoneIcon />
                </InputAdornment>
              ),
            }}
          />

          <FormControl fullWidth margin="normal" required>
            <InputLabel id="region-label">{t('register.region')}</InputLabel>
            <Select
              labelId="region-label"
              id="region"
              name="region"
              value={formData.region}
              onChange={handleChange}
              label={t('register.region')}
              startAdornment={
                <InputAdornment position="start">
                  <LocationIcon />
                </InputAdornment>
              }
            >
              {regions.map((region) => (
                <MenuItem key={region} value={region}>
                  {t(`regions.${region.toLowerCase().replace(/'/g, '').replace(/\s+/g, '')}`) || region}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" required>
            <InputLabel id="crops-label">{t('register.crops')}</InputLabel>
            <Select
              labelId="crops-label"
              id="crops"
              multiple
              name="crops"
              value={formData.crops}
              onChange={handleCropsChange}
              input={<OutlinedInput label={t('register.crops')} />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip 
                      key={value} 
                      label={t(value)} 
                      size="small"
                      sx={{ backgroundColor: theme.palette.primary.light, color: 'white' }}
                    />
                  ))}
                </Box>
              )}
              startAdornment={
                <InputAdornment position="start">
                  <AgricultureIcon />
                </InputAdornment>
              }
            >
              {crops.map((crop) => (
                <MenuItem key={crop.id} value={crop.id}>
                  {t(crop.id) || crop.name}
                </MenuItem>
              ))}
            </Select>
            {formData.crops.length === 0 && (
              <FormHelperText>Select at least one crop</FormHelperText>
            )}
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel id="language-label">{t('register.language')}</InputLabel>
            <Select
              labelId="language-label"
              id="language"
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

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2, py: 1.5 }}
            disabled={loading}
          >
            {loading ? 'Registering...' : t('register.button')}
          </Button>

          <Box sx={{ textAlign: 'center' }}>
            <Link
              component={RouterLink}
              to="/login"
              variant="body2"
              sx={{ color: theme.palette.primary.main }}
            >
              Already have an account? Login
            </Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default Register;