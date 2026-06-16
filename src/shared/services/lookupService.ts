import axios from 'axios';
import { api } from './api';

export interface DniResult { nombre: string; apellidoPaterno: string; apellidoMaterno: string; nombreCompleto: string; }
export interface RucResult { razonSocial: string; direccion: string; estado: string; }
export interface TipoCambioResult { compra: number; venta: number; fecha: string; }

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const publicApi = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } });

export const lookupService = {
  searchByDni: (numero: string): Promise<DniResult> => api.get(`/lookup/dni/${numero}`).then((r) => r.data.data),
  searchByRuc: (numero: string): Promise<RucResult> => api.get(`/lookup/ruc/${numero}`).then((r) => r.data.data),
  getTipoCambio: (date?: string): Promise<TipoCambioResult> => publicApi.get('/lookup/tipo-cambio', { params: date ? { date } : {} }).then((r) => r.data.data),
};
