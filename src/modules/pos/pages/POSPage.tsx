import { useState, useMemo, useEffect, useRef } from 'react';
import { useProducts } from '../../products/hooks/useProducts';
import { useCategories } from '../../categories/hooks/useCategories';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useClients } from '../../clients/hooks/useClients';
import { usePriceTiers } from '../../price-tiers/hooks/usePriceTiers';
import { usePaymentMethods } from '../../payment-methods/hooks/usePaymentMethods';
import { useCreateSale } from '../../sales/hooks/useSales';
import { useQuery } from '@tanstack/react-query';
import { stockService } from '../../stock/services/stockService';
import { Search, Plus, Minus, Trash2, Package, X, ShoppingCart, CreditCard, User, Pencil, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Product, ProductPrice, Category, Company, Client, PriceTier, PaymentMethod } from '../../../shared/types';

const IGV_RATE = 0.18;

interface CartItem {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  tierOverride?: string;   // if set, uses this tier instead of global
  isCustomPrice?: boolean; // true = manually edited, don't re-resolve
}

function resolvePrice(product: Product, tierId: string, companyId: string): number | undefined {
  if (!product.prices?.length) return undefined;
  const byCompany = product.prices.find((p: ProductPrice) => p.priceTierId === tierId && p.companyId === companyId);
  if (byCompany) return byCompany.price;
  const global = product.prices.find((p: ProductPrice) => p.priceTierId === tierId && !p.companyId);
  return global?.price;
}

