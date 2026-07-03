import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Download, FileText, Plus, RefreshCw, Search, Trash2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import type { Company, FiscalEntity, Product, PurchaseOrder, PurchaseOrderStatus } from '../../../shared/types';
import { formatDateEs } from '../../../shared/utils/date.util';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useFiscalEntities } from '../../fiscal-entities/hooks/useFiscalEntities';
import { useProducts } from '../../products/hooks/useProducts';
import { useDeletePurchaseOrder, usePurchaseOrders, useUpdatePurchaseOrderStatus } from '../hooks/usePurchases';
import { downloadPurchaseOrderPdf } from '../utils/purchaseOrderPdf';

const STATUS_META: Record<PurchaseOrderStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Aprobada', className: 'bg-blue-100 text-blue-700' },
  CANCELLED: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
  CONVERTED: { label: 'Convertida', className: 'bg-primary-100 text-primary-700' },
};

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [supplier, setSupplier] = useState('');
  const [status, setStatus] = useState<'' | PurchaseOrderStatus>('');
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);
  const { data, isLoading } = usePurchaseOrders({
    page,
    limit: 20,
    supplier: supplier || undefined,
    status: status || undefined,
  });
  const updateStatus = useUpdatePurchaseOrderStatus();
  const deleteOrder = useDeletePurchaseOrder();
  const { data: productsData } = useProducts({ limit: 10000 });
  const { data: companiesData } = useCompanies();
  const { data: fiscalEntitiesData } = useFiscalEntities();

  const orders: PurchaseOrder[] = data?.data || [];
  const products: Product[] = Array.isArray(productsData) ? productsData : productsData?.data || [];
  const companies: Company[] = Array.isArray(companiesData) ? companiesData : [];
  const fiscalEntities: FiscalEntity[] = (Array.isArray(fiscalEntitiesData) ? fiscalEntitiesData : []).filter((entity) => entity.isActive !== false);
  const fiscalEntityMap = useMemo(() => new Map(fiscalEntities.map((entity) => [entity.id, entity])), [fiscalEntities]);
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const pendingCount = useMemo(() => orders.filter((o) => o.status === 'PENDING').length, [orders]);

  const handleDownload = async (order: PurchaseOrder) => {
    try {
      await downloadPurchaseOrderPdf({
        order,
        products,
        companies,
        fiscalEntity: order.fiscalEntityId ? fiscalEntityMap.get(order.fiscalEntityId) : undefined,
      });
    } catch {
      toast.error('No se pudo generar el PDF de la orden');
    }
  };

  const columns = [
    {
      key: 'orderNumber',
      header: 'Orden',
      render: (o: PurchaseOrder) => (
        <span className="font-mono font-semibold text-primary-700">{o.orderNumber}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Fecha',
      render: (o: PurchaseOrder) => formatDateEs(o.createdAt, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    },
    {
      key: 'supplier',
      header: 'Proveedor',
    },
    {
      key: 'items',
      header: 'Items',
      render: (o: PurchaseOrder) => `${o.items.length} producto(s)`,
    },
    {
      key: 'totalCost',
      header: 'Total',
      render: (o: PurchaseOrder) => (
        o.totalCostUsd ? `$ ${o.totalCostUsd.toFixed(2)}` : `S/ ${o.totalCost.toFixed(2)}`
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (o: PurchaseOrder) => {
        const meta = STATUS_META[o.status];
        return (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.className}`}>
            {meta.label}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (o: PurchaseOrder) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(o);
            }}
            className="text-gray-500 hover:text-primary-700"
            title="Descargar PDF A4"
          >
            <Download size={15} />
          </button>
          {o.status !== 'CONVERTED' && o.status !== 'CANCELLED' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/purchases/orders/${o.id}/convert`);
              }}
              className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-xs font-medium"
            >
              <RefreshCw size={14} /> Convertir
            </button>
          )}
          {o.status === 'PENDING' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateStatus.mutate({ id: o.id, status: 'APPROVED' });
              }}
              className="text-blue-600 hover:text-blue-800"
              title="Aprobar"
            >
              <CheckCircle2 size={15} />
            </button>
          )}
          {o.status !== 'CONVERTED' && o.status !== 'CANCELLED' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateStatus.mutate({ id: o.id, status: 'CANCELLED' });
              }}
              className="text-red-500 hover:text-red-700"
              title="Cancelar"
            >
              <XCircle size={15} />
            </button>
          )}
          {o.status !== 'CONVERTED' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(o);
              }}
              className="text-red-600 hover:text-red-800"
              title="Eliminar"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><FileText size={18} /> Órdenes de compra</h2>
          <p className="text-xs text-gray-500">{pendingCount} pendiente(s) en esta página · no afectan stock, caja ni CxP</p>
        </div>
        <Link to="/purchases/orders/new" className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          <Plus size={16} /> Nueva orden
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={supplier}
            onChange={(e) => { setSupplier(e.target.value); setPage(1); }}
            placeholder="Buscar proveedor..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value as any); setPage(1); }} className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg">
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendientes</option>
          <option value="APPROVED">Aprobadas</option>
          <option value="CONVERTED">Convertidas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
      </div>

      <DataTable columns={columns} data={orders} isLoading={isLoading} hoverClass="hover:bg-primary-50" />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal isOpen={!!deleteTarget} onClose={() => { if (!deleteOrder.isPending) setDeleteTarget(null); }} title="Eliminar orden">
        {deleteTarget && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-sm text-red-800">
                Se eliminará la orden <strong>{deleteTarget.orderNumber}</strong> de {deleteTarget.supplier}.
              </p>
              <p className="text-xs text-red-600 mt-1">Esta acción no afecta stock, caja ni cuentas por pagar.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteOrder.isPending}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteOrder.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
                }}
                disabled={deleteOrder.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60"
              >
                {deleteOrder.isPending ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
