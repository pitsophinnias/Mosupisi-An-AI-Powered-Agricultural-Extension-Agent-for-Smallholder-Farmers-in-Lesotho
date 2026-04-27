// public/sw.js — Service Worker for Mosupisi push notifications
// Place this file in mosupisi-frontend/public/sw.js

const CACHE_NAME = 'mosupisi-v1';

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// ── Push event — show browser notification ────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'Mosupisi Alert',
      body: event.data.text(),
      severity: 'info',
      url: '/',
    };
  }

  const iconMap = {
    critical: '/icons/alert-critical.png',
    warning:  '/icons/alert-warning.png',
    info:     '/icons/icon-192x192.png',
  };

  const options = {
    body:    payload.body,
    icon:    iconMap[payload.severity] || '/icons/icon-192x192.png',
    badge:   '/icons/badge-72x72.png',
    tag:     payload.tag || `mosupisi-${payload.severity}`,
    data:    { url: payload.url || '/' },
    actions: [
      { action: 'view', title: 'View Details' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    requireInteraction: payload.severity === 'critical',
    vibrate: payload.severity === 'critical' ? [200, 100, 200] : [100],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Mosupisi', options)
  );
});

// ── Notification click — open the app at the right page ───────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';
  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url });
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});