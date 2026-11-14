import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
import type { Client, FiscalEntity, Product, Supplier, PurchaseOrder, PurchaseOrderItem } from '../../../shared/types';
import { getTodayDateString, toLocalDateString } from '../../../shared/utils/date.util';
import { useClients } from '../../clients/hooks/useClients';
import { useFiscalEntities } from '../../fiscal-entities/hooks/useFiscalEntities';
import { useProducts } from '../../products/hooks/useProducts';
import { useSuppliers } from '../../suppliers/hooks/useSuppliers';
import { useCreatePurchaseOrder, usePurchaseOrderById, useUpdatePurchaseOrder } from '../hooks/usePurchases';
import { calculatePurchaseOrderAmounts, purchaseOrderAmounts } from '../utils/purchaseOrderAmounts';
import { numberToWords } from '../../quotes/utils/numberToWords';
import {
  addDaysToDate,
  PURCHASE_ORDER_CONDITIONS,
  PURCHASE_ORDER_CREDIT_DAYS,
  serializePurchaseOrderDetails,
  getPurchaseOrderDetails,
  type PurchaseOrderPaymentForm,
} from '../utils/purchaseOrderDetails';

type OrderItem = {
  source?: PurchaseOrderItem;
  mode: 'catalogue' | 'manual';
  productId: string;
  productName: string;
  description: string;
  unit: string;
  taxType: string;
  quantity: number;
  unitPrice: number;
};

const emptyItem = (): OrderItem => ({
  mode: 'catalogue',
  productId: '',
  productName: '',
  description: '',
  unit: 'UND',
  taxType: 'GRAVADO',
  quantity: 1,
  unitPrice: 0,
});

const inputClass = 'mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

