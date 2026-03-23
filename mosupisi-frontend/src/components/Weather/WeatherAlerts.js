import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Chip,
  Alert,
  //Button,
  useTheme,
  LinearProgress,
  Divider
} from '@mui/material';
import {
  WbSunny as SunnyIcon,
  Cloud as CloudyIcon,
  Grain as RainIcon,
  //AcUnit as SnowIcon,
  Warning as WarningIcon,
  Thermostat as TempIcon,
  Opacity as HumidityIcon,
  Air as WindIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/db';
import { format } from 'date-fns';

const WeatherAlerts = () => {
  const [weatherData, setWeatherData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t, language } = useLanguage();
  const theme = useTheme();

  useEffect(() => {
    loadWeatherData();
  }, []);

  const loadWeatherData = async () => {
    try {
      const data = await db.weather.orderBy('date').toArray();
      setWeatherData(data);
      setAlerts(data.filter(w => w.alert));
    } catch (error) {
      console.error('Error loading weather data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIcon = (condition) => {
    switch (condition?.toLowerCase()) {
      case 'sunny':
        return <SunnyIcon sx={{ fontSize: 40, color: theme.palette.warning.main }} />;
      case 'rainy':
        return <RainIcon sx={{ fontSize: 40, color: theme.palette.info.main }} />;
      case 'cloudy':
        return <CloudyIcon sx={{ fontSize: 40, color: theme.palette.grey[500] }} />;
      case 'stormy':
        return <RainIcon sx={{ fontSize: 40, color: theme.palette.error.main }} />;
      default:
        return <SunnyIcon sx={{ fontSize: 40, color: theme.palette.warning.main }} />;
    }
  };

  const getConditionText = (condition) => {
    if (language === 'en') return condition;
    
    const translations = {
      sunny: 'Chesa',
      rainy: 'Pula',
      cloudy: 'Khoalifi',
      stormy: 'Sefefo',
      'partly cloudy': 'Khoalifi hanyane'
    };
    return translations[condition?.toLowerCase()] || condition;
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <LinearProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Typography variant="h4" gutterBottom>
        {t('weather.title')}
      </Typography>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Paper sx={{ p: 3, mb: 3, backgroundColor: theme.palette.error.light, color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <WarningIcon />
            <Typography variant="h6">
              {language === 'en' ? 'Active Weather Alerts' : 'Litemoso tsa Boemo ba Leholimo'}
            </Typography>
          </Box>
          
          {alerts.map((alert, index) => (
            <Alert 
              key={index} 
              severity="error" 
              sx={{ mb: 1, backgroundColor: 'white' }}
              icon={<WarningIcon />}
            >
              <Typography variant="subtitle2">
                {format(new Date(alert.date), 'EEEE, MMMM d, yyyy')}
              </Typography>
              <Typography variant="body2">{alert.alert}</Typography>
            </Alert>
          ))}
        </Paper>
      )}

      {/* Forecast */}
      <Grid container spacing={2}>
        {weatherData.map((day) => (
          <Grid item xs={12} sm={6} md={4} key={day.date}>
            <Card sx={{ 
              height: '100%',
              border: day.alert ? `2px solid ${theme.palette.error.main}` : 'none'
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarIcon color="primary" />
                    <Typography variant="h6">
                      {format(new Date(day.date), 'EEE, MMM d')}
                    </Typography>
                  </Box>
                  {day.alert && (
                    <Chip 
                      icon={<WarningIcon />} 
                      label="Alert" 
                      size="small" 
                      color="error"
                    />
                  )}
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2 }}>
                  {getWeatherIcon(day.condition)}
                  <Typography variant="h3" component="span" sx={{ ml: 1 }}>
                    {day.temp?.max}°
                  </Typography>
                </Box>

                <Typography variant="body1" align="center" gutterBottom sx={{ textTransform: 'capitalize' }}>
                  {getConditionText(day.condition)}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <TempIcon sx={{ color: theme.palette.warning.main }} />
                      <Typography variant="body2" color="textSecondary">
                        {language === 'en' ? 'Min' : 'Bonyane'}
                      </Typography>
                      <Typography variant="body1">{day.temp?.min}°C</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <TempIcon sx={{ color: theme.palette.error.main }} />
                      <Typography variant="body2" color="textSecondary">
                        {language === 'en' ? 'Max' : 'Boholo'}
                      </Typography>
                      <Typography variant="body1">{day.temp?.max}°C</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <HumidityIcon sx={{ color: theme.palette.info.main }} />
                      <Typography variant="body2" color="textSecondary">
                        {language === 'en' ? 'Rain' : 'Pula'}
                      </Typography>
                      <Typography variant="body1">{day.rainChance}%</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <WindIcon sx={{ color: theme.palette.primary.main }} />
                      <Typography variant="body2" color="textSecondary">
                        {language === 'en' ? 'Wind' : 'Moea'}
                      </Typography>
                      <Typography variant="body1">12 km/h</Typography>
                    </Box>
                  </Grid>
                </Grid>

                {day.alert && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    {day.alert}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Farming Tips based on weather */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          {language === 'en' ? 'Weather-Based Farming Tips' : 'Likeletso tsa Temo ho latela Boemo ba Leholimo'}
        </Typography>
        
        <Grid container spacing={2}>
          {weatherData.slice(0, 3).map((day, index) => {
            let tip = '';
            if (day.rainChance > 70) {
              tip = language === 'en' 
                ? 'Heavy rain expected. Ensure drainage channels are clear and harvest ripe crops.'
                : 'Pula e matla e lebelletsoe. Etsa bonnete ba hore likanaleng tsa metsi li hlakile le ho kotula lijalo tse butsoitseng.';
            } else if (day.temp?.max > 30) {
              tip = language === 'en'
                ? 'High temperatures. Increase irrigation and provide shade for seedlings.'
                : 'Mocheso o phahamile. Eketsa ho nosetsa ';
            } else if (day.condition === 'sunny') {
              tip = language === 'en'
                ? 'Good day for field work. Consider planting or applying fertilizers.'
                : 'Letsatsi le letle la ho sebetsa masimong. Nahana ka ho jala kapa ho sebelisa manyolo.';
            } else {
              tip = language === 'en'
                ? 'Normal conditions. Continue with regular farming activities.'
                : 'Maemo a tloaelehileng. Tsoelapele ka mesebetsi e tloaelehileng ea temo.';
            }

            return (
              <Grid item xs={12} key={index}>
                <Alert severity="info">
                  <Typography variant="subtitle2">
                    {format(new Date(day.date), 'EEEE, MMMM d')}:
                  </Typography>
                  <Typography variant="body2">{tip}</Typography>
                </Alert>
              </Grid>
            );
          })}
        </Grid>
      </Paper>
    </Container>
  );
};

export default WeatherAlerts;