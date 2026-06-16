import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, User, ShoppingCart, ClipboardList, Plus, Trash2, Search, Sparkles, Building2, Save, FileText, ScrollText, Users, X, Calendar, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCreateQuote } from '../hooks/useQuotes';
import { useDniLookup, useRucLookup } from '../../../shared/hooks/useLookup';
import { useProducts } from '../../products/hooks/useProducts';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useClients } from '../../clients/hooks/useClients';
import { usePriceTiers } from '../../price-tiers/hooks/usePriceTiers';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useUsers } from '../../users/hooks/useUsers';
import { usePaymentMethods } from '../../payment-methods/hooks/usePaymentMethods';
import { COMPANY_INFO } from '../../../config/companyInfo';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import type { Product, ProductPrice, Company, Client, PriceTier, QuotePayment } from '../../../shared/types';

const IGV_RATE = 0.18;
type DocType = 'DNI' | 'RUC' | 'CE' | 'OTRO';

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface CartLine {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxType?: string;
  tierOverride?: string;
  sourceCompanyId?: string;
}

interface CartPreload {
  items: CartLine[];
  companyId?: string;
  tierId?: string;
  sellerId?: string;
}

function resolvePrice(product: Product, tierId: string): number | undefined {
  if (!product.prices?.length) return undefined;
  return (
    product.prices.find((p: ProductPrice) => p.priceTierId === tierId && !p.companyId)?.price ??
    product.prices.find((p: ProductPrice) => p.priceTierId === tierId)?.price
  );
}

