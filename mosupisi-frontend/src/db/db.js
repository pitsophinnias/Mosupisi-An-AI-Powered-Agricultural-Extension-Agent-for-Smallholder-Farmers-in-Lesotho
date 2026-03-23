// src/db/db.js
// Mosupisi – IndexedDB (Dexie) schema
// Version 2 adds the 'plantings' table for offline-first PlantingGuide support.

import Dexie from 'dexie';
import {
  mockFarmerProfile,
  mockWeatherData,
  mockSampleResponses,
  mockKnowledgeBase,
} from '../data/mockData';

// ── Initialize database ────────────────────────────────────────────────────
export const db = new Dexie('MosupisiDB');

// ── Schema ─────────────────────────────────────────────────────────────────
// Version 1 – original schema (do not modify for migration safety)
db.version(1).stores({
  farmers:       '++id, mobile, name, region, language, createdAt',
  queries:       '++id, question, answer, timestamp, sources, isOffline',
  weather:       '++id, date, temp, rainChance, condition, alert',
  knowledgeBase: '++id, title, crop, content, source, year',
  syncQueue:     '++id, action, data, timestamp',
});

// Version 2 – adds plantings table
// All fields that are queried/indexed are listed; unindexed fields are stored too.
db.version(2).stores({
  farmers:       '++id, mobile, name, region, language, createdAt',
  queries:       '++id, question, answer, timestamp, sources, isOffline',
  weather:       '++id, date, temp, rainChance, condition, alert',
  knowledgeBase: '++id, title, crop, content, source, year',
  syncQueue:     '++id, action, data, timestamp',
  plantings: [
    '++id',
    'crop',
    'plantingDate',
    'area',
    'location',
    'status',
    'growthStage',
    'lastAction',
    'lastActionDate',
    'notes',
    'harvestDate',
    'yield',
    'nextCrop',
    'soilPrep',
    'createdAt',
    'updatedAt',
  ].join(', '),
});

// ── Seed database ──────────────────────────────────────────────────────────
export const seedDatabase = async () => {
  const seeded = localStorage.getItem('mosupisi_db_seeded');

  if (!seeded) {
    try {
      const farmersCount = await db.farmers.count();
      if (farmersCount === 0) {
        await db.farmers.add(mockFarmerProfile);
        console.log('Seeded farmers table');
      }

      const queriesCount = await db.queries.count();
      if (queriesCount === 0) {
        for (const response of mockSampleResponses) {
          await db.queries.add({
            ...response,
            isOffline: false,
            timestamp: response.timestamp || new Date().toISOString(),
          });
        }
        console.log('Seeded queries table');
      }

      const weatherCount = await db.weather.count();
      if (weatherCount === 0) {
        for (const day of mockWeatherData) {
          await db.weather.add(day);
        }
        console.log('Seeded weather table');
      }

      const kbCount = await db.knowledgeBase.count();
      if (kbCount === 0) {
        for (const item of mockKnowledgeBase) {
          await db.knowledgeBase.add(item);
        }
        console.log('Seeded knowledgeBase table');
      }

      // plantings table starts empty – populated from the backend API
      console.log('Plantings table ready (populated from backend API)');

      localStorage.setItem('mosupisi_db_seeded', 'true');
      console.log('Database seeded successfully');
    } catch (error) {
      console.error('Error seeding database:', error);
    }
  } else {
    console.log('Database already seeded');
  }
};

// ── Clear all data ─────────────────────────────────────────────────────────
export const clearDatabase = async () => {
  try {
    await db.farmers.clear();
    await db.queries.clear();
    await db.weather.clear();
    await db.knowledgeBase.clear();
    await db.syncQueue.clear();
    await db.plantings.clear();
    localStorage.removeItem('mosupisi_db_seeded');
    console.log('Database cleared');
  } catch (error) {
    console.error('Error clearing database:', error);
  }
};

// ── Database utility functions ─────────────────────────────────────────────
export const dbUtils = {
  // ── Farmers ──────────────────────────────────────────────────────────────
  async getFarmer(id) {
    return await db.farmers.get(id);
  },

  async getFarmerByMobile(mobile) {
    return await db.farmers.where('mobile').equals(mobile).first();
  },

  async updateFarmer(id, updates) {
    return await db.farmers.update(id, updates);
  },

  // ── Queries ───────────────────────────────────────────────────────────────
  async saveQuery(queryData) {
    return await db.queries.add({
      ...queryData,
      timestamp: new Date().toISOString(),
      isOffline: !navigator.onLine,
    });
  },

  async getFarmerQueries(limit = 20) {
    return await db.queries
      .orderBy('timestamp')
      .reverse()
      .limit(limit)
      .toArray();
  },

  async searchQueries(searchTerm) {
    return await db.queries
      .filter(
        (q) =>
          q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.answer.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .toArray();
  },

  // ── Weather ───────────────────────────────────────────────────────────────
  async getTodayWeather() {
    const today = new Date().toISOString().split('T')[0];
    return await db.weather.where('date').equals(today).first();
  },

  async getWeatherForecast(days = 7) {
    return await db.weather.orderBy('date').limit(days).toArray();
  },

  async updateWeather(weatherData) {
    await db.weather.clear();
    for (const day of weatherData) {
      await db.weather.add(day);
    }
  },

  // ── Knowledge Base ────────────────────────────────────────────────────────
  async searchKnowledgeBase(crop, query) {
    let collection = db.knowledgeBase;
    if (crop) {
      collection = collection.where('crop').equals(crop);
    }
    const results = await collection.toArray();
    if (query) {
      return results.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.content.toLowerCase().includes(query.toLowerCase()),
      );
    }
    return results;
  },

  async getCropGuides(crop) {
    return await db.knowledgeBase.where('crop').equals(crop).toArray();
  },

  // ── Plantings (offline-first) ─────────────────────────────────────────────

  /** Save or replace all plantings fetched from the backend. */
  async cachePlantings(plantingsArray) {
    await db.plantings.clear();
    for (const p of plantingsArray) {
      await db.plantings.put({ ...p, updatedAt: p.updatedAt || new Date().toISOString() });
    }
  },

  /** Get all locally cached plantings. */
  async getCachedPlantings() {
    return await db.plantings.orderBy('id').reverse().toArray();
  },

  /** Add or update a single planting locally. */
  async savePlanting(planting) {
    return await db.plantings.put({
      ...planting,
      updatedAt: new Date().toISOString(),
    });
  },

  /** Delete a planting locally. */
  async deletePlanting(id) {
    return await db.plantings.delete(id);
  },

  // ── Sync Queue (offline operations) ──────────────────────────────────────
  async addToSyncQueue(action, data) {
    return await db.syncQueue.add({
      action,
      data,
      timestamp: new Date().toISOString(),
    });
  },

  async getPendingSync() {
    return await db.syncQueue.orderBy('timestamp').toArray();
  },

  async removeFromSyncQueue(id) {
    return await db.syncQueue.delete(id);
  },

  async clearSyncQueue() {
    return await db.syncQueue.clear();
  },
};

export default db;