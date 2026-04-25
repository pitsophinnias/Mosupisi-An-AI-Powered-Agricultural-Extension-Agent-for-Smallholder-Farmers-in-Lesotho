// src/components/Notifications/NotificationPanel.js
import React, { useState } from 'react';
import {
  Box, Typography, IconButton, Divider, Chip, Button,
  List, ListItem, CircularProgress, useTheme,
} from '@mui/material';
import {
  WbSunny as WeatherIcon,
  Agriculture as PlantingIcon,
  BugReport as PestIcon,
  Opacity as SprayIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as CriticalIcon,
  DoneAll as DoneAllIcon,
  Settings as SettingsIcon,
  Notifications as EmptyIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatDistanceToNow } from 'date-fns';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_ICON = {
  weather:      <WeatherIcon sx={{ fontSize: 18 }} />,
  planting:     <PlantingIcon sx={{ fontSize: 18 }} />,
  pest:         <PestIcon sx={{ fontSize: 18 }} />,
  spray_window: <SprayIcon sx={{ fontSize: 18 }} />,
  system:       <InfoIcon sx={{ fontSize: 18 }} />,
};

const SEVERITY_COLOR = {
  info:     '#4CAF50',
  warning:  '#FF9800',
  critical: '#f44336',
};

const SEVERITY_ICON = {
  info:     <InfoIcon sx={{ fontSize: 14 }} />,
  warning:  <WarningIcon sx={{ fontSize: 14 }} />,
  critical: <CriticalIcon sx={{ fontSize: 14 }} />,
};

function timeAgo(dateString) {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return '';
  }
}

function groupByDate(notifications) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups = { Today: [], Yesterday: [], Earlier: [] };

  for (const n of notifications) {
    const d = new Date(n.created_at).toDateString();
    if (d === today) groups.Today.push(n);
    else if (d === yesterday) groups.Yesterday.push(n);
    else groups.Earlier.push(n);
  }
  return groups;
}

// ── Component ─────────────────────────────────────────────────────────────────

const NotificationPanel = ({ onClose }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const {
    notifications, unreadCount, loading,
    markRead, markAllRead, fetchNotifications,
  } = useNotifications();

  const [filter, setFilter] = useState(null); // null = all

  const isEn = language === 'en';

  const filtered = filter
    ? notifications.filter(n => n.type === filter)
    : notifications;

  const groups = groupByDate(filtered);

  const handleNotifClick = async (notif) => {
    if (!notif.is_read) await markRead(notif.id);
    const routes = {
      weather:      '/weather',
      planting:     '/planting-guide',
      pest:         '/pest-control',
      spray_window: '/pest-control',
    };
    const route = routes[notif.type] || '/';
    onClose();
    navigate(route);
  };

  const filterOptions = [
    { key: null,           label: isEn ? 'All' : 'Tsohle' },
    { key: 'weather',      label: isEn ? 'Weather' : 'Leholimo' },
    { key: 'planting',     label: isEn ? 'Planting' : 'Ho Jala' },
    { key: 'pest',         label: isEn ? 'Pests' : 'Likokonyana' },
    { key: 'spray_window', label: isEn ? 'Spray' : 'Ho Ata' },
  ];

  return (
    <Box sx={{ width: { xs: '100vw', sm: 380 }, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {isEn ? 'Notifications' : 'Litemoso'}
          </Typography>
          {unreadCount > 0 && (
            <Chip label={unreadCount} size="small" color="error"
              sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }} />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {unreadCount > 0 && (
            <IconButton size="small" onClick={markAllRead} title={isEn ? 'Mark all read' : 'Bala tsohle'}>
              <DoneAllIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
          <IconButton size="small" onClick={() => { onClose(); navigate('/notifications'); }}
            title={isEn ? 'Settings' : 'Litaelo'}>
            <SettingsIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Type filters */}
      <Box sx={{ px: 2, py: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap',
        borderBottom: `1px solid ${theme.palette.divider}` }}>
        {filterOptions.map(opt => (
          <Chip
            key={String(opt.key)}
            label={opt.label}
            size="small"
            onClick={() => setFilter(opt.key)}
            variant={filter === opt.key ? 'filled' : 'outlined'}
            color={filter === opt.key ? 'primary' : 'default'}
            sx={{ fontSize: '0.72rem', height: 24, cursor: 'pointer' }}
          />
        ))}
      </Box>

      {/* Notification list */}
      <Box sx={{ overflowY: 'auto', flex: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, px: 3 }}>
            <EmptyIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {isEn ? "You're all caught up 🌱" : "Ha ho litemoso tse ncha 🌱"}
            </Typography>
          </Box>
        ) : (
          Object.entries(groups).map(([group, items]) => {
            if (items.length === 0) return null;
            return (
              <Box key={group}>
                <Typography variant="caption" sx={{ px: 2, py: 0.75, display: 'block',
                  color: 'text.secondary', fontWeight: 600, bgcolor: 'action.hover',
                  textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                  {group}
                </Typography>
                {items.map(notif => (
                  <Box
                    key={notif.id}
                    onClick={() => handleNotifClick(notif)}
                    sx={{
                      px: 2, py: 1.5, cursor: 'pointer',
                      borderLeft: `3px solid ${SEVERITY_COLOR[notif.severity] || '#4CAF50'}`,
                      bgcolor: notif.is_read ? 'transparent' : 'action.selected',
                      '&:hover': { bgcolor: 'action.hover' },
                      borderBottom: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      {/* Type icon */}
                      <Box sx={{ color: SEVERITY_COLOR[notif.severity], mt: 0.3, flexShrink: 0 }}>
                        {TYPE_ICON[notif.type] || <InfoIcon sx={{ fontSize: 18 }} />}
                      </Box>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                          <Typography variant="body2" fontWeight={notif.is_read ? 400 : 700}
                            sx={{ lineHeight: 1.3 }}>
                            {notif.title}
                          </Typography>
                          {!notif.is_read && (
                            <Box sx={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                              bgcolor: 'error.main', ml: 'auto' }} />
                          )}
                        </Box>

                        <Typography variant="caption" color="text.secondary"
                          sx={{ display: 'block', lineHeight: 1.4, mb: 0.5 }}>
                          {notif.body}
                        </Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{ color: SEVERITY_COLOR[notif.severity], display: 'flex' }}>
                            {SEVERITY_ICON[notif.severity]}
                          </Box>
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
                            {timeAgo(notif.created_at)}
                          </Typography>
                          {notif.farm_name && (
                            <>
                              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>·</Typography>
                              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
                                {notif.farm_name}
                              </Typography>
                            </>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            );
          })
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ px: 2, py: 1, borderTop: `1px solid ${theme.palette.divider}`, textAlign: 'center' }}>
        <Button size="small" onClick={() => { onClose(); navigate('/notifications'); }}
          sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
          {isEn ? 'View all notifications' : 'Bona litemoso tsohle'}
        </Button>
      </Box>
    </Box>
  );
};

export default NotificationPanel;