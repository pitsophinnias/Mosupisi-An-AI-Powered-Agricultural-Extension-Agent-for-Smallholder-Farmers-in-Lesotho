// src/config/api.config.js

const config = {
  plantingGuide: process.env.REACT_APP_PLANTING_GUIDE_URL || 'http://localhost:3001/api',
  chatService: process.env.REACT_APP_CHAT_SERVICE_URL || 'http://localhost:3002/api',
};

export default config;