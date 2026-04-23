import React, { useState } from 'react';
import {
  Container, Paper, Typography, TextField, Button, Box,
  Link, Alert, InputAdornment, IconButton, useTheme, Divider
} from '@mui/material';
import {
  Phone as PhoneIcon, Lock as LockIcon,
  Visibility, VisibilityOff
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const Login = () => {
  const [mobile, setMobile]           = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]   = useState(false);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  const { login }   = useAuth();
  const { t, language } = useLanguage();
  const navigate    = useNavigate();
  const theme       = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!mobile || !password) {
      setError('Please enter your phone number and password');
      return;
    }

    setLoading(true);
    try {
      const result = await login(mobile, password, rememberMe);
      if (result.success) {
        if (result.onboarding_complete === false) {
          navigate('/onboarding');
        } else {
          navigate('/');
        }
      } else {
        setError(typeof result.error === 'string' ? result.error : 'Incorrect phone number or password');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
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
        {/* Icon */}
        <Box
          sx={{
            width: 80, height: 80,
            backgroundColor: theme.palette.primary.main,
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mb: 2, color: 'white', fontSize: '2rem',
          }}
        >
          🌽
        </Box>

        <Typography component="h1" variant="h5" gutterBottom fontWeight={600}>
          {t('login.title', language)}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {language === 'en'
            ? 'Welcome back! Enter your details to continue.'
            : 'Rea u amohela! Kenya dintlha tsa hau ho tsoela pele.'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
          {/* Phone */}
          <TextField
            margin="normal" required fullWidth
            id="mobile" name="mobile"
            label={t('login.mobile', language)}
            autoComplete="tel" autoFocus
            placeholder="57123456 or +26657123456"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><PhoneIcon /></InputAdornment>
              ),
            }}
          />

          {/* Password */}
          <TextField
            margin="normal" required fullWidth
            id="password" name="password"
            label={t('login.password', language)}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><LockIcon /></InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(p => !p)} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* Forgot password + Remember me row */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: theme.palette.primary.main, cursor: 'pointer' }}
              />
              <label htmlFor="rememberMe" style={{ fontSize: '0.875rem', cursor: 'pointer', color: theme.palette.text.secondary }}>
                {language === 'en' ? 'Remember me' : 'Nkgopole'}
              </label>
            </Box>

            <Link
              component={RouterLink}
              to="/forgot-password"
              variant="body2"
              sx={{ color: theme.palette.primary.main, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {t('login.forgot', language)}
            </Link>
          </Box>

          {/* Login button */}
          <Button
            type="submit" fullWidth variant="contained"
            sx={{ mt: 3, mb: 2, py: 1.5, fontWeight: 600 }}
            disabled={loading}
          >
            {loading ? (language === 'en' ? 'Logging in...' : 'E kena...') : t('login.button', language)}
          </Button>

          <Divider sx={{ my: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {language === 'en' ? 'OR' : 'KAPA'}
            </Typography>
          </Divider>

          {/* Register link */}
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body2" color="text.secondary" component="span">
              {language === 'en' ? "Don't have an account? " : 'Ha u na akhaonto? '}
            </Typography>
            <Link
              component={RouterLink}
              to="/register"
              variant="body2"
              fontWeight={600}
              sx={{ color: theme.palette.primary.main, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {language === 'en' ? 'Register here' : 'Ingodisetse mona'}
            </Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default Login;