// src/services/offlineService.js
// Offline / service-worker support.
// Registers which API endpoints are cacheable and defines fallback
// strategies for each service when the device is offline.
//
// Weather endpoints are added here so that:
//  - The last successful forecast / current conditions are served from
//    Cache Storage when the device has no network.
//  - Weather alerts are served stale rather than showing an error.
//
// Strategy summary:
//  - Chat, planting, weather data → network-first, cache fallback
//  - Static assets → cache-first
//  - Alert history → stale-while-revalidate (ok to show yesterday's alerts)

import { WEATHER_SERVICE_URL, CHAT_SERVICE_URL, PLANTING_SERVICE_URL } from '../config/api.config';

// ---------------------------------------------------------------------------
// Cache names — bump the version to invalidate on next deploy
// ---------------------------------------------------------------------------
const CACHE_VERSION   = 'v1';
const CACHE_STATIC    = `mosupisi-static-${CACHE_VERSION}`;
const CACHE_API       = `mosupisi-api-${CACHE_VERSION}`;

// ---------------------------------------------------------------------------
// URL prefixes that should be cached when fetched successfully
// ---------------------------------------------------------------------------
export const CACHEABLE_API_PREFIXES = [
  // Weather service — cache current, forecast, agro-climate
  `${WEATHER_SERVICE_URL}/api/weather/`,
  `${WEATHER_SERVICE_URL}/api/alerts/history`,
  `${WEATHER_SERVICE_URL}/api/sources/status`,

  // Planting guide
  `${PLANTING_SERVICE_URL}/api/plantings`,

  // Chat history (read-only; message sends are not cached)
  `${CHAT_SERVICE_URL}/api/chat/history`,
];

// ---------------------------------------------------------------------------
// TTLs for each cache namespace (milliseconds)
// Keep aligned with the weather service SQLite cache TTLs in aggregator.py:
//   current   = 30 min   → CACHE_TTL_CURRENT_MINUTES  = 30
//   forecast  = 3 hr     → CACHE_TTL_FORECAST_MINUTES = 180
//   agro      = 24 hr    → CACHE_TTL_AGRO_MINUTES     = 1440
// ---------------------------------------------------------------------------
export const CACHE_TTL_MS = {
  weather_current:  30  * 60 * 1000,   //  30 minutes
  weather_forecast: 3   * 60 * 60 * 1000, //  3 hours
  weather_agro:     24  * 60 * 60 * 1000, // 24 hours
  weather_alerts:   60  * 60 * 1000,   //  1 hour (alert history)
  sources_status:   5   * 60 * 1000,   //  5 minutes
  planting:         24  * 60 * 60 * 1000, // 24 hours (rarely changes)
  chat_history:     60  * 60 * 1000,   //  1 hour
};

// ---------------------------------------------------------------------------
// getCacheTTL — pick the right TTL for a request URL
// ---------------------------------------------------------------------------
export function getCacheTTL(url) {
  if (url.includes('/api/weather/current'))     return CACHE_TTL_MS.weather_current;
  if (url.includes('/api/weather/agro-climate'))return CACHE_TTL_MS.weather_agro;
  if (url.includes('/api/weather/'))            return CACHE_TTL_MS.weather_forecast;
  if (url.includes('/api/alerts/history'))      return CACHE_TTL_MS.weather_alerts;
  if (url.includes('/api/sources/status'))      return CACHE_TTL_MS.sources_status;
  if (url.includes('/api/plantings'))           return CACHE_TTL_MS.planting;
  if (url.includes('/api/chat/history'))        return CACHE_TTL_MS.chat_history;
  return 60 * 60 * 1000; // default: 1 hour
}

