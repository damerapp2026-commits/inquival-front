import { api } from '../../../shared/services/api';

export const userService = {
  getAll: (params?: any) => api.get('/users', { params }).then((r) => r.data.data),
  getById: (id: string) => api.get(`/users/${id}`).then((r) => r.data.data),
  create: (data: any) => api.post('/users', data).then((r) => r.data.data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data).then((r) => r.data.data),
  changePassword: (id: string, data: any) => api.patch(`/users/${id}/password`, data).then((r) => r.data.data),
  toggleStatus: (id: string) => api.patch(`/users/${id}/toggle-status`).then((r) => r.data.data),
};
