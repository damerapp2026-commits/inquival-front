import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  MapPin,
  Package,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../app/providers/AuthProvider';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { SmartSearchSelect } from '../../../shared/components/SmartSearchSelect';
import type { Company, FiscalEntity, Product, Supplier } from '../../../shared/types';
import { getTodayDateString } from '../../../shared/utils/date.util';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useFiscalEntities } from '../../fiscal-entities/hooks/useFiscalEntities';
import { useProducts } from '../../products/hooks/useProducts';
import { useSuppliers } from '../../suppliers/hooks/useSuppliers';
import { useCreatePurchaseOrder } from '../hooks/usePurchases';
import { calculatePurchaseOrderAmounts, roundOrderMoney } from '../utils/purchaseOrderAmounts';
import { numberToWords } from '../../quotes/utils/numberToWords';
import {
  addDaysToDate,
  PURCHASE_ORDER_CONDITIONS,
  PURCHASE_ORDER_CREDIT_DAYS,
  serializePurchaseOrderDetails,
  type PurchaseOrderPaymentForm,
} from '../utils/purchaseOrderDetails';

type OrderItem = {
  companyId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
};

const emptyItem = (): OrderItem => ({
  companyId: '',
  productId: '',
  quantity: 1,
  unitPrice: 0,
});

const inputClass = 'mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

