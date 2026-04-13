// services/pestControlService.js
// Matches the routes in mosupisi-pest-control-service/routes/pests.py
//
// Library routes (prefix /api/pests):
//   GET  /api/pests/              all pests  (?crop=maize to filter)
//   GET  /api/pests/crops         unique crop list
//   GET  /api/pests/tips          general prevention tips
//   GET  /api/pests/library/{id}  single pest by ID
//
// Report routes (prefix /api/pests):
//   POST   /api/pests/reports              create report
//   GET    /api/pests/reports/user/{id}    user's reports
//   GET    /api/pests/reports/stats/summary stats
//   GET    /api/pests/reports/{id}         single report
//   PATCH  /api/pests/reports/{id}         update report
//   DELETE /api/pests/reports/{id}         delete report
//
// Q&A:
//   POST /api/ask/   RAG-powered Q&A

const BASE_URL = process.env.REACT_APP_PEST_CONTROL_SERVICE_URL || 'http://localhost:8001';

const handleResponse = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

// ─── Pest Library ─────────────────────────────────────────────────────────────

export const fetchPests = async ({ crop = null } = {}) => {
  const query = crop ? `?crop=${encodeURIComponent(crop)}` : '';
  return handleResponse(await fetch(`${BASE_URL}/api/pests/${query}`));
};

export const fetchPestById = async (pestId) => {
  return handleResponse(await fetch(`${BASE_URL}/api/pests/library/${pestId}`));
};

export const fetchCrops = async () => {
  return handleResponse(await fetch(`${BASE_URL}/api/pests/crops`));
};

export const fetchGeneralTips = async () => {
  return handleResponse(await fetch(`${BASE_URL}/api/pests/tips`));
};

// ─── Pest Reports ─────────────────────────────────────────────────────────────

export const createPestReport = async (report) => {
  return handleResponse(
    await fetch(`${BASE_URL}/api/pests/reports`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(report),
    })
  );
};

export const fetchUserReports = async (userId, status = null) => {
  const params = status ? `?status=${status}` : '';
  return handleResponse(
    await fetch(`${BASE_URL}/api/pests/reports/user/${userId}${params}`)
  );
};

export const updatePestReport = async (reportId, updates) => {
  return handleResponse(
    await fetch(`${BASE_URL}/api/pests/reports/${reportId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(updates),
    })
  );
};

export const deletePestReport = async (reportId) => {
  return handleResponse(
    await fetch(`${BASE_URL}/api/pests/reports/${reportId}`, { method: 'DELETE' })
  );
};

export const fetchReportStats = async () => {
  return handleResponse(
    await fetch(`${BASE_URL}/api/pests/reports/stats/summary`)
  );
};

// ─── Ask / Q&A ────────────────────────────────────────────────────────────────

export const askPestQuestion = async ({ question, language = 'en', crop = null }) => {
  return handleResponse(
    await fetch(`${BASE_URL}/api/ask/`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ question, language, crop }),
    })
  );
};

// ─── Health check ─────────────────────────────────────────────────────────────

export const checkHealth = async () => {
  try {
    return handleResponse(await fetch(`${BASE_URL}/health`));
  } catch {
    return { status: 'unreachable' };
  }
};