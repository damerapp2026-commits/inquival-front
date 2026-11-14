import { api } from '../../../shared/services/api';
import type { Client, PaginatedResponse } from '../../../shared/types';

export const clientService = {
  getAll: (params?: any) => api.get('/clients', { params }).then((r) => r.data.data),
  getAllPages: async (params?: any): Promise<PaginatedResponse<Client>> => {
    const firstPage: PaginatedResponse<Client> = await clientService.getAll({ ...params, page: 1 });
    const clients = [...firstPage.data];
    const seenIds = new Set(clients.map(client => client.id));
    let page = 1;
    while (clients.length < firstPage.total) {
      const nextPage: PaginatedResponse<Client> = await clientService.getAll({ ...params, page: ++page });
      if (!nextPage.data.length || nextPage.data.some(client => seenIds.has(client.id))) {
        throw new Error('No se pudieron cargar todos los clientes. Vuelve a intentar la exportación.');
      }
      nextPage.data.forEach(client => seenIds.add(client.id));
      clients.push(...nextPage.data);
    }
    return { ...firstPage, data: clients };
  },
  create: (data: any) => api.post('/clients', data).then((r) => r.data.data),
  update: (id: string, data: any) => api.put(`/clients/${id}`, data).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/clients/${id}`).then((r) => r.data.data),
};