const money = (value: number, currency: 'PEN' | 'USD') =>
  `${currency === 'USD' ? 'US$' : 'S/'} ${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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
  const { id } = useParams<{ id: string }>();
  const { data: loadedOrder, isLoading: loadingOrder, isError: orderError } = usePurchaseOrderById(id);
  const order = loadedOrder as PurchaseOrder | undefined;
  const updateOrder = useUpdatePurchaseOrder();
  const [hydratedId, setHydratedId] = useState('');
  const { user } = useAuth();
  const createOrder = useCreatePurchaseOrder();
  const { data: suppliersData } = useSuppliers({ limit: 10000 });
  const { data: clientsData } = useClients({ limit: 10000 });
  const { data: fiscalEntitiesData } = useFiscalEntities();
  const { data: productsData, isLoading: loadingProducts, isError: productsError } = useProducts({ limit: 10000 });

  const suppliers: Supplier[] = Array.isArray(suppliersData) ? suppliersData : suppliersData?.data || [];
  const clients: Client[] = Array.isArray(clientsData) ? clientsData : clientsData?.data || [];
  const [contactClientId, setContactClientId] = useState('');
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
  const [installments, setInstallments] = useState<{ amount: number; dueDate: string }[]>([]);
  const [requestedBy, setRequestedBy] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItem[]>([emptyItem()]);

  useEffect(() => {
    if (!id && !fiscalEntityId && defaultFiscalEntityId) setFiscalEntityId(defaultFiscalEntityId);
  }, [defaultFiscalEntityId, fiscalEntityId, id]);

  useEffect(() => {
    if (!id && !requestedBy && user?.fullName) setRequestedBy(user.fullName);
  }, [requestedBy, user?.fullName, id]);

  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId);
  const selectedFiscalEntity = fiscalEntities.find(entity => entity.id === fiscalEntityId);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const productOptions = products.map((product) => ({
    value: product.id,
    label: product.name,
    sublabel: [product.activeIngredient, product.unit].filter(Boolean).join(' · '),
  }));
  const fiscalEntityOptions = fiscalEntities.map((entity) => ({
    value: entity.id,
    label: `${entity.legalName} (${entity.ruc})`,
  }));

  const requiresCatalogue = Boolean(order?.items.some(item => item.productId && (!item.productName || !item.taxType)));
  const usesNetPrices = !id || order?.priceIncludesIgv === false;
  const totals = useMemo(() => calculatePurchaseOrderAmounts(items.map(item => ({
    productId: item.productId || undefined, taxType: item.taxType,
    quantity: Number(item.quantity) || 0, unitPriceSinIgv: Number(item.unitPrice) || 0,
    unitPriceConIgv: (Number(item.unitPrice) || 0) * (item.taxType === 'GRAVADO' ? 1.18 : 1),
  })), products, undefined, !usesNetPrices), [items, products, usesNetPrices]);

  useEffect(() => {
    if (!order || (requiresCatalogue && (loadingProducts || productsError)) || hydratedId === order.id) return;
    const details = getPurchaseOrderDetails(order);
    const amounts = purchaseOrderAmounts(order, products);
    setSupplierId(order.supplierId || ''); setSupplierName(order.supplier); setSupplierRuc(order.supplierRuc || '');
    setSupplierContact(details.supplierContact); setSupplierPhone(details.supplierPhone);
    setFiscalEntityId(order.fiscalEntityId || defaultFiscalEntityId);
    setIssueDate(toLocalDateString(order.issueDate || order.createdAt));
    setQuotationValidUntil(details.quotationValidUntil); setCurrency(amounts.currency);
    setDeliveryPlace(details.deliveryPlace); setDeliveryAddress(details.deliveryAddress);
    setTransport(details.transport); setTransportAddress(details.transportAddress);
    setPaymentType(order.paymentType === 'CREDITO' ? 'CREDITO' : 'CONTADO'); setPaymentForm(details.paymentForm);
    setInstallments((order.installments || []).map(i => ({ amount: i.amount, dueDate: toLocalDateString(i.dueDate) })));
    setCreditDays(details.creditDays || (order.dueDate ? Math.max(1, Math.round((Date.parse(toLocalDateString(order.dueDate)) - Date.parse(toLocalDateString(order.issueDate || order.createdAt))) / 86400000)) : 30)); setRequestedBy(details.requestedBy); setApprovedBy(details.approvedBy);
    setNotes(details.observations);
    setItems(order.items.map((item, index) => ({
      source: item, mode: item.productId ? 'catalogue' : 'manual', productId: item.productId || '',
      productName: item.productName || productMap.get(item.productId || '')?.name || '',
      description: item.description || '', unit: item.unit || productMap.get(item.productId || '')?.unit || 'UND',
      taxType: amounts.lines[index].taxType, quantity: item.quantity,
      unitPrice: amounts.lines[index].unitPriceSinIgv,
    })));
    setHydratedId(order.id);
  }, [order, hydratedId, products, productMap, defaultFiscalEntityId, loadingProducts, productsError, requiresCatalogue]);

  const dueDate = paymentType === 'CREDITO' && creditDays > 0 ? addDaysToDate(issueDate, creditDays) : '';
  const standardCreditDays = PURCHASE_ORDER_CREDIT_DAYS.some(days => days === creditDays);

  const handleSupplierChange = (id: string) => {
    setSupplierId(id);
    setContactClientId('');
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

  const addItem = () => setItems(current => [...current, emptyItem()]);

  const removeItem = (index: number) => {
    setItems((current) => current.length === 1 ? current : current.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const supplier = (supplierName || selectedSupplier?.businessName || '').trim();
    const validItems = items.filter(item => (item.mode === 'manual' ? item.productName.trim() : item.productId) && Number.isFinite(item.quantity) && item.quantity > 0 && Number.isFinite(item.unitPrice) && item.unitPrice >= 0);

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
      toast.error('Completa el producto, la cantidad y el precio en cada línea');
      return;
    }
    if (paymentType === 'CREDITO' && (!Number.isInteger(creditDays) || creditDays < 1 || creditDays > 3650)) {
      toast.error('Ingresa un plazo de crédito válido en días');
      return;
    }

    if (paymentType === 'CREDITO' && installments.length && installments.some(i => !i.dueDate || !(i.amount > 0))) {
      toast.error('Completa los montos y vencimientos de las cuotas.');
      return;
    }
    const detailsNotes = serializePurchaseOrderDetails({
      supplierContact,
      supplierPhone,
      quotationValidUntil,
      deliveryPlace: deliveryPlace.trim(),
      deliveryAddress: deliveryAddress.trim(),
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
      priceIncludesIgv: !usesNetPrices,
      expectedUpdatedAt: id ? order?.updatedAt : undefined,
      currency,
      exchangeRate: order?.currency === currency ? order.exchangeRate : undefined,
      paymentMethodId: order?.paymentMethodId,
      documentType: order?.documentType,
      documentSeries: order?.documentSeries,
      documentNumber: order?.documentNumber,
      issueDate,
      paymentType,
      paymentScheduleType: paymentType === 'CREDITO' ? (installments.length ? 'INSTALLMENTS' : 'SINGLE_DATE') : undefined,
      installments: paymentType === 'CREDITO' ? installments : [],
      dueDate: paymentType === 'CREDITO' ? (installments.length ? [...installments].map(i => i.dueDate).sort().pop() : dueDate) : undefined,
      notes: detailsNotes,
      items: validItems.map((item, index) => {
        const line = totals.lines[index];
        return {
          productId: item.mode === 'catalogue' ? item.productId : undefined,
          productName: item.mode === 'manual' ? item.productName.trim() : (item.productName || productMap.get(item.productId)?.name),
          description: item.mode === 'manual' ? item.description.trim() : (item.description || productMap.get(item.productId)?.activeIngredient),
          unit: item.unit.trim() || 'UND',
          taxType: item.taxType,
          precioVenta: item.source?.precioVenta,
          markupPercent: item.source?.markupPercent,
          lotNumber: item.source?.lotNumber,
          expirationDate: item.source?.expirationDate,
          quantity: Number(item.quantity),
          unitCost: line.unitPrice,
          unitPriceSinIgv: line.unitPriceSinIgv,
          unitPriceConIgv: line.unitPrice,
        };
      }),
    };
    if (currency === 'USD') payload.totalCostUsd = totals.total;
    else payload.totalCost = totals.total;

    try {
      if (id) await updateOrder.mutateAsync({ id, data: payload });
      else await createOrder.mutateAsync(payload);
      navigate('/purchases?tab=orders');
    } catch { /* The mutation shows the error and preserves the form for retry. */ }
  };

  if (id && (loadingOrder || (requiresCatalogue && loadingProducts) || (order && !(requiresCatalogue && productsError) && hydratedId !== order.id))) return <div className="p-8 text-center">Cargando orden...</div>;
  if (id && (orderError || (requiresCatalogue && productsError) || !order)) return <div className="p-8">No se pudo cargar la orden. <Link to="/purchases?tab=orders" className="text-primary-700 underline">Volver</Link></div>;
  if (order && !['PENDING', 'APPROVED'].includes(order.status)) return <div className="p-8">Esta orden ya no se puede editar. <Link to="/purchases?tab=orders" className="text-primary-700 underline">Volver</Link></div>;
  const saving = createOrder.isPending || updateOrder.isPending;

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
          <h1 className="text-2xl font-bold text-gray-800">{id ? `Editar ${order?.orderNumber || 'orden de compra'}` : 'Nueva orden de compra'}</h1>
          {order?.status === 'APPROVED' && <p className="text-xs text-amber-700 mt-1">Al guardar los cambios, la orden quedará pendiente de aprobación.</p>}
          <p className="text-sm text-gray-500 mt-0.5">Completa los datos que aparecerán en el formato y en el PDF. La solicitud no modifica el stock.</p>
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
              <div className="sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Contacto de la cartera de clientes</span>
                <SmartSearchSelect items={clients} value={contactClientId}
                  onChange={value => {
                    setContactClientId(value);
                    const client = clients.find(c => c.id === value);
                    if (client) { setSupplierContact(client.name); setSupplierPhone(client.phone || ''); }
                  }}
                  getId={client => client.id} getLabel={client => client.name}
                  getSubLabel={client => [client.documentNumber, client.phone].filter(Boolean).join(' · ')}
                  searchFields={client => [client.name, client.documentNumber, client.phone]}
                  placeholder="Buscar contacto en clientes" emptyText="Sin contactos coincidentes" accent="gray" className="mt-1" />
              </div>
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
                <input value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} className={inputClass} placeholder="Dirección donde se entregará el pedido" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Dirección del transportista</span>
                <input value={transportAddress} onChange={event => setTransportAddress(event.target.value)} className={inputClass} placeholder="Agencia o sucursal del transportista (opcional)" />
              </label>

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
                  <select aria-label="Plazo de crédito" value={standardCreditDays ? creditDays : 'custom'} onChange={event => setCreditDays(event.target.value === 'custom' ? 0 : Number(event.target.value))} className={inputClass}>
                    {PURCHASE_ORDER_CREDIT_DAYS.map(days => <option key={days} value={days}>{days} días</option>)}
                    <option value="custom">Otro plazo</option>
                  </select>
                  {!standardCreditDays && <input type="number" aria-label="Plazo personalizado en días" min="1" max="3650" step="1" required value={creditDays || ''} onChange={event => setCreditDays(Number(event.target.value))} className={inputClass} placeholder="Número de días" />}
                  {dueDate && <span className="mt-1 block text-[11px] text-gray-500">Vence: {dueDate.split('-').reverse().join('/')}</span>}
                </label>
              )}
              {paymentType === 'CREDITO' && installments.length > 0 && <div className="sm:col-span-2 space-y-2">
                <p className="text-xs font-medium text-gray-600">Cuotas de la orden</p>
                {installments.map((installment, index) => <div key={index} className="grid grid-cols-2 gap-2">
                  <input type="number" aria-label={`Monto cuota ${index + 1}`} min="0.01" step="0.01" value={installment.amount} onChange={e => setInstallments(current => current.map((i, idx) => idx === index ? { ...i, amount: Number(e.target.value) } : i))} className={inputClass} />
                  <input type="date" aria-label={`Vencimiento cuota ${index + 1}`} value={installment.dueDate} onChange={e => setInstallments(current => current.map((i, idx) => idx === index ? { ...i, dueDate: e.target.value } : i))} className={inputClass} />
                </div>)}
              </div>}
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

        <FormSection title="Productos solicitados" description="Ingresa el precio base sin IGV; el impuesto se suma al total" icon={Package}>
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">Puedes elegir del catálogo o escribir un producto sin crearlo.</p>
            <button type="button" onClick={addItem} className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-50"><Plus size={15} /> Agregar producto</button>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map((item, index) => (
              <div key={index} className="p-4 space-y-3" data-testid="order-item">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <button type="button" aria-pressed={item.mode === 'catalogue'} onClick={() => item.mode !== 'catalogue' && updateItem(index, { source: undefined, mode: 'catalogue', productId: '', productName: '', description: '', unit: 'UND', taxType: 'GRAVADO' })} className={`px-3 py-1.5 rounded-lg text-xs border ${item.mode === 'catalogue' ? 'bg-primary-50 border-primary-200 text-primary-700' : 'border-gray-200 text-gray-500'}`}>Del catálogo</button>
                    <button type="button" aria-pressed={item.mode === 'manual'} onClick={() => item.mode !== 'manual' && updateItem(index, { source: undefined, mode: 'manual', productId: '', productName: '', description: '', unit: 'UND' })} className={`px-3 py-1.5 rounded-lg text-xs border ${item.mode === 'manual' ? 'bg-primary-50 border-primary-200 text-primary-700' : 'border-gray-200 text-gray-500'}`}>Escribir producto</button>
                  </div>
                  <button type="button" onClick={() => removeItem(index)} disabled={items.length === 1} className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-40" title="Quitar producto"><Trash2 size={16} /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(200px,2fr)_80px_120px_120px_120px] gap-3 items-end">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">{item.mode === 'manual' ? 'Nombre del producto' : 'Producto'}</span>
                    {item.mode === 'manual'
                      ? <input required value={item.productName} onChange={e => updateItem(index, { productName: e.target.value })} className={inputClass} placeholder="Escribe el producto solicitado" />
                      : <SearchableSelect options={productOptions.some(p => p.value === item.productId) || !item.productId ? productOptions : [...productOptions, { value: item.productId, label: item.productName || item.productId }]} value={item.productId} onChange={value => {
                          const product = productMap.get(value);
                          updateItem(index, { source: undefined, productId: value, productName: product?.name || '', description: product?.activeIngredient || '', unit: product?.unit || 'UND', taxType: product?.taxType || 'GRAVADO' });
                        }} placeholder="Buscar producto" minChars={1} className="mt-1 px-3 py-2 rounded-lg" />}
                  </label>
                  <label className="block"><span className="text-xs font-medium text-gray-600">Cantidad</span><input required type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(index, { quantity: Number(e.target.value) })} className={inputClass} /></label>
                  <label className="block"><span className="text-xs font-medium text-gray-600">P. unit. sin IGV</span><input required type="number" min="0" step="any" value={item.unitPrice} onChange={e => updateItem(index, { unitPrice: Number(e.target.value) })} className={inputClass} /></label>
                  <label className="block"><span className="text-xs font-medium text-gray-600">Afectación IGV</span><select aria-label="Afectación IGV" value={item.taxType} onChange={e => updateItem(index, { taxType: e.target.value })} className={inputClass}><option value="GRAVADO">Gravado (18%)</option><option value="EXONERADO">Exonerado</option><option value="INAFECTO">Inafecto</option></select></label>
                  <div><span className="text-xs font-medium text-gray-600">Importe con IGV</span><div className="mt-1 p-2 bg-gray-50 rounded-lg text-sm font-semibold tabular-nums">{money(totals.lines[index].total, currency)}</div></div>
                </div>
                {item.mode === 'manual' && <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-3">
                  <label><span className="text-xs text-gray-600">Descripción o ingrediente (opcional)</span><input value={item.description} onChange={e => updateItem(index, { description: e.target.value })} className={inputClass} /></label>
                  <label><span className="text-xs text-gray-600">Unidad</span><input value={item.unit} onChange={e => updateItem(index, { unit: e.target.value })} className={inputClass} placeholder="UND, LITRO, KG..." /></label>
                </div>}
                <p className="text-xs text-gray-500">Base: {money(totals.lines[index].subtotal, currency)} + IGV: {money(totals.lines[index].igv, currency)} = Total: {money(totals.lines[index].total, currency)}</p>
              </div>
            ))}
          </div>
          <div className="px-4 py-4 border-t border-gray-100 flex justify-end">
            <dl className="w-full sm:w-72 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600"><dt>Base sin IGV</dt><dd className="tabular-nums">{money(totals.subtotal, currency)}</dd></div>
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
          <button type="submit" disabled={saving} className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 text-sm font-medium">
            {saving ? 'Guardando...' : id ? 'Guardar cambios' : 'Guardar orden'}
          </button>
        </div>
      </form>
    </div>
  );
}
