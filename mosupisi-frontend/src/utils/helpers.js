// Date formatting helpers
export const formatDate = (date, format = 'short') => {
  if (!date) return '';
  
  const d = new Date(date);
  
  if (format === 'short') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (format === 'long') {
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } else if (format === 'time') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else if (format === 'full') {
    return d.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } else if (format === 'iso') {
    return d.toISOString();
  } else if (format === 'date') {
    return d.toISOString().split('T')[0];
  }
  
  return d.toLocaleDateString();
};

// Mobile number formatting (Lesotho format)
export const formatMobile = (mobile) => {
  if (!mobile) return '';
  
  // Remove all non-numeric characters
  const cleaned = mobile.replace(/\D/g, '');
  
  // Format as 266-XXXX-XXXX
  if (cleaned.length === 12) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 8) {
    return `266-${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  } else if (cleaned.length === 9 && cleaned.startsWith('266')) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  
  return mobile;
};

// Validate mobile number (Lesotho format)
export const isValidMobile = (mobile) => {
  if (!mobile) return false;
  const cleaned = mobile.replace(/\D/g, '');
  // Lesotho mobile numbers: 8 digits or 12 digits with 266 prefix
  return cleaned.length === 8 || (cleaned.length === 12 && cleaned.startsWith('266'));
};

// Crop name mapping
export const getCropName = (cropId, language = 'en') => {
  const cropNames = {
    en: {
      maize: 'Maize',
      sorghum: 'Sorghum',
      legumes: 'Legumes',
      beans: 'Beans',
      peas: 'Peas',
      wheat: 'Wheat',
      barley: 'Barley'
    },
    st: {
      maize: 'Poone',
      sorghum: 'Mabele',
      legumes: 'Linaoa',
      beans: 'Linaoa',
      peas: 'Lierekisi',
      wheat: 'Koro',
      barley: 'Haele'
    }
  };
  
  return cropNames[language]?.[cropId] || cropId;
};

// Region name mapping
export const getRegionName = (regionId, language = 'en') => {
  const regionNames = {
    en: {
      maseru: 'Maseru',
      leribe: 'Leribe',
      mafeteng: 'Mafeteng',
      mohaleshoek: "Mohale's Hoek",
      quthing: 'Quthing',
      buthabuthe: 'Butha-Buthe',
      mokhotlong: 'Mokhotlong',
      thabatseka: "Thaba-Tseka",
      'mohale\'s hoek': "Mohale's Hoek",
      'butha-buthe': 'Butha-Buthe',
      'thaba-tseka': "Thaba-Tseka"
    },
    st: {
      maseru: 'Maseru',
      leribe: 'Leribe',
      mafeteng: 'Mafeteng',
      mohaleshoek: "Mohale's Hoek",
      quthing: 'Quthing',
      buthabuthe: 'Butha-Buthe',
      mokhotlong: 'Mokhotlong',
      thabatseka: "Thaba-Tseka",
      'mohale\'s hoek': "Mohale's Hoek",
      'butha-buthe': 'Butha-Buthe',
      'thaba-tseka': "Thaba-Tseka"
    }
  };
  
  const key = regionId?.toLowerCase().replace(/\s+/g, '').replace(/'/g, '');
  return regionNames[language]?.[key] || regionId;
};

// Weather condition icons and names
export const getWeatherIcon = (condition) => {
  const icons = {
    sunny: '☀️',
    'clear': '☀️',
    'clear sky': '☀️',
    rainy: '🌧️',
    rain: '🌧️',
    'light rain': '🌦️',
    'moderate rain': '🌧️',
    'heavy rain': '🌧️',
    cloudy: '☁️',
    'few clouds': '⛅',
    'scattered clouds': '☁️',
    'broken clouds': '☁️',
    'overcast clouds': '☁️',
    stormy: '⛈️',
    thunderstorm: '⛈️',
    'partly cloudy': '⛅',
    fog: '🌫️',
    mist: '🌫️',
    snow: '❄️',
    default: '🌤️'
  };
  
  return icons[condition?.toLowerCase()] || icons.default;
};

// Get weather condition name in selected language
export const getWeatherConditionName = (condition, language = 'en') => {
  const names = {
    en: {
      sunny: 'Sunny',
      clear: 'Clear',
      rainy: 'Rainy',
      rain: 'Rain',
      cloudy: 'Cloudy',
      stormy: 'Stormy',
      thunderstorm: 'Thunderstorm',
      'partly cloudy': 'Partly Cloudy',
      fog: 'Fog',
      mist: 'Mist',
      snow: 'Snow'
    },
    st: {
      sunny: 'Chesa',
      clear: 'Lehodimo le hlakile',
      rainy: 'Pula',
      rain: 'Pula',
      cloudy: 'Khoalifi',
      stormy: 'Sefefo',
      thunderstorm: 'Sefefo sa lialuma',
      'partly cloudy': 'Khoalifi hanyane',
      fog: 'Moholi',
      mist: 'Moholi',
      snow: 'Lehloa'
    }
  };
  
  const key = condition?.toLowerCase();
  return names[language]?.[key] || names[language]?.default || condition;
};

// Get weather advice based on conditions
export const getWeatherAdvice = (weather, language = 'en') => {
  if (!weather) return '';
  
  const advice = {
    en: {
      high_rain: 'Heavy rain expected. Ensure drainage channels are clear and harvest ripe crops.',
      low_rain: 'Low rainfall expected. Consider irrigation if needed and conserve water.',
      high_temp: 'High temperatures expected. Provide shade for seedlings and increase irrigation.',
      low_temp: 'Cool temperatures expected. Protect sensitive crops from frost.',
      storm: 'Storm warning! Secure livestock, harvest ripe crops, and seek shelter.',
      windy: 'Strong winds expected. Support tall crops and secure loose items.',
      fog: 'Foggy conditions. Be careful when traveling and check crops for moisture.',
      default: 'Normal weather conditions. Continue with regular farming activities.'
    },
    st: {
      high_rain: 'Pula e matla e lebelletsoe. Hlakola likanale tsa metsi le ho kotula lijalo tse butsoitseng.',
      low_rain: 'Pula e fokotsehileng e lebelletsoe. Nahana ka ho nosetsa le ho boloka metsi.',
      high_temp: 'Mocheso o phahameng o lebelletsoe. Sireletsa lijalo tse nyane le ho nosetsa haholo.',
      low_temp: 'Mocheso o tlase o lebelletsoe. Sireletsa lijalo tse thathamelang seramela.',
      storm: 'Temoso ea sefefo! Boloka liphoofolo, kotula lijalo tse butsoitseng, le batla setšabelo.',
      windy: 'Moea o matla o lebelletsoe. Tšehetsa lijalo tse telele le ho sireletsa lintho.',
      fog: 'Moholi o lebelletsoe. Eba hlokolosi ha u tsamaea le ho hlahloba lijalo.',
      default: 'Maemo a tloaelehileng a leholimo. Tsoelapele ka mesebetsi ea temo.'
    }
  };
  
  if (weather.rainChance > 70 || weather.rainChance > 70) {
    return advice[language].high_rain;
  } else if (weather.rainChance < 20 && weather.temp?.max > 28) {
    return advice[language].high_temp;
  } else if (weather.condition?.toLowerCase().includes('storm') || weather.condition?.toLowerCase().includes('thunder')) {
    return advice[language].storm;
  } else if (weather.temp?.max < 15) {
    return advice[language].low_temp;
  } else if (weather.rainChance < 20) {
    return advice[language].low_rain;
  } else if (weather.condition?.toLowerCase().includes('wind')) {
    return advice[language].windy;
  } else if (weather.condition?.toLowerCase().includes('fog') || weather.condition?.toLowerCase().includes('mist')) {
    return advice[language].fog;
  }
  
  return advice[language].default;
};

// Generate random ID
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

// Debounce function for search inputs
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function for rate limiting
export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Truncate text with ellipsis
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substr(0, maxLength) + '...';
};

// Check if string contains Sesotho characters
export const containsSesotho = (text) => {
  if (!text) return false;
  const sesothoChars = /[áàâäéèêëíìîïóòôöúùûü]/i;
  return sesothoChars.test(text);
};

// Parse query parameters from URL
export const getQueryParams = () => {
  const params = new URLSearchParams(window.location.search);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
};

// Format file size
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Deep clone object
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (obj instanceof Object) {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  return obj;
};

// Compare two objects (shallow)
export const isEqual = (obj1, obj2) => {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!obj2.hasOwnProperty(key) || obj1[key] !== obj2[key]) return false;
  }
  
  return true;
};

// Group array by key
export const groupBy = (array, key) => {
  if (!array || !Array.isArray(array)) return {};
  
  return array.reduce((result, item) => {
    const groupKey = item[key];
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {});
};

// Sort array by date
export const sortByDate = (array, dateField = 'date', ascending = false) => {
  if (!array || !Array.isArray(array)) return [];
  
  return [...array].sort((a, b) => {
    const dateA = new Date(a[dateField] || a);
    const dateB = new Date(b[dateField] || b);
    return ascending ? dateA - dateB : dateB - dateA;
  });
};

// Validate email
export const isValidEmail = (email) => {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Get browser language
export const getBrowserLanguage = () => {
  const lang = navigator.language || navigator.userLanguage;
  // Check if browser language is Sesotho
  if (lang.startsWith('st') || lang.startsWith('st-LS')) {
    return 'st';
  }
  return 'en';
};

// Check if device is mobile
export const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Get device type
export const getDeviceType = () => {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
};

// Retry function with exponential backoff
export const retry = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const waitTime = delay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

// Calculate distance between two coordinates (Haversine formula)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Convert temperature Celsius to Fahrenheit
export const celsiusToFahrenheit = (celsius) => {
  return (celsius * 9/5) + 32;
};

// Convert temperature Fahrenheit to Celsius
export const fahrenheitToCelsius = (fahrenheit) => {
  return (fahrenheit - 32) * 5/9;
};

// Get wind direction from degrees
export const getWindDirection = (degrees) => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
};

// Format number with commas
export const formatNumber = (num) => {
  if (num === null || num === undefined) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Capitalize first letter of each word
export const capitalizeWords = (str) => {
  if (!str) return '';
  return str.replace(/\b\w/g, char => char.toUpperCase());
};

// Slugify string for URLs
export const slugify = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
};

// Get file extension
export const getFileExtension = (filename) => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
};

// Check if string is JSON
export const isJsonString = (str) => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

// Safe JSON parse
export const safeJsonParse = (str, fallback = null) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
};

// Download file from blob
export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Copy to clipboard
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
};

// Get initials from name
export const getInitials = (name) => {
  if (!name) return '';
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Sleep function
export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Check if online
export const isOnline = () => {
  return navigator.onLine;
};

// Add event listener for online/offline
export const onNetworkChange = (callback) => {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
  
  return () => {
    window.removeEventListener('online', () => callback(true));
    window.removeEventListener('offline', () => callback(false));
  };
};

// Get app version from package.json
export const getAppVersion = () => {
  try {
    return process.env.REACT_APP_VERSION || '1.0.0';
  } catch (e) {
    return '1.0.0';
  }
};

// Check if PWA is installed
export const isPwaInstalled = () => {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone === true;
};

// Prompt for PWA installation
export const promptPwaInstall = () => {
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install button or prompt
    const installButton = document.createElement('button');
    installButton.textContent = 'Install App';
    installButton.onclick = async () => {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      deferredPrompt = null;
      installButton.remove();
    };
    
    document.body.appendChild(installButton);
  });
};

export default {
  formatDate,
  formatMobile,
  isValidMobile,
  getCropName,
  getRegionName,
  getWeatherIcon,
  getWeatherConditionName,
  getWeatherAdvice,
  generateId,
  debounce,
  throttle,
  truncateText,
  containsSesotho,
  getQueryParams,
  formatFileSize,
  deepClone,
  isEqual,
  groupBy,
  sortByDate,
  isValidEmail,
  getBrowserLanguage,
  isMobileDevice,
  getDeviceType,
  retry,
  calculateDistance,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  getWindDirection,
  formatNumber,
  capitalizeWords,
  slugify,
  getFileExtension,
  isJsonString,
  safeJsonParse,
  downloadFile,
  copyToClipboard,
  getInitials,
  sleep,
  isOnline,
  onNetworkChange,
  getAppVersion,
  isPwaInstalled,
  promptPwaInstall
};