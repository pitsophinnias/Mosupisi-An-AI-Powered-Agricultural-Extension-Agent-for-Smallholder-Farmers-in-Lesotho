// src/services/api.js
// Centralised API client for all Mosupisi microservices.
// All base URLs come from api.config.js — change ports there, not here.

import { WEATHER_SERVICE_URL, CHAT_SERVICE_URL, PLANTING_SERVICE_URL } from '../config/api.config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

function jsonPost(url, body) {
  return fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }).then(handleResponse);
}

function jsonGet(url, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return fetch(qs ? `${url}?${qs}` : url).then(handleResponse);
}

// ---------------------------------------------------------------------------
// Chat Service  (Node.js — :3002)
// ---------------------------------------------------------------------------

export const chatApi = {
  sendMessage: (message, conversationId, userId) =>
    jsonPost(`${CHAT_SERVICE_URL}/chat`, { message, conversationId, userId }),

  getHistory: (conversationId) =>
    jsonGet(`${CHAT_SERVICE_URL}/chat/history/${conversationId}`),

  healthCheck: () =>
    jsonGet(`${CHAT_SERVICE_URL}/health`),
};

// ---------------------------------------------------------------------------
// Planting Guide Service  (FastAPI — :3001)
// ---------------------------------------------------------------------------

export const plantingApi = {
  getPlantingGuide: (crop, region) =>
    jsonGet(`${PLANTING_SERVICE_URL}/plantings`, { crop, region }),

  getAllCrops: () =>
    jsonGet(`${PLANTING_SERVICE_URL}/plantings`),
};

// ---------------------------------------------------------------------------
// Weather Service  (FastAPI — :8002)
// ---------------------------------------------------------------------------

export const weatherApi = {
  /**
   * GET current conditions for a lat/lon.
   */
  getCurrent: (latitude, longitude, locationName = null) =>
    jsonPost(`${WEATHER_SERVICE_URL}/api/weather/current`, {
      latitude,
      longitude,
      ...(locationName && { location_name: locationName }),
    }),

  /**
   * GET multi-day forecast for a lat/lon.
   */
  getForecast: (latitude, longitude, days = 7, locationName = null) =>
    jsonPost(`${WEATHER_SERVICE_URL}/api/weather/forecast`, {
      latitude,
      longitude,
      days,
      ...(locationName && { location_name: locationName }),
    }),

  /**
   * GET Maseru 7-day forecast — no body required (dev helper).
   */
  getMaserForecast: (days = 7) =>
    jsonGet(`${WEATHER_SERVICE_URL}/api/weather/forecast/maseru`, { days }),

  /**
   * GET NASA POWER agrometeorological summary for a date range.
   */
  getAgroClimate: (latitude, longitude, startDate, endDate) =>
    jsonPost(`${WEATHER_SERVICE_URL}/api/weather/agro-climate`, {
      latitude,
      longitude,
      start_date: startDate,
      end_date:   endDate,
    }),

  /**
   * Evaluate current conditions for alerts.
   */
  evaluateCurrentAlerts: (currentWeather, farmerId = null) => {
    const params = farmerId ? `?farmer_id=${farmerId}` : '';
    return fetch(`${WEATHER_SERVICE_URL}/api/alerts/evaluate/current${params}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(currentWeather),
    }).then(handleResponse);
  },

  /**
   * Evaluate a forecast for upcoming alerts.
   */
  evaluateForecastAlerts: (forecast, farmerId = null) => {
    const params = farmerId ? `?farmer_id=${farmerId}` : '';
    return fetch(`${WEATHER_SERVICE_URL}/api/alerts/evaluate/forecast${params}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(forecast),
    }).then(handleResponse);
  },

  /**
   * GET stored alert history from SQLite.
   */
  getAlertHistory: (farmerId = null, limit = 50) =>
    jsonGet(`${WEATHER_SERVICE_URL}/api/alerts/history`, {
      ...(farmerId && { farmer_id: farmerId }),
      limit,
    }),

  /**
   * GET status of all configured weather data sources.
   */
  getSourcesStatus: () =>
    jsonGet(`${WEATHER_SERVICE_URL}/api/sources/status`),

  /**
   * GET weather service health.
   */
  healthCheck: () =>
    jsonGet(`${WEATHER_SERVICE_URL}/health`),
};

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

const api = { chat: chatApi, planting: plantingApi, weather: weatherApi };
export default api;