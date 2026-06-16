import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLastPrice } from '../hooks/usePurchases';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts, useCreateProduct } from '../../products/hooks/useProducts';
import { useCategories } from '../../categories/hooks/useCategories';
import { useLaboratories } from '../../laboratories/hooks/useLaboratories';
import { useUnits } from '../../units/hooks/useUnits';
import { usePriceTiers } from '../../price-tiers/hooks/usePriceTiers';
import { useSupplierByRuc, useCreateSupplier } from '../../suppliers/hooks/useSuppliers';
import { useTodayTipoCambio } from '../../../shared/hooks/useLookup';
import { useCashRegisterToday } from '../../cash-register/hooks/useCashRegister';
import { Modal } from '../../../shared/components/Modal';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { SmartSearchSelect } from '../../../shared/components/SmartSearchSelect';
import {
  Trash2, Loader2, DollarSign, PackagePlus, FileText, CopyIcon, Dices, Wand2,
  Building2, CreditCard, Package, FlaskConical, CheckCircle, Truck,
} from 'lucide-react';
import type { Company, Product, Category, Laboratory } from '../../../shared/types';
import toast from 'react-hot-toast';
import {
  blurOnWheel,
  fmtPrice,
  emptyItem,
  recalcItem,
  itemAppliesIgv,
  type PurchaseFormItem,
  type PurchaseInitial,
} from '../utils/purchaseForm';

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
        Última: {symbol} {fmtPrice(data.unitPriceSinIgv)} sin IGV{dateStr ? ` — ${dateStr}` : ''}
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

export interface PurchaseFormBodyProps {
  mode: 'create' | 'edit';
  initial: PurchaseInitial;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  onSubmit: (payload: PurchaseSubmitPayload) => Promise<void> | void;
  onCancelHref: string;
  warningBanner?: React.ReactNode;
}

export interface PurchaseSubmitPayload {
  supplier: string;
  supplierId?: string;
  supplierRuc?: string;
  documentType?: string;
  documentSeries?: string;
  documentNumber?: string;
  issueDate?: string;
  grSeries?: string;
  grNumber?: string;
  grDate?: string;
  date: string;
  paymentType: 'CONTADO' | 'CREDITO' | 'BONIFICACION';
  addToStock?: boolean;
  paymentScheduleType?: 'SINGLE_DATE' | 'INSTALLMENTS';
  currency: 'PEN' | 'USD';
  exchangeRate?: number | null;
  exchangeRateDate?: string;
  totalCost?: number;
  totalCostUsd?: number;
  dueDate?: string;
  installments?: { amount: number; dueDate: string; status?: 'PENDING' | 'PAID' }[];
  items: Array<{
    companyId: string;
    productId: string;
    quantity: number;
    unitCost: number;
    unitPriceSinIgv: number;
    unitPriceConIgv: number;
    precioVenta?: number;
    markupPercent?: number;
    lotNumber?: string;
    expirationDate?: string;
  }>;
  reason?: string;
}

