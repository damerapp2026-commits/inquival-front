import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useConvertPurchaseOrder, useCreatePurchase, usePurchaseOrderById } from '../hooks/usePurchases';
import { PurchaseFormBody, type PurchaseSubmitPayload } from '../components/PurchaseFormBody';
import { buildInitialCreate, emptyItem, recalcItem, type PurchaseInitial } from '../utils/purchaseForm';
import { getTodayDateString } from '../../../shared/utils/date.util';
import type { PurchaseOrder } from '../../../shared/types';

function orderToInitial(order: PurchaseOrder): PurchaseInitial {
  const fallback = buildInitialCreate(getTodayDateString());
  const currency = order.currency || (order.totalCostUsd ? 'USD' : 'PEN');
  const exchangeRate = order.exchangeRate || null;
  const items = order.items.length ? order.items.map((item) => {
    const unitPriceSinIgv = item.unitPriceSinIgv ?? item.unitPriceConIgv ?? item.unitCost ?? 0;
    const unitPriceConIgv = item.unitPriceConIgv ?? item.unitCost ?? unitPriceSinIgv;
    const applyIgv = unitPriceConIgv > unitPriceSinIgv + 0.0001;
    const base = {
      ...emptyItem(),
      companyId: item.companyId || order.companyId,
      productId: item.productId,
      quantity: item.quantity,
      lotNumber: item.lotNumber || '',
      expirationDate: item.expirationDate?.slice(0, 10) || '',
      unitPriceSinIgv,
      unitPriceSinIgvInput: unitPriceSinIgv ? String(unitPriceSinIgv) : '',
      unitPriceConIgv,
      costoAdquisicion: unitPriceConIgv,
      costoEnSoles: item.unitCost || item.unitPriceConIgv || 0,
      precioVenta: item.precioVenta || 0,
      markupPercent: item.markupPercent || 0,
      precioVentaMode: 'direct' as const,
    };
    return recalcItem(base, currency, exchangeRate, applyIgv);
  }) : fallback.state.items;

  return {
    ...fallback,
    state: {
      ...fallback.state,
      supplier: order.supplier,
      supplierRuc: order.supplierRuc || '',
      supplierId: order.supplierId || '',
      paymentType: order.paymentType || 'CONTADO',
      paymentMethodId: order.paymentMethodId || '',
      paymentScheduleType: order.paymentScheduleType || 'SINGLE_DATE',
      dueDate: order.dueDate?.slice(0, 10) || '',
      installments: (order.installments || []).map((i) => ({ amount: i.amount, dueDate: i.dueDate.slice(0, 10) })),
      items,
      documentType: order.documentType || fallback.state.documentType,
      documentSeries: order.documentSeries || '',
      documentNumber: order.documentNumber || '',
      issueDate: order.issueDate?.slice(0, 10) || fallback.state.issueDate,
    },
    currency,
    exchangeRate,
    exchangeRateDate: '',
    originalTotal: order.totalCost,
    originalTotalUsd: order.totalCostUsd,
    fiscalEntityId: order.fiscalEntityId,
  };
}

export function ConvertPurchaseOrderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading } = usePurchaseOrderById(id);
  const createPurchase = useCreatePurchase();
  const convertOrder = useConvertPurchaseOrder();

  const initial = useMemo(() => order ? orderToInitial(order as PurchaseOrder) : null, [order]);

  const handleSubmit = async (payload: PurchaseSubmitPayload) => {
    if (!id) return;
    const apiPayload: any = { ...payload };
    delete apiPayload.reason;
    if (apiPayload.currency === 'USD') delete apiPayload.totalCost;
    const purchase = await createPurchase.mutateAsync(apiPayload);
    await convertOrder.mutateAsync({ id, purchaseId: purchase.id });
    navigate(`/purchases/${purchase.id}`);
  };

  if (isLoading || !initial) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/purchases?tab=orders" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Volver">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <RefreshCw size={12} /> Órdenes · Convertir
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Convertir orden en compra</h1>
        </div>
      </div>

      <PurchaseFormBody
        mode="create"
        initial={initial}
        submitLabel="Registrar compra"
        submittingLabel="Registrando..."
        isSubmitting={createPurchase.isPending || convertOrder.isPending}
        onSubmit={handleSubmit}
        onCancelHref="/purchases?tab=orders"
      />
    </div>
  );
}
