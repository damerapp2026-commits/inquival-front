import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useFiscalEntities } from '../../fiscal-entities/hooks/useFiscalEntities';
import { useProducts } from '../../products/hooks/useProducts';
import { useSuppliers } from '../../suppliers/hooks/useSuppliers';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { SmartSearchSelect } from '../../../shared/components/SmartSearchSelect';
import type { Company, FiscalEntity, Product, Supplier } from '../../../shared/types';
import { useCreatePurchaseOrder } from '../hooks/usePurchases';

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

const money = (value: number, currency: 'PEN' | 'USD') =>
  `${currency === 'USD' ? '$' : 'S/'} ${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function NewPurchaseOrderPage() {
  const navigate = useNavigate();
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
  const [fiscalEntityId, setFiscalEntityId] = useState(defaultFiscalEntityId);
  const [currency, setCurrency] = useState<'PEN' | 'USD'>('PEN');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItem[]>([emptyItem()]);

  useEffect(() => {
    if (!fiscalEntityId && defaultFiscalEntityId) setFiscalEntityId(defaultFiscalEntityId);
  }, [defaultFiscalEntityId, fiscalEntityId]);

  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId);
  const productOptions = products.map((product) => ({
    value: product.id,
    label: product.name,
    sublabel: [product.activeIngredient, product.unit].filter(Boolean).join(' · '),
  }));
  const companyOptions = companies.map((company) => ({
    value: company.id,
    label: company.name,
    sublabel: (company as any).ruc,
  }));
  const fiscalEntityOptions = fiscalEntities.map((entity) => ({
    value: entity.id,
    label: `${entity.legalName} (${entity.ruc})`,
  }));

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [items],
  );

  const handleSupplierChange = (id: string) => {
    setSupplierId(id);
    if (!id) {
      setSupplierName('');
      setSupplierRuc('');
      return;
    }
    const supplier = suppliers.find((item) => item.id === id);
    if (!supplier) return;
    setSupplierName(supplier.businessName);
    setSupplierRuc(supplier.ruc);
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
    if (!validItems.length || validItems.length !== items.length) {
      toast.error('Completa almacén, producto y cantidad en cada línea');
      return;
    }

    const payload: any = {
      supplier,
      supplierId: supplierId || undefined,
      supplierRuc: supplierRuc || selectedSupplier?.ruc || undefined,
      fiscalEntityId,
      companyId: validItems[0].companyId,
      currency,
      notes: notes.trim() || undefined,
      items: validItems.map((item) => {
        const unitPrice = Number(item.unitPrice) || 0;
        return {
          companyId: item.companyId,
          productId: item.productId,
          quantity: Number(item.quantity),
          unitCost: unitPrice,
          unitPriceSinIgv: unitPrice,
          unitPriceConIgv: unitPrice,
        };
      }),
    };
    if (currency === 'USD') payload.totalCostUsd = total;
    else payload.totalCost = total;

    await createOrder.mutateAsync(payload);
    navigate('/purchases?tab=orders');
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/purchases?tab=orders" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Volver">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <ClipboardList size={12} /> Compras · Órdenes
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Nueva orden de compra</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Datos del pedido</h2>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block md:col-span-2">
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
                  <span className="text-xs font-medium text-gray-600">Nombre del proveedor</span>
                  <input
                    value={supplierName}
                    onChange={(event) => setSupplierName(event.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Proveedor"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">RUC proveedor</span>
                  <input
                    value={supplierRuc}
                    onChange={(event) => setSupplierRuc(event.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Opcional"
                  />
                </label>
              </>
            )}
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Empresa receptora (RUC)</span>
              <SearchableSelect
                options={fiscalEntityOptions}
                value={fiscalEntityId}
                onChange={setFiscalEntityId}
                placeholder="Seleccionar empresa"
                minChars={0}
                className="mt-1 px-3 py-2 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Moneda</span>
              <div className="mt-1 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                {(['PEN', 'USD'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCurrency(option)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium ${
                      currency === option ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {option === 'PEN' ? 'S/ PEN' : '$ USD'}
                  </button>
                ))}
              </div>
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-gray-600">Observaciones</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Condiciones, fecha estimada o indicaciones para el proveedor"
              />
            </label>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-700">Productos solicitados</h2>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-50"
            >
              <Plus size={15} /> Agregar producto
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map((item, index) => (
              <div key={index} className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_120px_150px_120px_40px] gap-3 items-end">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Almacén destino</span>
                  <SearchableSelect
                    options={companyOptions}
                    value={item.companyId}
                    onChange={(value) => updateItem(index, { companyId: value })}
                    placeholder="Almacén"
                    minChars={0}
                    className="mt-1 px-3 py-2 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Producto</span>
                  <SearchableSelect
                    options={productOptions}
                    value={item.productId}
                    onChange={(value) => updateItem(index, { productId: value })}
                    placeholder="Buscar producto"
                    minChars={1}
                    className="mt-1 px-3 py-2 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Cantidad</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Precio estimado</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </label>
                <div>
                  <span className="text-xs font-medium text-gray-600">Subtotal</span>
                  <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-semibold text-gray-800">
                    {money(item.quantity * item.unitPrice, currency)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                  title="Quitar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
            <div className="text-right">
              <div className="text-xs text-gray-500">Total estimado</div>
              <div className="text-2xl font-bold text-primary-700">{money(total, currency)}</div>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <Link to="/purchases?tab=orders" className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={createOrder.isPending}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 text-sm font-medium"
          >
            {createOrder.isPending ? 'Guardando...' : 'Guardar orden'}
          </button>
        </div>
      </form>
    </div>
  );
}
