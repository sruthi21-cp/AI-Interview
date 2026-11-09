import axios from 'axios';

// Dynamically resolve the backend host so the frontend works seamlessly
// through Vite proxy (/api/v1), Nginx in production, or direct backend access.
const resolveBackendBase = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // When running in a browser, use relative /api/v1 so requests are forwarded via
  // the Vite dev server proxy (or Nginx reverse proxy). This completely avoids
  // cross-origin (CORS) preflight failures, network firewall blocking, and IP mismatches.
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
