// src/db/db.js
// Mosupisi – IndexedDB (Dexie) schema
//
// Version 3 updates the weather table schema to match the backend
// WeatherService field names (temp_min_c, temp_max_c, rainfall_mm, etc.)
// and adds a weather_current table for today's live conditions.

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
db.version(2).stores({
  farmers:       '++id, mobile, name, region, language, createdAt',
  queries:       '++id, question, answer, timestamp, sources, isOffline',
  weather:       '++id, date, temp, rainChance, condition, alert',
  knowledgeBase: '++id, title, crop, content, source, year',
  syncQueue:     '++id, action, data, timestamp',
  plantings: [
    '++id', 'crop', 'plantingDate', 'area', 'location', 'status',
    'growthStage', 'lastAction', 'lastActionDate', 'notes',
    'harvestDate', 'yield', 'nextCrop', 'soilPrep', 'createdAt', 'updatedAt',
  ].join(', '),
});

// Version 3 – aligns weather table with backend WeatherService schema.
//
// New weather forecast fields (from DailyForecast schema):
//   date, temp_min_c, temp_max_c, humidity_pct, rainfall_mm,
//   wind_speed_ms, solar_radiation_mj, description, farming_note, alert
//
// New weather_current table stores today's live CurrentWeather snapshot:
//   temperature_c, feels_like_c, humidity_pct, wind_speed_ms,
//   wind_direction_deg, rainfall_mm, cloud_cover_pct, description,
//   source, fetched_at, location_name, latitude, longitude
db.version(3)
  .stores({
    farmers:         '++id, mobile, name, region, language, createdAt',
    queries:         '++id, question, answer, timestamp, sources, isOffline',
    weather:         '++id, date, temp_min_c, temp_max_c, rainfall_mm, humidity_pct, wind_speed_ms, description, alert',
    weather_current: '++id, fetched_at',
    knowledgeBase:   '++id, title, crop, content, source, year',
    syncQueue:       '++id, action, data, timestamp',
    plantings: [
      '++id', 'crop', 'plantingDate', 'area', 'location', 'status',
      'growthStage', 'lastAction', 'lastActionDate', 'notes',
      'harvestDate', 'yield', 'nextCrop', 'soilPrep', 'createdAt', 'updatedAt',
    ].join(', '),
  })
  .upgrade(tx => {
    // Migrate any existing weather rows from old shape to new shape.
    // Old shape: { temp: { min, max }, rainChance, condition, alert }
    // New shape: { temp_min_c, temp_max_c, humidity_pct, rainfall_mm, description, alert }
    return tx.table('weather').toCollection().modify(row => {
      if (row.temp && typeof row.temp === 'object') {
        row.temp_min_c  = row.temp.min  ?? null;
        row.temp_max_c  = row.temp.max  ?? null;
        delete row.temp;
      }
      if (row.rainChance !== undefined) {
        // rainChance was 0–100 — treat as humidity proxy; rainfall_mm unknown
        row.humidity_pct = row.rainChance;
        row.rainfall_mm  = null;
        delete row.rainChance;
      }
      if (row.condition !== undefined) {
        row.description = row.condition;
        delete row.condition;
      }
    });
  });

// ── Seed database ──────────────────────────────────────────────────────────
export const seedDatabase = async () => {
  const seeded = localStorage.getItem('mosupisi_db_seeded_v3');

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

      // Seed weather with new field shape
      const weatherCount = await db.weather.count();
      if (weatherCount === 0) {
        for (const day of mockWeatherData) {
          // Accept both old and new mock shapes
          await db.weather.add(_normaliseMockWeatherDay(day));
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

      localStorage.setItem('mosupisi_db_seeded_v3', 'true');
      console.log('Database seeded successfully (v3)');
    } catch (error) {
      console.error('Error seeding database:', error);
    }
  }
};

/**
 * Normalise a mock weather day (which may use the old shape) to the v3 schema.
 * Safe to call on already-normalised objects.
 */
