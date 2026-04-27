import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Paper, Switch,
  Divider, Chip, Button, CircularProgress, Alert, useTheme,
  List, ListItem, ListItemText, ListItemIcon, IconButton, Drawer,
  AppBar, Toolbar,
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
  Settings as SettingsIcon,
  Close as CloseIcon,
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

  const [settings, setSettings]     = useState(null);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [filter, setFilter]         = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const filtered = filter
    ? notifications.filter(n => n.type === filter)
    : notifications;

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

      {/* ── Page header ─────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={600}>
          {isEn ? 'Notifications' : 'Litemoso'}
          {unreadCount > 0 && (
            <Chip
              label={`${unreadCount} ${isEn ? 'unread' : 'tse sa balang'}`}
              size="small" color="error"
              sx={{ ml: 1.5, fontWeight: 600 }}
            />
          )}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {unreadCount > 0 && (
            <Button size="small" variant="outlined" onClick={markAllRead}>
              {isEn ? 'Mark all read' : 'Bala tsohle'}
            </Button>
          )}
          <IconButton
            onClick={() => setSettingsOpen(true)}
            title={isEn ? 'Notification settings' : 'Litaelo tsa litemoso'}
            sx={{
              bgcolor: 'action.hover',
              '&:hover': { bgcolor: 'action.selected' },
            }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* ── Type filter chips ───────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: 2.5, flexWrap: 'wrap' }}>
        {[
          { key: null,           label: isEn ? 'All'      : 'Tsohle' },
          { key: 'weather',      label: isEn ? 'Weather'  : 'Leholimo' },
          { key: 'planting',     label: isEn ? 'Planting' : 'Ho Jala' },
          { key: 'pest',         label: isEn ? 'Pests'    : 'Likokonyana' },
          { key: 'spray_window', label: isEn ? 'Spray'    : 'Ho Ata' },
        ].map(opt => (
          <Chip
            key={String(opt.key)}
            label={opt.label}
            size="small"
            onClick={() => setFilter(opt.key)}
            variant={filter === opt.key ? 'filled' : 'outlined'}
            color={filter === opt.key ? 'primary' : 'default'}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Box>

      {/* ── Notification list ───────────────────────────────────────── */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, px: 3 }}>
            <Typography variant="h2" sx={{ mb: 1 }}>🌱</Typography>
            <Typography variant="body1" color="text.secondary" fontWeight={500}>
              {isEn ? "You're all caught up!" : "O phethile tsohle!"}
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
              {isEn
                ? 'No notifications match this filter.'
                : 'Ha ho litemoso tse tshoanang le sefe sena.'}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {filtered.map((notif, idx) => (
              <React.Fragment key={notif.id}>
                <ListItem
                  alignItems="flex-start"
                  sx={{
                    borderLeft: `4px solid ${SEVERITY_COLOR[notif.severity] || '#4CAF50'}`,
                    bgcolor: notif.is_read ? 'transparent' : 'action.selected',
                    px: 2, py: 1.5,
                    '&:hover': { bgcolor: 'action.hover' },
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
                          <Box sx={{
                            width: 8, height: 8, borderRadius: '50%',
                            bgcolor: 'error.main', flexShrink: 0,
                          }} />
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="caption" display="block" sx={{ mb: 0.75, color: 'text.secondary' }}>
                          {notif.body}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                          <Chip
                            label={notif.type.replace('_', ' ')}
                            size="small" variant="outlined"
                            sx={{ height: 18, fontSize: '0.65rem', textTransform: 'capitalize' }}
                          />
                          {notif.farm_name && (
                            <Chip
                              label={notif.farm_name}
                              size="small" variant="outlined"
                              sx={{ height: 18, fontSize: '0.65rem' }}
                            />
                          )}
                          <Typography variant="caption" color="text.disabled">
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

      {/* ── Settings drawer (opens from settings icon) ──────────────── */}
      <Drawer
        anchor="right"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        PaperProps={{ sx: { width: { xs: '100vw', sm: 400 } } }}
      >
        {/* Drawer header */}
        <AppBar position="static" elevation={0}
          sx={{ bgcolor: '#0f3d2e', color: 'white' }}>
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Typography variant="h6" fontWeight={600}>
              {isEn ? 'Notification Settings' : 'Litaelo tsa Litemoso'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {saving && <CircularProgress size={18} sx={{ color: 'white' }} />}
              {saved && (
                <Chip
                  label={isEn ? '✓ Saved' : '✓ Bolokiloe'}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '0.75rem' }}
                />
              )}
              <IconButton onClick={() => setSettingsOpen(false)} sx={{ color: 'white' }}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Settings list */}
        <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
          {settings ? (
            <>
              <List disablePadding>
                {settingRows.map((row, idx) => (
                  <React.Fragment key={row.key}>
                    <ListItem disablePadding sx={{ py: 1.5 }}>
                      <ListItemIcon sx={{ color: theme.palette.primary.main, minWidth: 42 }}>
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

              {/* Push subscribe */}
              {pushSupported && settings?.push_enabled && (
                <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {isEn
                      ? 'Enable browser push to receive alerts even when the app is closed.'
                      : 'Khetha ho kenngoa ha litemoso ho fumana litemoso le ha app e koaliloe.'}
                  </Typography>
                  {pushSubscribed ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip
                        label={isEn ? '✓ Push active' : '✓ E sebetsa'}
                        color="success" size="small"
                      />
                      <Button size="small" variant="outlined" color="error"
                        onClick={unsubscribeFromPush}>
                        {isEn ? 'Disable' : 'Tima'}
                      </Button>
                    </Box>
                  ) : (
                    <Button
                      variant="contained" startIcon={<PushIcon />}
                      onClick={subscribeToPush} fullWidth
                    >
                      {isEn ? 'Enable push notifications' : 'Khetha litemoso tsa sebautla'}
                    </Button>
                  )}
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}
        </Box>
      </Drawer>
    </Container>
  );
};

export default NotificationsPage;