import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCreatePurchase, useLastPrice } from '../hooks/usePurchases';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts, useCreateProduct } from '../../products/hooks/useProducts';
import { useCategories } from '../../categories/hooks/useCategories';
import { useLaboratories } from '../../laboratories/hooks/useLaboratories';
import { useUnits } from '../../units/hooks/useUnits';
import { usePriceTiers } from '../../price-tiers/hooks/usePriceTiers';
import { useTipoCambio } from '../../../shared/hooks/useLookup';
import { useSupplierByRuc, useCreateSupplier } from '../../suppliers/hooks/useSuppliers';
import { useCashRegisterToday } from '../../cash-register/hooks/useCashRegister';
import { Modal } from '../../../shared/components/Modal';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { SmartSearchSelect } from '../../../shared/components/SmartSearchSelect';
import {
  ArrowLeft, ShoppingCart, Trash2, Loader2, DollarSign, PackagePlus,
  FileText, CopyIcon, Dices, Wand2, Building2, CreditCard, Package, FlaskConical,
} from 'lucide-react';
import type { Company, Product, Category, Laboratory } from '../../../shared/types';
import toast from 'react-hot-toast';

const IGV_RATE = 0.18;

const blurOnWheel = (e: React.WheelEvent<HTMLInputElement>) => {
  (e.currentTarget as HTMLInputElement).blur();
};

// Muestra 2 decimales si el número ya es exacto a céntimos; si no, hasta 4.
// Se usa para precios unitarios donde 4 decimales (4.565) son válidos.
const fmtPrice = (n: number): string => {
  if (!Number.isFinite(n) || n === 0) return '0.00';
  const r2 = Math.round(n * 100) / 100;
  return Math.abs(n - r2) < 1e-9 ? n.toFixed(2) : n.toFixed(4);
};

interface PurchaseFormItem {
  companyId: string;
  productId: string;
  quantity: number;
  lotNumber?: string;
  expirationDate?: string;
  unitPriceSinIgv: number;
  unitPriceConIgv: number;
  costoAdquisicion: number;
  costoEnSoles: number;
  markupPercent: number;
  precioVenta: number;
  precioVentaMode: 'markup' | 'direct';
}

const emptyItem = (): PurchaseFormItem => ({
  companyId: '', productId: '', quantity: 0, lotNumber: '', expirationDate: '',
  unitPriceSinIgv: 0, unitPriceConIgv: 0,
  costoAdquisicion: 0, costoEnSoles: 0, markupPercent: 0, precioVenta: 0, precioVentaMode: 'markup',
});

