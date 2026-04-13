// src/services/weatherService.js
//
// API layer for the mosupisi-weather-service backend (port 8002).
//
// Strategy:
//   1. Always try the live backend first.
//   2. On success: cache the result in IndexedDB and return it.
//   3. On failure (offline / API down): fall back to the IndexedDB cache
//      and return stale data with an `isStale: true` flag so the UI can
//      show an offline indicator.
//
// All field names match the backend Pydantic schemas exactly:
//   CurrentWeather : temperature_c, feels_like_c, humidity_pct,
//                    wind_speed_ms, rainfall_mm, description, ...
//   DailyForecast  : date, temp_min_c, temp_max_c, humidity_pct,
//                    rainfall_mm, wind_speed_ms, solar_radiation_mj,
//                    description, farming_note
//   WeatherForecast: { latitude, longitude, days: DailyForecast[], source }

import apiConfig from '../config/api.config';
import { dbUtils } from '../db/db';

const BASE = apiConfig.weatherService;  // http://localhost:8002/api

// Default coordinates: Maseru, Lesotho
const DEFAULT_LAT = -29.3167;
const DEFAULT_LON =  27.4833;

// How old (in minutes) cached data can be before we consider it stale
const CURRENT_STALE_MINUTES  = 60;
const FORECAST_STALE_MINUTES = 180;

// ── Helpers ────────────────────────────────────────────────────────────────

function _isStale(fetchedAt, maxMinutes) {
  if (!fetchedAt) return true;
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  return ageMs > maxMinutes * 60 * 1000;
}

async function _post(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Weather API ${path} returned ${response.status}`);
  }
  return response.json();
}

async function _get(path) {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Weather API ${path} returned ${response.status}`);
  }
  return response.json();
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch current weather conditions for a location.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} [locationName]
 * @returns {Promise<{ data: CurrentWeather, isStale: boolean, source: string }>}
 */
export async function getCurrentWeather(
  latitude    = DEFAULT_LAT,
  longitude   = DEFAULT_LON,
  locationName = 'Maseru',
) {
  try {
    const data = await _post('/weather/current', { latitude, longitude, location_name: locationName });
    await dbUtils.cacheCurrentWeather(data);
    return { data, isStale: false, source: data.source };
  } catch (err) {
    console.warn('getCurrentWeather: API unavailable, trying cache.', err.message);
    const cached = await dbUtils.getCurrentWeather();
    if (cached) {
      const stale = _isStale(cached.fetched_at, CURRENT_STALE_MINUTES);
      return { data: cached, isStale: stale, source: cached.source };
    }
    throw new Error('No weather data available — check your connection.');
  }
}

/**
 * Fetch a multi-day forecast, enriched with NASA POWER agro data.
 *
 * @param {number}  latitude
 * @param {number}  longitude
 * @param {number}  days          1–16
 * @param {string}  [locationName]
 * @returns {Promise<{ data: WeatherForecast, isStale: boolean, source: string }>}
 */
export async function getWeatherForecast(
  latitude     = DEFAULT_LAT,
  longitude    = DEFAULT_LON,
  days         = 7,
  locationName = 'Maseru',
) {
  try {
    const data = await _post('/weather/forecast', {
      latitude,
      longitude,
      days,
      location_name: locationName,
    });
    // Cache each day in IndexedDB so offline mode has the full forecast
    if (data.days?.length) {
      await dbUtils.updateWeatherForecast(data.days);
    }
    return { data, isStale: false, source: data.source };
  } catch (err) {
    console.warn('getWeatherForecast: API unavailable, trying cache.', err.message);
    const cachedDays = await dbUtils.getWeatherForecast(days);
    if (cachedDays.length > 0) {
      const oldestFetch = cachedDays[0]?.fetched_at;
      const stale = _isStale(oldestFetch, FORECAST_STALE_MINUTES);
      return {
        data: {
          latitude,
          longitude,
          location_name: locationName,
          days: cachedDays,
          source: 'cache',
        },
        isStale: stale,
        source: 'cache',
      };
    }
    throw new Error('No forecast data available — check your connection.');
  }
}

/**
 * Fetch NASA POWER agrometeorological summary for a date range.
 * Used for crop planning and season analysis.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} startDate  YYYY-MM-DD
 * @param {string} endDate    YYYY-MM-DD
 * @returns {Promise<AgroClimateData>}
 */
export async function getAgroClimate(
  latitude  = DEFAULT_LAT,
  longitude = DEFAULT_LON,
  startDate,
  endDate,
) {
  return _post('/weather/agro-climate', {
    latitude,
    longitude,
    start_date: startDate,
    end_date:   endDate,
  });
}

/**
 * Evaluate current conditions against alert thresholds.
 * Pass the CurrentWeather object returned by getCurrentWeather().
 *
 * @param {CurrentWeather} currentWeather
 * @param {string}         [farmerId]
 * @returns {Promise<WeatherAlert[]>}
 */
export async function evaluateAlerts(currentWeather, farmerId = null) {
  const path = farmerId
    ? `/alerts/evaluate/current?farmer_id=${encodeURIComponent(farmerId)}`
    : '/alerts/evaluate/current';
  return _post(path, currentWeather);
}

/**
 * Get stored alert history for a farmer.
 *
 * @param {string} [farmerId]
 * @param {number} [limit=50]
 * @returns {Promise<WeatherAlert[]>}
 */
export async function getAlertHistory(farmerId = null, limit = 50) {
  const params = new URLSearchParams({ limit });
  if (farmerId) params.set('farmer_id', farmerId);
  return _get(`/alerts/history?${params}`);
}

/**
 * Check which weather sources are available.
 * Useful for showing a data-source indicator in the UI.
 *
 * @returns {Promise<SourceStatus[]>}
 */
export async function getSourceStatus() {
  return _get('/sources/status');
}

// ── Utility: map backend description to icon key ───────────────────────────

/**
 * Convert a backend weather description string to one of:
 * 'sunny' | 'rainy' | 'cloudy' | 'stormy' | 'partly cloudy'
 * so WeatherAlerts.js getWeatherIcon() keeps working unchanged.
 */
export function descriptionToCondition(description = '') {
  const d = description.toLowerCase();
  if (d.includes('thunder') || d.includes('storm')) return 'stormy';
  if (d.includes('rain')    || d.includes('drizzle') || d.includes('shower')) return 'rainy';
  if (d.includes('overcast')) return 'cloudy';
  if (d.includes('partly') || d.includes('few clouds') || d.includes('scattered')) return 'partly cloudy';
  if (d.includes('cloud'))  return 'cloudy';
  if (d.includes('clear')   || d.includes('sunny')) return 'sunny';
  return 'sunny';   // default
}