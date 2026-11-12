import axios from 'axios';

// Helper to ensure API base URL always ends with /api/v1
const normalizeApiBase = (url) => {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim().replace(/\/+$/, '');
  if (!clean) return '';
  if (!clean.endsWith('/api/v1')) {
    if (clean.endsWith('/api')) {
      clean = `${clean}/v1`;
    } else {
      clean = `${clean}/api/v1`;
    }
  }
  return clean;
};

// Dynamically resolve the backend host so the frontend works seamlessly
// in production on Render, Docker, or through Vite local dev proxy (/api/v1).
const resolveBackendBase = () => {
  const envUrl =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL;

  if (envUrl) {
    return normalizeApiBase(envUrl);
  }
  // When running in a browser without explicit env URL, use relative /api/v1
  // so requests are forwarded via the Vite dev server proxy (or Nginx reverse proxy).
  if (typeof window !== 'undefined') {
    return '/api/v1';
  }
  return 'http://127.0.0.1:8000/api/v1';
};

const backendBase = resolveBackendBase();

const api = axios.create({
  baseURL: backendBase,
  headers: {
    'Content-Type': 'application/json',
  },
});


api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && token !== 'dummy_token') {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config ? error.config.url || '' : '';
      const isAuthEndpoint =
        url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/auth/forgot-password') ||
        url.includes('/auth/reset-password');

      if (!isAuthEndpoint) {
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
export const fetchAnalytics = () => api.get('/interviews/analytics');
export const fetchAICoach = () => api.get('/interviews/coach');
export const fetchCoachSummary = () => api.get('/coach/summary');
export const fetchCoachRecommendations = () => api.get('/coach/recommendations');
export const fetchCoachTopics = () => api.get('/coach/topics');
export const fetchCoachWeakTopics = () => api.get('/coach/weak-topics');
export const fetchCoachStrongTopics = () => api.get('/coach/strong-topics');
export const generatePracticeQuestion = (topic) => api.post('/coach/practice-question', { topic });
export const askCoachChat = (message, history = []) => api.post('/coach/chat', { message, history });
export const extractResumeSkills = (formData) =>
  api.post('/interviews/extract-resume', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
