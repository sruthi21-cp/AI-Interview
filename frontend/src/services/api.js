import axios from 'axios';

// Dynamically resolve the backend host so the frontend works whether
// accessed via localhost or a LAN IP (e.g. 10.20.17.183).
const backendBase =
  import.meta.env.VITE_API_URL ||
  `http://${window.location.hostname}:8000/api/v1`;

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

export default api;
export const fetchAnalytics = () => api.get('/analytics');
