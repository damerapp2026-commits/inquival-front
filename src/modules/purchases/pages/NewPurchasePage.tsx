import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { useCreatePurchase } from '../hooks/usePurchases';
import { PurchaseFormBody, type PurchaseSubmitPayload } from '../components/PurchaseFormBody';
import { buildInitialCreate } from '../utils/purchaseForm';
import { getTodayDateString } from '../../../shared/utils/date.util';

export function NewPurchasePage() {
  const navigate = useNavigate();
  const createPurchase = useCreatePurchase();
  const today = getTodayDateString();
  const initial = buildInitialCreate(today);

  const handleSubmit = async (payload: PurchaseSubmitPayload) => {
    const apiPayload: any = { ...payload };
    delete apiPayload.reason;
    if (apiPayload.currency === 'USD') {
      delete apiPayload.totalCost;
    }
    await createPurchase.mutateAsync(apiPayload);
    navigate('/purchases');
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/purchases" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Volver">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <ShoppingCart size={12} /> Compras
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Nueva Compra</h1>
        </div>
      </div>

      <PurchaseFormBody
        mode="create"
        initial={initial}
        submitLabel="Registrar Compra"
        submittingLabel="Registrando..."
        isSubmitting={createPurchase.isPending}
        onSubmit={handleSubmit}
        onCancelHref="/purchases"
      />
    </div>
  );
}
