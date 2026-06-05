import { useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { usePurchases, useCancelPurchase, useUpdatePurchaseMeta } from '../hooks/usePurchases';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts } from '../../products/hooks/useProducts';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useAccountPayableByPurchaseId } from '../../accounts-payable/hooks/useAccountsPayable';
import { ArrowLeft, ShoppingCart, Building2, CreditCard, Package, Pencil, Trash2, CheckCircle, Clock, AlertCircle, FileText } from 'lucide-react';
import type { Purchase, Company, Product, AccountPayable } from '../../../shared/types';
import { CancelPurchaseDialog } from '../components/CancelPurchaseDialog';
import { Modal } from '../../../shared/components/Modal';
import { formatDateEs } from '../../../shared/utils/date.util';

function InfoCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <span className="block text-xs text-gray-500 mb-0.5">{label}</span>
      <span className="text-sm font-medium text-gray-800">{children}</span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Icon size={16} className="text-primary-600" />
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

const apStatusConfig = {
  PENDING:      { label: 'Pendiente',   cls: 'bg-orange-100 text-orange-700', icon: Clock },
  PARTIAL:      { label: 'Parcial',     cls: 'bg-blue-100 text-blue-700',     icon: AlertCircle },
  PAID:         { label: 'Pagado',      cls: 'bg-green-100 text-green-700',   icon: CheckCircle },
  CONSOLIDATED: { label: 'Consolidado', cls: 'bg-purple-100 text-purple-700', icon: CheckCircle },
} as const;

