// src/context/NotificationContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

const NOTIF_SERVICE_URL = process.env.REACT_APP_NOTIFICATION_SERVICE_URL || 'http://localhost:8004';
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications]   = useState([]);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [loading, setLoading]               = useState(false);
  const [pushSupported, setPushSupported]   = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const pollRef = useRef(null);

  const farmerId = user?.id;

  // ── API helpers ────────────────────────────────────────────────────────────

  const apiFetch = useCallback(async (path, options = {}) => {
    if (!farmerId) return null;
    try {
      const res = await fetch(
        `${NOTIF_SERVICE_URL}${path}${path.includes('?') ? '&' : '?'}farmer_id=${farmerId}`,
        { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } }
      );
      if (!res.ok) return null;
      // DELETE responses may return JSON or empty
      const text = await res.text();
      return text ? JSON.parse(text) : {};
    } catch {
      return null;
    }
  }, [farmerId]);

  // ── Fetch unread count (lightweight — polled every 5 min) ─────────────────

  const fetchUnreadCount = useCallback(async () => {
    const data = await apiFetch('/notifications/unread-count');
    if (data !== null) setUnreadCount(data.count ?? 0);
  }, [apiFetch]);

  // ── Fetch full notification list ───────────────────────────────────────────

  const fetchNotifications = useCallback(async (type = null, unreadOnly = false) => {
    setLoading(true);
    let path = '/notifications/?limit=50';
    if (type) path += `&type=${type}`;
    if (unreadOnly) path += `&unread_only=true`;
    const data = await apiFetch(path);
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
    setLoading(false);
  }, [apiFetch]);

  // ── Mark read ──────────────────────────────────────────────────────────────

  const markRead = useCallback(async (notificationId) => {
    await apiFetch(`/notifications/${notificationId}/read`, { method: 'POST' });
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [apiFetch]);

  const markAllRead = useCallback(async () => {
    await apiFetch('/notifications/read-all', { method: 'POST' });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [apiFetch]);

  // ── Delete a single notification ───────────────────────────────────────────

  const deleteNotification = useCallback(async (notificationId) => {
    const result = await apiFetch(`/notifications/${notificationId}`, { method: 'DELETE' });
    if (result !== null) {
      setNotifications(prev => {
        const target = prev.find(n => n.id === notificationId);
        const wasUnread = target && !target.is_read;
        if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
        return prev.filter(n => n.id !== notificationId);
      });
    }
  }, [apiFetch]);

  // ── Delete all notifications (optionally filtered by type) ─────────────────

  const deleteAllNotifications = useCallback(async (type = undefined) => {
    const path = type
      ? `/notifications/clear-all?type=${encodeURIComponent(type)}`
      : '/notifications/clear-all';
    const result = await apiFetch(path, { method: 'DELETE' });
    if (result !== null) {
      if (type) {
        setNotifications(prev => {
          const removed = prev.filter(n => n.type === type && !n.is_read).length;
          setUnreadCount(c => Math.max(0, c - removed));
          return prev.filter(n => n.type !== type);
        });
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    }
  }, [apiFetch]);

  // ── Settings ───────────────────────────────────────────────────────────────

  const getSettings = useCallback(() => apiFetch('/notifications/settings'), [apiFetch]);

  const updateSettings = useCallback(async (updates) => {
    return apiFetch('/notifications/settings', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }, [apiFetch]);

  // ── Push notifications ─────────────────────────────────────────────────────

  const checkPushSupport = useCallback(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setPushSupported(supported);
    return supported;
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (!pushSupported || !farmerId) return false;
    try {
      const keyData = await apiFetch('/push/vapid-public-key');
      if (!keyData?.public_key) {
        console.warn('[Push] No VAPID key available — stub mode');
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.public_key),
      });
      const sub = subscription.toJSON();
      await apiFetch('/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        }),
      });
      setPushSubscribed(true);
      return true;
    } catch (err) {
      console.error('[Push] Subscribe failed:', err);
      return false;
    }
  }, [pushSupported, farmerId, apiFetch]);

  const unsubscribeFromPush = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiFetch(
          `/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`,
          { method: 'DELETE' }
        );
        await sub.unsubscribe();
      }
      setPushSubscribed(false);
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err);
    }
  }, [apiFetch]);

  // ── Weather alert trigger (called from Dashboard/WeatherAlerts) ────────────

  const reportWeatherAlert = useCallback(async (alert) => {
    if (!farmerId) return;
    try {
      await fetch(`${NOTIF_SERVICE_URL}/internal/weather-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...alert, farmer_id: farmerId }),
      });
      await fetchUnreadCount();
    } catch (err) {
      console.warn('[Notifications] Weather alert report failed:', err.message);
    }
  }, [farmerId, fetchUnreadCount]);

  // ── Polling ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated || !farmerId) {
      setNotifications([]);
      setUnreadCount(0);
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    fetchUnreadCount();
    fetchNotifications();
    checkPushSupport();

    pollRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);

    const onFocus = () => fetchUnreadCount();
    window.addEventListener('focus', onFocus);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, [isAuthenticated, farmerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    notifications,
    unreadCount,
    loading,
    pushSupported,
    pushSubscribed,
    fetchNotifications,
    fetchUnreadCount,
    markRead,
    markAllRead,
    deleteNotification,
    deleteAllNotifications,
    getSettings,
    updateSettings,
    subscribeToPush,
    unsubscribeFromPush,
    reportWeatherAlert,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}