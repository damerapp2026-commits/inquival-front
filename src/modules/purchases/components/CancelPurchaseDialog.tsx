import { useState } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  isCredit: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function CancelPurchaseDialog({ open, isCredit, loading, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  if (!open) return null;

  const trimmed = reason.trim();
  const valid = trimmed.length >= 5;

  const handleConfirm = () => {
    if (!valid || loading) return;
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold text-gray-900">¿Eliminar esta compra?</h2>
              <p className="text-xs text-red-600 font-semibold mt-0.5">Esta acción no se puede revertir.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-gray-700">Al eliminar la compra:</p>
          <ul className="text-sm text-gray-600 space-y-1.5 list-disc list-inside">
            <li>Se descontará el stock de los productos comprados</li>
            <li>Se decrementarán (o eliminarán) los lotes generados</li>
            {isCredit ? (
              <li>Se eliminará la cuenta por pagar asociada</li>
            ) : (
              <li>Se eliminará el movimiento de caja (egreso) de esa compra</li>
            )}
            <li>La compra desaparecerá del listado de compras y comprobantes</li>
          </ul>

          <label className="block text-xs font-semibold text-gray-700 mt-4">
            Motivo (obligatorio, queda registrado en auditoría)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            rows={3}
            placeholder="Ej.: Comprobante duplicado, error de digitación, devolución al proveedor..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 disabled:bg-gray-50"
          />
          {trimmed.length > 0 && trimmed.length < 5 && (
            <p className="text-xs text-red-500">El motivo debe tener al menos 5 caracteres.</p>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/60">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border-2 border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-semibold disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!valid || loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            {loading ? 'Eliminando...' : 'Sí, eliminar compra'}
          </button>
        </div>
      </div>
    </div>
  );
}
