// src/config/api.config.js
// Single source of truth for all service base URLs.

const config = {
  // Planting Guide - FastAPI on :3001
  plantingGuide: process.env.REACT_APP_PLANTING_GUIDE_URL || 'http://localhost:3001/api',

  // Chat - Node gateway on :3002
  chatService: process.env.REACT_APP_CHAT_SERVICE_URL || 'http://localhost:3002/api',

  // Weather - FastAPI on :8002  ← was wrongly hitting :8000
  weatherService: process.env.REACT_APP_WEATHER_SERVICE_URL || 'http://localhost:8002',

  // Pest Control - FastAPI on :8001
  pestControlService: process.env.REACT_APP_PEST_CONTROL_SERVICE_URL || 'http://localhost:8001',

  // Profile Service - FastAPI on : 8003
  profileService: process.env.REACT_APP_PROFILE_SERVICE_URL || 'http://localhost:8003',
};

// Named exports consumed by services/api.js
export const WEATHER_SERVICE_URL  = config.weatherService;
export const CHAT_SERVICE_URL     = config.chatService;
export const PLANTING_SERVICE_URL = config.plantingGuide;
export const PEST_SERVICE_URL     = config.pestControlService;
export const PROFILE_SERVICE_URL = config.profileService;

export default config;