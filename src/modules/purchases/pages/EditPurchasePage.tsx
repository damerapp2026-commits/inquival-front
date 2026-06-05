import { useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, AlertTriangle } from 'lucide-react';
import { usePurchaseById, useUpdatePurchaseFull } from '../hooks/usePurchases';
import { useProducts } from '../../products/hooks/useProducts';
import { useAccountPayableByPurchaseId } from '../../accounts-payable/hooks/useAccountsPayable';
import { PurchaseFormBody, type PurchaseSubmitPayload } from '../components/PurchaseFormBody';
import { purchaseToFormState } from '../utils/purchaseForm';
import type { Purchase, Product } from '../../../shared/types';

function WarningBanner({ purchaseRef, totalLabel }: { purchaseRef: string; totalLabel: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
        <AlertTriangle size={18} />
      </div>
      <div className="text-sm text-amber-800">
        <div className="font-semibold">Estás editando la compra {purchaseRef}</div>
        <p className="text-xs text-amber-700 mt-0.5">
          Total original: <span className="font-semibold">{totalLabel}</span>. Los cambios afectan stock, kardex,
          caja y cuentas por pagar. La acción se registra en el historial de auditoría con tu usuario y motivo.
        </p>
      </div>
    </div>
  );
}

export function EditPurchasePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: purchaseData, isLoading } = usePurchaseById(id);
  const { data: accountPayable, isLoading: apLoading } = useAccountPayableByPurchaseId(id ?? null);
  const { data: productsData } = useProducts({ limit: 10000 });
  const updateFull = useUpdatePurchaseFull();

  const purchase: Purchase | undefined = purchaseData;

  const products: Product[] = useMemo(() => {
    const raw: any = productsData;
    return Array.isArray(raw) ? raw : raw?.data || [];
  }, [productsData]);

  if (isLoading || apLoading) {
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
          <p className="text-sm text-gray-500">La compra que intentas editar no existe o fue eliminada.</p>
          <Link to="/purchases" className="inline-block mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">Volver a compras</Link>
        </div>
      </div>
    );
  }

  const initial = purchaseToFormState(purchase, products);

  // Pre-poblar cuotas desde AccountPayable si existe y tiene cuotas
  if (accountPayable?.paymentScheduleType === 'INSTALLMENTS' && (accountPayable?.installments?.length ?? 0) > 0) {
    initial.state.installments = accountPayable.installments.map((i) => ({
      amount: i.amount,
      dueDate: i.dueDate ? i.dueDate.slice(0, 10) : '',
      status: i.status as 'PENDING' | 'PAID',
    }));
  }

  const handleSubmit = async (payload: PurchaseSubmitPayload) => {
    if (!payload.reason) return;
    const data: any = {
      reason: payload.reason,
      updatedAt: (purchase as any).updatedAt,
      supplier: payload.supplier,
      supplierId: payload.supplierId || null,
      supplierRuc: payload.supplierRuc || null,
      documentType: payload.documentType || null,
      documentSeries: payload.documentSeries || null,
      documentNumber: payload.documentNumber || null,
      issueDate: payload.issueDate || null,
      grSeries: payload.grSeries || null,
      grNumber: payload.grNumber || null,
      grDate: payload.grDate || null,
      date: payload.date,
      currency: payload.currency,
      paymentType: payload.paymentType,
      items: payload.items,
    };
    if (payload.currency === 'USD') {
      data.totalCostUsd = payload.totalCostUsd;
      data.exchangeRate = payload.exchangeRate;
      data.exchangeRateDate = payload.exchangeRateDate;
      data.totalCost = payload.totalCost;
    } else {
      data.totalCost = payload.totalCost;
    }
    if (payload.paymentType === 'CREDITO') {
      data.paymentScheduleType = payload.paymentScheduleType;
      if (payload.paymentScheduleType === 'SINGLE_DATE') data.dueDate = payload.dueDate;
      if (payload.paymentScheduleType === 'INSTALLMENTS') data.installments = payload.installments;
    }
    await updateFull.mutateAsync({ id: purchase.id, data });
    navigate(`/purchases/${purchase.id}`);
  };

  const purchaseRef = purchase.documentSeries && purchase.documentNumber
    ? `${purchase.documentType || ''} ${purchase.documentSeries}-${purchase.documentNumber}`.trim()
    : `del ${new Date(purchase.date).toLocaleDateString('es-PE')}`;

  const totalLabel = purchase.totalCostUsd
    ? `$ ${purchase.totalCostUsd.toFixed(2)} (≈ S/ ${purchase.totalCost.toFixed(2)})`
    : `S/ ${purchase.totalCost.toFixed(2)}`;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/purchases/${purchase.id}`} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Volver al detalle">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <ShoppingCart size={12} /> Compras · Editar
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Editar compra</h1>
        </div>
      </div>

      <PurchaseFormBody
        mode="edit"
        initial={initial}
        submitLabel="Guardar cambios"
        submittingLabel="Guardando..."
        isSubmitting={updateFull.isPending}
        onSubmit={handleSubmit}
        onCancelHref={`/purchases/${purchase.id}`}
        warningBanner={<WarningBanner purchaseRef={purchaseRef} totalLabel={totalLabel} />}
      />
    </div>
  );
}
