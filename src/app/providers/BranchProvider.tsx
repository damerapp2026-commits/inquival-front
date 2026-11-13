import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthProvider';
import { api, getPendingWriteCount } from '../../shared/services/api';
import { DEFAULT_BRANCH_ID, getActiveBranchId, setActiveBranchId } from '../../shared/utils/branchStorage';
import type { Branch } from '../../shared/types';

interface BranchContextType {
  branches: Branch[];
  currentBranch: Branch | null;
  selectBranch: (id: string) => Promise<void>;
  refreshBranches: () => Promise<unknown>;
}
const BranchContext = createContext<BranchContextType | null>(null);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState('');
  const query = useQuery({
    queryKey: ['branches', user?.id], enabled: !!user,
    queryFn: () => api.get('/branches').then(r => r.data.data as Branch[]),
  });
  const branches = query.data || [];
  const requested = user?.role === 'ADMIN' ? getActiveBranchId() : user?.branchId || DEFAULT_BRANCH_ID;
  const currentBranch = branches.find(branch => branch.id === requested)
    || branches.find(branch => branch.id === (user?.branchId || DEFAULT_BRANCH_ID)) || null;
  const readyKey = `${user?.id || ''}:${currentBranch?.id || ''}`;

  useEffect(() => {
    if (user && currentBranch) { setActiveBranchId(currentBranch.id); setReady(readyKey); }
  }, [user, currentBranch?.id, readyKey]);

  const selectBranch = async (id: string) => {
    if (user?.role !== 'ADMIN' || !branches.some(branch => branch.id === id)) throw new Error('Sucursal no disponible');
    if (getPendingWriteCount() || queryClient.isMutating()) throw new Error('Espera a que termine la operación en curso antes de cambiar de sucursal');
    if (id === currentBranch?.id) return;
    await queryClient.cancelQueries();
    queryClient.clear();
    setActiveBranchId(id);
    // Remount forms and discard every old query result before another branch runs.
    window.location.assign('/');
  };

  if (user && (query.isError || (query.isSuccess && !currentBranch))) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <p role="alert" className="text-gray-700">No se pudo cargar tu sucursal.</p>
      <button className="text-primary-700 underline" onClick={() => { void query.refetch(); }}>Reintentar</button>
    </div>
  );
  if (user && ready !== readyKey) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando sucursal…</div>;
  return <BranchContext.Provider value={{ branches, currentBranch, selectBranch, refreshBranches: query.refetch }}>{children}</BranchContext.Provider>;
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) throw new Error('useBranch debe usarse dentro de BranchProvider');
  return context;
}
