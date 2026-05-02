import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCreatePurchase, useLastPrice } from '../hooks/usePurchases';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts, useCreateProduct } from '../../products/hooks/useProducts';
import { useCategories } from '../../categories/hooks/useCategories';
import { useLaboratories } from '../../laboratories/hooks/useLaboratories';
import { useRucLookup, useTipoCambio } from '../../../shared/hooks/useLookup';
import { useSupplierByRuc, useCreateSupplier } from '../../suppliers/hooks/useSuppliers';
import { useCashRegisterToday } from '../../cash-register/hooks/useCashRegister';
import { Modal } from '../../../shared/components/Modal';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import {
  ArrowLeft, ShoppingCart, Trash2, Search, Loader2, DollarSign, PackagePlus,
  FileText, CopyIcon, Dices, Wand2, Building2, Users, CreditCard, Package,
} from 'lucide-react';
import type { Company, Product, Category } from '../../../shared/types';
import toast from 'react-hot-toast';

const IGV_RATE = 0.18;

interface PurchaseFormItem {
  productId: string;
  quantity: number;
  lotNumber?: string;
  expirationDate?: string;
  unitPriceSinIgv: number;
  unitPriceConIgv: number;
  flete: number;
  otrosCostos: number;
  costoAdquisicion: number;
  markupPercent: number;
  precioVenta: number;
  precioVentaMode: 'markup' | 'direct';
}

const emptyItem = (): PurchaseFormItem => ({
  productId: '', quantity: 0, lotNumber: '', expirationDate: '',
  unitPriceSinIgv: 0, unitPriceConIgv: 0, flete: 0, otrosCostos: 0,
  costoAdquisicion: 0, markupPercent: 0, precioVenta: 0, precioVentaMode: 'markup',
});

function recalcItem(item: PurchaseFormItem, currency: 'PEN' | 'USD' = 'PEN', exchangeRate: number | null = null): PurchaseFormItem {
  const unitPriceConIgv = Math.round(item.unitPriceSinIgv * (1 + IGV_RATE) * 100) / 100;
  const unitPriceConIgvSoles = currency === 'USD'
    ? (exchangeRate ? unitPriceConIgv * exchangeRate : 0)
    : unitPriceConIgv;
  const costoAdquisicion = Math.round((unitPriceConIgvSoles + item.flete + item.otrosCostos) * 100) / 100;

  let precioVenta = item.precioVenta;
  let markupPercent = item.markupPercent;

  if (item.precioVentaMode === 'markup') {
    precioVenta = costoAdquisicion > 0
      ? Math.round(costoAdquisicion * (1 + markupPercent / 100) * 100) / 100
      : 0;
  } else {
    markupPercent = costoAdquisicion > 0
      ? Math.round(((precioVenta / costoAdquisicion) - 1) * 10000) / 100
      : 0;
  }

  return { ...item, unitPriceConIgv, costoAdquisicion, precioVenta, markupPercent };
}