function recalcItem(
  item: PurchaseFormItem,
  currency: 'PEN' | 'USD' = 'PEN',
  exchangeRate: number | null = null,
  applyIgv: boolean = true,
): PurchaseFormItem {
  // Mantenemos el unitario con precisión total (sin redondear a céntimos)
  // para que `cantidad × precio` sume exacto. El redondeo a 2 decimales
  // se hace una sola vez al calcular el total del documento.
  const unitPriceConIgv = applyIgv
    ? item.unitPriceSinIgv * (1 + IGV_RATE)
    : item.unitPriceSinIgv;
  const costoAdquisicion = unitPriceConIgv;
  const costoEnSoles = currency === 'USD'
    ? (exchangeRate ? unitPriceConIgv * exchangeRate : 0)
    : costoAdquisicion;

  let precioVenta = item.precioVenta;
  let markupPercent = item.markupPercent;

  if (item.precioVentaMode === 'markup') {
    precioVenta = costoEnSoles > 0
      ? Math.round(costoEnSoles * (1 + markupPercent / 100) * 100) / 100
      : 0;
  } else {
    markupPercent = costoEnSoles > 0
      ? Math.round(((precioVenta / costoEnSoles) - 1) * 10000) / 100
      : 0;
  }

  return { ...item, unitPriceConIgv, costoAdquisicion, costoEnSoles, precioVenta, markupPercent };
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

export function NewPurchasePage() {
  const navigate = useNavigate();

  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 10000 });
  const createPurchase = useCreatePurchase();
  const supplierByRuc = useSupplierByRuc();
  const createSupplier = useCreateSupplier();
  const tipoCambioMutation = useTipoCambio();
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

  const today = new Date().toISOString().slice(0, 10);
  const [currency, setCurrency] = useState<'PEN' | 'USD'>('USD');
  const [form, setForm] = useState({
    supplier: '', supplierRuc: '', supplierId: '', laboratoryId: '',
    paymentType: 'CONTADO' as 'CONTADO' | 'CREDITO',
    paymentScheduleType: 'SINGLE_DATE' as 'SINGLE_DATE' | 'INSTALLMENTS', dueDate: '',
    installments: [] as { amount: number; dueDate: string }[],
    items: [emptyItem()] as PurchaseFormItem[],
    purchaseDate: today,
    documentType: 'FACTURA' as 'FACTURA' | 'BOLETA' | 'GUIA' | 'NOTA_CREDITO' | 'OTRO',
    documentSeries: '',
    documentNumber: '',
    issueDate: today,
  });
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateDate, setExchangeRateDate] = useState('');
  const [labResolving, setLabResolving] = useState(false);
  const [installmentGen, setInstallmentGen] = useState({ count: 6, intervalDays: 30, firstDaysFromPurchase: 30 });
  const [scrollToLast, setScrollToLast] = useState(false);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProductForIdx, setNewProductForIdx] = useState<number>(-1);
  const [newProduct, setNewProduct] = useState({
    name: '', description: '', categoryId: '', laboratoryId: '', unit: 'unidad',
    activeIngredient: '', taxType: 'GRAVADO' as 'GRAVADO' | 'EXONERADO' | 'INAFECTO', tracksLot: false,
    companyId: '',
  });

  const companyList = Array.isArray(companies) ? companies : [];
  const products = (() => {
    const raw: any = productsData;
    const list: any[] = Array.isArray(raw) ? raw : raw?.data || [];
    return list.filter((p) => p.isActive !== false);
  })();

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
  const itemAppliesIgv = (productId: string) => {
    if (!productId) return true;
    const p = products.find((pr: Product) => pr.id === productId);
    const taxType = (p as any)?.taxType;
    return !taxType || taxType === 'GRAVADO';
  };
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
    if (field === 'markupPercent') item.precioVentaMode = 'markup';
    if (field === 'precioVenta') item.precioVentaMode = 'direct';
    if (field === 'productId') {
      const seeded = seedPrecioVentaFromProduct(value);
      if (seeded > 0) {
        item.precioVenta = seeded;
        item.precioVentaMode = 'direct';
      }
    }
    const costoFields = ['unitPriceSinIgv', 'markupPercent', 'precioVenta', 'productId'];
    if (costoFields.includes(field)) item = recalcItem(item, currency, exchangeRate, itemAppliesIgv(item.productId));
    items[idx] = item;
    return { ...prev, items };
  });

  useEffect(() => {
    setForm(prev => ({ ...prev, items: prev.items.map(i => recalcItem(i, currency, exchangeRate, itemAppliesIgv(i.productId))) }));
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

  const documentTotal = Math.round(form.items.reduce((s, i) => s + (i.quantity * i.unitPriceConIgv || 0), 0) * 100) / 100;
  const totalSoles = currency === 'USD' && exchangeRate && documentTotal ? Math.round(documentTotal * exchangeRate * 100) / 100 : 0;
  const creditTotal = documentTotal;
  const creditSymbol = currency === 'USD' ? '$' : 'S/';

  const itemsSubtotal = Math.round(form.items.reduce((s, i) => s + (i.quantity * i.costoAdquisicion || 0), 0) * 100) / 100;

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
    if (form.paymentType === 'CONTADO' && (cashRegisterToday as any)?.status === 'CLOSED') {
      toast.error('La caja del día está cerrada. No se pueden registrar compras al contado.');
      return;
    }
    if (!form.supplier.trim()) { toast.error('Selecciona un laboratorio'); return; }
    if (!documentTotal) { toast.error('Agrega productos con cantidad y costo unitario'); return; }
    if (currency === 'USD' && !exchangeRate) { toast.error('Verifique el tipo de cambio'); return; }
    const missingCompany = form.items.find(i => !i.companyId);
    if (missingCompany) { toast.error('Selecciona el almacén destino para cada producto'); return; }
    const missingLot = form.items.find(i => {
      const p = products.find((pr: Product) => pr.id === i.productId);
      return p?.tracksLot && !i.lotNumber;
    });
    if (missingLot) { toast.error('Hay productos que requieren número de lote'); return; }
    const payload: any = {
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
    };
    if (form.documentType) payload.documentType = form.documentType;
    if (form.documentSeries) payload.documentSeries = form.documentSeries;
    if (form.documentNumber) payload.documentNumber = form.documentNumber;
    if (form.issueDate) payload.issueDate = form.issueDate;
    if (currency === 'USD') {
      payload.totalCostUsd = documentTotal;
      payload.exchangeRate = exchangeRate;
      payload.exchangeRateDate = exchangeRateDate;
    } else {
      payload.totalCost = documentTotal;
    }
    if (form.supplierId) payload.supplierId = form.supplierId;
    if (form.supplierRuc) payload.supplierRuc = form.supplierRuc;
    if (form.paymentType === 'CREDITO') {
      payload.paymentScheduleType = form.paymentScheduleType;
      payload.currency = currency;
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
                    const appliesIgv = itemAppliesIgv(item.productId);
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
                              <input type="number" min="0" step="0.0001" value={item.unitPriceSinIgv || ''} onChange={(e) => updateItem(idx, 'unitPriceSinIgv', parseFloat(e.target.value) || 0)} onWheel={blurOnWheel} className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400" placeholder="0.0000" />
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
              <button type="button" onClick={() => setForm({ ...form, paymentType: 'CREDITO' })} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${form.paymentType === 'CREDITO' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>Crédito</button>
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
                  {form.installments.map((inst, idx) => (
                    <div key={idx} className="flex gap-2 mb-2 items-end">
                      <div className="w-10 pb-2 text-xs text-gray-400 font-medium text-right">#{idx + 1}</div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Monto ({creditSymbol})</label>
                        <input type="number" min="0.01" step="0.01" value={inst.amount || ''} onChange={(e) => { const installments = [...form.installments]; installments[idx] = { ...installments[idx], amount: parseFloat(e.target.value) || 0 }; setForm({ ...form, installments }); }} onWheel={blurOnWheel} className="w-full px-2 py-1.5 border rounded text-sm" required />
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

        {/* Barra de acciones sticky */}
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white border-t border-gray-200 px-4 lg:px-8 py-3 z-10 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-3 max-w-full">
            <div className="text-xs text-gray-500 hidden sm:block">
              {form.items.length} producto{form.items.length !== 1 ? 's' : ''}
              {creditTotal > 0 && <> · Total <span className="font-semibold text-gray-700">{creditSymbol} {creditTotal.toFixed(2)}</span></>}
            </div>
            <div className="flex gap-2 ml-auto">
              <Link to="/purchases" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Cancelar</Link>
              <button type="submit" disabled={!documentTotal || (currency === 'USD' && !exchangeRate) || createPurchase.isPending} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                {createPurchase.isPending ? 'Registrando...' : 'Registrar Compra'}
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
