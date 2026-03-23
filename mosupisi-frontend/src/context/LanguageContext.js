import React, { createContext, useState, useContext, useEffect } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('mosupisi_language');
    return saved || 'en'; // Default to English
  });

  useEffect(() => {
    localStorage.setItem('mosupisi_language', language);
    document.documentElement.lang = language;
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'st' : 'en');
  };

  const t = (key) => {
    // This is a simple translation function - in production, use i18next
    const translations = {
      en: {
        'app.name': 'Mosupisi',
        'nav.dashboard': 'Dashboard',
        'nav.chat': 'Chat',
        'nav.profile': 'Profile',
        'nav.weather': 'Weather',
        'nav.planting': 'Planting Guide',
        'nav.pest': 'Pest Control',
        'nav.logout': 'Logout',
        'nav.login': 'Login',
        'nav.register': 'Register',
        'welcome': 'Welcome',
        'offline': 'You are offline',
        'online': 'You are back online',
        'weather.title': 'Weather & Alerts',
        'chat.title': 'Ask Mosupisi',
        'chat.input': 'Type your question...',
        'chat.send': 'Send',
        'profile.title': 'Farmer Profile',
        'profile.mobile': 'Mobile Number',
        'profile.region': 'Region',
        'profile.crops': 'Crops',
        'profile.language': 'Preferred Language',
        'profile.update': 'Update Profile',
        'login.title': 'Login to Mosupisi',
        'login.mobile': 'Mobile Number',
        'login.password': 'Password',
        'login.button': 'Login',
        'register.title': 'Register as Farmer',
        'register.name': 'Full Name',
        'register.mobile': 'Mobile Number',
        'register.region': 'Region',
        'register.crops': 'Select Crops',
        'register.language': 'Preferred Language',
        'register.button': 'Register',
        'maize': 'Maize',
        'sorghum': 'Sorghum',
        'legumes': 'Legumes',
        'regions.maseru': 'Maseru',
        'regions.leribe': 'Leribe',
        'regions.mafeteng': 'Mafeteng',
        'regions.mohaleshoek': "Mohale's Hoek",
        'regions.quthing': 'Quthing',
        'regions.buthabuthe': 'Butha-Buthe',
        'regions.mokhotlong': 'Mokhotlong',
        'regions.thabatseka': "Thaba-Tseka",
      },
      st: {
        'app.name': 'Mosupisi',
        'nav.dashboard': 'Diboto',
        'nav.chat': 'Puisano',
        'nav.profile': 'Boitsebiso',
        'nav.weather': 'Boemo ba Leholimo',
        'nav.planting': 'Tataiso ea Ho Jala',
        'nav.pest': 'Taolo ea Likokonyana',
        'nav.logout': 'Tsoa',
        'nav.login': 'Kena',
        'nav.register': 'Ingodisetse',
        'welcome': 'Lumela',
        'offline': 'Ha u hokahane le inthanete',
        'online': 'U hokahane le inthanete hape',
        'weather.title': 'Boemo ba Leholimo le Litemoso',
        'chat.title': 'Botsa Mosupisi',
        'chat.input': 'Ngola potso ea hau...',
        'chat.send': 'Romela',
        'profile.title': 'Boitsebiso ba Sehoai',
        'profile.mobile': 'Nomoro ea Mohala',
        'profile.region': 'Setereke',
        'profile.crops': 'Lijalo',
        'profile.language': 'Puo eo u e Ratang',
        'profile.update': 'Ntlafatsa Boitsebiso',
        'login.title': 'Kena ho Mosupisi',
        'login.mobile': 'Nomoro ea Mohala',
        'login.password': 'Phasewete',
        'login.button': 'Kena',
        'register.title': 'Ingodisetse joalo ka Sehoai',
        'register.name': 'Lebitso le Felletseng',
        'register.mobile': 'Nomoro ea Mohala',
        'register.region': 'Setereke',
        'register.crops': 'Khetha Lijalo',
        'register.language': 'Puo eo u e Ratang',
        'register.button': 'Ingodisetse',
        'maize': 'Poone',
        'sorghum': 'Mabele',
        'legumes': 'Linaoa',
        'regions.maseru': 'Maseru',
        'regions.leribe': 'Leribe',
        'regions.mafeteng': 'Mafeteng',
        'regions.mohaleshoek': "Mohale's Hoek",
        'regions.quthing': 'Quthing',
        'regions.buthabuthe': 'Butha-Buthe',
        'regions.mokhotlong': 'Mokhotlong',
        'regions.thabatseka': "Thaba-Tseka",
      }
    };
    
    return translations[language]?.[key] || key;
  };

  const value = {
    language,
    setLanguage,
    toggleLanguage,
    t
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};