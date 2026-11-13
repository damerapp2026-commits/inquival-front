import axios from 'axios';
import { getActiveBranchId } from '../utils/branchStorage';

let pendingWrites = 0;
const writeListeners = new Set<() => void>();
export const getPendingWriteCount = () => pendingWrites;
export const subscribePendingWrites = (listener: () => void) => {
  writeListeners.add(listener);
  return () => { writeListeners.delete(listener); };
};
function finishWrite(config: any) {
  if (!config?.__branchWrite) return;
  config.__branchWrite = false;
  pendingWrites--;
  writeListeners.forEach(listener => listener());
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Branch-Id'] = getActiveBranchId();
  if (['post', 'put', 'patch', 'delete'].includes(config.method || '')) {
    (config as any).__branchWrite = true;
    pendingWrites++;
    writeListeners.forEach(listener => listener());
  }
  return config;
});

api.interceptors.response.use(
  (response) => { finishWrite(response.config); return response; },
  (error) => {
    finishWrite(error.config);
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
