import React from 'react';
import { Modal } from '../../../shared/components/Modal';
import { useProductSuppliers } from '../../purchases/hooks/usePurchases';
import { Truck, Package, Calendar, FileText } from 'lucide-react';
import type { Product } from '../../../shared/types';

interface ProductSupplierSummary {
  supplierId?: string;
  supplierName: string;
  supplierRuc?: string;
  purchaseCount: number;
  totalQuantity: number;
  lastUnitCost?: number;
  minUnitCost?: number;
  maxUnitCost?: number;
  avgUnitCost?: number;
  lastPurchaseDate: string;
  firstPurchaseDate: string;
  lastDocumentType?: string;
  lastDocumentSeries?: string;
  lastDocumentNumber?: string;
}

interface Props {
  product: Product | null;
  onClose: () => void;
}

export function ProductSuppliersModal({ product, onClose }: Props) {
  const { data, isLoading } = useProductSuppliers(product?.id || '');
  const suppliers: ProductSupplierSummary[] = Array.isArray(data) ? data : [];

  const formatDate = (d: string | Date) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const formatMoney = (n?: number) => (n != null ? `S/ ${n.toFixed(2)}` : '—');

  const formatDocument = (s: ProductSupplierSummary) => {
    const parts = [s.lastDocumentType, s.lastDocumentSeries, s.lastDocumentNumber].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '—';
  };

  return (
    <Modal isOpen={!!product} onClose={onClose} title={`Proveedores — ${product?.name || ''}`} size="xl">
      {isLoading ? (
        <div className="py-8 text-center text-gray-500 text-sm">Cargando proveedores…</div>
      ) : suppliers.length === 0 ? (
        <div className="py-10 text-center">
          <Truck size={40} className="mx-auto text-gray-300 mb-3" />
          <div className="text-gray-500 text-sm">
            Este producto aún no se ha comprado a ningún proveedor.
          </div>
          <div className="text-gray-400 text-xs mt-1">
            Los proveedores aparecen automáticamente conforme registras compras.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-primary-50 rounded-lg p-3">
              <div className="text-xs text-primary-700 uppercase tracking-wide">Proveedores</div>
              <div className="text-xl font-bold text-primary-700">{suppliers.length}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Compras totales</div>
              <div className="text-xl font-bold text-gray-800">
                {suppliers.reduce((s, x) => s + x.purchaseCount, 0)}
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-blue-700 uppercase tracking-wide">Cantidad total</div>
              <div className="text-xl font-bold text-blue-700">
                {suppliers.reduce((s, x) => s + x.totalQuantity, 0).toFixed(2)} {product?.unit || ''}
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="text-xs text-orange-700 uppercase tracking-wide">Última compra</div>
              <div className="text-sm font-semibold text-orange-700">
                {formatDate(suppliers[0]?.lastPurchaseDate)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium">Proveedor</th>
                  <th className="px-3 py-2 font-medium">Compras</th>
                  <th className="px-3 py-2 font-medium">Cantidad</th>
                  <th className="px-3 py-2 font-medium">Último costo</th>
                  <th className="px-3 py-2 font-medium">Promedio</th>
                  <th className="px-3 py-2 font-medium">Rango</th>
                  <th className="px-3 py-2 font-medium">Última compra</th>
                  <th className="px-3 py-2 font-medium">Último comprobante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {suppliers.map((s, idx) => (
                  <tr key={`${s.supplierId || s.supplierName}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{s.supplierName}</div>
                      {s.supplierRuc && (
                        <div className="text-xs text-gray-400">RUC {s.supplierRuc}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">
                        <Package size={11} /> {s.purchaseCount}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {s.totalQuantity.toFixed(2)} {product?.unit || ''}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-800">{formatMoney(s.lastUnitCost)}</td>
                    <td className="px-3 py-2 text-gray-700">{formatMoney(s.avgUnitCost)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {s.minUnitCost != null && s.maxUnitCost != null && s.minUnitCost !== s.maxUnitCost
                        ? `${formatMoney(s.minUnitCost)} — ${formatMoney(s.maxUnitCost)}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      <div className="flex items-center gap-1 text-xs">
                        <Calendar size={11} className="text-gray-400" />
                        {formatDate(s.lastPurchaseDate)}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        desde {formatDate(s.firstPurchaseDate)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <FileText size={11} className="text-gray-400" />
                        {formatDocument(s)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