function _normaliseMockWeatherDay(day) {
  return {
    date:                day.date,
    temp_min_c:          day.temp_min_c  ?? day.temp?.min  ?? null,
    temp_max_c:          day.temp_max_c  ?? day.temp?.max  ?? null,
    humidity_pct:        day.humidity_pct ?? day.rainChance ?? null,
    rainfall_mm:         day.rainfall_mm  ?? null,
    wind_speed_ms:       day.wind_speed_ms ?? null,
    solar_radiation_mj:  day.solar_radiation_mj ?? null,
    description:         day.description  ?? day.condition ?? 'partly cloudy',
    farming_note:        day.farming_note ?? null,
    alert:               day.alert        ?? null,
    source:              day.source       ?? 'mock',
    fetched_at:          day.fetched_at   ?? new Date().toISOString(),
  };
}

// ── Clear all data ─────────────────────────────────────────────────────────
export const clearDatabase = async () => {
  try {
    await db.farmers.clear();
    await db.queries.clear();
    await db.weather.clear();
    await db.weather_current.clear();
    await db.knowledgeBase.clear();
    await db.syncQueue.clear();
    await db.plantings.clear();
    localStorage.removeItem('mosupisi_db_seeded_v3');
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
    return await db.queries.orderBy('timestamp').reverse().limit(limit).toArray();
  },
  async searchQueries(searchTerm) {
    return await db.queries
      .filter(q =>
        q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.answer.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .toArray();
  },

  // ── Weather (v3 field names) ──────────────────────────────────────────────

  /** Get today's conditions from the weather_current snapshot table. */
  async getCurrentWeather() {
    return await db.weather_current.orderBy('fetched_at').last();
  },

  /** Cache a live CurrentWeather API response. Keeps only the latest entry. */
  async cacheCurrentWeather(currentWeather) {
    await db.weather_current.clear();
    await db.weather_current.add({
      ...currentWeather,
      fetched_at: currentWeather.fetched_at || new Date().toISOString(),
    });
  },

  /** Get today's forecast day from the forecast table. */
  async getTodayWeather() {
    const today = new Date().toISOString().split('T')[0];
    return await db.weather.where('date').equals(today).first();
  },

  /** Get the next N days of forecast. */
  async getWeatherForecast(days = 7) {
    return await db.weather.orderBy('date').limit(days).toArray();
  },

  /**
   * Replace the entire forecast cache with fresh data from the backend.
   * Accepts an array of DailyForecast objects.
   */
  async updateWeatherForecast(forecastDays) {
    await db.weather.clear();
    for (const day of forecastDays) {
      await db.weather.add(_normaliseMockWeatherDay(day));
    }
  },

  // ── Knowledge Base ────────────────────────────────────────────────────────
  async searchKnowledgeBase(crop, query) {
    let collection = crop
      ? db.knowledgeBase.where('crop').equals(crop)
      : db.knowledgeBase;
    const results = await collection.toArray();
    if (query) {
      return results.filter(
        item =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.content.toLowerCase().includes(query.toLowerCase()),
      );
    }
    return results;
  },
  async getCropGuides(crop) {
    return await db.knowledgeBase.where('crop').equals(crop).toArray();
  },

  // ── Plantings ─────────────────────────────────────────────────────────────
  async cachePlantings(plantingsArray) {
    await db.plantings.clear();
    for (const p of plantingsArray) {
      await db.plantings.put({ ...p, updatedAt: p.updatedAt || new Date().toISOString() });
    }
  },
  async getCachedPlantings() {
    return await db.plantings.orderBy('id').reverse().toArray();
  },
  async savePlanting(planting) {
    return await db.plantings.put({ ...planting, updatedAt: new Date().toISOString() });
  },
  async deletePlanting(id) {
    return await db.plantings.delete(id);
  },

  // ── Sync Queue ────────────────────────────────────────────────────────────
  async addToSyncQueue(action, data) {
    return await db.syncQueue.add({ action, data, timestamp: new Date().toISOString() });
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