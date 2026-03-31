// services/pestControlService.js
// Connects the frontend to the mosupisi-pest-control-service (port 8002)

const BASE_URL = process.env.REACT_APP_PEST_CONTROL_SERVICE_URL || 'http://localhost:8002';

const handleResponse = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

// ─── Pest Library ────────────────────────────────────────────────────────────

export const fetchPests = async ({ crop = null, severity = null } = {}) => {
  const params = new URLSearchParams();
  if (crop) params.append('crop', crop);
  if (severity) params.append('severity', severity);
  const query = params.toString() ? `?${params}` : '';
  return handleResponse(await fetch(`${BASE_URL}/api/pests/${query}`));
};

export const fetchPestById = async (pestId) => {
  return handleResponse(await fetch(`${BASE_URL}/api/pests/${pestId}`));
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
    await fetch(`${BASE_URL}/api/reports/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    })
  );
};

export const fetchUserReports = async (userId, status = null) => {
  const params = status ? `?status=${status}` : '';
  return handleResponse(await fetch(`${BASE_URL}/api/reports/user/${userId}${params}`));
};

export const updatePestReport = async (reportId, updates) => {
  return handleResponse(
    await fetch(`${BASE_URL}/api/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  );
};

export const deletePestReport = async (reportId) => {
  return handleResponse(
    await fetch(`${BASE_URL}/api/reports/${reportId}`, { method: 'DELETE' })
  );
};

export const fetchReportStats = async () => {
  return handleResponse(await fetch(`${BASE_URL}/api/reports/stats/summary`));
};

// ─── Ask / Q&A ───────────────────────────────────────────────────────────────

export const askPestQuestion = async ({ question, language = 'en', crop = null }) => {
  return handleResponse(
    await fetch(`${BASE_URL}/api/ask/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, language, crop }),
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