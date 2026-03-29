import { api } from './api';

export interface DniResult { nombre: string; apellidoPaterno: string; apellidoMaterno: string; nombreCompleto: string; }
export interface RucResult { razonSocial: string; direccion: string; estado: string; }
export interface TipoCambioResult { compra: number; venta: number; fecha: string; }

export const lookupService = {
  searchByDni: (numero: string): Promise<DniResult> => api.get(`/lookup/dni/${numero}`).then((r) => r.data.data),
  searchByRuc: (numero: string): Promise<RucResult> => api.get(`/lookup/ruc/${numero}`).then((r) => r.data.data),
  getTipoCambio: (date?: string): Promise<TipoCambioResult> => api.get('/lookup/tipo-cambio', { params: date ? { date } : {} }).then((r) => r.data.data),
};
