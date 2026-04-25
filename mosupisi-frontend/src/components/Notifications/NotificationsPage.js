// src/components/Notifications/NotificationsPage.js
import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Paper, Switch, FormControlLabel,
  Divider, Chip, Button, CircularProgress, Alert, useTheme,
  List, ListItem, ListItemText, ListItemIcon,
} from '@mui/material';
import {
  WbSunny as WeatherIcon,
  Agriculture as PlantingIcon,
  BugReport as PestIcon,
  Opacity as SprayIcon,
  Sms as SmsIcon,
  NotificationsActive as PushIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as CriticalIcon,
} from '@mui/icons-material';
import { useNotifications } from '../../context/NotificationContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatDistanceToNow } from 'date-fns';

const SEVERITY_COLOR = { info: '#4CAF50', warning: '#FF9800', critical: '#f44336' };

const NotificationsPage = () => {
  const theme = useTheme();
  const { language } = useLanguage();
  const {
    notifications, loading, fetchNotifications,
    markAllRead, unreadCount,
    getSettings, updateSettings,
    pushSupported, pushSubscribed,
    subscribeToPush, unsubscribeFromPush,
  } = useNotifications();

  const [settings, setSettings] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [filter, setFilter]     = useState(null);

  const isEn = language === 'en';

  useEffect(() => {
    fetchNotifications();
    getSettings().then(s => { if (s) setSettings(s); });
  }, []); // eslint-disable-line

  const handleSettingChange = async (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    setSaving(true);
    setSaved(false);
    await updateSettings({ [key]: value });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const filtered = filter ? notifications.filter(n => n.type === filter) : notifications;

  const settingRows = [
    {
      key: 'weather_alerts_enabled',
      icon: <WeatherIcon />,
      label: isEn ? 'Weather alerts' : 'Litemoso tsa Leholimo',
      desc: isEn ? 'Frost, heat, heavy rain, drought' : 'Sekhahla, mocheso, pula e matla, komello',
    },
    {
      key: 'planting_reminders_enabled',
      icon: <PlantingIcon />,
      label: isEn ? 'Planting reminders' : 'Lipehelo tsa Ho Jala',
      desc: isEn ? 'Fertiliser, weeding, harvest windows' : 'Manyolo, ho tlosa joang, nako ea kotulo',
    },
    {
      key: 'pest_alerts_enabled',
      icon: <PestIcon />,
      label: isEn ? 'Pest risk alerts' : 'Litemoso tsa Kotsi ea Likokonyana',
      desc: isEn ? 'Fall armyworm, aphids, fungal disease' : 'Sebole sa autumn, likhothola, mafu a likhohle',
    },
    {
      key: 'spray_window_enabled',
      icon: <SprayIcon />,
      label: isEn ? 'Spray window alerts' : 'Litemoso tsa Nako ea Ho Ata',
      desc: isEn ? 'Good conditions for pesticide application' : 'Maemo a ntle a ho sebelisa lithibela-kokonyana',
    },
    {
      key: 'sms_critical_enabled',
      icon: <SmsIcon />,
      label: isEn ? 'SMS for critical alerts' : 'SMS bakeng sa Litemoso tse Potlakileng',
      desc: isEn ? 'Frost, heavy rain, fall armyworm (your phone number)' : 'Sekhahla, pula e matla, sebole (nomoro ea hau)',
    },
    {
      key: 'push_enabled',
      icon: <PushIcon />,
      label: isEn ? 'Browser push notifications' : 'Litemoso tsa Sebautla',
      desc: isEn ? 'Instant alerts even when app is closed' : 'Litemoso tsa kapele le ha app e koaliloe',
    },
  ];

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        {isEn ? 'Notifications' : 'Litemoso'}
      </Typography>

      {/* Settings panel */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            {isEn ? 'Notification Settings' : 'Litaelo tsa Litemoso'}
          </Typography>
          {saving && <CircularProgress size={18} />}
          {saved && <Chip label={isEn ? 'Saved' : 'Bolokiloe'} size="small" color="success" />}
        </Box>

        {settings ? (
          <List disablePadding>
            {settingRows.map((row, idx) => (
              <React.Fragment key={row.key}>
                <ListItem disablePadding sx={{ py: 1 }}>
                  <ListItemIcon sx={{ color: theme.palette.primary.main, minWidth: 40 }}>
                    {row.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={row.label}
                    secondary={row.desc}
                    primaryTypographyProps={{ fontWeight: 500 }}
                    secondaryTypographyProps={{ fontSize: '0.78rem' }}
                  />
                  <Switch
                    checked={!!settings[row.key]}
                    onChange={(e) => handleSettingChange(row.key, e.target.checked)}
                    color="primary"
                  />
                </ListItem>
                {idx < settingRows.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        ) : (
          <CircularProgress size={24} />
        )}

        {/* Push subscribe button */}
        {pushSupported && settings?.push_enabled && (
          <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
            {pushSubscribed ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip label={isEn ? '✓ Push notifications active' : '✓ Litemoso tsa sebautla li sebetsa'}
                  color="success" size="small" />
                <Button size="small" variant="outlined" color="error" onClick={unsubscribeFromPush}>
                  {isEn ? 'Disable' : 'Tima'}
                </Button>
              </Box>
            ) : (
              <Button variant="contained" startIcon={<PushIcon />} onClick={subscribeToPush} size="small">
                {isEn ? 'Enable browser push notifications' : 'Khetha litemoso tsa sebautla'}
              </Button>
            )}
          </Box>
        )}
      </Paper>

      {/* Notification history */}
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            {isEn ? 'History' : 'Nalane'}
            {unreadCount > 0 && (
              <Chip label={`${unreadCount} ${isEn ? 'unread' : 'tse sa balang'}`}
                size="small" color="error" sx={{ ml: 1 }} />
            )}
          </Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={markAllRead}>
              {isEn ? 'Mark all read' : 'Bala tsohle'}
            </Button>
          )}
        </Box>

        {/* Type filters */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
          {[
            { key: null, label: isEn ? 'All' : 'Tsohle' },
            { key: 'weather', label: isEn ? 'Weather' : 'Leholimo' },
            { key: 'planting', label: isEn ? 'Planting' : 'Ho Jala' },
            { key: 'pest', label: isEn ? 'Pests' : 'Likokonyana' },
            { key: 'spray_window', label: isEn ? 'Spray' : 'Ho Ata' },
          ].map(opt => (
            <Chip key={String(opt.key)} label={opt.label} size="small"
              onClick={() => setFilter(opt.key)}
              variant={filter === opt.key ? 'filled' : 'outlined'}
              color={filter === opt.key ? 'primary' : 'default'}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
        ) : filtered.length === 0 ? (
          <Alert severity="info">
            {isEn ? "No notifications yet. You're all caught up! 🌱" : "Ha ho litemoso. O phethile tsohle! 🌱"}
          </Alert>
        ) : (
          <List disablePadding>
            {filtered.map((notif, idx) => (
              <React.Fragment key={notif.id}>
                <ListItem
                  alignItems="flex-start"
                  sx={{
                    borderLeft: `3px solid ${SEVERITY_COLOR[notif.severity] || '#4CAF50'}`,
                    bgcolor: notif.is_read ? 'transparent' : 'action.selected',
                    borderRadius: 1, mb: 0.5,
                  }}
                >
                  <ListItemIcon sx={{ color: SEVERITY_COLOR[notif.severity], mt: 0.5, minWidth: 36 }}>
                    {notif.severity === 'critical' ? <CriticalIcon /> :
                     notif.severity === 'warning'  ? <WarningIcon />  : <InfoIcon />}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={notif.is_read ? 400 : 700}>
                          {notif.title}
                        </Typography>
                        {!notif.is_read && (
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main' }} />
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                          {notif.body}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip label={notif.type} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                          {notif.farm_name && (
                            <Chip label={notif.farm_name} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                          )}
                          <Typography variant="caption" color="text.disabled" sx={{ alignSelf: 'center' }}>
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                          </Typography>
                        </Box>
                      </>
                    }
                  />
                </ListItem>
                {idx < filtered.length - 1 && <Divider component="li" />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>
    </Container>
  );
};

export default NotificationsPage;