export function POSPage() {
  const { data: productsData } = useProducts({ limit: 500 });
  const { data: categoriesData } = useCategories();
  const { data: companiesData } = useCompanies();
  const { data: clientsData } = useClients({ limit: 500 });
  const { data: priceTiers } = usePriceTiers();
  const { data: paymentMethodsData } = usePaymentMethods();
  const createSale = useCreateSale();

  const products: Product[] = useMemo(() => {
    const raw: any = productsData;
    const list: Product[] = Array.isArray(raw) ? raw : raw?.data || [];
    return list.filter((p) => p.isActive);
  }, [productsData]);

  const categories: Category[] = useMemo(() => {
    const list: Category[] = Array.isArray(categoriesData) ? categoriesData : [];
    return list.filter((c) => c.isActive);
  }, [categoriesData]);

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
    const list: PriceTier[] = Array.isArray(priceTiers) ? priceTiers : [];
    return list.filter((t) => t.isActive).sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }, [priceTiers]);

  const paymentMethods: PaymentMethod[] = useMemo(() => {
    const raw: any = paymentMethodsData;
    const list: PaymentMethod[] = Array.isArray(raw) ? raw : raw?.data || [];
    return list.filter((p) => p.isActive);
  }, [paymentMethodsData]);

  const [categoryId, setCategoryId] = useState<string>(''); // '' = Todos
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState<string>('');
  const [tierId, setTierId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [clientId, setClientId] = useState<string>('');
  const [voucherType, setVoucherType] = useState<'NONE' | 'BOLETA' | 'FACTURA'>('NONE');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: stockList } = useQuery({
    queryKey: ['stock', companyId],
    queryFn: () => stockService.getByCompany(companyId, { limit: 9999 }),
    enabled: !!companyId,
    staleTime: 30_000,
  });

  const stockByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    const list: any[] = Array.isArray(stockList) ? stockList : (stockList as any)?.data || [];
    list.forEach((s) => {
      const pid = s.productId || s.product?.id || s.product?._id || s.product;
      if (pid) map[String(pid)] = s.quantity;
    });
    return map;
  }, [stockList]);

  // Defaults once data loads
  useEffect(() => {
    if (!companyId && companies.length) setCompanyId(companies[0].id);
  }, [companies, companyId]);
  useEffect(() => {
    if (!tierId && tiers.length) setTierId(tiers[0].id);
  }, [tiers, tierId]);
  useEffect(() => {
    if (!paymentMethodId && paymentMethods.length) setPaymentMethodId(paymentMethods[0].id);
  }, [paymentMethods, paymentMethodId]);

  // Keyboard shortcut: Ctrl+K focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Re-resolve prices when global tier or company changes (only non-custom, non-override items)
  useEffect(() => {
    if (!tierId || !companyId || cart.length === 0) return;
    setCart((prev) =>
      prev.map((item) => {
        if (item.isCustomPrice) return item;
        const effectiveTier = item.tierOverride || tierId;
        const product = products.find((p) => p.id === item.productId);
        if (!product) return item;
        const price = resolvePrice(product, effectiveTier, companyId);
        if (price == null || price === item.unitPrice) return item;
        return { ...item, unitPrice: price };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierId, companyId]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId && p.categoryId !== categoryId) return false;
      if (term && !p.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [products, categoryId, search]);

  const cartQty = (productId: string) => cart.find((i) => i.productId === productId)?.quantity || 0;

  const addToCart = (product: Product) => {
    if (!companyId) {
      toast.error('Selecciona una empresa');
      return;
    }
    if (!tierId) {
      toast.error('Selecciona un rango de precio');
      return;
    }
    const price = resolvePrice(product, tierId, companyId);
    if (price == null) {
      toast.error(`Sin precio configurado para ${product.name}`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          quantity: 1,
          unitPrice: price,
        },
      ];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    if (delta > 0) {
      const stock = stockByProduct[productId] ?? 0;
      const current = cart.find((i) => i.productId === productId)?.quantity || 0;
      if (current + delta > stock) {
        toast.error(`Solo hay ${stock} en stock`);
        return;
      }
    }
    setCart((prev) =>
      prev
        .map((i) =>
          i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const clearCart = () => setCart([]);

  const setItemTier = (productId: string, newTierId: string) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.productId !== productId) return i;
        const product = products.find((p) => p.id === i.productId);
        if (!product) return i;
        const useTier = newTierId || tierId;
        const price = resolvePrice(product, useTier, companyId);
        if (price == null) {
          toast.error('Sin precio configurado para ese rango');
          return i;
        }
        return {
          ...i,
          unitPrice: price,
          tierOverride: newTierId && newTierId !== tierId ? newTierId : undefined,
          isCustomPrice: false,
        };
      }),
    );
  };

  const setItemCustomPrice = (productId: string, price: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, unitPrice: price, isCustomPrice: true, tierOverride: undefined }
          : i,
      ),
    );
  };

  const [editingPriceFor, setEditingPriceFor] = useState<string | null>(null);

  const subtotal = cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const igv = subtotal * IGV_RATE;
  const total = subtotal;

  const openCheckout = () => {
    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }
    if (!paymentMethodId) {
      toast.error('No hay métodos de pago configurados');
      return;
    }
    setShowCheckout(true);
  };

  const confirmSale = async () => {
    try {
      await createSale.mutateAsync({
        clientId: clientId || undefined,
        voucherType,
        isCredit: false,
        items: cart.map((i) => ({
          productId: i.productId,
          companyId,
          quantity: i.quantity,
          priceTier: i.tierOverride || tierId,
          unitPrice: i.unitPrice,
        })),
        payments: [{ paymentMethodId, amount: total }],
      } as any);
      toast.success('Venta registrada');
      setCart([]);
      setClientId('');
      setVoucherType('NONE');
      setShowCheckout(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al registrar la venta';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    }
  };

  return (
    <div className="-m-4 lg:-m-8 h-[calc(100vh-4rem)] flex bg-surface">
      {/* Products panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar productos por nombre… (Ctrl+K)"
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category tabs */}
        <div className="bg-white border-b border-gray-200 px-6 py-2 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setCategoryId('')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              categoryId === '' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Todos
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                categoryId === c.id ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Products grid */}
        <div className="flex-1 overflow-auto p-6">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Package size={48} className="mb-3" />
              <div className="text-sm">
                {search ? 'Sin resultados para tu búsqueda' : 'Sin productos en esta categoría'}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map((p) => {
                const price = tierId && companyId ? resolvePrice(p, tierId, companyId) : undefined;
                const qty = cartQty(p.id);
                const stock = stockByProduct[p.id] ?? 0;
                const available = stock - qty;
                const stockColor =
                  stock === 0
                    ? 'bg-red-50 text-red-600'
                    : stock <= 10
                    ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-gray-50 text-gray-600';
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (available <= 0) {
                        toast.error(`Sin stock disponible para ${p.name}`);
                        return;
                      }
                      addToCart(p);
                    }}
                    disabled={stock === 0}
                    className="relative bg-white rounded-xl shadow-card p-4 text-left hover:shadow-card-hover hover:-translate-y-0.5 transition-all group disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {qty > 0 && (
                      <span className="absolute top-2 left-2 bg-primary-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {qty}
                      </span>
                    )}
                    <span className={`absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${stockColor}`}>
                      Stock: {stock}
                    </span>
                    <div className="w-full aspect-square rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center mb-3 group-hover:bg-primary-100 transition-colors">
                      <Package size={32} />
                    </div>
                    <div className="text-sm font-medium text-gray-800 leading-tight line-clamp-2 min-h-[2.5rem]">
                      {p.name}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-base font-bold text-gray-900">
                        {price != null ? `S/ ${price.toFixed(2)}` : '—'}
                      </span>
                      <span className="w-7 h-7 rounded-lg bg-primary-600 text-white flex items-center justify-center shadow-sm group-hover:bg-primary-700">
                        <Plus size={14} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart panel */}
      <aside className="w-80 xl:w-96 bg-white border-l border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-primary-600" />
              <div>
                <div className="text-sm font-semibold text-gray-800">Carrito</div>
                <div className="text-xs text-gray-500">
                  {cart.length} {cart.length === 1 ? 'producto' : 'productos'}
                </div>
              </div>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Tag size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500 shrink-0">Rango:</span>
            <select
              value={tierId}
              onChange={(e) => setTierId(e.target.value)}
              className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white"
            >
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-3 py-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
              <ShoppingCart size={40} className="mb-2 opacity-50" />
              <div className="text-sm">Agrega productos al carrito</div>
            </div>
          ) : (
            cart.map((item) => {
              const effectiveTierId = item.tierOverride || tierId;
              const effectiveTierName = item.isCustomPrice
                ? 'Personalizado'
                : tiers.find((t) => t.id === effectiveTierId)?.name || '';
              const isOverridden = !!item.tierOverride || !!item.isCustomPrice;
              const isEditing = editingPriceFor === item.productId;
              return (
                <div key={item.productId} className="bg-gray-50 rounded-xl p-3 group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white text-primary-600 flex items-center justify-center shrink-0">
                      <Package size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{item.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-gray-500">
                          S/ {item.unitPrice.toFixed(2)} · {item.unit}
                        </span>
                        <button
                          onClick={() => setEditingPriceFor(isEditing ? null : item.productId)}
                          className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium transition-colors flex items-center gap-0.5 ${
                            isOverridden
                              ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                              : 'text-gray-400 hover:text-primary-600 hover:bg-gray-100'
                          }`}
                          title="Cambiar precio / rango"
                        >
                          <Pencil size={9} /> {effectiveTierName}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQty(item.productId, -1)}
                        className="w-6 h-6 rounded-md bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 flex items-center justify-center"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.productId, 1)}
                        className="w-6 h-6 rounded-md bg-primary-600 text-white hover:bg-primary-700 flex items-center justify-center"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {isEditing && (
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                      <div className="text-[11px] text-gray-500 font-medium">Cambiar rango de precio</div>
                      <div className="flex flex-wrap gap-1">
                        {tiers.map((t) => {
                          const isActive = !item.isCustomPrice && effectiveTierId === t.id;
                          return (
                            <button
                              key={t.id}
                              onClick={() => {
                                setItemTier(item.productId, t.id);
                                setEditingPriceFor(null);
                              }}
                              className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                                isActive
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-400'
                              }`}
                            >
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-[11px] text-gray-500 font-medium pt-1">Precio personalizado</div>
                      <div className="flex gap-1.5">
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">S/</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={item.unitPrice.toFixed(2)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const v = parseFloat((e.target as HTMLInputElement).value);
                                if (!isNaN(v) && v >= 0) {
                                  setItemCustomPrice(item.productId, v);
                                  setEditingPriceFor(null);
                                }
                              }
                            }}
                            className="w-full pl-7 pr-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <button
                          onClick={(e) => {
                            const input = (e.currentTarget.previousElementSibling as HTMLElement)
                              ?.querySelector('input') as HTMLInputElement;
                            const v = parseFloat(input?.value || '0');
                            if (!isNaN(v) && v >= 0) {
                              setItemCustomPrice(item.productId, v);
                              setEditingPriceFor(null);
                            }
                          }}
                          className="px-3 py-1 bg-primary-600 text-white text-xs font-medium rounded-md hover:bg-primary-700"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span className="font-medium">S/ {(subtotal / (1 + IGV_RATE)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>IGV (18%)</span>
              <span className="font-medium">S/ {(subtotal - subtotal / (1 + IGV_RATE)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-2xl font-bold text-primary-600">S/ {total.toFixed(2)}</span>
            </div>
            <button
              onClick={openCheckout}
              className="w-full mt-2 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-semibold transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <CreditCard size={18} />
              Cobrar
            </button>
          </div>
        )}
      </aside>

      {/* Checkout modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCheckout(false)} />
          <div className="relative bg-white rounded-2xl shadow-card-hover w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Finalizar venta</h2>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <User size={14} className="inline mr-1" />
                  Cliente (opcional)
                </label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">— Consumidor final —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Comprobante</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['NONE', 'BOLETA', 'FACTURA'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVoucherType(v)}
                      className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                        voucherType === v
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {v === 'NONE' ? 'Ninguno' : v === 'BOLETA' ? 'Boleta' : 'Factura'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Método de pago</label>
                <select
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {paymentMethods.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="bg-primary-50 rounded-xl p-4 flex items-center justify-between">
                <span className="text-sm text-gray-600">Total a cobrar</span>
                <span className="text-2xl font-bold text-primary-700">S/ {total.toFixed(2)}</span>
              </div>

              <button
                onClick={confirmSale}
                disabled={createSale.isPending}
                className="w-full py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-semibold transition-colors shadow-sm"
              >
                {createSale.isPending ? 'Procesando…' : 'Confirmar venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