function AccountPayableSection({ ap, sym }: { ap: AccountPayable | null | undefined; sym: string }) {
  if (!ap) return null;

  const cfg = apStatusConfig[ap.status as keyof typeof apStatusConfig] ?? apStatusConfig.PENDING;
  const StatusIcon = cfg.icon;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const isOverdue = (dateStr?: string) => {
    if (!dateStr) return false;
    return new Date(dateStr.slice(0, 10) + 'T00:00:00') < today;
  };

  return (
    <SectionCard title="Cuenta por Pagar" icon={CreditCard}>
      {/* Resumen general */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${cfg.cls}`}>
          <StatusIcon size={14} />
          {cfg.label}
        </span>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-gray-500 text-xs">Total </span>
            <span className="font-semibold text-gray-800">{sym} {ap.totalAmount.toFixed(2)}</span>
          </span>
          {ap.paidAmount > 0 && (
            <span className="px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
              <span className="text-green-600 text-xs">Pagado </span>
              <span className="font-semibold text-green-700">{sym} {ap.paidAmount.toFixed(2)}</span>
            </span>
          )}
          {ap.pendingAmount > 0 && (
            <span className="px-3 py-1.5 bg-orange-50 rounded-lg border border-orange-200">
              <span className="text-orange-600 text-xs">Pendiente </span>
              <span className="font-semibold text-orange-700">{sym} {ap.pendingAmount.toFixed(2)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Pago único */}
      {ap.paymentScheduleType === 'SINGLE_DATE' && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${ap.status === 'PAID' ? 'bg-green-50 border-green-200' : isOverdue(ap.dueDate) ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-0.5">Fecha de pago</p>
            <p className="text-sm font-medium text-gray-800">
              {ap.dueDate ? formatDateEs(ap.dueDate, { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
            </p>
            {ap.status !== 'PAID' && isOverdue(ap.dueDate) && (
              <p className="text-xs text-red-600 font-medium mt-0.5">Vencido</p>
            )}
          </div>
          {ap.status === 'PAID' ? (
            <CheckCircle size={22} className="text-green-600" />
          ) : (
            <Clock size={22} className={isOverdue(ap.dueDate) ? 'text-red-500' : 'text-orange-500'} />
          )}
        </div>
      )}

      {/* Cuotas */}
      {ap.paymentScheduleType === 'INSTALLMENTS' && ap.installments.length > 0 && (
        <div className="border rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Vencimiento</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Monto</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Estado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Fecha de Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ap.installments.map((inst, idx) => {
                const paid = inst.status === 'PAID';
                const overdue = !paid && isOverdue(inst.dueDate);
                return (
                  <tr key={idx} className={paid ? 'bg-green-50/40' : overdue ? 'bg-red-50/40' : ''}>
                    <td className="px-3 py-2 text-gray-500">#{idx + 1}</td>
                    <td className="px-3 py-2">
                      <span className={overdue ? 'text-red-600 font-medium' : ''}>
                        {inst.dueDate ? formatDateEs(inst.dueDate, { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                      </span>
                      {overdue && <span className="ml-1 text-xs text-red-500">(vencida)</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{sym} {inst.amount.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      {paid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle size={11} /> Pagada
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${overdue ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                          <Clock size={11} /> {overdue ? 'Vencida' : 'Pendiente'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500">
                      {inst.paidDate ? formatDateEs(inst.paidDate, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Historial de pagos */}
      {ap.payments && ap.payments.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Historial de pagos</p>
          <div className="space-y-2">
            {ap.payments.map((pmt, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                <div>
                  <span className="font-medium text-gray-800">{sym} {pmt.amount.toFixed(2)}</span>
                  {pmt.notes && <span className="ml-2 text-xs text-gray-500">{pmt.notes}</span>}
                </div>
                <span className="text-xs text-gray-400">
                  {pmt.paymentDate ? formatDateEs(pmt.paymentDate, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

export function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo: string = (location.state as any)?.from ?? '/purchases';
  const { user } = useAuth();
  const { data, isLoading } = usePurchases({ limit: 500 });
  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 10000 });
  const { data: accountPayable } = useAccountPayableByPurchaseId(id ?? null);
  const cancelPurchase = useCancelPurchase();
  const updateMeta = useUpdatePurchaseMeta();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [grModal, setGrModal] = useState<{ grSeries: string; grNumber: string; grDate: string } | null>(null);
  const isAdmin = user?.role === 'ADMIN';

  const purchases: Purchase[] = data?.data || [];
  const purchase = purchases.find((p) => p.id === id);
  const companyList = Array.isArray(companies) ? companies : [];
  const products = productsData?.data || [];
  const getCompanyName = (cid: string) => companyList.find((c: Company) => c.id === cid)?.name || 'N/A';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!purchase) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Link to={backTo} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><ArrowLeft size={18} /></Link>
          <h1 className="text-2xl font-bold text-gray-800">Compra no encontrada</h1>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500">La compra que buscas no existe o fue eliminada.</p>
          <Link to={backTo} className="inline-block mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">Volver</Link>
        </div>
      </div>
    );
  }

  const sym = purchase.totalCostUsd ? '$' : 'S/';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to={backTo} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Volver">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <ShoppingCart size={12} /> Compras
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Detalle de Compra</h1>
        </div>
        <button
          type="button"
          onClick={() => setGrModal({
            grSeries: purchase.grSeries || '',
            grNumber: purchase.grNumber || '',
            grDate: purchase.grDate ? purchase.grDate.slice(0, 10) : '',
          })}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border rounded-lg text-sm font-semibold transition-colors ${purchase.grSeries || purchase.grNumber ? 'border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          title={purchase.grSeries || purchase.grNumber ? 'Editar Guía de Remisión' : 'Añadir Guía de Remisión'}
        >
          <FileText size={14} /> GR
        </button>
        <Link
          to={`/purchases/${purchase.id}/edit`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-primary-200 text-primary-700 rounded-lg hover:bg-primary-50 hover:border-primary-300 text-sm font-semibold transition-colors"
          title="Editar compra completa"
        >
          <Pencil size={14} /> Editar
        </Link>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-300 text-sm font-semibold transition-colors"
            title="Eliminar compra (revierte stock, lotes, AP/caja)"
          >
            <Trash2 size={14} /> Eliminar
          </button>
        )}
      </div>

      <CancelPurchaseDialog
        open={confirmOpen}
        isCredit={purchase.paymentType === 'CREDITO'}
        loading={cancelPurchase.isPending}
        onClose={() => { if (!cancelPurchase.isPending) setConfirmOpen(false); }}
        onConfirm={(reason) => {
          cancelPurchase.mutate(
            { id: purchase.id!, reason },
            {
              onSuccess: () => {
                setConfirmOpen(false);
                navigate('/purchases');
              },
            },
          );
        }}
      />

      <div className="space-y-5">
        {/* Info general */}
        <SectionCard title="Información general" icon={Building2}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <InfoCell label="Fecha">
              {formatDateEs(purchase.date, { day: '2-digit', month: 'long', year: 'numeric' })}
            </InfoCell>
            <InfoCell label="Almacén">{getCompanyName(purchase.companyId)}</InfoCell>
            <InfoCell label="Proveedor">
              {purchase.supplier}
              {purchase.supplierRuc ? ` (${purchase.supplierRuc})` : ''}
            </InfoCell>
            {purchase.documentType && (
              <InfoCell label="Comprobante">
                {purchase.documentType} {purchase.documentSeries || ''}
                {purchase.documentNumber ? `-${purchase.documentNumber}` : ''}
                {purchase.issueDate && (
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Emisión: {formatDateEs(purchase.issueDate)}
                  </span>
                )}
              </InfoCell>
            )}
            <InfoCell label="Tipo de Pago">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${purchase.paymentType === 'CREDITO' ? 'bg-orange-100 text-orange-700' : 'bg-primary-100 text-primary-700'}`}>
                {purchase.paymentType === 'CREDITO' ? 'Crédito' : 'Contado'}
              </span>
            </InfoCell>
            {purchase.paymentType === 'CREDITO' && purchase.paymentScheduleType === 'SINGLE_DATE' && purchase.dueDate && (
              <InfoCell label="Vencimiento">
                {formatDateEs(purchase.dueDate, { day: '2-digit', month: 'long', year: 'numeric' })}
              </InfoCell>
            )}
            {(purchase.grSeries || purchase.grNumber) && (
              <InfoCell label="Guía de Remisión">
                {[purchase.grSeries, purchase.grNumber].filter(Boolean).join('-')}
                {purchase.grDate && (
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Fecha: {formatDateEs(purchase.grDate)}
                  </span>
                )}
              </InfoCell>
            )}
          </div>
        </SectionCard>

        {/* Productos */}
        <SectionCard title={`Productos (${purchase.items.length})`} icon={Package}>
          <div className="border rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Cant.</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Lote</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Vence</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">P.U. s/IGV</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">PC+IGV</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Flete</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Otros</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">C. Adq.</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">P. Venta</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {purchase.items.map((item, idx) => {
                  const product = products.find((p: Product) => p.id === item.productId);
                  return (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-medium">{product?.name || item.productId}</td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-gray-600">{item.lotNumber || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{item.expirationDate ? formatDateEs(item.expirationDate) : '—'}</td>
                      <td className="px-3 py-2 text-right">{item.unitPriceSinIgv ? `${sym} ${item.unitPriceSinIgv.toFixed(2)}` : '—'}</td>
                      <td className="px-3 py-2 text-right">{item.unitPriceConIgv ? `${sym} ${item.unitPriceConIgv.toFixed(2)}` : '—'}</td>
                      <td className="px-3 py-2 text-right">{item.flete ? `${sym} ${item.flete.toFixed(2)}` : '—'}</td>
                      <td className="px-3 py-2 text-right">{item.otrosCostos ? `${sym} ${item.otrosCostos.toFixed(2)}` : '—'}</td>
                      <td className="px-3 py-2 text-right font-medium text-green-700">{sym} {(item.unitCost || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{item.precioVenta ? `${sym} ${item.precioVenta.toFixed(2)}` : '—'}</td>
                      <td className="px-3 py-2 text-right font-medium">{sym} {(item.quantity * (item.unitCost || 0)).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Cuenta por Pagar (solo crédito) */}
        {purchase.paymentType === 'CREDITO' && (
          <AccountPayableSection ap={accountPayable as AccountPayable | null | undefined} sym={sym} />
        )}

        {/* Totales */}
        <SectionCard title="Totales" icon={CreditCard}>
          <div className="space-y-2">
            {purchase.totalCostUsd && purchase.exchangeRate && (
              <div className="bg-primary-50 p-3 rounded-lg space-y-1 border border-primary-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-primary-700">Monto USD</span>
                  <span className="text-lg font-bold text-primary-800">$ {purchase.totalCostUsd.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-primary-600">
                  <span>Tipo de cambio (venta)</span>
                  <span>S/ {purchase.exchangeRate.toFixed(4)}</span>
                </div>
              </div>
            )}
            <div className="bg-blue-50 p-3 rounded-lg flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">Total en Soles</span>
              <span className="text-xl font-bold text-blue-700">S/ {purchase.totalCost.toFixed(2)}</span>
            </div>
          </div>
        </SectionCard>
      </div>

      <Modal isOpen={!!grModal} onClose={() => setGrModal(null)} title="Guía de Remisión">
        {grModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Serie</label>
                <input
                  value={grModal.grSeries}
                  onChange={(e) => setGrModal({ ...grModal, grSeries: e.target.value.toUpperCase() })}
                  placeholder="T001"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Correlativo</label>
                <input
                  value={grModal.grNumber}
                  onChange={(e) => setGrModal({ ...grModal, grNumber: e.target.value })}
                  placeholder="00000001"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                <input
                  type="date"
                  value={grModal.grDate}
                  onChange={(e) => setGrModal({ ...grModal, grDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setGrModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await updateMeta.mutateAsync({
                    id: purchase.id,
                    data: { grSeries: grModal.grSeries, grNumber: grModal.grNumber, grDate: grModal.grDate },
                  });
                  setGrModal(null);
                }}
                disabled={updateMeta.isPending}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {updateMeta.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