function LastPriceBadge({ productId, supplierId }: { productId: string; supplierId: string }) {
  const { data } = useLastPrice(productId, supplierId);
  if (!data || data.unitPriceSinIgv == null) return null;
  const symbol = data.currency === 'USD' ? '$' : 'S/';
  const dateStr = data.date
    ? new Date(data.date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  const docInfo = data.documentSeries && data.documentNumber
    ? `${data.documentSeries}-${data.documentNumber}`
    : '';
  const tcInfo = data.currency === 'USD' && data.exchangeRate ? ` · TC ${data.exchangeRate.toFixed(4)}` : '';
  return (
    <div className="mt-1.5">
      <span
        className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium"
        title={[docInfo, tcInfo.trim()].filter(Boolean).join(' · ')}
      >
        Última: {symbol} {data.unitPriceSinIgv.toFixed(2)} sin IGV{dateStr ? ` — ${dateStr}` : ''}
      </span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, className = '' }: { title: string; icon: any; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Icon size={16} className="text-primary-600" />
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function NewPurchasePage() {
  const navigate = useNavigate();

  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 200 });
  const createPurchase = useCreatePurchase();
  const rucLookup = useRucLookup();
  const supplierByRuc = useSupplierByRuc();
  const createSupplier = useCreateSupplier();
  const tipoCambioMutation = useTipoCambio();
  const { data: cashRegisterToday } = useCashRegisterToday();
  const { data: categoriesData } = useCategories();
  const { data: laboratoriesData } = useLaboratories();
  const labsById = new Map<string, any>((Array.isArray(laboratoriesData) ? laboratoriesData : []).map((l: any) => [l.id, l]));
  const createProduct = useCreateProduct();
  const categories: Category[] = Array.isArray(categoriesData) ? categoriesData : (categoriesData as any)?.data || [];

  const today = new Date().toISOString().slice(0, 10);
  const [currency, setCurrency] = useState<'PEN' | 'USD'>('USD');
  const [form, setForm] = useState({
    companyId: '', supplier: '', supplierRuc: '', supplierId: '',
    paymentType: 'CONTADO' as 'CONTADO' | 'CREDITO',
    paymentScheduleType: 'SINGLE_DATE' as 'SINGLE_DATE' | 'INSTALLMENTS', dueDate: '',
    installments: [] as { amount: number; dueDate: string }[],
    items: [emptyItem()] as PurchaseFormItem[],
    purchaseDate: today,
    totalCostUsd: 0,
    totalCostPen: 0,
    documentType: 'FACTURA' as 'FACTURA' | 'BOLETA' | 'GUIA' | 'NOTA_CREDITO' | 'OTRO',
    documentSeries: '',
    documentNumber: '',
    issueDate: today,
  });
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateDate, setExchangeRateDate] = useState('');
  const [supplierLocked, setSupplierLocked] = useState(false);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [installmentGen, setInstallmentGen] = useState({ count: 6, intervalDays: 30, firstDaysFromPurchase: 30 });
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProductForIdx, setNewProductForIdx] = useState<number>(-1);
  const [newProduct, setNewProduct] = useState({ name: '', categoryId: '', laboratoryId: '', unit: 'unidad' });

  const companyList = Array.isArray(companies) ? companies : [];
  const products = productsData?.data || [];

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, emptyItem()] }));
  const repeatFromPrev = (idx: number, field: 'lotNumber' | 'expirationDate') => {
    if (idx === 0) return;
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: (items[idx - 1] as any)[field] || '' };
      return { ...prev, items };
    });
  };
  const autoGenLot = (idx: number) => {
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], lotNumber: `L-${stamp}-${String(idx + 1).padStart(2, '0')}` };
      return { ...prev, items };
    });
  };
  const removeItem = (idx: number) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, field: string, value: any) => setForm(prev => {
    const items = [...prev.items];
    let item = { ...items[idx], [field]: value };
    if (field === 'markupPercent') item.precioVentaMode = 'markup';
    if (field === 'precioVenta') item.precioVentaMode = 'direct';
    const costoFields = ['unitPriceSinIgv', 'flete', 'otrosCostos', 'markupPercent', 'precioVenta', 'productId'];
    if (costoFields.includes(field)) item = recalcItem(item, currency, exchangeRate);
    items[idx] = item;
    return { ...prev, items };
  });

  useEffect(() => {
    setForm(prev => ({ ...prev, items: prev.items.map(i => recalcItem(i, currency, exchangeRate)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, exchangeRate]);

  useEffect(() => {
    if (currency === 'USD' && form.purchaseDate && exchangeRate == null) {
      tipoCambioMutation.mutate(form.purchaseDate, {
        onSuccess: (data) => { setExchangeRate(data.venta); setExchangeRateDate(data.fecha); },
        onError: () => { setExchangeRate(null); setExchangeRateDate(''); },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDateChange = (date: string) => {
    setForm(prev => ({ ...prev, purchaseDate: date }));
    if (date && currency === 'USD') {
      tipoCambioMutation.mutate(date, {
        onSuccess: (data) => { setExchangeRate(data.venta); setExchangeRateDate(data.fecha); },
        onError: () => { setExchangeRate(null); setExchangeRateDate(''); },
      });
    }
  };

  const handleCurrencyChange = (cur: 'PEN' | 'USD') => {
    setCurrency(cur);
    if (cur === 'USD' && form.purchaseDate) {
      tipoCambioMutation.mutate(form.purchaseDate, {
        onSuccess: (data) => { setExchangeRate(data.venta); setExchangeRateDate(data.fecha); },
        onError: () => { setExchangeRate(null); setExchangeRateDate(''); },
      });
    }
  };

  const totalSoles = currency === 'USD' && exchangeRate && form.totalCostUsd ? Math.round(form.totalCostUsd * exchangeRate * 100) / 100 : 0;
  const creditTotal = currency === 'USD' ? totalSoles : form.totalCostPen;

  const itemsSubtotal = form.items.reduce((s, i) => s + (i.quantity * i.costoAdquisicion || 0), 0);

  const generateInstallments = () => {
    const { count, intervalDays, firstDaysFromPurchase } = installmentGen;
    if (count < 1) { toast.error('Ingresa al menos 1 cuota'); return; }
    if (!creditTotal || creditTotal <= 0) { toast.error('Primero ingresa el monto total de la compra'); return; }
    if (!form.purchaseDate) { toast.error('Ingresa la fecha de la compra primero'); return; }

    const base = Math.round((creditTotal / count) * 100) / 100;
    const installments: { amount: number; dueDate: string }[] = [];
    let accumulated = 0;
    const baseDate = new Date(form.purchaseDate + 'T00:00:00');

    for (let i = 0; i < count; i++) {
      const daysOffset = firstDaysFromPurchase + i * intervalDays;
      const due = new Date(baseDate);
      due.setDate(due.getDate() + daysOffset);
      const dueStr = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;

      const isLast = i === count - 1;
      const amount = isLast ? Math.round((creditTotal - accumulated) * 100) / 100 : base;
      accumulated = Math.round((accumulated + amount) * 100) / 100;

      installments.push({ amount, dueDate: dueStr });
    }
    setForm((prev) => ({ ...prev, installments }));
    toast.success(`${count} cuota${count > 1 ? 's' : ''} generada${count > 1 ? 's' : ''}`);
  };

  const openQuickProduct = (idx: number) => {
    setNewProductForIdx(idx);
    setNewProduct({ name: '', categoryId: '', laboratoryId: '', unit: 'unidad' });
    setShowNewProduct(true);
  };

  const handleCreateQuickProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { name: newProduct.name, categoryId: newProduct.categoryId, unit: newProduct.unit, prices: [] };
      if (newProduct.laboratoryId) payload.laboratoryId = newProduct.laboratoryId;
      const created = await createProduct.mutateAsync(payload);
      if (created && newProductForIdx >= 0) {
        updateItem(newProductForIdx, 'productId', created.id);
      }
      setShowNewProduct(false);
    } catch { /* error handled by hook */ }
  };

  const handleSupplierLookup = async () => {
    const ruc = form.supplierRuc.trim();
    if (ruc.length !== 11) { toast.error('El RUC debe tener 11 dígitos'); return; }

    setSupplierLoading(true);
    try {
      const localSupplier = await supplierByRuc.mutateAsync(ruc);
      if (localSupplier) {
        setForm(prev => ({ ...prev, supplier: localSupplier.businessName, supplierId: localSupplier.id }));
        setSupplierLocked(true);
        toast.success('Proveedor encontrado en el sistema');
        setSupplierLoading(false);
        return;
      }
    } catch { /* not found locally */ }

    try {
      const result = await rucLookup.mutateAsync(ruc);
      if (result.razonSocial) {
        const newSupplier = await createSupplier.mutateAsync({
          ruc,
          businessName: result.razonSocial,
          address: result.direccion || '',
        });
        setForm(prev => ({ ...prev, supplier: result.razonSocial, supplierId: newSupplier?.id || '' }));
        setSupplierLocked(true);
        toast.success('Proveedor encontrado en SUNAT y registrado');
      }
    } catch { /* toast handled by hook */ } finally {
      setSupplierLoading(false);
    }
  };

  const clearSupplier = () => {
    setForm(prev => ({ ...prev, supplier: '', supplierId: '', supplierRuc: '' }));
    setSupplierLocked(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.paymentType === 'CONTADO' && (cashRegisterToday as any)?.status === 'CLOSED') {
      toast.error('La caja del día está cerrada. No se pueden registrar compras al contado.');
      return;
    }
    if (currency === 'USD' && (!exchangeRate || !form.totalCostUsd)) { toast.error('Ingrese el monto en USD y verifique el tipo de cambio'); return; }
    if (currency === 'PEN' && !form.totalCostPen) { toast.error('Ingrese el monto en soles'); return; }
    const missingLot = form.items.find(i => {
      const p = products.find((pr: Product) => pr.id === i.productId);
      return p?.tracksLot && !i.lotNumber;
    });
    if (missingLot) { toast.error('Hay productos que requieren número de lote'); return; }
    const payload: any = {
      companyId: form.companyId, supplier: form.supplier,
      items: form.items.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitCost: i.costoAdquisicion,
        unitPriceSinIgv: i.unitPriceSinIgv,
        unitPriceConIgv: i.unitPriceConIgv,
        flete: i.flete || undefined,
        otrosCostos: i.otrosCostos || undefined,
        precioVenta: i.precioVenta || undefined,
        markupPercent: i.markupPercent || undefined,
        ...(i.lotNumber ? { lotNumber: i.lotNumber } : {}),
        ...(i.expirationDate ? { expirationDate: i.expirationDate } : {}),
      })),
      paymentType: form.paymentType,
      date: form.purchaseDate,
    };
    if (form.documentType) payload.documentType = form.documentType;
    if (form.documentSeries) payload.documentSeries = form.documentSeries;
    if (form.documentNumber) payload.documentNumber = form.documentNumber;
    if (form.issueDate) payload.issueDate = form.issueDate;
    if (currency === 'USD') {
      payload.totalCostUsd = form.totalCostUsd;
      payload.exchangeRate = exchangeRate;
      payload.exchangeRateDate = exchangeRateDate;
    } else {
      payload.totalCost = form.totalCostPen;
    }
    if (form.supplierId) payload.supplierId = form.supplierId;
    if (form.supplierRuc) payload.supplierRuc = form.supplierRuc;
    if (form.paymentType === 'CREDITO') {
      payload.paymentScheduleType = form.paymentScheduleType;
      if (form.paymentScheduleType === 'SINGLE_DATE') payload.dueDate = form.dueDate;
      if (form.paymentScheduleType === 'INSTALLMENTS') payload.installments = form.installments;
    }
    await createPurchase.mutateAsync(payload);
    navigate('/purchases');
  };

  return (
    <div className="pb-24">
      {/* Header */}
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

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Almacén y proveedor */}
          <SectionCard title="Almacén y proveedor" icon={Building2}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Almacén</label>
                <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-400" required>
                  <option value="">Seleccionar...</option>
                  {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <Users size={12} /> Proveedor
                </label>
                <div className="flex gap-2">
                  <input
                    value={form.supplierRuc}
                    onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 11); setForm({ ...form, supplierRuc: v }); if (supplierLocked) clearSupplier(); }}
                    className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="RUC (11 dígitos)"
                    maxLength={11}
                  />
                  <button
                    type="button"
                    onClick={handleSupplierLookup}
                    disabled={form.supplierRuc.length !== 11 || supplierLoading}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                  >
                    {supplierLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    Buscar
                  </button>
                  <input
                    value={form.supplier}
                    onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                    className={`flex-1 px-3 py-2 border rounded-lg text-sm ${supplierLocked ? 'bg-primary-50 border-primary-300' : 'border-gray-200'}`}
                    placeholder="Nombre del proveedor"
                    readOnly={supplierLocked}
                    required
                  />
                </div>
                {supplierLocked && (
                  <button type="button" onClick={clearSupplier} className="mt-1 text-xs text-gray-500 hover:text-red-500">
                    Limpiar proveedor y buscar otro
                  </button>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Comprobante */}
          <SectionCard title="Comprobante de pago" icon={FileText}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value as any })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="FACTURA">Factura</option>
                  <option value="BOLETA">Boleta</option>
                  <option value="GUIA">Guía</option>
                  <option value="NOTA_CREDITO">Nota Crédito</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Serie</label>
                <input value={form.documentSeries} onChange={(e) => setForm({ ...form, documentSeries: e.target.value.toUpperCase() })} placeholder="F001" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm uppercase" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Número</label>
                <input value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} placeholder="00012345" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">F. Emisión</label>
                <input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">F. Recepción</label>
                <input type="date" value={form.purchaseDate} onChange={(e) => handleDateChange(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Pago */}
        <SectionCard title="Condiciones de pago" icon={CreditCard}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Moneda</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleCurrencyChange('PEN')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${currency === 'PEN' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>S/ Soles</button>
                <button type="button" onClick={() => handleCurrencyChange('USD')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${currency === 'USD' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>$ Dólares</button>
              </div>
              {currency === 'USD' && (
                <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex items-center justify-between">
                  <span className="text-xs text-blue-700">Tipo de cambio (venta)</span>
                  <div className="flex items-center gap-2">
                    {tipoCambioMutation.isPending && <Loader2 size={14} className="animate-spin text-blue-500" />}
                    {exchangeRate != null && !tipoCambioMutation.isPending && (
                      <span className="text-sm font-medium text-blue-800">S/ {exchangeRate.toFixed(4)}</span>
                    )}
                    {!exchangeRate && !tipoCambioMutation.isPending && (
                      <span className="text-xs text-gray-400">Sin datos</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Pago</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm({ ...form, paymentType: 'CONTADO', paymentScheduleType: 'SINGLE_DATE', dueDate: '', installments: [] })} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${form.paymentType === 'CONTADO' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>Contado</button>
                <button type="button" onClick={() => setForm({ ...form, paymentType: 'CREDITO' })} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${form.paymentType === 'CREDITO' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>Crédito</button>
              </div>
            </div>
          </div>

          {form.paymentType === 'CREDITO' && (
            <div className="mt-4 space-y-3 bg-orange-50 p-3 rounded-lg border border-orange-200">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Modalidad</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm({ ...form, paymentScheduleType: 'SINGLE_DATE', installments: [] })} className={`flex-1 py-1.5 rounded text-xs font-medium border ${form.paymentScheduleType === 'SINGLE_DATE' ? 'border-orange-400 bg-white text-orange-700' : 'border-gray-200 text-gray-500'}`}>Fecha única</button>
                  <button type="button" onClick={() => setForm({ ...form, paymentScheduleType: 'INSTALLMENTS', dueDate: '' })} className={`flex-1 py-1.5 rounded text-xs font-medium border ${form.paymentScheduleType === 'INSTALLMENTS' ? 'border-orange-400 bg-white text-orange-700' : 'border-gray-200 text-gray-500'}`}>Cuotas</button>
                </div>
              </div>
              {form.paymentScheduleType === 'SINGLE_DATE' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha de vencimiento</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required />
                </div>
              )}
              {form.paymentScheduleType === 'INSTALLMENTS' && (
                <div>
                  <div className="bg-white border border-orange-300 rounded-lg p-3 mb-3 space-y-2">
                    <div className="flex items-center gap-1 text-xs font-semibold text-orange-700">
                      <Wand2 size={13} /> Generar cuotas automáticamente
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1"># de cuotas</label>
                        <input type="number" min="1" max="36" step="1" value={installmentGen.count || ''} onChange={(e) => setInstallmentGen({ ...installmentGen, count: parseInt(e.target.value) || 0 })} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Cada (días)</label>
                        <input type="number" min="1" step="1" value={installmentGen.intervalDays || ''} onChange={(e) => setInstallmentGen({ ...installmentGen, intervalDays: parseInt(e.target.value) || 0 })} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">1ra cuota (días)</label>
                        <input type="number" min="0" step="1" value={installmentGen.firstDaysFromPurchase} onChange={(e) => setInstallmentGen({ ...installmentGen, firstDaysFromPurchase: parseInt(e.target.value) || 0 })} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="text-[11px] text-gray-500">
                        {installmentGen.count > 0 && installmentGen.intervalDays > 0 && (
                          <>Total {installmentGen.count * installmentGen.intervalDays + installmentGen.firstDaysFromPurchase - installmentGen.intervalDays} días (última cuota)</>
                        )}
                      </div>
                      <button type="button" onClick={generateInstallments} className="px-3 py-1.5 bg-orange-600 text-white rounded text-xs font-medium hover:bg-orange-700 inline-flex items-center gap-1">
                        <Wand2 size={12} /> Generar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      <button type="button" onClick={() => setInstallmentGen({ count: 3, intervalDays: 30, firstDaysFromPurchase: 30 })} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded hover:bg-orange-100">3 × 30 días</button>
                      <button type="button" onClick={() => setInstallmentGen({ count: 6, intervalDays: 30, firstDaysFromPurchase: 30 })} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded hover:bg-orange-100">6 × 30 días</button>
                      <button type="button" onClick={() => setInstallmentGen({ count: 4, intervalDays: 30, firstDaysFromPurchase: 30 })} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded hover:bg-orange-100">4 × 30 días</button>
                      <button type="button" onClick={() => setInstallmentGen({ count: 5, intervalDays: 30, firstDaysFromPurchase: 30 })} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded hover:bg-orange-100">5 × 30 días</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-500">
                      Cuotas {form.installments.length > 0 && (
                        <span className="ml-1 text-[11px]">
                          (Total: S/ {form.installments.reduce((s, i) => s + (i.amount || 0), 0).toFixed(2)}
                          {creditTotal > 0 && Math.abs(form.installments.reduce((s, i) => s + (i.amount || 0), 0) - creditTotal) > 0.01 && (
                            <span className="text-red-600"> · no coincide con {creditTotal.toFixed(2)}</span>
                          )}
                          )
                        </span>
                      )}
                    </label>
                    <button type="button" onClick={() => setForm({ ...form, installments: [...form.installments, { amount: 0, dueDate: '' }] })} className="text-xs text-orange-600 hover:text-orange-800 font-medium">+ Agregar cuota</button>
                  </div>
                  {form.installments.map((inst, idx) => (
                    <div key={idx} className="flex gap-2 mb-2 items-end">
                      <div className="w-10 pb-2 text-xs text-gray-400 font-medium text-right">#{idx + 1}</div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Monto</label>
                        <input type="number" min="0.01" step="0.01" value={inst.amount || ''} onChange={(e) => { const installments = [...form.installments]; installments[idx] = { ...installments[idx], amount: parseFloat(e.target.value) || 0 }; setForm({ ...form, installments }); }} className="w-full px-2 py-1.5 border rounded text-sm" required />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                        <input type="date" value={inst.dueDate} onChange={(e) => { const installments = [...form.installments]; installments[idx] = { ...installments[idx], dueDate: e.target.value }; setForm({ ...form, installments }); }} className="w-full px-2 py-1.5 border rounded text-sm" required />
                      </div>
                      <button type="button" onClick={() => setForm({ ...form, installments: form.installments.filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-600 pb-1"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {form.installments.length === 0 && <p className="text-xs text-gray-400">Usa el generador arriba o agrega cuotas manualmente</p>}
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* Productos */}
        <SectionCard title={`Productos (${form.items.length})`} icon={Package}>
          <div className="flex items-center justify-end mb-3">
            <button type="button" onClick={addItem} className="text-sm text-primary-600 hover:text-primary-800 font-medium">+ Agregar producto</button>
          </div>
          <div className="space-y-3">
            {form.items.map((item, idx) => {
              const product = products.find((p: Product) => p.id === item.productId);
              const needsLot = product?.tracksLot;
              return (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 relative border border-gray-100">
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  )}
                  <div className="grid grid-cols-12 gap-2 items-end pr-6">
                    <div className="col-span-12 sm:col-span-5">
                      <label className="block text-xs text-gray-500 mb-1">Producto</label>
                      <div className="flex gap-1">
                        <div className="flex-1">
                          <SearchableSelect
                            options={products.map((p: Product) => {
                              const labName = p.laboratoryId ? labsById.get(p.laboratoryId)?.name : null;
                              return { value: p.id, label: labName ? `${p.name} — ${labName}` : p.name };
                            })}
                            value={item.productId}
                            onChange={(v) => updateItem(idx, 'productId', v)}
                            placeholder="Buscar producto..."
                            minChars={1}
                            required
                          />
                        </div>
                        <button type="button" onClick={() => openQuickProduct(idx)} className="px-2 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 shrink-0" title="Crear nuevo producto">
                          <PackagePlus size={16} />
                        </button>
                      </div>
                      {product?.laboratoryId && labsById.get(product.laboratoryId) && (
                        <div className="mt-1.5">
                          <span className="text-[11px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-medium">
                            Lab: {labsById.get(product.laboratoryId).name}
                          </span>
                        </div>
                      )}
                      {item.productId && form.supplierId && (
                        <LastPriceBadge productId={item.productId} supplierId={form.supplierId} />
                      )}
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                      <input type="number" min="0.01" step="0.01" value={item.quantity || ''} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 border rounded text-sm" required />
                    </div>
                    <div className="col-span-8 sm:col-span-3">
                      <label className="block text-xs text-gray-500 mb-1 flex items-center justify-between">
                        <span>Lote {needsLot && <span className="text-red-500">*</span>}</span>
                        <span className="flex gap-1">
                          {idx > 0 && <button type="button" onClick={() => repeatFromPrev(idx, 'lotNumber')} className="text-gray-400 hover:text-primary-600" title="Copiar del anterior"><CopyIcon size={11} /></button>}
                          <button type="button" onClick={() => autoGenLot(idx)} className="text-gray-400 hover:text-primary-600" title="Generar lote"><Dices size={11} /></button>
                        </span>
                      </label>
                      <input value={item.lotNumber || ''} onChange={(e) => updateItem(idx, 'lotNumber', e.target.value)} placeholder={needsLot ? 'L-20260415-01' : 'Opcional'} className={`w-full px-2 py-1.5 border rounded text-sm ${needsLot && !item.lotNumber ? 'border-red-300 bg-red-50' : product && !needsLot ? 'bg-gray-100 text-gray-500' : ''}`} />
                    </div>
                    <div className="col-span-12 sm:col-span-2">
                      <label className="block text-xs text-gray-500 mb-1 flex items-center justify-between">
                        <span>Vence</span>
                        {idx > 0 && <button type="button" onClick={() => repeatFromPrev(idx, 'expirationDate')} className="text-gray-400 hover:text-primary-600" title="Copiar del anterior"><CopyIcon size={11} /></button>}
                      </label>
                      <input type="date" value={item.expirationDate || ''} onChange={(e) => updateItem(idx, 'expirationDate', e.target.value)} className={`w-full px-2 py-1.5 border rounded text-sm ${product && !needsLot ? 'bg-gray-100 text-gray-500' : ''}`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-1.5 items-end mt-2 pt-2 border-t border-gray-200 pr-6">
                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-[10px] text-gray-500 mb-0.5">P.U. sin IGV ({currency === 'USD' ? '$' : 'S/'})</label>
                      <input type="number" min="0" step="0.01" value={item.unitPriceSinIgv || ''} onChange={(e) => updateItem(idx, 'unitPriceSinIgv', parseFloat(e.target.value) || 0)} className="w-full px-1.5 py-1 border rounded text-xs" placeholder="0.00" />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-[10px] text-gray-500 mb-0.5">PC + IGV ({currency === 'USD' ? '$' : 'S/'})</label>
                      <input type="text" readOnly value={item.unitPriceConIgv ? item.unitPriceConIgv.toFixed(2) : '0.00'} className="w-full px-1.5 py-1 border border-green-200 rounded text-xs bg-green-50 text-green-800 font-medium" />
                    </div>
                    <div className="col-span-4 sm:col-span-1">
                      <label className="block text-[10px] text-gray-500 mb-0.5">Flete (S/)</label>
                      <input type="number" min="0" step="0.01" value={item.flete || ''} onChange={(e) => updateItem(idx, 'flete', parseFloat(e.target.value) || 0)} className="w-full px-1.5 py-1 border rounded text-xs" placeholder="0" />
                    </div>
                    <div className="col-span-4 sm:col-span-1">
                      <label className="block text-[10px] text-gray-500 mb-0.5">Otros (S/)</label>
                      <input type="number" min="0" step="0.01" value={item.otrosCostos || ''} onChange={(e) => updateItem(idx, 'otrosCostos', parseFloat(e.target.value) || 0)} className="w-full px-1.5 py-1 border rounded text-xs" placeholder="0" />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-[10px] text-gray-500 mb-0.5">C. Adquisición (S/)</label>
                      <input type="text" readOnly value={item.costoAdquisicion ? item.costoAdquisicion.toFixed(2) : '0.00'} className="w-full px-1.5 py-1 border border-green-200 rounded text-xs bg-green-50 text-green-800 font-semibold" />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-[10px] text-gray-500 mb-0.5">% Margen</label>
                      <input type="number" min="0" step="0.1" value={item.markupPercent || ''} onChange={(e) => updateItem(idx, 'markupPercent', parseFloat(e.target.value) || 0)} className={`w-full px-1.5 py-1 border rounded text-xs ${item.precioVentaMode === 'direct' ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`} placeholder="30" />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-[10px] text-gray-500 mb-0.5">P. Venta</label>
                      <input type="number" min="0" step="0.01" value={item.precioVenta || ''} onChange={(e) => updateItem(idx, 'precioVenta', parseFloat(e.target.value) || 0)} className={`w-full px-1.5 py-1 border rounded text-xs ${item.precioVentaMode === 'markup' ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`} placeholder="0.00" />
                    </div>
                  </div>
                  {item.quantity > 0 && item.costoAdquisicion > 0 && (
                    <div className="mt-1.5 text-right pr-6">
                      <span className="text-[10px] text-gray-500">Subtotal: </span>
                      <span className="text-xs font-semibold text-gray-700">S/ {(item.quantity * item.costoAdquisicion).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Totales */}
        <SectionCard title="Total de la compra" icon={DollarSign}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currency === 'PEN' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monto Total (Soles)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">S/</span>
                  <input type="number" min="0.01" step="0.01" value={form.totalCostPen || ''} onChange={(e) => setForm({ ...form, totalCostPen: parseFloat(e.target.value) || 0 })} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" placeholder="0.00" required />
                </div>
              </div>
            )}
            {currency === 'USD' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monto Total (USD)</label>
                <div className="relative">
                  <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="number" min="0.01" step="0.01" value={form.totalCostUsd || ''} onChange={(e) => setForm({ ...form, totalCostUsd: parseFloat(e.target.value) || 0 })} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" placeholder="0.00" required />
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Subtotal por items (calculado)</span>
                <span>S/ {itemsSubtotal.toFixed(2)}</span>
              </div>
              {currency === 'USD' && exchangeRate != null && form.totalCostUsd > 0 && (
                <div className="flex items-center justify-between text-xs text-blue-600">
                  <span>Total en Soles (×{exchangeRate.toFixed(4)})</span>
                  <span className="font-semibold">S/ {totalSoles.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">Total</span>
                <span className="text-xl font-bold text-primary-700">
                  {currency === 'USD' ? `$ ${(form.totalCostUsd || 0).toFixed(2)}` : `S/ ${(form.totalCostPen || 0).toFixed(2)}`}
                </span>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Barra de acciones sticky */}
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white border-t border-gray-200 px-4 lg:px-8 py-3 z-10 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-3 max-w-full">
            <div className="text-xs text-gray-500 hidden sm:block">
              {form.items.length} producto{form.items.length !== 1 ? 's' : ''}
              {creditTotal > 0 && <> · Total <span className="font-semibold text-gray-700">S/ {creditTotal.toFixed(2)}</span></>}
            </div>
            <div className="flex gap-2 ml-auto">
              <Link to="/purchases" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Cancelar</Link>
              <button type="submit" disabled={(currency === 'USD' ? (!exchangeRate || !form.totalCostUsd) : !form.totalCostPen) || createPurchase.isPending} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                {createPurchase.isPending ? 'Registrando...' : 'Registrar Compra'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Modal crear producto rápido */}
      <Modal isOpen={showNewProduct} onClose={() => setShowNewProduct(false)} title="Crear Producto Rápido">
        <form onSubmit={handleCreateQuickProduct} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del producto</label>
            <input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Ej: Agrifo, Campal..." required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select value={newProduct.categoryId} onChange={(e) => setNewProduct({ ...newProduct, categoryId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required>
              <option value="">Seleccionar...</option>
              {categories.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Laboratorio <span className="text-gray-400 font-normal">(opcional)</span></label>
            <select value={newProduct.laboratoryId} onChange={(e) => setNewProduct({ ...newProduct, laboratoryId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Sin laboratorio</option>
              {(Array.isArray(laboratoriesData) ? laboratoriesData : []).filter((l: any) => l.isActive).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
            <select value={newProduct.unit} onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="unidad">Unidad</option>
              <option value="kg">Kilogramo</option>
              <option value="litro">Litro</option>
              <option value="saco">Saco</option>
              <option value="caja">Caja</option>
            </select>
          </div>
          <button type="submit" disabled={createProduct.isPending} className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
            {createProduct.isPending ? 'Creando...' : 'Crear Producto'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
