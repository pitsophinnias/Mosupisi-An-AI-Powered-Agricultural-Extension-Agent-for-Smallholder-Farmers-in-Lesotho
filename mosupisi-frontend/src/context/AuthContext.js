import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useSnackbar } from 'notistack';

const AuthContext = createContext();

const PROFILE_SERVICE_URL = process.env.REACT_APP_PROFILE_SERVICE_URL || 'http://localhost:8003';

// ── Token storage helpers ────────────────────────────────────────────────────

const storage = {
  getUser:         ()      => { try { return JSON.parse(localStorage.getItem('mosupisi_user')); } catch { return null; } },
  setUser:         (u)     => localStorage.setItem('mosupisi_user', JSON.stringify(u)),
  removeUser:      ()      => localStorage.removeItem('mosupisi_user'),
  getAccessToken:  ()      => localStorage.getItem('mosupisi_access_token'),
  setAccessToken:  (t)     => localStorage.setItem('mosupisi_access_token', t),
  getRefreshToken: ()      => localStorage.getItem('mosupisi_refresh_token'),
  setRefreshToken: (t)     => localStorage.setItem('mosupisi_refresh_token', t),
  clearTokens:     ()      => {
    localStorage.removeItem('mosupisi_access_token');
    localStorage.removeItem('mosupisi_refresh_token');
    localStorage.removeItem('mosupisi_user');
  },
};

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiPost(path, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${PROFILE_SERVICE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Request failed');
  return data;
}

async function apiGet(path, token) {
  const res = await fetch(`${PROFILE_SERVICE_URL}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Request failed');
  return data;
}

async function apiPatch(path, body, token) {
  const res = await fetch(`${PROFILE_SERVICE_URL}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Request failed');
  return data;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const { enqueueSnackbar }   = useSnackbar();

  // ── Restore session on mount ───────────────────────────────────────────────

  useEffect(() => {
    const savedUser    = storage.getUser();
    const accessToken  = storage.getAccessToken();
    const refreshToken = storage.getRefreshToken();

    if (savedUser && accessToken) {
      setUser(savedUser);
      // Silently refresh the access token in the background
      if (refreshToken) {
        apiPost('/auth/refresh', { refresh_token: refreshToken })
          .then(data => {
            storage.setAccessToken(data.access_token);
            storage.setRefreshToken(data.refresh_token);
          })
          .catch(() => {
            // Refresh token expired — force logout
            storage.clearTokens();
            setUser(null);
          });
      }
    }
    setLoading(false);
  }, []);

  // ── Register ───────────────────────────────────────────────────────────────

  const register = async (userData) => {
    try {
      console.log('Sending to backend:', {
        full_name:     userData.name,
        phone_number:  userData.mobile,
        password:      userData.password,
        home_district: userData.region || null,
        language:      userData.language || 'en',
      });
      const data = await apiPost('/auth/register', {
        full_name:     userData.name,          // frontend uses "name"
        phone_number:  userData.mobile,        // frontend uses "mobile"
        password:      userData.password,
        home_district: userData.region || null,
        language:      userData.language || 'en',
      });

      storage.setAccessToken(data.access_token);
      storage.setRefreshToken(data.refresh_token);

      // Fetch full profile after registering
      const profile = await apiGet('/profile/me', data.access_token);
      const userObj = _normaliseProfile(profile);

      storage.setUser(userObj);
      setUser(userObj);
      enqueueSnackbar('Registration successful!', { variant: 'success' });
      return { success: true, user: userObj, onboarding_complete: data.onboarding_complete };

    } catch (err) {
      enqueueSnackbar(err.message || 'Registration failed', { variant: 'error' });
      return { success: false, error: err.message };
    }
  };

  // ── Login ──────────────────────────────────────────────────────────────────

  const login = async (mobile, password, rememberMe = false) => {
    try {
      const data = await apiPost('/auth/login', {
        phone_number: mobile,
        password,
        remember_me: rememberMe,
      });

      storage.setAccessToken(data.access_token);
      storage.setRefreshToken(data.refresh_token);

      // Fetch full profile
      const profile = await apiGet('/profile/me', data.access_token);
      const userObj = _normaliseProfile(profile);

      storage.setUser(userObj);
      setUser(userObj);
      enqueueSnackbar('Login successful!', { variant: 'success' });
      return { success: true, user: userObj, onboarding_complete: data.onboarding_complete };

    } catch (err) {
      enqueueSnackbar(err.message || 'Login failed', { variant: 'error' });
      return { success: false, error: err.message };
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────

  const logout = () => {
    storage.clearTokens();
    setUser(null);
    enqueueSnackbar('Logged out successfully', { variant: 'info' });
  };

  // ── Update profile ─────────────────────────────────────────────────────────

  const updateUser = async (updates) => {
    try {
      const token = storage.getAccessToken();
      const updated = await apiPatch('/profile/me', {
        full_name:     updates.name,
        home_district: updates.region,
        language:      updates.language,
      }, token);

      const userObj = _normaliseProfile(updated);
      storage.setUser(userObj);
      setUser(userObj);
      enqueueSnackbar('Profile updated successfully', { variant: 'success' });
      return { success: true };

    } catch (err) {
      enqueueSnackbar(err.message || 'Update failed', { variant: 'error' });
      return { success: false, error: err.message };
    }
  };

  // ── Forgot password ────────────────────────────────────────────────────────

  const forgotPassword = async (mobile) => {
    try {
      const data = await apiPost('/auth/forgot-password', { phone_number: mobile });
      return { success: true, ...data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── Reset password ─────────────────────────────────────────────────────────

  const resetPassword = async (mobile, otp, newPassword) => {
    try {
      await apiPost('/auth/reset-password', {
        phone_number:  mobile,
        otp,
        new_password:  newPassword,
      });
      enqueueSnackbar('Password reset! Please log in.', { variant: 'success' });
      return { success: true };
    } catch (err) {
      enqueueSnackbar(err.message || 'Reset failed', { variant: 'error' });
      return { success: false, error: err.message };
    }
  };

  // ── Complete onboarding (first-login farm setup) ───────────────────────────

  const completeOnboarding = async (farms) => {
    try {
      const token = storage.getAccessToken();
      const data = await apiPost('/farms/onboarding', { farms }, token);
      // Mark onboarding done in local user object
      const updatedUser = { ...user, onboarding_complete: true };
      storage.setUser(updatedUser);
      setUser(updatedUser);
      return { success: true, farms: data };
    } catch (err) {
      enqueueSnackbar(err.message || 'Onboarding failed', { variant: 'error' });
      return { success: false, error: err.message };
    }
  };

  // ── Expose raw token for other services (weather, chat etc.) ──────────────

  const getAccessToken = () => storage.getAccessToken();

  // ── Context value ──────────────────────────────────────────────────────────

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateUser,
    forgotPassword,
    resetPassword,
    completeOnboarding,
    getAccessToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ── Normalise backend profile → frontend user shape ───────────────────────────
// The frontend expects: name, mobile, region, crops, language, createdAt
// The backend returns:  full_name, phone_number, home_district, language, created_at

function _normaliseProfile(profile) {
  return {
    id:                   profile.id,
    name:                 profile.full_name,
    mobile:               profile.phone_number,
    region:               profile.home_district,
    language:             profile.language,
    role:                 profile.role,
    onboarding_complete:  profile.onboarding_complete,
    createdAt:            profile.created_at,
    crops:                [],   // crops are now per-farm; kept for Profile.js compatibility
  };
}