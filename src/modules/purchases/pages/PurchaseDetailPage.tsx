import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePurchases, useUpdatePurchase } from '../hooks/usePurchases';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts } from '../../products/hooks/useProducts';
import { useSuppliers } from '../../suppliers/hooks/useSuppliers';
import { Modal } from '../../../shared/components/Modal';
import { SmartSearchSelect } from '../../../shared/components/SmartSearchSelect';
import { ArrowLeft, ShoppingCart, Building2, FileText, CreditCard, Package, Pencil, Loader2 } from 'lucide-react';
import type { Purchase, Company, Product } from '../../../shared/types';

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
  const { data, isLoading } = usePurchases({ limit: 500 });
  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 10000 });
  const [showEdit, setShowEdit] = useState(false);

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
        <button
          onClick={() => setShowEdit(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-primary-200 text-primary-700 rounded-lg hover:bg-primary-50 hover:border-primary-300 text-sm font-semibold transition-colors"
          title="Editar comprobante y proveedor"
        >
          <Pencil size={14} /> Editar
        </button>
      </div>

      <div className="space-y-5">
        {/* Info general */}
        <SectionCard title="Información general" icon={Building2}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <InfoCell label="Fecha">
              {new Date(purchase.date).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
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
                    Emisión: {new Date(purchase.issueDate).toLocaleDateString('es-PE')}
                  </span>
                )}
              </InfoCell>
            )}
            <InfoCell label="Tipo de Pago">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${purchase.paymentType === 'CREDITO' ? 'bg-orange-100 text-orange-700' : 'bg-primary-100 text-primary-700'}`}>
                {purchase.paymentType === 'CREDITO' ? 'Crédito' : 'Contado'}
              </span>
            </InfoCell>
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
                      <td className="px-3 py-2 text-gray-600">{item.expirationDate ? new Date(item.expirationDate).toLocaleDateString('es-PE') : '—'}</td>
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

      <EditPurchaseModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        purchase={purchase}
      />
    </div>
  );
}

interface EditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: Purchase;
}

function EditPurchaseModal({ isOpen, onClose, purchase }: EditPurchaseModalProps) {
  const update = useUpdatePurchase();
  const { data: suppliersData } = useSuppliers({ limit: 1000 });
  const suppliers: any[] = Array.isArray(suppliersData) ? suppliersData : (suppliersData as any)?.data || [];

  const issueDateStr = (d: any) => {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  const [form, setForm] = useState({
    supplierId: purchase.supplierId || '',
    supplier: purchase.supplier || '',
    supplierRuc: purchase.supplierRuc || '',
    documentType: (purchase.documentType || '') as '' | 'FACTURA' | 'BOLETA' | 'GUIA' | 'NOTA_CREDITO' | 'OTRO',
    documentSeries: purchase.documentSeries || '',
    documentNumber: purchase.documentNumber || '',
    issueDate: issueDateStr(purchase.issueDate),
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        supplierId: purchase.supplierId || '',
        supplier: purchase.supplier || '',
        supplierRuc: purchase.supplierRuc || '',
        documentType: (purchase.documentType || '') as any,
        documentSeries: purchase.documentSeries || '',
        documentNumber: purchase.documentNumber || '',
        issueDate: issueDateStr(purchase.issueDate),
      });
    }
  }, [isOpen, purchase]);

  const pickSupplier = (id: string) => {
    if (!id) {
      setForm((prev) => ({ ...prev, supplierId: '', supplier: '', supplierRuc: '' }));
      return;
    }
    const s = suppliers.find((x) => x.id === id);
    if (!s) return;
    setForm((prev) => ({
      ...prev,
      supplierId: s.id,
      supplier: s.businessName || s.name || '',
      supplierRuc: s.ruc || '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier.trim()) return;
    const payload = {
      supplier: form.supplier.trim(),
      supplierId: form.supplierId || null,
      supplierRuc: form.supplierRuc.trim() || null,
      documentType: form.documentType || null,
      documentSeries: form.documentSeries.trim().toUpperCase() || null,
      documentNumber: form.documentNumber.trim() || null,
      issueDate: form.issueDate || null,
    };
    await update.mutateAsync({ id: purchase.id, data: payload });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar compra" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-start gap-3 p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
            <Pencil size={16} />
          </div>
          <div className="text-xs text-amber-800">
            Solo puedes corregir <span className="font-semibold">datos del comprobante y del proveedor</span>. Items, cantidades, precios y tipo de pago no se editan: para esos cambios anula y vuelve a registrar la compra.
          </div>
        </div>

        {/* Proveedor */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
            Proveedor <span className="text-red-500 normal-case">*</span>
          </label>
          <SmartSearchSelect
            items={suppliers}
            value={form.supplierId}
            onChange={(id) => pickSupplier(id)}
            getId={(s: any) => s.id}
            getLabel={(s: any) => s.businessName || s.name || '—'}
            getSubLabel={(s: any) => (s.ruc ? `RUC ${s.ruc}` : '')}
            searchFields={(s: any) => [s.businessName, s.name, s.ruc]}
            placeholder="Buscar proveedor por nombre o RUC…"
            emptyText="No se encontraron proveedores"
          />
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Razón social (texto)</label>
              <input
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">RUC</label>
              <input
                value={form.supplierRuc}
                onChange={(e) => setForm({ ...form, supplierRuc: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="—"
                maxLength={11}
              />
            </div>
          </div>
        </div>

        {/* Comprobante */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText size={14} className="text-primary-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Comprobante de pago</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Tipo</label>
              <select
                value={form.documentType}
                onChange={(e) => setForm({ ...form, documentType: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="">Sin comprobante</option>
                <option value="FACTURA">Factura</option>
                <option value="BOLETA">Boleta</option>
                <option value="GUIA">Guía</option>
                <option value="NOTA_CREDITO">Nota Crédito</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">F. Emisión</label>
              <input
                type="date"
                value={form.issueDate}
                onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Serie</label>
              <input
                value={form.documentSeries}
                onChange={(e) => setForm({ ...form, documentSeries: e.target.value.toUpperCase() })}
                placeholder="F001"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm uppercase"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Número</label>
              <input
                value={form.documentNumber}
                onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
                placeholder="00012345"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={update.isPending || !form.supplier.trim()}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-semibold text-sm disabled:opacity-50"
          >
            {update.isPending ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={14} />}
            {update.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
