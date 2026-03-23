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
  useTheme
} from '@mui/material';
import { Phone as PhoneIcon, Lock as LockIcon } from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const Login = () => {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const theme = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(mobile, password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
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
        {/* Mokorotlo hat icon placeholder */}
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
          🌽
        </Box>

        <Typography component="h1" variant="h5" gutterBottom>
          {t('login.title')}
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
            id="mobile"
            label={t('login.mobile')}
            name="mobile"
            autoComplete="tel"
            autoFocus
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PhoneIcon />
                </InputAdornment>
              ),
            }}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label={t('login.password')}
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon />
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2, py: 1.5 }}
            disabled={loading}
          >
            {loading ? 'Logging in...' : t('login.button')}
          </Button>

          <Box sx={{ textAlign: 'center' }}>
            <Link
              component={RouterLink}
              to="/register"
              variant="body2"
              sx={{ color: theme.palette.primary.main }}
            >
              {t('register.link') || "Don't have an account? Register"}
            </Link>
          </Box>
        </Box>

        {/* Demo credentials hint */}
        <Typography variant="caption" sx={{ mt: 2, color: 'text.secondary' }}>
          Demo: Use 266-1234-5678 (any password)
        </Typography>
      </Paper>
    </Container>
  );
};

export default Login;