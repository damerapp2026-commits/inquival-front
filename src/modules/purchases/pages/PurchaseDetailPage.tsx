import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { usePurchases, useCancelPurchase } from '../hooks/usePurchases';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts } from '../../products/hooks/useProducts';
import { useAuth } from '../../../app/providers/AuthProvider';
import { ArrowLeft, ShoppingCart, Building2, FileText, CreditCard, Package, Pencil, Trash2 } from 'lucide-react';
import type { Purchase, Company, Product } from '../../../shared/types';
import { CancelPurchaseDialog } from '../components/CancelPurchaseDialog';
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

export function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = usePurchases({ limit: 500 });
  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 10000 });
  const cancelPurchase = useCancelPurchase();
  const [confirmOpen, setConfirmOpen] = useState(false);
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
          <Link to="/purchases" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><ArrowLeft size={18} /></Link>
          <h1 className="text-2xl font-bold text-gray-800">Compra no encontrada</h1>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500">La compra que buscas no existe o fue eliminada.</p>
          <Link to="/purchases" className="inline-block mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">Volver a compras</Link>
        </div>
      </div>
    );
  }

  const sym = purchase.totalCostUsd ? '$' : 'S/';
  const installments = (purchase as any).installments as { amount: number; dueDate: string; status?: string }[] | undefined;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/purchases" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Volver">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <ShoppingCart size={12} /> Compras
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Detalle de Compra</h1>
        </div>
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

        {/* Cuotas */}
        {purchase.paymentType === 'CREDITO' && purchase.paymentScheduleType === 'INSTALLMENTS' && installments && installments.length > 0 && (
          <SectionCard title={`Cronograma de cuotas (${installments.length})`} icon={CreditCard}>
            <div className="border rounded-lg overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Vencimiento</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Monto</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {installments.map((inst, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-gray-500">#{idx + 1}</td>
                      <td className="px-3 py-2">{inst.dueDate ? formatDateEs(inst.dueDate, { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</td>
                      <td className="px-3 py-2 text-right font-medium">{sym} {inst.amount.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${inst.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {inst.status === 'PAID' ? 'Pagada' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
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
    </div>
  );
}
