import { useState } from 'react';
import { useProductLotsByProduct, useUpdateLotExpiration } from '../../stock/hooks/useProductLots';
import { Modal } from '../../../shared/components/Modal';
import { toLocalDateString } from '../../../shared/utils/date.util';
import type { Company, ProductLot } from '../../../shared/types';

export interface LotExpirationTarget {
  productId: string;
  productName: string;
  companyId?: string;
  lotId?: string;
}

export function EditLotExpirationModal({ target, companyList, onClose }: {
  target: LotExpirationTarget;
  companyList: Company[];
  onClose: () => void;
}) {
  const { data, isLoading, isFetching, isError, refetch } = useProductLotsByProduct(target.productId, target.companyId);
  const update = useUpdateLotExpiration();
  const [lotId, setLotId] = useState(target.lotId || '');
  const [draftDate, setDraftDate] = useState<string>();
  const lots: ProductLot[] = Array.isArray(data) ? data : [];
  const lot = lotId ? lots.find(item => item.id === lotId) : lots[0];
  const savedDate = lot?.expirationDate ? toLocalDateString(lot.expirationDate) : '';
  const date = draftDate ?? savedDate;
  const warehouse = (item: ProductLot) => item.companyName || companyList.find(c => c.id === item.companyId)?.name || 'Almacén';

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!lot || !date || update.isPending || isFetching) return;
    try {
      await update.mutateAsync({ id: lot.id, expirationDate: date });
      onClose();
    } catch {
      // El mensaje de error conserva el editor abierto para corregir o reintentar.
    }
  };

  return (
    <Modal isOpen onClose={update.isPending ? () => {} : onClose} title="Cambiar fecha de vencimiento">
      <p className="mb-4 text-sm font-medium text-gray-800">{target.productName}</p>
      {isLoading ? <p className="text-sm text-gray-500">Cargando lotes...</p>
        : isError ? <div className="text-sm text-red-600">No se pudieron cargar los lotes. <button type="button" onClick={() => refetch()} className="underline">Reintentar</button></div>
        : lots.length === 0 ? <p className="text-sm text-gray-500">Este producto no tiene lotes registrados.</p>
        : (
          <form onSubmit={handleSave} className="space-y-4">
            {lots.length > 1 || !lot ? (
              <label className="block text-sm font-medium text-gray-700">
                Lote y almacén
                <select value={lot?.id || ''} disabled={update.isPending}
                  onChange={event => { setLotId(event.target.value); setDraftDate(undefined); }}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required>
                  <option value="" disabled>Seleccionar lote...</option>
                  {lots.map(item => <option key={item.id} value={item.id}>{item.lotNumber} · {warehouse(item)}</option>)}
                </select>
              </label>
            ) : <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">Lote: <span className="font-medium">{lot.lotNumber}</span> · {warehouse(lot)}</p>}
            <label className="block text-sm font-medium text-gray-700" htmlFor="lot-expiration-date">Fecha de vencimiento</label>
            <input id="lot-expiration-date" type="date" value={date} required autoFocus disabled={!lot || update.isPending}
              onChange={event => setDraftDate(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} disabled={update.isPending} className="rounded-lg px-4 py-2 text-sm text-gray-600 disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={!lot || !date || date === savedDate || isFetching || update.isPending}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                {update.isPending ? 'Guardando...' : 'Guardar fecha'}
              </button>
            </div>
          </form>
        )}
    </Modal>
  );
}