export function PurchaseFormBody({
  mode,
  initial,
  submitLabel,
  submittingLabel,
  isSubmitting,
  onSubmit,
  onCancelHref,
  warningBanner,
}: PurchaseFormBodyProps) {
  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 10000 });
  const supplierByRuc = useSupplierByRuc();
  const createSupplier = useCreateSupplier();
  const { data: cashRegisterToday } = useCashRegisterToday();
  const { data: categoriesData } = useCategories();
  const { data: laboratoriesData } = useLaboratories();
  const { data: unitsData } = useUnits();
  const { data: priceTiersData } = usePriceTiers();
  const priceTiers: any[] = Array.isArray(priceTiersData) ? priceTiersData : [];
  const allUnits: { value: string; label: string }[] = Array.isArray(unitsData)
    ? unitsData.filter((u: any) => u.isActive).map((u: any) => ({ value: u.name, label: u.abbreviation ? `${u.name} (${u.abbreviation})` : u.name }))
    : [];
  const labs: Laboratory[] = (Array.isArray(laboratoriesData) ? laboratoriesData : []).filter((l: Laboratory) => l.isActive !== false);
  const createProduct = useCreateProduct();
  const categories: Category[] = Array.isArray(categoriesData) ? categoriesData : (categoriesData as any)?.data || [];

  const [currency, setCurrency] = useState<'PEN' | 'USD'>(initial.currency);
  const [form, setForm] = useState(initial.state);
  const [exchangeRate, setExchangeRate] = useState<number | null>(initial.exchangeRate);
  const [exchangeRateDate, setExchangeRateDate] = useState(initial.exchangeRateDate);
  const [exchangeRateFromSunat, setExchangeRateFromSunat] = useState(false);

  // Al registrar una compra nueva en USD, sugerir el tipo de cambio SUNAT del día
  const { data: tipoCambioData } = useTodayTipoCambio(mode === 'create' && currency === 'USD');
  useEffect(() => {
    if (mode === 'create' && currency === 'USD' && exchangeRate == null && tipoCambioData?.venta) {
      setExchangeRate(tipoCambioData.venta);
      setExchangeRateDate(tipoCambioData.fecha);
      setExchangeRateFromSunat(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoCambioData, currency, mode]);
  const [labResolving, setLabResolving] = useState(false);
  const [installmentGen, setInstallmentGen] = useState(() => ({
    count: initial.state.installments.length || 6,
    intervalDays: 15,
    firstDaysFromPurchase: 15,
  }));
  const [scrollToLast, setScrollToLast] = useState(false);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProductForIdx, setNewProductForIdx] = useState<number>(-1);
  const [newProduct, setNewProduct] = useState({
    name: '', description: '', categoryId: '', laboratoryId: '', unit: 'unidad',
    activeIngredient: '', taxType: 'GRAVADO' as 'GRAVADO' | 'EXONERADO' | 'INAFECTO', tracksLot: false,
    companyId: '',
  });
  const [reason, setReason] = useState('');

  const companyList = Array.isArray(companies) ? companies : [];
  const products = useMemo(() => {
    const raw: any = productsData;
    const list: any[] = Array.isArray(raw) ? raw : raw?.data || [];
    return list.filter((p) => p.isActive !== false);
  }, [productsData]);

  const addItem = () => {
    setForm(prev => {
      const last = prev.items[prev.items.length - 1];
      const next = emptyItem();
      if (last?.companyId) next.companyId = last.companyId;
      return { ...prev, items: [...prev.items, next] };
    });
    setScrollToLast(true);
  };
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

  const seedPrecioVentaFromProduct = (productId: string): number => {
    const prod = products.find((pr: Product) => pr.id === productId);
    if (!prod || !prod.prices?.length) return 0;
    const sortedTiers = priceTiers.slice().sort((a, b) => (a.priority || 0) - (b.priority || 0));
    for (const t of sortedTiers) {
      const found = prod.prices.find((px: any) => px.priceTierId === t.id && !px.companyId && px.price > 0);
      if (found) return found.price;
    }
    const anyGlobal = prod.prices.find((px: any) => !px.companyId && px.price > 0);
    if (anyGlobal) return anyGlobal.price;
    const anyPrice = prod.prices.find((px: any) => px.price > 0);
    return anyPrice?.price || 0;
  };

  const updateItem = (idx: number, field: string, value: any) => setForm(prev => {
    const items = [...prev.items];
    let item = { ...items[idx], [field]: value };
    if (field === 'unitPriceSinIgv') {
      const raw = String(value);
      item.unitPriceSinIgvInput = raw;
      item.unitPriceSinIgv = raw === '' ? 0 : (parseFloat(raw) || 0);
    }
    if (field === 'markupPercent') item.precioVentaMode = 'markup';
    if (field === 'precioVenta') item.precioVentaMode = 'direct';
    if (field === 'productId') {
      const catalogPrice = seedPrecioVentaFromProduct(value);
      item.precioVenta = catalogPrice;
      item.markupPercent = 0;
      item.precioVentaMode = catalogPrice > 0 ? 'direct' : 'markup';
    }
    const costoFields = ['unitPriceSinIgv', 'markupPercent', 'precioVenta', 'productId'];
    if (costoFields.includes(field)) item = recalcItem(item, currency, exchangeRate, itemAppliesIgv(item.productId, products));
    items[idx] = item;
    return { ...prev, items };
  });

  useEffect(() => {
    setForm(prev => ({ ...prev, items: prev.items.map(i => recalcItem(i, currency, exchangeRate, itemAppliesIgv(i.productId, products))) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, exchangeRate]);


  useEffect(() => {
    if (scrollToLast) {
      const last = itemRefs.current[form.items.length - 1];
      last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = last?.querySelector('input[type="text"]') as HTMLInputElement | null;
      input?.focus();
      setScrollToLast(false);
    }
  }, [scrollToLast, form.items.length]);

  const handleDateChange = (date: string) => {
    setForm(prev => ({ ...prev, purchaseDate: date }));
  };

  const handleCurrencyChange = (cur: 'PEN' | 'USD') => {
    setCurrency(cur);
  };

  const documentTotal = Math.round(form.items.reduce((s, i) => s + (i.quantity * i.unitPriceConIgv || 0), 0) * 100) / 100;
  const totalSoles = currency === 'USD' && exchangeRate && documentTotal ? Math.round(documentTotal * exchangeRate * 100) / 100 : 0;
  const creditTotal = documentTotal;
  const creditSymbol = currency === 'USD' ? '$' : 'S/';

  const itemsSubtotal = Math.round(form.items.reduce((s, i) => s + (i.quantity * i.costoAdquisicion || 0), 0) * 100) / 100;

  const originalTotalForDiff = currency === 'USD' && initial.originalTotalUsd ? initial.originalTotalUsd : initial.originalTotal;
  const diff = mode === 'edit' ? Math.round((documentTotal - originalTotalForDiff) * 100) / 100 : 0;

  const generateInstallments = () => {
    const { count, intervalDays, firstDaysFromPurchase } = installmentGen;
    if (count < 1) { toast.error('Ingresa al menos 1 cuota'); return; }
    if (!creditTotal || creditTotal <= 0) { toast.error('Primero ingresa el monto total de la compra'); return; }
    // Las cuotas se cuentan desde la fecha de EMISIÓN de la factura (fecha legal del
    // crédito), con fallback a la fecha de recepción si no se indicó.
    const refDate = form.issueDate || form.purchaseDate;
    if (!refDate) { toast.error('Ingresa la fecha de emisión o recepción primero'); return; }

    const base = Math.round((creditTotal / count) * 100) / 100;
    const installments: { amount: number; dueDate: string }[] = [];
    let accumulated = 0;
    const baseDate = new Date(refDate + 'T00:00:00');

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
    setNewProduct({
      name: '', description: '', categoryId: '', laboratoryId: '',
      unit: allUnits[0]?.value || 'unidad',
      activeIngredient: '', taxType: 'GRAVADO', tracksLot: false,
      companyId: form.items[idx]?.companyId || '',
    });
    setShowNewProduct(true);
  };

  const handleCreateQuickProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name.trim()) { toast.error('Ingresa el nombre del producto'); return; }
    if (!newProduct.companyId) { toast.error('Selecciona el almacén'); return; }
    if (!newProduct.categoryId) { toast.error('Selecciona la categoría'); return; }
    try {
      const payload: any = {
        name: newProduct.name.trim(),
        categoryId: newProduct.categoryId,
        unit: newProduct.unit,
        taxType: newProduct.taxType,
        tracksLot: newProduct.tracksLot,
        prices: [],
      };
      if (newProduct.description.trim()) payload.description = newProduct.description.trim();
      if (newProduct.activeIngredient.trim()) payload.activeIngredient = newProduct.activeIngredient.trim();
      if (newProduct.laboratoryId) payload.laboratoryId = newProduct.laboratoryId;
      const created = await createProduct.mutateAsync(payload);
      if (created && newProductForIdx >= 0) {
        updateItem(newProductForIdx, 'productId', created.id);
        if (newProduct.companyId) {
          updateItem(newProductForIdx, 'companyId', newProduct.companyId);
        }
      }
      setShowNewProduct(false);
    } catch { /* error handled by hook */ }
  };

  const clearLaboratory = () => {
    setForm(prev => ({ ...prev, supplier: '', supplierId: '', supplierRuc: '', laboratoryId: '' }));
  };

  const resolveSupplierIdByRuc = async (ruc: string, fallbackName: string, fallbackAddress?: string): Promise<string> => {
    try {
      const existing = await supplierByRuc.mutateAsync(ruc);
      if (existing?.id) return existing.id;
    } catch { /* not found, will create */ }
    try {
      const created = await createSupplier.mutateAsync({
        ruc,
        businessName: fallbackName,
        address: fallbackAddress || '',
      });
      return created?.id || '';
    } catch {
      return '';
    }
  };

  const pickLaboratory = async (id: string) => {
    if (!id) { clearLaboratory(); return; }
    const lab = labs.find((l) => l.id === id);
    if (!lab) return;

    setForm(prev => ({
      ...prev,
      laboratoryId: lab.id,
      supplier: lab.name,
      supplierRuc: lab.ruc || '',
      supplierId: '',
    }));

    if (!lab.ruc) {
      toast('Este laboratorio no tiene RUC. Edítalo en Laboratorios para vincularlo a Cuentas por Pagar.', { icon: '⚠️' });
      return;
    }

    setLabResolving(true);
    try {
      const supplierId = await resolveSupplierIdByRuc(lab.ruc, lab.name, lab.address);
      setForm(prev => ({ ...prev, supplierId }));
    } finally {
      setLabResolving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'create' && form.paymentType === 'CONTADO' && (cashRegisterToday as any)?.status === 'CLOSED') {
      toast.error('La caja del día está cerrada. No se pueden registrar compras al contado.');
      return;
    }
    if (!form.supplier.trim()) { toast.error('Selecciona un laboratorio'); return; }
    const hasValidItems = form.items.some(i => i.productId && i.quantity > 0);
    if (!hasValidItems) { toast.error('Agrega al menos un producto con cantidad mayor a 0'); return; }
    const missingCompany = form.items.find(i => !i.companyId);
    if (missingCompany) { toast.error('Selecciona el almacén destino para cada producto'); return; }
    const missingLot = form.items.find(i => {
      const p = products.find((pr: Product) => pr.id === i.productId);
      return p?.tracksLot && !i.lotNumber;
    });
    if (missingLot) { toast.error('Hay productos que requieren número de lote'); return; }
    if (currency === 'USD' && !(exchangeRate && exchangeRate > 0)) {
      toast.error('Ingresa el tipo de cambio para compras en dólares');
      return;
    }
    if (mode === 'edit' && reason.trim().length < 5) {
      toast.error('Indica el motivo del cambio (mínimo 5 caracteres)');
      return;
    }
    if (form.paymentType === 'CREDITO' && form.paymentScheduleType === 'INSTALLMENTS') {
      const sumInst = form.installments.reduce((s, i) => s + (i.amount || 0), 0);
      if (Math.abs(sumInst - creditTotal) > 0.01) {
        toast.error(`Las cuotas (${creditSymbol} ${sumInst.toFixed(2)}) no suman el total (${creditSymbol} ${creditTotal.toFixed(2)})`);
        return;
      }
    }

    const payload: PurchaseSubmitPayload = {
      supplier: form.supplier,
      items: form.items.map(i => ({
        companyId: i.companyId,
        productId: i.productId,
        quantity: i.quantity,
        unitCost: i.costoEnSoles,
        unitPriceSinIgv: i.unitPriceSinIgv,
        unitPriceConIgv: i.unitPriceConIgv,
        precioVenta: i.precioVenta || undefined,
        markupPercent: i.markupPercent || undefined,
        ...(i.lotNumber ? { lotNumber: i.lotNumber } : {}),
        ...(i.expirationDate ? { expirationDate: i.expirationDate } : {}),
      })),
      paymentType: form.paymentType,
      date: form.purchaseDate,
      currency,
    };
    if (form.documentType) payload.documentType = form.documentType;
    if (form.documentSeries) payload.documentSeries = form.documentSeries;
    if (form.documentNumber) payload.documentNumber = form.documentNumber;
    if (form.issueDate) payload.issueDate = form.issueDate;
    if (form.grSeries) payload.grSeries = form.grSeries;
    if (form.grNumber) payload.grNumber = form.grNumber;
    if (form.grDate) payload.grDate = form.grDate;
    if (currency === 'USD') {
      payload.totalCostUsd = documentTotal;
      payload.exchangeRate = exchangeRate;
      payload.exchangeRateDate = exchangeRateDate;
      payload.totalCost = totalSoles;
    } else {
      payload.totalCost = documentTotal;
    }
    if (form.supplierId) payload.supplierId = form.supplierId;
    if (form.supplierRuc) payload.supplierRuc = form.supplierRuc;
    if (form.paymentType === 'CREDITO') {
      payload.paymentScheduleType = form.paymentScheduleType;
      if (form.paymentScheduleType === 'SINGLE_DATE') payload.dueDate = form.dueDate;
      if (form.paymentScheduleType === 'INSTALLMENTS') payload.installments = form.installments;
    }
    if (form.paymentType === 'BONIFICACION') {
      payload.addToStock = form.addToStock;
      payload.totalCost = 0;
      payload.totalCostUsd = undefined;
    }
    if (mode === 'edit') payload.reason = reason.trim();

    await onSubmit(payload);
  };

  return (
    <div className="pb-24">
      <form onSubmit={handleSubmit} className="space-y-5">
        {warningBanner}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Laboratorio */}
          <SectionCard title="Laboratorio" icon={FlaskConical}>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <FlaskConical size={12} /> Laboratorio (proveedor)
                </label>
                <SmartSearchSelect
                  items={labs}
                  value={form.laboratoryId}
                  onChange={(id) => { pickLaboratory(id); }}
                  getId={(l: Laboratory) => l.id}
                  getLabel={(l: Laboratory) => l.name}
                  getSubLabel={(l: Laboratory) => (l.ruc ? `RUC ${l.ruc}` : 'Sin RUC')}
                  searchFields={(l: Laboratory) => [l.name, l.ruc]}
                  placeholder="Buscar laboratorio por nombre o RUC…"
                  emptyText="No se encontraron laboratorios. Crea uno en Laboratorios."
                />
                {form.laboratoryId && labResolving && (
                  <p className="mt-2 text-[11px] text-gray-500 inline-flex items-center gap-1">
                    <Loader2 size={11} className="animate-spin" /> Vinculando con cuentas por pagar…
                  </p>
                )}
                {form.laboratoryId && !form.supplierRuc && !labResolving && (
                  <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    Este laboratorio no tiene RUC. Para que la compra a crédito quede vinculada, agrégale el RUC en <Link to="/laboratories" className="underline font-medium">Laboratorios</Link>.
                  </p>
                )}
                {!form.laboratoryId && labs.length === 0 && (
                  <p className="mt-2 text-[11px] text-gray-500">
                    Aún no tienes laboratorios. <Link to="/laboratories" className="text-primary-700 underline font-medium">Agrega uno</Link> antes de continuar.
                  </p>
                )}
                {mode === 'edit' && form.supplier && !form.laboratoryId && (
                  <p className="mt-2 text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
                    Proveedor actual: <span className="font-semibold">{form.supplier}</span>{form.supplierRuc ? ` (RUC ${form.supplierRuc})` : ''}.
                  </p>
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

        {/* Guía de Remisión */}
        <SectionCard title="Guía de Remisión" icon={Truck}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Serie</label>
              <input
                value={form.grSeries}
                onChange={(e) => setForm({ ...form, grSeries: e.target.value.toUpperCase() })}
                placeholder="T001"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Correlativo</label>
              <input
                value={form.grNumber}
                onChange={(e) => setForm({ ...form, grNumber: e.target.value })}
                placeholder="00000001"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
              <input
                type="date"
                value={form.grDate}
                onChange={(e) => setForm({ ...form, grDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>
        </SectionCard>

        {/* Productos */}
        <SectionCard title={`Productos (${form.items.length})`} icon={Package}>
          <div className="space-y-3">
            {form.items.map((item, idx) => {
              const product = products.find((p: Product) => p.id === item.productId);
              const needsLot = product?.tracksLot;
              return (
                <div key={idx} ref={(el) => { itemRefs.current[idx] = el; }} className="bg-gray-50 rounded-lg p-3 relative border border-gray-100">
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  )}
                  <div className="grid grid-cols-12 gap-2 items-end pr-6">
                    <div className="col-span-12 sm:col-span-5">
                      <label className="block text-xs text-gray-500 mb-1">Producto</label>
                      <div className="flex gap-1">
                        <div className="flex-1">
                          <SearchableSelect
                            options={products.map((p: Product) => ({ value: p.id, label: p.name }))}
                            value={item.productId}
                            onChange={(v) => updateItem(idx, 'productId', v)}
                            placeholder="Buscar producto..."
                            minChars={1}
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => openQuickProduct(idx)}
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-100 hover:border-primary-300 text-sm font-semibold transition-colors"
                          title="Crear nuevo producto"
                        >
                          <PackagePlus size={16} />
                          <span className="hidden sm:inline">Nuevo</span>
                        </button>
                      </div>
                      {item.productId && form.supplierId && (
                        <LastPriceBadge productId={item.productId} supplierId={form.supplierId} />
                      )}
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                      <input type="number" min="0.01" step="0.01" value={item.quantity || ''} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} onWheel={blurOnWheel} className="w-full px-2 py-1.5 border rounded text-sm" required />
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
                  {(() => {
                    const sym = currency === 'USD' ? '$' : 'S/';
                    const appliesIgv = itemAppliesIgv(item.productId, products);
                    const taxType = (product as any)?.taxType;
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-12 gap-3 pr-6">
                        {/* Costo de compra */}
                        <div className="col-span-12 lg:col-span-5">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center justify-between">
                            <span>Costo de compra</span>
                            {product && !appliesIgv && (
                              <span className="text-[10px] font-semibold normal-case tracking-normal px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded">
                                {taxType === 'EXONERADO' ? 'Exonerado · sin IGV' : 'Inafecto · sin IGV'}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] text-gray-500 mb-1">P.U. sin IGV ({sym}) <span className="text-gray-400 font-normal">— hasta 4 dec.</span></label>
                              <input type="number" min="0" step="0.0001" value={item.unitPriceSinIgvInput} onChange={(e) => updateItem(idx, 'unitPriceSinIgv', e.target.value)} onWheel={blurOnWheel} className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400" placeholder="0.0000" />
                            </div>
                            <div>
                              <label className="block text-[11px] text-gray-500 mb-1">{appliesIgv ? `+ IGV (${sym})` : `Total (${sym})`}</label>
                              <input
                                type="text"
                                readOnly
                                value={fmtPrice(item.unitPriceConIgv)}
                                className={`w-full px-2.5 py-2 border rounded-lg text-sm tabular-nums font-medium ${
                                  appliesIgv
                                    ? 'border-primary-200 bg-primary-50 text-primary-800'
                                    : 'border-gray-200 bg-gray-100 text-gray-600'
                                }`}
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[11px] text-gray-500 mb-1 flex items-center gap-1">
                                <Building2 size={11} /> Almacén destino <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={item.companyId}
                                onChange={(e) => updateItem(idx, 'companyId', e.target.value)}
                                className={`w-full px-2.5 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${item.companyId ? 'border-gray-200' : 'border-red-300 bg-red-50'}`}
                                required
                              >
                                <option value="">Seleccionar almacén...</option>
                                {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Costo final */}
                        <div className="col-span-6 lg:col-span-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Costo final</div>
                          <div className="bg-gradient-to-br from-primary-50 to-primary-100/60 border-2 border-primary-200 rounded-xl px-4 py-3 h-[calc(100%-26px)]">
                            <div className="text-[10px] uppercase text-primary-700 font-semibold tracking-wider">Costo de adquisición</div>
                            <div className="text-xl font-bold text-primary-800 tabular-nums mt-1">{sym} {fmtPrice(item.costoAdquisicion)}</div>
                            {item.quantity > 0 && item.costoAdquisicion > 0 && (
                              <div className="text-[11px] text-primary-700/80 mt-1">
                                × {item.quantity} = <span className="font-semibold tabular-nums">{sym} {(item.quantity * item.costoAdquisicion).toFixed(2)}</span>
                              </div>
                            )}
                            {currency === 'USD' && exchangeRate && item.costoEnSoles > 0 && (
                              <div className="text-[10px] text-primary-700/70 mt-1 italic">≈ S/ {fmtPrice(item.costoEnSoles)} {item.quantity > 0 && <>· × {item.quantity} = S/ {(item.quantity * item.costoEnSoles).toFixed(2)}</>}</div>
                            )}
                          </div>
                        </div>

                        {/* Precio de venta */}
                        <div className="col-span-6 lg:col-span-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1">
                            <DollarSign size={11} /> Precio de venta
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] text-gray-500 mb-1">% Margen</label>
                              <input
                                type="number" min="0" step="0.01"
                                value={item.markupPercent || ''}
                                onChange={(e) => updateItem(idx, 'markupPercent', parseFloat(e.target.value) || 0)}
                                onWheel={blurOnWheel}
                                className={`w-full px-2.5 py-2 border rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                                  item.precioVentaMode === 'markup' ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold' : 'border-gray-200'
                                }`}
                                placeholder="30"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-gray-500 mb-1">P. Venta (S/)</label>
                              <input
                                type="number" min="0" step="0.01"
                                value={item.precioVenta || ''}
                                onChange={(e) => updateItem(idx, 'precioVenta', parseFloat(e.target.value) || 0)}
                                onWheel={blurOnWheel}
                                className={`w-full px-2.5 py-2 border rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                                  item.precioVentaMode === 'direct' ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold' : 'border-gray-200'
                                }`}
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1.5">El campo en azul es el que controla al otro automáticamente.</div>
                          {item.productId && (() => {
                            const ref = seedPrecioVentaFromProduct(item.productId);
                            if (!ref) return null;
                            return <div className="text-[10px] text-indigo-600 mt-1">Precio actual en catálogo: S/ {ref.toFixed(2)}</div>;
                          })()}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addItem}
            className="mt-3 w-full py-3 border-2 border-dashed border-primary-200 rounded-lg text-sm font-semibold text-primary-700 hover:border-primary-400 hover:bg-primary-50 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Package size={16} /> + Agregar producto
          </button>
        </SectionCard>

        {/* Totales */}
        <SectionCard title="Total de la compra" icon={DollarSign}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Moneda</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleCurrencyChange('PEN')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${currency === 'PEN' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>S/ Soles</button>
                <button type="button" onClick={() => handleCurrencyChange('USD')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${currency === 'USD' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>$ Dólares</button>
              </div>
              {currency === 'USD' && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Tipo de cambio (S/ por $) <span className="text-red-500">*</span>
                    {exchangeRateFromSunat && (
                      <span className="ml-1 text-[10px] font-normal text-blue-600">(SUNAT {exchangeRateDate})</span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.0001"
                    value={exchangeRate ?? ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setExchangeRate(isNaN(v) || v <= 0 ? null : v);
                      setExchangeRateFromSunat(false);
                      setExchangeRateDate('');
                    }}
                    placeholder="Ej: 3.7500"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Costo unitario × cantidad (con IGV)</span>
                <span className="font-medium">{currency === 'USD' ? '$' : 'S/'} {documentTotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Subtotal con flete y otros (S/)</span>
                <span>S/ {itemsSubtotal.toFixed(2)}</span>
              </div>
              {currency === 'USD' && exchangeRate != null && documentTotal > 0 && (
                <div className="flex items-center justify-between text-xs text-blue-600">
                  <span>Total en Soles (×{exchangeRate.toFixed(4)})</span>
                  <span className="font-semibold">S/ {totalSoles.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">Total de la compra</span>
                <span className="text-xl font-bold text-primary-700">
                  {currency === 'USD' ? `$ ${documentTotal.toFixed(2)}` : `S/ ${documentTotal.toFixed(2)}`}
                </span>
              </div>
              {mode === 'edit' && originalTotalForDiff > 0 && (
                <div className={`flex items-center justify-between pt-1 text-xs font-medium ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-700' : 'text-gray-500'}`}>
                  <span>Diferencia vs. total original ({creditSymbol} {originalTotalForDiff.toFixed(2)})</span>
                  <span>{diff > 0 ? '+' : ''}{creditSymbol} {diff.toFixed(2)}</span>
                </div>
              )}
              <p className="text-[11px] text-gray-400 pt-1">Calculado automáticamente desde los productos.</p>
            </div>
          </div>
        </SectionCard>

        {/* Pago */}
        <SectionCard title="Condiciones de pago" icon={CreditCard}>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Pago</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm({ ...form, paymentType: 'CONTADO', paymentScheduleType: 'SINGLE_DATE', dueDate: '', installments: [] })} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${form.paymentType === 'CONTADO' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>Contado</button>
              <button type="button" onClick={() => setForm({ ...form, paymentType: 'CREDITO', paymentScheduleType: 'SINGLE_DATE' })} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${form.paymentType === 'CREDITO' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>Crédito</button>
              <button type="button" onClick={() => setForm({ ...form, paymentType: 'BONIFICACION', paymentScheduleType: 'SINGLE_DATE', dueDate: '', installments: [], addToStock: form.addToStock ?? true })} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${form.paymentType === 'BONIFICACION' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>Bonificación</button>
            </div>
          </div>

          {form.paymentType === 'BONIFICACION' && (
            <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
              <label className="block text-xs font-medium text-purple-800 mb-2">¿Agregar productos al stock?</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, addToStock: true })}
                  className={`flex-1 py-1.5 rounded text-xs font-medium border-2 transition ${form.addToStock !== false ? 'border-purple-500 bg-white text-purple-700' : 'border-gray-200 text-gray-500'}`}
                >
                  Sí, agregar al stock
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, addToStock: false })}
                  className={`flex-1 py-1.5 rounded text-xs font-medium border-2 transition ${form.addToStock === false ? 'border-purple-500 bg-white text-purple-700' : 'border-gray-200 text-gray-500'}`}
                >
                  No agregar al stock
                </button>
              </div>
              <p className="text-[11px] text-purple-600 mt-2">No representa ningún gasto ni cuenta por pagar.</p>
            </div>
          )}

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
                        <input type="number" min="1" max="36" step="1" value={installmentGen.count || ''} onChange={(e) => setInstallmentGen({ ...installmentGen, count: parseInt(e.target.value) || 0 })} onWheel={blurOnWheel} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Cada (días)</label>
                        <input type="number" min="1" step="1" value={installmentGen.intervalDays || ''} onChange={(e) => setInstallmentGen({ ...installmentGen, intervalDays: parseInt(e.target.value) || 0 })} onWheel={blurOnWheel} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">1ra cuota (días)</label>
                        <input type="number" min="0" step="1" value={installmentGen.firstDaysFromPurchase} onChange={(e) => setInstallmentGen({ ...installmentGen, firstDaysFromPurchase: parseInt(e.target.value) || 0 })} onWheel={blurOnWheel} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="text-[11px] text-gray-500">
                        {installmentGen.count > 0 && installmentGen.intervalDays > 0 && (
                          <>Total {installmentGen.count * installmentGen.intervalDays + installmentGen.firstDaysFromPurchase - installmentGen.intervalDays} días (última cuota)</>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={generateInstallments}
                        disabled={form.installments.some(i => i.status === 'PAID')}
                        title={form.installments.some(i => i.status === 'PAID') ? 'No se puede regenerar: hay cuotas ya pagadas' : undefined}
                        className="px-3 py-1.5 bg-orange-600 text-white rounded text-xs font-medium hover:bg-orange-700 inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
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
                          (Total: {creditSymbol} {form.installments.reduce((s, i) => s + (i.amount || 0), 0).toFixed(2)}
                          {creditTotal > 0 && Math.abs(form.installments.reduce((s, i) => s + (i.amount || 0), 0) - creditTotal) > 0.01 && (
                            <span className="text-red-600"> · no coincide con {creditSymbol} {creditTotal.toFixed(2)}</span>
                          )}
                          )
                        </span>
                      )}
                    </label>
                    <button type="button" onClick={() => setForm({ ...form, installments: [...form.installments, { amount: 0, dueDate: '' }] })} className="text-xs text-orange-600 hover:text-orange-800 font-medium">+ Agregar cuota</button>
                  </div>
                  {form.installments.map((inst, idx) => {
                    const isPaid = inst.status === 'PAID';
                    return (
                      <div key={idx} className={`flex gap-2 mb-2 items-end ${isPaid ? 'opacity-80' : ''}`}>
                        <div className="w-10 pb-2 text-xs text-gray-400 font-medium text-right">#{idx + 1}</div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Monto ({creditSymbol})</label>
                          <input
                            type="number" min="0.01" step="0.01"
                            value={inst.amount || ''}
                            readOnly={isPaid}
                            onChange={isPaid ? undefined : (e) => { const next = [...form.installments]; next[idx] = { ...next[idx], amount: parseFloat(e.target.value) || 0 }; setForm({ ...form, installments: next }); }}
                            onWheel={blurOnWheel}
                            className={`w-full px-2 py-1.5 border rounded text-sm ${isPaid ? 'bg-green-50 border-green-200 text-gray-600 cursor-default' : ''}`}
                            required
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                          <input
                            type="date"
                            value={inst.dueDate}
                            readOnly={isPaid}
                            onChange={isPaid ? undefined : (e) => { const next = [...form.installments]; next[idx] = { ...next[idx], dueDate: e.target.value }; setForm({ ...form, installments: next }); }}
                            className={`w-full px-2 py-1.5 border rounded text-sm ${isPaid ? 'bg-green-50 border-green-200 text-gray-600 cursor-default' : ''}`}
                            required
                          />
                        </div>
                        {isPaid ? (
                          <div className="pb-1 flex-shrink-0">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">
                              <CheckCircle size={11} /> Pagada
                            </span>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setForm({ ...form, installments: form.installments.filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-600 pb-1"><Trash2 size={14} /></button>
                        )}
                      </div>
                    );
                  })}
                  {form.installments.length === 0 && <p className="text-xs text-gray-400">Usa el generador arriba o agrega cuotas manualmente</p>}
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* Motivo (solo modo edit) */}
        {mode === 'edit' && (
          <SectionCard title="Motivo del cambio" icon={FileText}>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              minLength={5}
              placeholder="Ej: corrección de costo mal ingresado en el producto X, ajuste de cuotas tras renegociación con proveedor..."
              className="w-full px-3 py-2 border rounded-lg text-sm"
              required
            />
            <p className="text-[11px] text-gray-400 mt-1">Mínimo 5 caracteres. Queda registrado en el historial de auditoría.</p>
          </SectionCard>
        )}

        {/* Barra de acciones sticky */}
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white border-t border-gray-200 px-4 lg:px-8 py-3 z-10 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-3 max-w-full">
            <div className="text-xs text-gray-500 hidden sm:block">
              {form.items.length} producto{form.items.length !== 1 ? 's' : ''}
              {creditTotal > 0 && <> · Total <span className="font-semibold text-gray-700">{creditSymbol} {creditTotal.toFixed(2)}</span></>}
              {mode === 'edit' && originalTotalForDiff > 0 && diff !== 0 && (
                <span className={`ml-2 font-semibold ${diff > 0 ? 'text-red-600' : 'text-green-700'}`}>
                  Δ {diff > 0 ? '+' : ''}{creditSymbol} {diff.toFixed(2)}
                </span>
              )}
            </div>
            <div className="flex gap-2 ml-auto">
              <Link to={onCancelHref} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Cancelar</Link>
              <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                {isSubmitting ? submittingLabel : submitLabel}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Modal crear producto rápido */}
      <Modal isOpen={showNewProduct} onClose={() => setShowNewProduct(false)} title="Nuevo producto">
        <form onSubmit={handleCreateQuickProduct} className="space-y-5">
          <div className="flex items-start gap-3 p-3 bg-primary-50/60 border border-primary-100 rounded-xl">
            <div className="w-9 h-9 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
              <PackagePlus size={18} />
            </div>
            <div className="text-xs text-gray-600">
              Crea el producto y se asignará automáticamente a la fila de la compra. Los precios de venta se completan después en <span className="font-semibold text-gray-800">Productos</span>.
            </div>
          </div>

          {/* Identidad */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Nombre <span className="text-red-500 normal-case">*</span>
              </label>
              <input
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400"
                placeholder="Ej: Antracol 70 WP, Agrifo, Campal..."
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Descripción <span className="text-gray-400 normal-case font-normal">— opcional</span>
              </label>
              <input
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400"
                placeholder="Notas, presentación, observaciones..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Ingrediente activo <span className="text-gray-400 normal-case font-normal">— opcional</span>
              </label>
              <input
                value={newProduct.activeIngredient}
                onChange={(e) => setNewProduct({ ...newProduct, activeIngredient: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400"
                placeholder="Ej: Propineb 70%"
              />
            </div>
          </div>

          {/* Clasificación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Almacén <span className="text-red-500 normal-case">*</span>
              </label>
              <select
                value={newProduct.companyId}
                onChange={(e) => setNewProduct({ ...newProduct, companyId: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400"
                required
              >
                <option value="">Seleccionar almacén...</option>
                {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Almacén donde quedará registrado este producto.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Categoría <span className="text-red-500 normal-case">*</span>
              </label>
              <SmartSearchSelect
                items={categories}
                value={newProduct.categoryId}
                onChange={(id) => setNewProduct({ ...newProduct, categoryId: id })}
                getId={(c: any) => c.id}
                getLabel={(c: any) => c.name}
                searchFields={(c: any) => [c.name]}
                placeholder="Buscar categoría…"
                emptyText="Sin categorías que coincidan"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Laboratorio <span className="text-gray-400 normal-case font-normal">— opcional</span>
              </label>
              <SmartSearchSelect
                items={(Array.isArray(laboratoriesData) ? laboratoriesData : []).filter((l: any) => l.isActive !== false)}
                value={newProduct.laboratoryId}
                onChange={(id) => setNewProduct({ ...newProduct, laboratoryId: id })}
                getId={(l: any) => l.id}
                getLabel={(l: any) => l.name}
                searchFields={(l: any) => [l.name]}
                placeholder="Buscar laboratorio…"
                emptyText="Sin laboratorios que coincidan"
                accent="gray"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Unidad <span className="text-red-500 normal-case">*</span>
              </label>
              <select
                value={newProduct.unit}
                onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400"
                required
              >
                {allUnits.length === 0 && <option value="unidad">Unidad</option>}
                {allUnits.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Tipo IGV <span className="text-red-500 normal-case">*</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['GRAVADO', 'EXONERADO', 'INAFECTO'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewProduct({ ...newProduct, taxType: t })}
                    className={`py-2 rounded-lg text-xs font-semibold border-2 transition-colors ${
                      newProduct.taxType === t
                        ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                    }`}
                  >
                    {t === 'GRAVADO' ? 'Gravado' : t === 'EXONERADO' ? 'Exonerado' : 'Inafecto'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lote */}
          <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={newProduct.tracksLot}
              onChange={(e) => setNewProduct({ ...newProduct, tracksLot: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <div className="text-sm">
              <div className="font-semibold text-gray-800">Llevar control por lote</div>
              <div className="text-xs text-gray-500 mt-0.5">Cada compra deberá registrar número de lote y fecha de vencimiento.</div>
            </div>
          </label>

          <div className="flex gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowNewProduct(false)}
              className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createProduct.isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-semibold shadow-sm disabled:opacity-50"
            >
              {createProduct.isPending ? <Loader2 size={16} className="animate-spin" /> : <PackagePlus size={16} />}
              {createProduct.isPending ? 'Creando...' : 'Crear y agregar a compra'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