const money = (value: number, currency: 'PEN' | 'USD') =>
  `${currency === 'USD' ? 'US$' : 'S/'} ${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const appliesIgv = (product?: Product) => !product?.taxType || product.taxType === 'GRAVADO';

function FormSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: typeof UserRound;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
          <Icon size={16} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function NewPurchaseOrderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createOrder = useCreatePurchaseOrder();
  const { data: suppliersData } = useSuppliers({ limit: 10000 });
  const { data: companiesData } = useCompanies();
  const { data: fiscalEntitiesData } = useFiscalEntities();
  const { data: productsData } = useProducts({ limit: 10000 });

  const suppliers: Supplier[] = Array.isArray(suppliersData) ? suppliersData : suppliersData?.data || [];
  const companies: Company[] = Array.isArray(companiesData) ? companiesData : [];
  const fiscalEntities: FiscalEntity[] = (Array.isArray(fiscalEntitiesData) ? fiscalEntitiesData : [])
    .filter((entity) => entity.isActive !== false);
  const products: Product[] = (Array.isArray(productsData) ? productsData : productsData?.data || [])
    .filter((product: Product) => product.isActive !== false);

  const defaultFiscalEntityId = fiscalEntities.find((entity) => entity.isDefault)?.id || fiscalEntities[0]?.id || '';
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierRuc, setSupplierRuc] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [fiscalEntityId, setFiscalEntityId] = useState(defaultFiscalEntityId);
  const [issueDate, setIssueDate] = useState(getTodayDateString());
  const [quotationValidUntil, setQuotationValidUntil] = useState('');
  const [currency, setCurrency] = useState<'PEN' | 'USD'>('PEN');
  const [deliveryPlace, setDeliveryPlace] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [transport, setTransport] = useState('Directo (a cargo del proveedor)');
  const [transportAddress, setTransportAddress] = useState('');
  const [paymentForm, setPaymentForm] = useState<PurchaseOrderPaymentForm>('CONTADO');
  const [paymentType, setPaymentType] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [creditDays, setCreditDays] = useState(30);
  const [requestedBy, setRequestedBy] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItem[]>([emptyItem()]);

  useEffect(() => {
    if (!fiscalEntityId && defaultFiscalEntityId) setFiscalEntityId(defaultFiscalEntityId);
  }, [defaultFiscalEntityId, fiscalEntityId]);

  useEffect(() => {
    if (!requestedBy && user?.fullName) setRequestedBy(user.fullName);
  }, [requestedBy, user?.fullName]);

  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId);
  const selectedFiscalEntity = fiscalEntities.find(entity => entity.id === fiscalEntityId);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const companyMap = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const productOptions = products.map((product) => ({
    value: product.id,
    label: product.name,
    sublabel: [product.activeIngredient, product.unit].filter(Boolean).join(' · '),
  }));
  const companyOptions = companies.map((company) => ({
    value: company.id,
    label: company.name,
    sublabel: company.ruc,
  }));
  const fiscalEntityOptions = fiscalEntities.map((entity) => ({
    value: entity.id,
    label: `${entity.legalName} (${entity.ruc})`,
  }));

  const selectedWarehouses = useMemo(() => {
    const ids = [...new Set(items.map((item) => item.companyId).filter(Boolean))];
    return ids.map((id) => companyMap.get(id)).filter((company): company is Company => !!company);
  }, [companyMap, items]);
  const inferredDeliveryAddress = selectedWarehouses.map((company) => company.address).filter(Boolean).join(' / ');

  const totals = useMemo(() => calculatePurchaseOrderAmounts(items.map(item => ({
    productId: item.productId, quantity: Number(item.quantity) || 0,
    unitPriceConIgv: roundOrderMoney(Number(item.unitPrice) || 0),
  })), products), [items, products]);

  const dueDate = paymentType === 'CREDITO' && creditDays > 0 ? addDaysToDate(issueDate, creditDays) : '';
  const standardCreditDays = PURCHASE_ORDER_CREDIT_DAYS.some(days => days === creditDays);

  const handleSupplierChange = (id: string) => {
    setSupplierId(id);
    if (!id) {
      setSupplierName('');
      setSupplierRuc('');
      setSupplierContact('');
      setSupplierPhone('');
      return;
    }
    const supplier = suppliers.find((item) => item.id === id);
    if (!supplier) return;
    setSupplierName(supplier.businessName);
    setSupplierRuc(supplier.ruc);
    setSupplierContact('');
    setSupplierPhone(supplier.phone || '');
  };

  const updateItem = (index: number, patch: Partial<OrderItem>) => {
    setItems((current) => current.map((item, idx) => (
      idx === index ? { ...item, ...patch } : item
    )));
  };

  const addItem = () => {
    setItems((current) => {
      const last = current[current.length - 1];
      return [...current, { ...emptyItem(), companyId: last?.companyId || '' }];
    });
  };

  const removeItem = (index: number) => {
    setItems((current) => current.length === 1 ? current : current.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const supplier = (selectedSupplier?.businessName || supplierName).trim();
    const validItems = items.filter((item) => item.companyId && item.productId && item.quantity > 0);

    if (!supplier) {
      toast.error('Ingresa o selecciona el proveedor');
      return;
    }
    if (!fiscalEntityId) {
      toast.error('Selecciona la empresa receptora');
      return;
    }
    if (!issueDate) {
      toast.error('Selecciona la fecha de pedido');
      return;
    }
    if (quotationValidUntil && quotationValidUntil < issueDate) {
      toast.error('La vigencia de la cotización no puede ser anterior al pedido');
      return;
    }
    if (!validItems.length || validItems.length !== items.length) {
      toast.error('Completa almacén, producto y cantidad en cada línea');
      return;
    }
    if (paymentType === 'CREDITO' && (!Number.isInteger(creditDays) || creditDays < 1 || creditDays > 3650)) {
      toast.error('Ingresa un plazo de crédito válido en días');
      return;
    }

    const detailsNotes = serializePurchaseOrderDetails({
      supplierContact,
      supplierPhone,
      quotationValidUntil,
      deliveryPlace: deliveryPlace.trim(),
      deliveryAddress: deliveryAddress.trim() || inferredDeliveryAddress,
      transport,
      transportAddress,
      paymentForm,
      creditDays: paymentType === 'CREDITO' ? creditDays : undefined,
      requestedBy,
      approvedBy,
      observations: notes,
    });

    const payload: any = {
      supplier,
      supplierId: supplierId || undefined,
      supplierRuc: supplierRuc || selectedSupplier?.ruc || undefined,
      fiscalEntityId,
      companyId: validItems[0].companyId,
      currency,
      issueDate,
      paymentType,
      paymentScheduleType: paymentType === 'CREDITO' ? 'SINGLE_DATE' : undefined,
      dueDate: paymentType === 'CREDITO' ? dueDate : undefined,
      notes: detailsNotes,
      items: validItems.map((item, index) => {
        const line = totals.lines[index];
        return {
          companyId: item.companyId,
          productId: item.productId,
          quantity: Number(item.quantity),
          unitCost: line.unitPrice,
          unitPriceSinIgv: line.unitPriceSinIgv,
          unitPriceConIgv: line.unitPrice,
        };
      }),
    };
    if (currency === 'USD') payload.totalCostUsd = totals.total;
    else payload.totalCost = totals.total;

    await createOrder.mutateAsync(payload);
    navigate('/purchases?tab=orders');
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/purchases?tab=orders" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Volver">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <ClipboardList size={12} /> Compras · Órdenes
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Nueva orden de compra</h1>
          <p className="text-sm text-gray-500 mt-0.5">Completa los datos que aparecerán en el formato y en el PDF.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <FormSection title="Empresa receptora" description="Empresa a cuyo nombre se emite la orden de compra" icon={Building2}>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Empresa receptora</span>
              <SearchableSelect options={fiscalEntityOptions} value={fiscalEntityId} onChange={setFiscalEntityId} placeholder="Seleccionar empresa" minChars={0} className="mt-1 px-3 py-2 rounded-lg" />
            </label>
            {selectedFiscalEntity && <div className="rounded-lg bg-primary-50 p-3 text-sm text-primary-900">
              <p className="font-semibold">{selectedFiscalEntity.legalName}</p>
              <p>RUC: {selectedFiscalEntity.ruc}</p>
              {selectedFiscalEntity.address && <p className="text-xs mt-1">{selectedFiscalEntity.address}</p>}
            </div>}
          </div>
        </FormSection>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          <FormSection title="Proveedor" description="Razón social y datos de contacto" icon={UserRound}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Proveedor</span>
                <SmartSearchSelect
                  items={suppliers}
                  value={supplierId}
                  onChange={handleSupplierChange}
                  getId={(supplier) => supplier.id}
                  getLabel={(supplier) => supplier.businessName}
                  getSubLabel={(supplier) => supplier.ruc}
                  searchFields={(supplier) => [supplier.businessName, supplier.ruc]}
                  placeholder="Buscar proveedor por nombre o RUC"
                  emptyText="Sin proveedores"
                  accent="gray"
                  className="mt-1"
                />
              </label>
              {!supplierId && (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">Razón social</span>
                    <input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} className={inputClass} placeholder="Proveedor" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">RUC</span>
                    <input value={supplierRuc} onChange={(event) => setSupplierRuc(event.target.value)} className={inputClass} placeholder="RUC del proveedor" />
                  </label>
                </>
              )}
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Persona de contacto</span>
                <input value={supplierContact} onChange={(event) => setSupplierContact(event.target.value)} className={inputClass} placeholder="Nombre del contacto" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Teléfono</span>
                <input value={supplierPhone} onChange={(event) => setSupplierPhone(event.target.value)} className={inputClass} placeholder="Teléfono del proveedor" />
              </label>
            </div>
          </FormSection>

          <FormSection title="Fecha y moneda" description="Fecha del pedido y vigencia de la cotización" icon={CalendarDays}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Fecha de pedido</span>
                <input type="date" required value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Vencimiento de cotización</span>
                <input type="date" min={issueDate} value={quotationValidUntil} onChange={(event) => setQuotationValidUntil(event.target.value)} className={inputClass} />
              </label>
              <div className="sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Moneda</span>
                <div className="mt-1 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                  {(['PEN', 'USD'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setCurrency(option)}
                      className={`px-5 py-1.5 rounded-md text-sm font-medium ${
                        currency === option ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {option === 'PEN' ? 'S/ Soles (PEN)' : 'US$ Dólares (USD)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection title="Punto de llegada" description="Destino y modalidad de transporte" icon={MapPin}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Referencia del punto de llegada</span>
                <input value={deliveryPlace} onChange={(event) => setDeliveryPlace(event.target.value)} className={inputClass} placeholder="Local, sucursal o referencia (opcional)" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Transporte</span>
                <input value={transport} onChange={(event) => setTransport(event.target.value)} className={inputClass} placeholder="Directo (a cargo del proveedor)" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Dirección de entrega</span>
                <input value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} className={inputClass} placeholder={inferredDeliveryAddress || 'Se completará según el almacén'} />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Dirección del transportista</span>
                <input value={transportAddress} onChange={event => setTransportAddress(event.target.value)} className={inputClass} placeholder="Agencia o sucursal del transportista (opcional)" />
              </label>
              {selectedWarehouses.length > 0 && (
                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  {selectedWarehouses.map((company) => (
                    <span key={company.id} className="px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-medium">
                      Almacén: {company.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </FormSection>

          <FormSection title="Condiciones de pago" description="Forma, condición y plazo del pedido" icon={CreditCard}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Forma de pago</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(['CONTADO', 'LETRA', 'FACTURA'] as const).map((option) => (
                    <button key={option} type="button" aria-pressed={paymentForm === option} onClick={() => {
                      setPaymentForm(option);
                      setPaymentType(option === 'CONTADO' ? 'CONTADO' : 'CREDITO');
                    }} className={`px-3 py-2 rounded-lg border text-xs font-semibold ${paymentForm === option ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {option.charAt(0) + option.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-600">Condición de pago</span>
                <div className="mt-1 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                  {(['CONTADO', 'CREDITO'] as const).map((option) => (
                    <button key={option} type="button" aria-pressed={paymentType === option} onClick={() => {
                      setPaymentType(option);
                      setPaymentForm(option === 'CONTADO' ? 'CONTADO' : paymentForm === 'CONTADO' ? 'FACTURA' : paymentForm);
                    }} className={`px-4 py-1.5 rounded-md text-sm font-medium ${paymentType === option ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}>
                      {option === 'CONTADO' ? 'Contado' : 'Crédito'}
                    </button>
                  ))}
                </div>
              </div>
              {paymentType === 'CREDITO' && (
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Plazo de crédito</span>
                  <select value={standardCreditDays ? creditDays : 'custom'} onChange={event => setCreditDays(event.target.value === 'custom' ? 0 : Number(event.target.value))} className={inputClass}>
                    {PURCHASE_ORDER_CREDIT_DAYS.map(days => <option key={days} value={days}>{days} días</option>)}
                    <option value="custom">Otro plazo</option>
                  </select>
                  {!standardCreditDays && <input type="number" aria-label="Plazo personalizado en días" min="1" max="3650" step="1" required value={creditDays || ''} onChange={event => setCreditDays(Number(event.target.value))} className={inputClass} placeholder="Número de días" />}
                  {dueDate && <span className="mt-1 block text-[11px] text-gray-500">Vence: {dueDate.split('-').reverse().join('/')}</span>}
                </label>
              )}
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Solicitado por</span>
                <input value={requestedBy} onChange={(event) => setRequestedBy(event.target.value)} className={inputClass} placeholder="Nombre del solicitante" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Aprobado por</span>
                <input value={approvedBy} onChange={event => setApprovedBy(event.target.value)} className={inputClass} placeholder="Nombre o firma pendiente" />
              </label>
            </div>
          </FormSection>
        </div>

        <FormSection title="Productos solicitados" description="El precio unitario debe incluir IGV cuando corresponda" icon={Package}>
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-end">
            <button type="button" onClick={addItem} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-50">
              <Plus size={15} /> Agregar producto
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map((item, index) => {
              const product = productMap.get(item.productId);
              return (
                <div key={index} className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(140px,1fr)_minmax(160px,1.4fr)_80px_120px_100px_120px_40px] gap-3 items-end">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">Almacén destino</span>
                    <SearchableSelect options={companyOptions} value={item.companyId} onChange={(value) => updateItem(index, { companyId: value })} placeholder="Almacén" minChars={0} className="mt-1 px-3 py-2 rounded-lg" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">Producto</span>
                    <SearchableSelect options={productOptions} value={item.productId} onChange={(value) => updateItem(index, { productId: value })} placeholder="Buscar producto" minChars={1} className="mt-1 px-3 py-2 rounded-lg" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">Cantidad</span>
                    <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} className={inputClass} />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">P. unit. con IGV</span>
                    <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })} className={inputClass} />
                  </label>
                  <div>
                    <span className="text-xs font-medium text-gray-600">IGV incluido</span>
                    <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm tabular-nums">{money(totals.lines[index].igv, currency)}</div>
                    {product && !appliesIgv(product) && <span className="text-[10px] text-amber-600">{product.taxType === 'EXONERADO' ? 'Exonerado' : 'Inafecto'}</span>}
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-600">Importe</span>
                    <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-semibold text-gray-800">
                      {money(totals.lines[index].total, currency)}
                    </div>
                  </div>
                  <button type="button" onClick={() => removeItem(index)} disabled={items.length === 1} className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400" title="Quitar">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-4 border-t border-gray-100 flex justify-end">
            <dl className="w-full sm:w-72 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600"><dt>Subtotal</dt><dd className="tabular-nums">{money(totals.subtotal, currency)}</dd></div>
              <div className="flex justify-between text-gray-600"><dt>IGV (18%)</dt><dd className="tabular-nums">{money(totals.igv, currency)}</dd></div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-primary-700"><dt>Total estimado</dt><dd className="tabular-nums">{money(totals.total, currency)}</dd></div>
            </dl>
          </div>
          <p className="px-4 pb-4 text-xs text-gray-600"><span className="font-semibold">Son: </span>{numberToWords(totals.total, currency)}.</p>
        </FormSection>

        <FormSection title="Observaciones" description="Indicaciones adicionales para el proveedor" icon={Building2}>
          <div className="p-4">
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={inputClass} placeholder="Condiciones especiales, instrucciones de entrega u otras observaciones" />
          </div>
        </FormSection>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
          <p className="font-semibold text-gray-700 mb-2">Condiciones de entrega</p>
          <ol className="list-decimal pl-4 space-y-1">{PURCHASE_ORDER_CONDITIONS.map(condition => <li key={condition}>{condition}</li>)}</ol>
        </div>

        <div className="flex items-center justify-end gap-3 pb-4">
          <Link to="/purchases?tab=orders" className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </Link>
          <button type="submit" disabled={createOrder.isPending} className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 text-sm font-medium">
            {createOrder.isPending ? 'Guardando...' : 'Guardar orden'}
          </button>
        </div>
      </form>
    </div>
  );
}
