import { useState } from 'react';
import { useCreateLotFromStock, useProductLotsByProduct, useUpdateLotExpiration } from '../../stock/hooks/useProductLots';
import { useStockByProductSummary } from '../../stock/hooks/useStock';
import type { CreateLotFromStockPayload } from '../../stock/services/productLotService';
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
  const create = useCreateLotFromStock();
  const [creating, setCreating] = useState(false);
  const [lotId, setLotId] = useState(target.lotId || '');
  const [draftDate, setDraftDate] = useState<string>();
  const lots: ProductLot[] = Array.isArray(data) ? data : [];
  const lot = lotId ? lots.find(item => item.id === lotId) : lots[0];
  const savedDate = lot?.expirationDate ? toLocalDateString(lot.expirationDate) : '';
  const date = draftDate ?? savedDate;
  const warehouse = (item: ProductLot) => item.companyName || companyList.find(c => c.id === item.companyId)?.name || 'Almacén';
  const busy = update.isPending || create.isPending;

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
    <Modal isOpen onClose={busy ? () => {} : onClose} title="Cambiar fecha de vencimiento">
      <p className="mb-4 text-sm font-medium text-gray-800">{target.productName}</p>
      {isLoading ? <p className="text-sm text-gray-500">Cargando lotes...</p>
        : isError ? <div className="text-sm text-red-600">No se pudieron cargar los lotes. <button type="button" onClick={() => refetch()} className="underline">Reintentar</button></div>
        : creating || lots.length === 0 ? (
          <>
            <p className="mb-4 text-sm text-gray-600">{lots.length === 0 ? 'Este producto no tiene lotes registrados. Crea uno para guardar su vencimiento.' : 'Registra otro lote para este producto.'}</p>
            <CreateLotForm target={target} companyList={companyList} isPending={create.isPending}
              onCancel={lots.length ? () => setCreating(false) : onClose}
              onSave={async payload => { await create.mutateAsync(payload); onClose(); }} />
          </>
        )
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
            <button type="button" disabled={busy || isFetching} onClick={() => setCreating(true)} className="text-sm font-medium text-primary-700 hover:underline disabled:opacity-50">Crear nuevo lote</button>
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

function CreateLotForm({ target, companyList, isPending, onSave, onCancel }: {
  target: LotExpirationTarget;
  companyList: Company[];
  isPending: boolean;
  onSave: (payload: CreateLotFromStockPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const stock = useStockByProductSummary();
  // Include every warehouse and inactive lot so existing assigned units are never assigned twice.
  const allLots = useProductLotsByProduct(target.productId);
  const [companyId, setCompanyId] = useState(target.companyId || '');
  const [lotNumber, setLotNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [quantityDraft, setQuantityDraft] = useState<string>();
  const warehouses = companyList.filter(company => company.isActive !== false && (!target.companyId || company.id === target.companyId));
  const availableIn = (id: string) => {
    const quantity = stock.data?.find(row => row.productId === target.productId)?.byCompany.find(row => row.companyId === id)?.quantity || 0;
    const assigned = (allLots.data || []).filter(lot => lot.companyId === id).reduce((sum, lot) => sum + Math.max(0, lot.currentQuantity || 0), 0);
    return Math.max(0, quantity - assigned);
  };
  const withStock = warehouses.filter(company => availableIn(company.id) > 0);
  const selectedCompany = companyId || (withStock.length === 1 ? withStock[0].id : warehouses.length === 1 ? warehouses[0].id : '');
  const available = selectedCompany ? availableIn(selectedCompany) : 0;
  const quantityText = quantityDraft ?? String(available);
  const quantity = Number(quantityText);
  const loading = stock.isLoading || allLots.isLoading;
  const failed = stock.isError || allLots.isError;
  const valid = !!selectedCompany && warehouses.some(company => company.id === selectedCompany) &&
    !!lotNumber.trim() && !!expirationDate && quantityText !== '' && Number.isFinite(quantity) && quantity >= 0 && quantity <= available + 1e-9;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || loading || failed || stock.isFetching || allLots.isFetching || isPending) return;
    try {
      await onSave({ productId: target.productId, companyId: selectedCompany, lotNumber: lotNumber.trim(), expirationDate, quantity });
    } catch {
      // Keep every field when the server rejects a duplicate or availability changes.
    }
  };

  if (loading) return <p role="status" className="text-sm text-gray-500">Consultando stock disponible para el lote...</p>;
  if (failed) return <div className="text-sm text-red-600"><p role="alert">No se pudo consultar el stock y los lotes existentes.</p><button type="button" onClick={() => { void stock.refetch(); void allLots.refetch(); }} className="mt-2 underline">Reintentar</button></div>;
  if (!warehouses.length) return <p className="text-sm text-gray-600">Se necesita un almacén activo para registrar el lote.</p>;

  return <form onSubmit={handleSave} className="space-y-4">
    <fieldset disabled={isPending} className="space-y-4">
      {warehouses.length > 1 ? <div>
        <label htmlFor="new-lot-company" className="block text-sm font-medium text-gray-700">Almacén</label>
        <select id="new-lot-company" value={selectedCompany} onChange={event => { setCompanyId(event.target.value); setQuantityDraft(undefined); }} required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="" disabled>Seleccionar almacén...</option>
          {warehouses.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
      </div> : <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">Almacén: {warehouses[0].name}</p>}
      <label className="block text-sm font-medium text-gray-700" htmlFor="new-lot-number">Número de lote</label>
      <input id="new-lot-number" value={lotNumber} onChange={event => setLotNumber(event.target.value)} required maxLength={120} autoFocus placeholder="Escribe el lote del producto" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      <label className="block text-sm font-medium text-gray-700" htmlFor="new-lot-expiration">Fecha de vencimiento</label>
      <input id="new-lot-expiration" type="date" value={expirationDate} onChange={event => setExpirationDate(event.target.value)} required max="9999-12-31" className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      <label className="block text-sm font-medium text-gray-700" htmlFor="new-lot-quantity">Unidades existentes de este lote</label>
      <input id="new-lot-quantity" type="number" min={0} max={available} step="any" value={quantityText} onChange={event => setQuantityDraft(event.target.value)} required disabled={!selectedCompany || isPending} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      <p className="text-xs text-gray-600">{selectedCompany ? `Stock sin lote disponible en este almacén: ${available}.` : 'Selecciona el almacén donde se encuentra el producto.'} El stock total no aumenta al guardar este lote.</p>
      {selectedCompany && available === 0 && <p className="text-xs text-gray-500">Puedes guardar el lote con 0 unidades si aún no hay stock disponible para asignarle.</p>}
    </fieldset>
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel} disabled={isPending} className="rounded-lg px-4 py-2 text-sm text-gray-600 disabled:opacity-50">Cancelar</button>
      <button type="submit" disabled={!valid || stock.isFetching || allLots.isFetching || isPending} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{isPending ? 'Guardando...' : 'Crear lote y guardar'}</button>
    </div>
  </form>;
}
