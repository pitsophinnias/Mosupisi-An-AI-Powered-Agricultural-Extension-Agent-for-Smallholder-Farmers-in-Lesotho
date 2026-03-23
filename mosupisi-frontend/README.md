# Mosupisi: AI-Powered Agricultural Extension Agent for Smallholder Farmers in Lesotho

[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![PWA](https://img.shields.io/badge/PWA-Ready-green.svg)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📋 Overview

Mosupisi is a bilingual (Sesotho/English) Progressive Web App (PWA) designed to serve as a digital extension officer for smallholder farmers in Lesotho. The app provides localized, evidence-based crop advice for staple crops like maize, sorghum, and legumes, focusing on planting times, pest management, harvesting, and climate-smart practices.

### 🎯 Key Features

- **Bilingual Interface**: Full support for English and Sesotho
- **Offline-First**: Works without internet connection using IndexedDB caching
- **AI-Powered Chat**: Get instant answers to farming questions
- **Weather Integration**: Local weather forecasts and alerts
- **Crop-Specific Advice**: Tailored recommendations for maize, sorghum, and legumes
- **PWA Ready**: Install on mobile devices like a native app
- **Low-Literacy Friendly**: Large buttons, voice input ready, simple navigation

### 🏗️ Architecture

- **Frontend**: ReactJS 18 with Material-UI components
- **State Management**: Context API for auth and language
- **Local Database**: IndexedDB via Dexie.js for offline storage
- **PWA**: Service workers for caching and offline support
- **API Integration**: Prepared for FastAPI/Python backend

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/mosupisi-frontend.git
cd mosupisi-frontend