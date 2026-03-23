import axios from 'axios';

// Base API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mosupisi_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('mosupisi_token');
      localStorage.removeItem('mosupisi_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API service functions
export const apiService = {
  // Auth endpoints
  auth: {
    login: (mobile, password) => 
      api.post('/api/auth/login', { mobile, password }),
    
    register: (userData) => 
      api.post('/api/auth/register', userData),
    
    logout: () => 
      api.post('/api/auth/logout'),
    
    verifyToken: () => 
      api.get('/api/auth/verify'),
  },

  // Query endpoints
  query: {
    send: (question, language) => 
      api.post('/api/query', { question, language }),
    
    getHistory: (limit = 20) => 
      api.get(`/api/query/history?limit=${limit}`),
    
    getById: (id) => 
      api.get(`/api/query/${id}`),
  },

  // Weather endpoints
  weather: {
    getCurrent: () => 
      api.get('/api/weather/current'),
    
    getForecast: (days = 7) => 
      api.get(`/api/weather/forecast?days=${days}`),
    
    getAlerts: () => 
      api.get('/api/weather/alerts'),
  },

  // Profile endpoints
  profile: {
    get: () => 
      api.get('/api/profile'),
    
    update: (data) => 
      api.put('/api/profile', data),
    
    getCrops: () => 
      api.get('/api/profile/crops'),
  },

  // Knowledge base endpoints
  knowledge: {
    search: (query, crop) => 
      api.get(`/api/knowledge/search?q=${query}&crop=${crop || ''}`),
    
    getByCrop: (crop) => 
      api.get(`/api/knowledge/crop/${crop}`),
    
    getBulletins: () => 
      api.get('/api/knowledge/bulletins'),
  },
};

// Mock API for development (when backend is not ready)
export const mockApi = {
  // Simulate API delay
  delay: (ms = 1000) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock implementations
  auth: {
    login: async (mobile, password) => {
      await mockApi.delay();
      if (mobile === '266-1234-5678') {
        return {
          data: {
            success: true,
            token: 'mock-token-12345',
            user: {
              id: 1,
              name: 'Ntate Thabo',
              mobile: '266-1234-5678',
              region: 'Maseru',
              crops: ['maize', 'sorghum'],
              language: 'en'
            }
          }
        };
      }
      throw new Error('Invalid credentials');
    },
    
    register: async (userData) => {
      await mockApi.delay();
      return {
        data: {
          success: true,
          token: 'mock-token-12345',
          user: { id: Date.now(), ...userData }
        }
      };
    },
  },

  query: {
    send: async (question, language) => {
      await mockApi.delay(1500);
      const responses = {
        en: {
          maize: "Plant maize in October-November when rains start. Use certified seeds and apply fertilizer.",
          sorghum: "Sorghum does well in dry areas. Plant in November-December.",
          default: "Thank you for your question. Based on agricultural guidelines for Lesotho, I recommend consulting your local extension officer for specific advice."
        },
        st: {
          maize: "Jala poone ka Mphalane-Pulungoana ha lipula li qala. Sebelisa peo e netefalitsoeng le manyolo.",
          sorghum: "Mabele a hantle libakeng tse omileng. Jala ka Pulungoana-Tšitoe.",
          default: "Kea leboha potso ea hau. Ho latela tataiso ea temo Lesotho, ke khothaletsa ho buisana le ofisiri ea temo sebakeng sa heno."
        }
      };

      const crop = question.toLowerCase().includes('maize') ? 'maize' : 
                   question.toLowerCase().includes('sorghum') ? 'sorghum' : 'default';
      
      return {
        data: {
          answer: responses[language][crop] || responses[language].default,
          sources: ['Lesotho Agricultural Guide 2025', 'Ministry of Agriculture'],
          timestamp: new Date().toISOString()
        }
      };
    },
  },

  weather: {
    getForecast: async () => {
      await mockApi.delay();
      return {
        data: {
          forecast: [
            { date: new Date().toISOString().split('T')[0], temp: { min: 15, max: 28 }, rainChance: 20, condition: 'sunny' },
            { date: new Date(Date.now() + 86400000).toISOString().split('T')[0], temp: { min: 14, max: 26 }, rainChance: 60, condition: 'rainy' },
          ]
        }
      };
    },
  },
};

// Choose which API to use based on environment
export const activeApi = process.env.REACT_APP_USE_MOCK === 'true' ? mockApi : apiService;

export default api;