export function NewQuotePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isSellerRole = user?.role === 'VENDEDOR' || user?.role === 'VENDEDOR_CAMPO';

  const preload = (location.state as { cart?: CartPreload } | null)?.cart;

  const { data: productsData } = useProducts({ limit: 10000 });
  const { data: companiesData } = useCompanies();
  const { data: clientsData } = useClients({ limit: 500 });
  const { data: tiersData } = usePriceTiers();
  const { data: usersData } = useUsers({ limit: 200, isActive: true });
  const createQuote = useCreateQuote();
  const dniLookup = useDniLookup();
  const rucLookup = useRucLookup();
  const { data: paymentMethodsData } = usePaymentMethods();

  const products: Product[] = useMemo(() => {
    const raw: any = productsData;
    const list: Product[] = Array.isArray(raw) ? raw : raw?.data || [];
    return list.filter((p) => p.isActive);
  }, [productsData]);

  const companies: Company[] = useMemo(() => {
    const list: Company[] = Array.isArray(companiesData) ? companiesData : [];
    return list.filter((c) => c.isActive);
  }, [companiesData]);

  const clients: Client[] = useMemo(() => {
    const raw: any = clientsData;
    const list: Client[] = Array.isArray(raw) ? raw : raw?.data || [];
    return list.filter((c) => c.isActive);
  }, [clientsData]);

  const tiers: PriceTier[] = useMemo(() => {
    const list: PriceTier[] = Array.isArray(tiersData) ? tiersData : [];
    return list.filter((t) => t.isActive).sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }, [tiersData]);

  // ----- form state -----
  const [docType, setDocType] = useState<DocType>('DNI');
  const [docNumber, setDocNumber] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  const [clientSearch, setClientSearch] = useState('');
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const debouncedClientSearch = useDebounce(clientSearch);
  const canClientSearch = debouncedClientSearch.trim().length >= 2;
  const { data: clientSearchRaw } = useClients(
    { search: debouncedClientSearch.trim(), limit: 8 },
    { enabled: canClientSearch },
  );
  const clientSearchResults: Client[] = canClientSearch
    ? (Array.isArray(clientSearchRaw) ? clientSearchRaw : (clientSearchRaw as any)?.data || [])
    : [];

  const [companyId, setCompanyId] = useState(preload?.companyId || '');
  const [tierId, setTierId] = useState(preload?.tierId || '');
  const [sellerId] = useState(preload?.sellerId || (isSellerRole ? user?.id : '') || '');

  const [currency, setCurrency] = useState<'PEN' | 'USD'>('PEN');
  const [exchangeRate, setExchangeRate] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [validityDays, setValidityDays] = useState(15);
  const [paymentTerm, setPaymentTerm] = useState('CONTADO');
  const [creditDueDate, setCreditDueDate] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return toDateKey(d);
  });
  const [deliveryTime, setDeliveryTime] = useState('INMEDIATO');
  const [deliveryPlace, setDeliveryPlace] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [observations, setObservations] = useState('');

  const [lines, setLines] = useState<CartLine[]>(() => preload?.items || []);
  const [productSearch, setProductSearch] = useState('');
  const [searchOpenForLine, setSearchOpenForLine] = useState<number | null>(null);

  // Pagos a cuenta
  const [payments, setPayments] = useState<QuotePayment[]>([]);
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [newPaymentAmount, setNewPaymentAmount] = useState('');

  // Defaults once data arrives
  useEffect(() => {
    if (!companyId && companies.length) setCompanyId(companies[0].id);
  }, [companies, companyId]);
  useEffect(() => {
    if (!tierId && tiers.length) setTierId(tiers[0].id);
  }, [tiers, tierId]);

  const validUntilISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (Number.isFinite(validityDays) ? validityDays : 15));
    return d.toISOString().slice(0, 10);
  }, [validityDays]);

  const todayKey = toDateKey(new Date());

  const creditDaysForApi = useMemo(() => {
    const [y, m, d] = creditDueDate.split('-').map(Number);
    const due = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.max(1, Math.round((due.getTime() - today.getTime()) / 86400000));
  }, [creditDueDate]);

  const creditDueDateLabel = useMemo(() => {
    const [y, m, d] = creditDueDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }, [creditDueDate]);

  const isPresetActive = (days: number) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + days);
    return toDateKey(d) === creditDueDate;
  };
  const setPreset = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    setCreditDueDate(toDateKey(d));
  };

  const paymentMethodNames: string[] = useMemo(() => {
    const raw: any = paymentMethodsData;
    const list = Array.isArray(raw) ? raw : raw?.data || [];
    return list.filter((m: any) => m.isActive).map((m: any) => m.name as string);
  }, [paymentMethodsData]);

  const addPayment = () => {
    const method = newPaymentMethod.trim();
    const amount = parseFloat(newPaymentAmount);
    if (!method || !amount || amount <= 0) return;
    setPayments(prev => [...prev, { paymentMethodName: method, amount }]);
    setNewPaymentMethod('');
    setNewPaymentAmount('');
  };

  const removePayment = (idx: number) => setPayments(prev => prev.filter((_, i) => i !== idx));

  const currSymbol = currency === 'USD' ? 'US$' : 'S/';
  const exchangeRateNum = parseFloat(exchangeRate) || 0;

  const isExonerado = (taxType?: string) => taxType === 'EXONERADO' || taxType === 'INAFECTO';
  const gravadoTotal = useMemo(() => lines.filter(l => !isExonerado(l.taxType)).reduce((acc, l) => acc + l.quantity * l.unitPrice, 0), [lines]);
  const exoneradoTotal = useMemo(() => lines.filter(l => isExonerado(l.taxType)).reduce((acc, l) => acc + l.quantity * l.unitPrice, 0), [lines]);
  const opGravadas = Math.round((gravadoTotal / (1 + IGV_RATE)) * 100) / 100;
  const igv = Math.round((gravadoTotal - opGravadas) * 100) / 100;
  const total = gravadoTotal + exoneradoTotal;
  const solEquiv = currency === 'USD' && exchangeRateNum > 0 ? Math.round(total * exchangeRateNum * 100) / 100 : null;
  const paidAmount = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  const saldoAmount = Math.round((total - paidAmount) * 100) / 100;

  const productOptions = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.activeIngredient || '').toLowerCase().includes(q))
      .slice(0, 12);
  }, [productSearch, products]);

  const pickClient = (c: Client) => {
    setClientId(c.id);
    setClientName(c.name);
    setClientEmail(c.email || '');
    setClientPhone(c.phone || '');
    setClientAddress(c.address || '');
    setDocNumber(c.documentNumber || '');
    if (c.documentNumber?.length === 8) setDocType('DNI');
    else if (c.documentNumber?.length === 11) setDocType('RUC');
    setClientSearch(c.name);
    setClientSearchOpen(false);
  };

  const clearClient = () => {
    setClientId('');
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setClientAddress('');
    setDocNumber('');
    setClientSearch('');
  };

  const handleLookup = async () => {
    const numero = docNumber.trim();
    if (docType === 'DNI' && numero.length !== 8) { toast.error('El DNI debe tener 8 dígitos'); return; }
    if (docType === 'RUC' && numero.length !== 11) { toast.error('El RUC debe tener 11 dígitos'); return; }

    setLookupLoading(true);
    try {
      const localMatch = clients.find((c) => c.documentNumber === numero);
      if (localMatch) {
        setClientId(localMatch.id);
        setClientName(localMatch.name);
        setClientEmail(localMatch.email || '');
        setClientPhone(localMatch.phone || '');
        setClientAddress(localMatch.address || '');
        toast.success('Cliente encontrado en el sistema');
        return;
      }
      if (docType === 'DNI') {
        const r = await dniLookup.mutateAsync(numero);
        setClientName(`${r.apellidoPaterno} ${r.apellidoMaterno}, ${r.nombre}`);
        toast.success('Datos encontrados en RENIEC');
      } else if (docType === 'RUC') {
        const r = await rucLookup.mutateAsync(numero);
        setClientName(r.razonSocial);
        if (r.direccion) setClientAddress(r.direccion);
        toast.success('Datos encontrados en SUNAT');
      } else {
        toast('Para este tipo de documento, completá los datos manualmente.');
      }
    } catch { /* hook toast */ }
    finally { setLookupLoading(false); }
  };

  const addEmptyLine = () => {
    setLines((prev) => [...prev, { productId: '', name: '', unit: '', quantity: 1, unitPrice: 0 }]);
    setSearchOpenForLine(lines.length);
    setProductSearch('');
  };

  const setLine = (idx: number, patch: Partial<CartLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const applyTierToLine = (idx: number, nextTierId: string) => {
    const line = lines[idx];
    const product = products.find((p) => p.id === line.productId);
    const price = product ? resolvePrice(product, nextTierId) : undefined;
    setLine(idx, {
      tierOverride: nextTierId,
      ...(price != null ? { unitPrice: price } : {}),
    });
  };

  const handleTierChange = (nextTierId: string) => {
    setTierId(nextTierId);
    setLines((prev) => prev.map((line) => {
      if (!line.productId || line.tierOverride) return line;
      const product = products.find((p) => p.id === line.productId);
      const price = product ? resolvePrice(product, nextTierId) : undefined;
      return price != null ? { ...line, unitPrice: price } : line;
    }));
  };

  const pickProduct = (idx: number, p: Product) => {
    const lineTierId = lines[idx]?.tierOverride || tierId;
    const price = lineTierId ? resolvePrice(p, lineTierId) ?? 0 : 0;
    setLine(idx, {
      productId: p.id,
      name: p.name,
      unit: p.unit,
      unitPrice: price,
      taxType: p.taxType,
      sourceCompanyId: companyId,
    });
    setSearchOpenForLine(null);
    setProductSearch('');
  };

  const buildNotes = () => {
    const parts: string[] = [];
    if (paymentTerm.trim()) parts.push(`Forma de pago: ${paymentTerm.trim()}`);
    if (deliveryTime.trim()) parts.push(`Tiempo de entrega: ${deliveryTime.trim()}`);
    if (deliveryPlace.trim()) parts.push(`Lugar de entrega: ${deliveryPlace.trim()}`);
    const header = parts.join('\n');
    const body = observations.trim();
    const internal = internalNotes.trim() ? `\n\n[Interno] ${internalNotes.trim()}` : '';
    return [header, body].filter(Boolean).join('\n\n') + internal;
  };

  const canSave = lines.length > 0 && lines.every((l) => l.productId && l.quantity > 0 && l.unitPrice >= 0)
    && !!companyId && !!tierId
    && (!!clientId || !!clientName.trim());

  const handleSubmit = async () => {
    if (!canSave) {
      if (!lines.length) toast.error('Agregá al menos un producto');
      else if (!clientId && !clientName.trim()) toast.error('Indicá el nombre del cliente');
      else toast.error('Completá producto, cantidad y precio en cada línea');
      return;
    }
    try {
      await createQuote.mutateAsync({
        companyId,
        clientId: clientId || undefined,
        clientName: clientId ? undefined : clientName.trim(),
        validUntil: validUntilISO,
        notes: buildNotes() || undefined,
        sellerId: sellerId || undefined,
        participantIds: participantIds.length ? participantIds : undefined,
        currency,
        exchangeRate: exchangeRateNum || undefined,
        paymentMethod: paymentTerm,
        creditDays: paymentTerm === 'CRÉDITO' ? creditDaysForApi : undefined,
        payments: payments.length ? payments : undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          companyId: l.sourceCompanyId || companyId,
          quantity: l.quantity,
          priceTier: l.tierOverride || tierId,
          unitPrice: l.unitPrice,
        })),
      } as any);
      navigate('/quotes');
    } catch { /* hook toast */ }
  };

  const company = companies.find((c) => c.id === companyId);
  const docTabs: DocType[] = ['DNI', 'RUC', 'CE', 'OTRO'];

  return (
    <div>
      {/* Top bar */}
      <Link to="/quotes" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 mb-4">
        <ArrowLeft size={15} /> Volver a cotizaciones
      </Link>

      {/* Hero */}
      <div className="bg-gradient-to-r from-primary-50 to-white border border-primary-100 rounded-2xl p-6 mb-6 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-white border border-primary-200 text-primary-600 flex items-center justify-center shrink-0">
          <FileText size={22} />
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-primary-600 uppercase">Nueva cotización</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5">¿A quién le vas a cotizar?</h1>
          <p className="text-sm text-gray-500 mt-1">Completá los datos del cliente y los productos. La cotización se genera en PDF al guardar.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* ===================== MAIN COLUMN ===================== */}
        <div className="space-y-6">
          {/* Cliente */}
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <header className="px-6 py-4 border-b border-gray-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center"><User size={17} /></div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Datos del cliente</h2>
                <p className="text-xs text-gray-500 mt-0.5">Identificá al cliente con su DNI o RUC, o completá los datos manualmente.</p>
              </div>
            </header>
            <div className="p-6 space-y-4">

              {/* ---- Buscador de clientes existentes ---- */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Buscar cliente existente</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      if (clientId) setClientId('');
                      setClientSearchOpen(true);
                    }}
                    onFocus={() => setClientSearchOpen(true)}
                    onBlur={() => setTimeout(() => setClientSearchOpen(false), 180)}
                    placeholder="Nombre, DNI o RUC del cliente…"
                    className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  {clientId && (
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); clearClient(); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                      title="Limpiar cliente seleccionado"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Dropdown de resultados */}
                {clientSearchOpen && clientSearchResults.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                    {clientSearchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); pickClient(c); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-primary-50 border-b border-gray-50 last:border-0 transition-colors"
                      >
                        <div className="text-sm font-medium text-gray-800">{c.name}</div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                          {c.documentNumber && <span className="font-mono">{c.documentNumber}</span>}
                          {c.phone && <span>{c.phone}</span>}
                          {c.city && <span>{c.city}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Indicador de cliente seleccionado */}
                {clientId && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Cliente registrado seleccionado — datos precargados
                  </div>
                )}
              </div>

              {/* Separador */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-gray-100" />
                <span className="text-[11px] text-gray-400 font-medium">o ingresa / busca por documento</span>
                <div className="flex-1 border-t border-gray-100" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de documento</label>
                <div className="grid grid-cols-4 gap-1 p-1 bg-gray-100 rounded-xl">
                  {docTabs.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setDocType(t); setDocNumber(''); setClientId(''); }}
                      className={`py-2 text-sm font-medium rounded-lg transition-all ${docType === t ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Número de documento</label>
                  <input
                    value={docNumber}
                    onChange={(e) => {
                      const max = docType === 'DNI' ? 8 : docType === 'RUC' ? 11 : 20;
                      const v = (docType === 'DNI' || docType === 'RUC') ? e.target.value.replace(/\D/g, '') : e.target.value;
                      setDocNumber(v.slice(0, max));
                      setClientId('');
                    }}
                    placeholder={docType === 'DNI' ? '12345678' : docType === 'RUC' ? '20123456789' : '—'}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={lookupLoading || (docType !== 'DNI' && docType !== 'RUC')}
                    className="w-full md:w-auto px-4 py-2.5 rounded-xl text-sm font-medium border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <Sparkles size={14} /> {lookupLoading ? 'Buscando…' : 'Autocompletar'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nombre o razón social <span className="text-red-500">*</span></label>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Distribuidora Los Andes S.A.C."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                  <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="cliente@empresa.com" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Teléfono</label>
                  <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="987 654 321" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Dirección</label>
                <input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="Av. Principal 123, Distrito, Ciudad" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              </div>
            </div>
          </section>

          {/* Productos */}
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <header className="px-6 py-4 border-b border-gray-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center"><ShoppingCart size={17} /></div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-gray-900">Productos y servicios</h2>
                <p className="text-xs text-gray-500 mt-0.5">Buscá en el catálogo y ajustá cantidad o precio por línea.</p>
              </div>
              <button
                type="button"
                onClick={addEmptyLine}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100"
              >
                <Plus size={14} /> Agregar línea
              </button>
            </header>

            <div className="p-6 space-y-4">
              {/* Lista de precios */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Lista de precios</label>
                <select value={tierId} onChange={(e) => handleTierChange(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                  {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {lines.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                  <ShoppingCart size={28} className="mx-auto text-gray-300" />
                  <p className="text-sm text-gray-500 mt-2">Aún no hay productos en la cotización.</p>
                  <button onClick={addEmptyLine} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700">
                    <Plus size={14} /> Agregar primera línea
                  </button>
                </div>
              )}

              {lines.map((line, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold flex items-center justify-center mt-1.5 shrink-0">{idx + 1}</div>
                    <div className="flex-1 relative">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          value={searchOpenForLine === idx ? productSearch : line.name}
                          onChange={(e) => { setSearchOpenForLine(idx); setProductSearch(e.target.value); }}
                          onFocus={() => { setSearchOpenForLine(idx); setProductSearch(''); }}
                          placeholder="Buscar producto por nombre o principio activo…"
                          className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      {searchOpenForLine === idx && productOptions.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                          {productOptions.map((p) => {
                            const lineTierId = lines[idx]?.tierOverride || tierId;
                            const price = lineTierId ? resolvePrice(p, lineTierId) ?? 0 : 0;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); pickProduct(idx, p); }}
                                className="w-full text-left px-3 py-2 hover:bg-primary-50 border-b border-gray-50 last:border-0"
                              >
                                <div className="text-sm font-medium text-gray-800">{p.name}</div>
                                <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                                  <span>{p.unit}</span>
                                  <span>·</span>
                                  <span className="text-primary-600 font-medium">{currSymbol} {price.toFixed(2)}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <button onClick={() => removeLine(idx)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Quitar línea">
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {line.productId && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-[150px_100px_140px_1fr] gap-3 items-end">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">Lista</label>
                        <select
                          value={line.tierOverride || tierId}
                          onChange={(e) => applyTierToLine(idx, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">Cantidad</label>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={line.quantity}
                          onChange={(e) => setLine(idx, { quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">P. unit. ({currSymbol})</label>
                        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary-500">
                          <span className="px-2 text-xs text-gray-400 bg-gray-50">{currSymbol}</span>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={line.unitPrice}
                            onChange={(e) => setLine(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-2 text-sm text-right focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-gray-500">Subtotal</div>
                        <div className="text-lg font-semibold text-gray-800">{currSymbol} {(line.quantity * line.unitPrice).toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Condiciones comerciales */}
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <header className="px-6 py-4 border-b border-gray-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center"><ClipboardList size={17} /></div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Condiciones comerciales</h2>
                <p className="text-xs text-gray-500 mt-0.5">Estas condiciones se incluyen en el PDF de la cotización.</p>
              </div>
            </header>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Validez (días)</label>
                  <select value={validityDays} onChange={(e) => setValidityDays(parseInt(e.target.value, 10))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                    {[5, 10, 15, 30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} días</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Forma de pago</label>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl">
                      {(['CONTADO', 'CRÉDITO'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setPaymentTerm(opt)}
                          className={`py-2 text-sm font-medium rounded-lg transition-all ${paymentTerm === opt ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  {paymentTerm === 'CRÉDITO' && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-2">
                      <label className="block text-xs font-medium text-amber-700">Accesos rápidos</label>
                      <div className="grid grid-cols-5 gap-1 p-1 bg-white/70 rounded-lg">
                        {[15, 30, 45, 60, 90].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setPreset(d)}
                            className={`py-1.5 text-xs font-semibold rounded-md transition-all ${isPresetActive(d) ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-700 hover:bg-amber-100'}`}
                          >
                            {d}d
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-amber-600">Vence el <span className="font-semibold">{creditDueDateLabel}</span></p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Tiempo de entrega</label>
                  <input value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} placeholder="INMEDIATO" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Lugar de entrega</label>
                  <input value={deliveryPlace} onChange={(e) => setDeliveryPlace(e.target.value)} placeholder="—" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Notas internas</label>
                <input value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Nota corta visible solo al equipo" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <p className="text-[11px] text-gray-400 mt-1">Las notas internas se prefijan con <span className="font-mono">[Interno]</span> y no se destacan al cliente.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Observaciones (aparecen en el PDF)</label>
                <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={4} placeholder="Garantía, condiciones adicionales, información relevante para el cliente…" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y" />
              </div>
            </div>
          </section>

          {/* Pagos a cuenta */}
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <header className="px-6 py-4 border-b border-gray-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center"><CreditCard size={17} /></div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Pagos a cuenta</h2>
                <p className="text-xs text-gray-500 mt-0.5">Registra los montos ya recibidos. El saldo se calculará automáticamente.</p>
              </div>
            </header>
            <div className="p-6 space-y-4">
              {/* Fila de ingreso */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Método de pago</label>
                  <select
                    value={newPaymentMethod}
                    onChange={(e) => setNewPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Seleccionar…</option>
                    {paymentMethodNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-36">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Monto ({currSymbol})</label>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary-500">
                    <span className="px-2 text-xs text-gray-400 bg-gray-50">{currSymbol}</span>
                    <input
                      type="number" min={0} step="0.01"
                      value={newPaymentAmount}
                      onChange={(e) => setNewPaymentAmount(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPayment(); } }}
                      placeholder="0.00"
                      className="w-full px-2 py-2.5 text-sm text-right focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addPayment}
                  disabled={!newPaymentMethod || !parseFloat(newPaymentAmount)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Plus size={14} /> Agregar
                </button>
              </div>

              {/* Lista de pagos */}
              {payments.length > 0 && (
                <div className="space-y-1.5">
                  {payments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="font-medium text-gray-800">{p.paymentMethodName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-emerald-700">{currSymbol} {p.amount.toFixed(2)}</span>
                        <button type="button" onClick={() => removePayment(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Resumen a cuenta / saldo */}
              {payments.length > 0 && (
                <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>A CUENTA</span>
                    <span>{currSymbol} {paidAmount.toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between font-bold text-base ${saldoAmount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    <span>SALDO</span>
                    <span>{currSymbol} {saldoAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ===================== SIDEBAR (todo el panel acompaña al scroll) ===================== */}
        <aside className="space-y-4 lg:sticky lg:top-4 self-start">
          {/* Resumen */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Resumen</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between items-center text-gray-600">
                <dt>Moneda</dt>
                <dd className="flex gap-1">
                  <button type="button" onClick={() => setCurrency('PEN')} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${currency === 'PEN' ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}>S/ PEN</button>
                  <button type="button" onClick={() => setCurrency('USD')} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${currency === 'USD' ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}>$ USD</button>
                </dd>
              </div>
              {currency === 'USD' && (
                <div className="flex justify-between items-center text-gray-600">
                  <dt>T.C. referencial</dt>
                  <dd className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">S/</span>
                    <input
                      type="number" min={0} step="0.01"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                      placeholder="3.75"
                      className="w-20 text-right px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </dd>
                </div>
              )}
              <div className="flex justify-between text-gray-600"><dt>Validez</dt><dd className="font-medium text-gray-800">{new Date(validUntilISO).toLocaleDateString('es-PE')}</dd></div>
              <div className="flex justify-between text-gray-600"><dt>Items</dt><dd className="font-medium text-gray-800">{lines.length}</dd></div>
            </dl>
            <div className="border-t border-gray-100 mt-3 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600"><dt>Op. Gravadas</dt><dd>{currSymbol} {opGravadas.toFixed(2)}</dd></div>
              {exoneradoTotal > 0 && <div className="flex justify-between text-gray-600"><dt>Op. Exoneradas</dt><dd>{currSymbol} {exoneradoTotal.toFixed(2)}</dd></div>}
              <div className="flex justify-between text-gray-600"><dt>IGV (18%)</dt><dd>{currSymbol} {igv.toFixed(2)}</dd></div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <dt className="font-semibold text-gray-900">Total</dt>
                <dd className="text-2xl font-bold text-primary-600">{currSymbol} {total.toFixed(2)}</dd>
              </div>
              {solEquiv !== null && (
                <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-50">
                  <dt>Equiv. en S/</dt>
                  <dd>S/ {solEquiv.toFixed(2)}</dd>
                </div>
              )}
            </div>
            {payments.length > 0 && (
              <div className="border-t border-gray-100 mt-3 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-emerald-700 font-medium">
                  <dt>A cuenta</dt>
                  <dd className="font-semibold">{currSymbol} {paidAmount.toFixed(2)}</dd>
                </div>
                <div className={`flex justify-between font-bold ${saldoAmount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  <dt>Saldo</dt>
                  <dd>{currSymbol} {saldoAmount.toFixed(2)}</dd>
                </div>
              </div>
            )}
          </div>

          {/* Datos del emisor (incluye cuentas bancarias inline, como PANCA) */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"><Building2 size={15} /></div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Datos del emisor</h3>
                <p className="text-[11px] text-gray-400">Se incluirán automáticamente en el PDF.</p>
              </div>
            </div>

            <div className="text-sm">
              <p className="font-semibold text-gray-800">{COMPANY_INFO.legalName || company?.name || '—'}</p>
              {(COMPANY_INFO.ruc || company?.ruc) && <p className="text-xs text-gray-500 mt-0.5">RUC {COMPANY_INFO.ruc || company?.ruc}</p>}
              {(COMPANY_INFO.address || company?.address) && <p className="text-xs text-gray-500 mt-0.5">{COMPANY_INFO.address || company?.address}</p>}
              {(COMPANY_INFO.phone || company?.phone || COMPANY_INFO.email) && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {[COMPANY_INFO.phone || company?.phone, COMPANY_INFO.email].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>

            {COMPANY_INFO.bankAccounts.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Cuentas bancarias</h4>
                <div className="space-y-2">
                  {COMPANY_INFO.bankAccounts.map((acc, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-2.5 bg-gray-50/50">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">{acc.bank}</p>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">{acc.currency}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{acc.holder}</p>
                      <p className="text-xs font-mono text-gray-700 mt-1">N° {acc.accountNumber}</p>
                      {acc.cci && <p className="text-xs font-mono text-gray-500">CCI {acc.cci}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Atendido por</h4>
              <p className="text-sm font-semibold text-gray-800">{user?.fullName || '—'}</p>
              {user?.email && <p className="text-xs text-gray-500">{user.email}</p>}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Users size={13} className="text-gray-400" />
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Participantes adicionales</h4>
              </div>
              <select
                onChange={(e) => {
                  const id = e.target.value;
                  if (id && !participantIds.includes(id)) setParticipantIds(prev => [...prev, id]);
                  e.target.value = '';
                }}
                className="w-full px-2.5 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                defaultValue=""
              >
                <option value="" disabled>Agregar empleado…</option>
                {(Array.isArray(usersData) ? usersData : usersData?.data || [])
                  .filter((u: any) => u.id !== user?.id && !participantIds.includes(u.id))
                  .map((u: any) => (
                    <option key={u.id} value={u.id}>{u.fullName || u.username}</option>
                  ))}
              </select>
              {participantIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {participantIds.map(id => {
                    const u = (Array.isArray(usersData) ? usersData : usersData?.data || []).find((u: any) => u.id === id);
                    return (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
                        {u?.fullName || u?.username || id}
                        <button type="button" onClick={() => setParticipantIds(prev => prev.filter(p => p !== id))} className="hover:text-indigo-900">
                          <X size={11} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Mini calendario de crédito */}
          {paymentTerm === 'CRÉDITO' && (
            <div className="bg-white border border-amber-200 rounded-2xl shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Calendar size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Fecha de cobro</h3>
                  <p className="text-[11px] text-gray-400">Selecciona el día límite de pago</p>
                </div>
              </div>
              <CreditDatePicker value={creditDueDate} onChange={setCreditDueDate} todayKey={todayKey} />
            </div>
          )}
        </aside>
      </div>

      {/* Barra inferior sticky — full width, siempre visible en todas las resoluciones */}
      <div className="sticky bottom-0 -mx-4 lg:-mx-8 mt-6 bg-white/95 backdrop-blur border-t border-gray-200 px-4 lg:px-8 py-3 flex items-center justify-between shadow-[0_-4px_16px_rgba(0,0,0,0.06)] z-30">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ScrollText size={15} className="text-gray-400" />
          <span>{lines.length} ítems</span>
          <span className="text-gray-300">·</span>
          <span>Total <span className="font-semibold text-gray-800">{currSymbol} {total.toFixed(2)}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/quotes')}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSave || createQuote.isPending}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            <Save size={15} /> {createQuote.isPending ? 'Guardando…' : 'Guardar cotización'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== MINI CALENDARIO DE CRÉDITO =====

interface CreditDatePickerProps {
  value: string;
  todayKey: string;
  onChange: (v: string) => void;
}

function CreditDatePicker({ value, todayKey, onChange }: CreditDatePickerProps) {
  const initDate = () => { const d = new Date(value + 'T00:00:00'); d.setDate(1); return d; };
  const [month, setMonth] = useState<Date>(initDate);

  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstDay = new Date(year, monthIdx, 1);
  const lastDay = new Date(year, monthIdx + 1, 0);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const endOffset = lastDay.getDay() === 0 ? 0 : 7 - lastDay.getDay();
  const days = Array.from({ length: startOffset + lastDay.getDate() + endOffset }, (_, i) =>
    new Date(year, monthIdx, i - startOffset + 1)
  );

  const monthLabel = month.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  return (
    <div>
      {/* Nav de mes */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setMonth(new Date(year, monthIdx - 1, 1))}
          className="p-1 rounded-lg hover:bg-amber-50 text-gray-500 hover:text-amber-600 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-semibold text-gray-700 capitalize">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setMonth(new Date(year, monthIdx + 1, 1))}
          className="p-1 rounded-lg hover:bg-amber-50 text-gray-500 hover:text-amber-600 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Cabecera de días */}
      <div className="grid grid-cols-7 mb-1">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-0.5">{d}</div>
        ))}
      </div>

      {/* Grilla de días */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
          const isPast = key < todayKey;
          const isSelected = key === value;
          const isToday = key === todayKey;
          const isCurrentMonth = day.getMonth() === monthIdx;

          return (
            <button
              key={i}
              type="button"
              disabled={isPast}
              onClick={() => onChange(key)}
              className={[
                'w-full aspect-square flex items-center justify-center text-[11px] font-medium rounded-lg transition-all',
                isPast ? 'text-gray-200 cursor-not-allowed' : '',
                !isCurrentMonth && !isPast ? 'text-gray-300' : '',
                isSelected ? 'bg-amber-500 text-white font-bold shadow-sm' : '',
                isToday && !isSelected ? 'ring-1 ring-amber-400 text-amber-700 font-semibold' : '',
                !isPast && !isSelected && isCurrentMonth ? 'hover:bg-amber-50 text-gray-700' : '',
              ].join(' ')}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      {/* Fecha seleccionada */}
      <div className="mt-3 pt-2 border-t border-amber-100 text-center">
        <p className="text-[11px] text-amber-600 font-medium">
          Vence el{' '}
          <span className="font-bold">
            {new Date(value + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
        </p>
      </div>
    </div>
  );
}
