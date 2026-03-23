import { db, dbUtils } from '../db/db';

class OfflineService {
  constructor() {
    this.syncInProgress = false;
    this.initSyncListener();
  }

  // Initialize online/offline listeners
  initSyncListener() {
    window.addEventListener('online', () => {
      console.log('Back online - starting sync');
      this.syncWithServer();
    });
  }

  // Check if we're offline
  isOffline() {
    return !navigator.onLine;
  }

  // Queue an operation for sync when back online
  async queueForSync(action, data) {
    if (this.isOffline()) {
      await dbUtils.addToSyncQueue(action, data);
      console.log('Operation queued for sync:', action);
      return true;
    }
    return false;
  }

  // Sync queued operations with server
  async syncWithServer() {
    if (this.syncInProgress || this.isOffline()) {
      return;
    }

    this.syncInProgress = true;
    console.log('Starting sync with server...');

    try {
      const pendingSync = await dbUtils.getPendingSync();
      
      for (const item of pendingSync) {
        try {
          // Process each queued operation based on action type
          switch (item.action) {
            case 'saveQuery':
              await this.syncQuery(item.data);
              break;
            case 'updateProfile':
              await this.syncProfile(item.data);
              break;
            case 'saveWeather':
              await this.syncWeather(item.data);
              break;
            default:
              console.log('Unknown action type:', item.action);
          }
          
          // Remove from queue after successful sync
          await dbUtils.removeFromSyncQueue(item.id);
          
        } catch (error) {
          console.error('Error syncing item:', item.id, error);
          // Keep in queue for retry later
        }
      }

      console.log('Sync completed');
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Sync a saved query
  async syncQuery(queryData) {
    // In production, this would call your API
    console.log('Syncing query:', queryData);
    // await api.query.send(queryData.question, queryData.language);
  }

  // Sync profile updates
  async syncProfile(profileData) {
    console.log('Syncing profile:', profileData);
    // await api.profile.update(profileData);
  }

  // Sync weather data
  async syncWeather(weatherData) {
    console.log('Syncing weather:', weatherData);
    // await api.weather.update(weatherData);
  }

  // Cache API responses for offline use
  async cacheResponse(key, data) {
    try {
      const cache = await caches.open('api-cache-v1');
      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
      await cache.put(key, response);
    } catch (error) {
      console.error('Error caching response:', error);
    }
  }

  // Get cached response
  async getCachedResponse(key) {
    try {
      const cache = await caches.open('api-cache-v1');
      const response = await cache.match(key);
      if (response) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error getting cached response:', error);
    }
    return null;
  }

  // Clear old cache
  async clearOldCache(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
    try {
      const cache = await caches.open('api-cache-v1');
      const keys = await cache.keys();
      const now = Date.now();

      for (const request of keys) {
        const response = await cache.match(request);
        const dateHeader = response?.headers.get('date');
        if (dateHeader) {
          const cacheDate = new Date(dateHeader).getTime();
          if (now - cacheDate > maxAge) {
            await cache.delete(request);
          }
        }
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

export const offlineService = new OfflineService();
export default offlineService;