// ---------------------------------------------------------------------------
// isCacheable — should this request be stored in Cache Storage?
// Only GET requests (or the POST-like weather fetches used as GETs) are cached.
// ---------------------------------------------------------------------------
export function isCacheable(url, method = 'GET') {
  // POST to /api/weather/* is used for fetching (not mutating), so cache it
  const isWeatherFetch = method === 'POST' && url.includes(`${WEATHER_SERVICE_URL}/api/weather/`);
  const isGetRequest   = method === 'GET';

  if (!isGetRequest && !isWeatherFetch) return false;
  return CACHEABLE_API_PREFIXES.some(prefix => url.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// isOnline — simple connectivity check
// ---------------------------------------------------------------------------
export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

// ---------------------------------------------------------------------------
// cachedFetch — network-first with cache fallback + automatic cache write
//
// Usage:
//   const data = await cachedFetch(url, fetchOptions, cacheKey?);
//
// If online   → fetch from network, write to cache, return fresh data
// If offline  → return cached entry if available, else throw
// If fetch fails → return cached entry if available, else rethrow
// ---------------------------------------------------------------------------
export async function cachedFetch(url, options = {}, cacheKey = null) {
  const key = cacheKey || url;

  // Attempt network
  if (isOnline()) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        const clone = response.clone();
        // Write to Cache Storage asynchronously
        caches.open(CACHE_API).then(cache => {
          // Wrap with timestamp header for TTL enforcement
          clone.json().then(body => {
            const stamped = new Response(JSON.stringify(body), {
              headers: {
                'Content-Type':  'application/json',
                'X-Cached-At':   Date.now().toString(),
                'X-Cache-TTL':   getCacheTTL(url).toString(),
              },
            });
            cache.put(key, stamped);
          }).catch(() => {}); // ignore serialisation errors
        }).catch(() => {});
        return response.json();
      }
    } catch (networkError) {
      console.warn(`[offlineService] Network error for ${url}:`, networkError.message);
      // Fall through to cache
    }
  }

  // Cache fallback
  try {
    const cache    = await caches.open(CACHE_API);
    const cached   = await cache.match(key);
    if (cached) {
      const cachedAt = parseInt(cached.headers.get('X-Cached-At') || '0', 10);
      const ttl      = parseInt(cached.headers.get('X-Cache-TTL')  || '0', 10);
      const age      = Date.now() - cachedAt;
      const stale    = ttl > 0 && age > ttl;

      if (!stale) {
        console.info(`[offlineService] Serving from cache (age ${Math.round(age / 1000)}s): ${url}`);
        return cached.json();
      }
      // Even if stale, use it when offline — better than nothing
      if (!isOnline()) {
        console.warn(`[offlineService] Serving stale cache (age ${Math.round(age / 1000)}s, offline): ${url}`);
        return cached.json();
      }
    }
  } catch (cacheError) {
    console.warn('[offlineService] Cache read error:', cacheError.message);
  }

  throw new Error(`[offlineService] No network and no cache available for: ${url}`);
}

// ---------------------------------------------------------------------------
// Offline fallback data shapes — returned when both network and cache fail.
// These keep the UI from crashing entirely when the device is offline and
// the cache is cold.
// ---------------------------------------------------------------------------
export const OFFLINE_FALLBACKS = {
  weather_current: {
    latitude:        -29.3167,
    longitude:        27.4833,
    location_name:   'Maseru (offline)',
    temperature_c:    null,
    humidity_pct:     null,
    wind_speed_ms:    null,
    description:     'Weather data unavailable offline',
    source:          'aggregated',
    fetched_at:       new Date().toISOString(),
    _offline:         true,
  },
  weather_forecast: {
    latitude:        -29.3167,
    longitude:        27.4833,
    location_name:   'Maseru (offline)',
    days:             [],
    source:          'aggregated',
    fetched_at:       new Date().toISOString(),
    _offline:         true,
  },
  alerts: [],
};

// ---------------------------------------------------------------------------
// registerOfflineListeners — call once in your app entry point (index.js)
// Displays an OfflineBanner when connectivity changes.
// ---------------------------------------------------------------------------
export function registerOfflineListeners(onOffline, onOnline) {
  if (typeof window === 'undefined') return;
  window.addEventListener('offline', onOffline);
  window.addEventListener('online',  onOnline);
  return () => {
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('online',  onOnline);
  };
}

// ---------------------------------------------------------------------------
// clearExpiredCache — call periodically (e.g. on app focus) to keep
// Cache Storage lean. Removes entries whose TTL has elapsed.
// ---------------------------------------------------------------------------
export async function clearExpiredCache() {
  try {
    const cache   = await caches.open(CACHE_API);
    const keys    = await cache.keys();
    const now     = Date.now();
    let   cleared = 0;
    for (const request of keys) {
      const response = await cache.match(request);
      if (!response) continue;
      const cachedAt = parseInt(response.headers.get('X-Cached-At') || '0', 10);
      const ttl      = parseInt(response.headers.get('X-Cache-TTL')  || '0', 10);
      if (ttl > 0 && now - cachedAt > ttl) {
        await cache.delete(request);
        cleared++;
      }
    }
    if (cleared > 0) console.info(`[offlineService] Cleared ${cleared} expired cache entries`);
  } catch (err) {
    console.warn('[offlineService] clearExpiredCache error:', err.message);
  }
}