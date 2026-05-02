import { useState, useMemo, useEffect, useRef } from 'react';
import { useProducts } from '../../products/hooks/useProducts';
import { useCategories } from '../../categories/hooks/useCategories';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useClients } from '../../clients/hooks/useClients';
import { usePriceTiers } from '../../price-tiers/hooks/usePriceTiers';
import { usePaymentMethods } from '../../payment-methods/hooks/usePaymentMethods';
import { useCreateSale } from '../../sales/hooks/useSales';
import { useCreateQuote, useQuote, useConvertQuote } from '../../quotes/hooks/useQuotes';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { stockService } from '../../stock/services/stockService';
import { Search, Plus, Minus, Trash2, Package, X, ShoppingCart, CreditCard, User, Pencil, Tag, ScrollText, Landmark, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Product, ProductPrice, Category, Company, Client, PriceTier, PaymentMethod, CreditAccount } from '../../../shared/types';
import { useOpenClientCredits } from '../../credits/hooks/useCredits';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useUsers } from '../../users/hooks/useUsers';

const IGV_RATE = 0.18;

function getPaymentMethodColors(name: string, selected: boolean): string {
  const n = name.toLowerCase();
  if (n.includes('yape'))
    return selected
      ? 'bg-purple-800 text-white border-purple-800'
      : 'bg-white text-gray-600 border-gray-200 hover:border-purple-600';
  if (n.includes('plin'))
    return selected
      ? 'bg-cyan-700 text-white border-cyan-700'
      : 'bg-white text-gray-600 border-gray-200 hover:border-cyan-500';
  if (n.includes('transferencia'))
    return selected
      ? 'bg-indigo-600 text-white border-indigo-600'
      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400';
  return selected
    ? 'bg-primary-600 text-white border-primary-600'
    : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300';
}

const ALL_COMPANIES = '__ALL__';

interface CartItem {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  tierOverride?: string;   // if set, uses this tier instead of global
  isCustomPrice?: boolean; // true = manually edited, don't re-resolve
  sourceCompanyId?: string; // when global selector is "Todos", store which warehouse this item comes from
}

function resolvePrice(product: Product, tierId: string, companyId: string): number | undefined {
  if (!product.prices?.length) return undefined;
  const byCompany = product.prices.find((p: ProductPrice) => p.priceTierId === tierId && p.companyId === companyId);
  if (byCompany) return byCompany.price;
  const global = product.prices.find((p: ProductPrice) => p.priceTierId === tierId && !p.companyId);
  return global?.price;
}

export function POSPage() {
  const { user } = useAuth();
  const isFieldSeller = user?.role === 'VENDEDOR_CAMPO';
  const { data: usersData } = useUsers({ limit: 100, role: 'VENDEDOR_CAMPO' });
  const sellerOptions: any[] = useMemo(() => {
    const raw: any = usersData;
    const list: any[] = Array.isArray(raw) ? raw : raw?.data || [];
    return list.filter((u) => u.isActive !== false);
  }, [usersData]);

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
  const [ingredientFilter, setIngredientFilter] = useState('');
  const [onlyInStock, setOnlyInStock] = useState(true);
  const [companyId, setCompanyId] = useState<string>('');
  const [tierId, setTierId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteClientId, setQuoteClientId] = useState('');
  const [quoteClientName, setQuoteClientName] = useState('');
  const [quoteValidUntil, setQuoteValidUntil] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [quoteNotes, setQuoteNotes] = useState('');
  const createQuote = useCreateQuote();
  const convertQuote = useConvertQuote();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromQuoteId = searchParams.get('fromQuote') || '';
  const { data: preloadedQuote } = useQuote(fromQuoteId);
  const [sourceQuoteId, setSourceQuoteId] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [voucherType, setVoucherType] = useState<'NONE' | 'BOLETA' | 'FACTURA'>('NONE');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [splitPayments, setSplitPayments] = useState<{ paymentMethodId: string; amount: number }[]>([]);
  const [isCredit, setIsCredit] = useState(false);
  const [creditAccountId, setCreditAccountId] = useState<string>('new');
  const [creditName, setCreditName] = useState('');
  const [checkoutStep, setCheckoutStep] = useState<1 | 2>(1);
  const [sellerId, setSellerId] = useState<string>('');
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: openCredits } = useOpenClientCredits(isCredit ? clientId : '');

  const stockQueries = useQueries({
    queries: companies.map((c) => ({
      queryKey: ['stock', c.id],
      queryFn: () => stockService.getByCompany(c.id, { limit: 9999 }),
      staleTime: 30_000,
    })),
  });
  const stockQueryDataKey = stockQueries.map((q) => q.dataUpdatedAt).join('|');

  // { [companyId]: { [productId]: quantity } }
  const stockByCompany = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    companies.forEach((c, idx) => {
      const raw: any = stockQueries[idx]?.data;
      const list: any[] = Array.isArray(raw) ? raw : raw?.data || [];
      const map: Record<string, number> = {};
      list.forEach((s) => {
        const pid = s.productId || s.product?.id || s.product?._id || s.product;
        if (pid) map[String(pid)] = s.quantity;
      });
      result[c.id] = map;
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, stockQueryDataKey]);

  // Aggregated or per-company depending on selector mode
  const stockByProduct = useMemo(() => {
    if (companyId === ALL_COMPANIES) {
      const result: Record<string, number> = {};
      Object.values(stockByCompany).forEach((perCompany) => {
        Object.entries(perCompany).forEach(([pid, qty]) => {
          result[pid] = (result[pid] || 0) + qty;
        });
      });
      return result;
    }
    return stockByCompany[companyId] || {};
  }, [stockByCompany, companyId]);

  // Picks the warehouse with the most stock for a product (used in "Todos" mode)
  const findSourceCompanyForProduct = (productId: string): string | null => {
    let bestId: string | null = null;
    let bestQty = 0;
    Object.entries(stockByCompany).forEach(([cid, map]) => {
      const qty = map[productId] || 0;
      if (qty > 0 && qty > bestQty) {
        bestId = cid;
        bestQty = qty;
      }
    });
    return bestId;
  };

  const companyNameById = useMemo(() => {
    const map: Record<string, string> = {};
    companies.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [companies]);

  // Preload cart from quote (if ?fromQuote=... param)
  useEffect(() => {
    if (!preloadedQuote || !products.length || sourceQuoteId === preloadedQuote.id) return;
    if (preloadedQuote.status === 'CONVERTED' || preloadedQuote.status === 'REJECTED') {
      toast.error('Esta cotización ya no puede convertirse');
      navigate('/quotes');
      return;
    }
    if (preloadedQuote.companyId) setCompanyId(preloadedQuote.companyId);
    if (preloadedQuote.clientId) setClientId(preloadedQuote.clientId);
    const items: CartItem[] = preloadedQuote.items.map((i: any) => {
      const p = products.find(pr => pr.id === i.productId);
      return {
        productId: i.productId,
        name: p?.name || '—',
        unit: p?.unit || '',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        tierOverride: i.priceTier,
        isCustomPrice: true,
        sourceCompanyId: preloadedQuote.companyId || undefined,
      };
    });
    setCart(items);
    setSourceQuoteId(preloadedQuote.id);
    toast.success(`Cotización ${preloadedQuote.quoteNumber} cargada`);
  }, [preloadedQuote, products, sourceQuoteId, navigate]);

  // Defaults once data loads
  useEffect(() => {
    if (!companyId && companies.length) setCompanyId(ALL_COMPANIES);
  }, [companies, companyId]);
  useEffect(() => {
    if (isFieldSeller && user?.id && sellerId !== user.id) setSellerId(user.id);
  }, [isFieldSeller, user?.id, sellerId]);
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
        const itemCompany = item.sourceCompanyId || (companyId !== ALL_COMPANIES ? companyId : '');
        if (!itemCompany) return item;
        const price = resolvePrice(product, effectiveTier, itemCompany);
        if (price == null || price === item.unitPrice) return item;
        return { ...item, unitPrice: price };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierId, companyId]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const ing = ingredientFilter.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId && p.categoryId !== categoryId) return false;
      if (term && !p.name.toLowerCase().includes(term)) return false;
      if (ing && !(p.activeIngredient || '').toLowerCase().includes(ing)) return false;
      if (onlyInStock && (stockByProduct[p.id] ?? 0) <= 0) return false;
      return true;
    });
  }, [products, categoryId, search, ingredientFilter, onlyInStock, stockByProduct]);

  const cartQty = (productId: string) => cart.find((i) => i.productId === productId)?.quantity || 0;

  const addToCart = (product: Product) => {
    if (!companyId) {
      toast.error('Selecciona un almacén');
      return;
    }
    if (!tierId) {
      toast.error('Selecciona un rango de precio');
      return;
    }

    let sourceCompanyId: string;
    if (companyId === ALL_COMPANIES) {
      const found = findSourceCompanyForProduct(product.id);
      if (!found) {
        toast.error(`Sin stock de ${product.name} en ningún almacén`);
        return;
      }
      sourceCompanyId = found;
    } else {
      sourceCompanyId = companyId;
    }

    const price = resolvePrice(product, tierId, sourceCompanyId);
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
          sourceCompanyId,
        },
      ];
    });
  };

  const stockForCartItem = (item: CartItem | undefined): number => {
    if (!item) return 0;
    const cid = item.sourceCompanyId || (companyId !== ALL_COMPANIES ? companyId : '');
    if (!cid) return 0;
    return stockByCompany[cid]?.[item.productId] ?? 0;
  };

  const updateQty = (productId: string, delta: number) => {
    if (delta > 0) {
      const item = cart.find((i) => i.productId === productId);
      const stock = stockForCartItem(item);
      const current = item?.quantity || 0;
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

  const setQty = (productId: string, value: number) => {
    if (isNaN(value) || value <= 0) { removeFromCart(productId); return; }
    const item = cart.find((i) => i.productId === productId);
    const stock = stockForCartItem(item);
    if (value > stock) { toast.error(`Solo hay ${stock} en stock`); value = stock; }
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, quantity: value } : i));
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
        const itemCompany = i.sourceCompanyId || (companyId !== ALL_COMPANIES ? companyId : '');
        if (!itemCompany) {
          toast.error('Sin almacén asignado para este item');
          return i;
        }
        const price = resolvePrice(product, useTier, itemCompany);
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
    const itemMissingSource = cart.find((i) => !i.sourceCompanyId && companyId === ALL_COMPANIES);
    if (itemMissingSource) {
      toast.error(`Selecciona un almacén para "${itemMissingSource.name}"`);
      return;
    }
    setIsCredit(false);
    setCreditAccountId('new');
    setCreditName('');
    setSplitPayments([{ paymentMethodId, amount: 0 }]);
    setCheckoutStep(1);
    setShowCheckout(true);
  };

  const splitTotal = splitPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const splitRemaining = Math.round((total - splitTotal) * 100) / 100;

  const confirmSale = async () => {
    if (isCredit) {
      if (!clientId) { toast.error('Selecciona un cliente para la venta a crédito'); return; }
      if (creditAccountId === 'new' && !creditName.trim()) { toast.error('Ingresa un nombre para la cuenta de crédito'); return; }
    } else {
      const validPayments = splitPayments.filter(p => p.paymentMethodId && p.amount > 0);
      if (validPayments.length === 0) { toast.error('Ingresa al menos un método de pago con monto'); return; }
      if (Math.abs(splitTotal - total) > 0.01) {
        toast.error(`La suma de pagos (${splitTotal.toFixed(2)}) no coincide con el total (${total.toFixed(2)})`);
        return;
      }
    }
    const validPayments = isCredit ? [] : splitPayments.filter(p => p.paymentMethodId && p.amount > 0);
    try {
      const effectiveSellerId = sellerId || (isFieldSeller ? user?.id : undefined);
      if (sourceQuoteId) {
        await convertQuote.mutateAsync({
          id: sourceQuoteId,
          payload: {
            companyId: companyId === ALL_COMPANIES ? (cart[0]?.sourceCompanyId || '') : companyId,
            clientId: clientId || undefined,
            voucherType,
            isCredit,
            payments: validPayments,
            sellerId: effectiveSellerId,
          },
        });
      } else {
        await createSale.mutateAsync({
          clientId: clientId || undefined,
          voucherType,
          isCredit,
          creditAccountId: isCredit && creditAccountId !== 'new' ? creditAccountId : undefined,
          creditName: isCredit && creditAccountId === 'new' ? creditName.trim() : undefined,
          sellerId: effectiveSellerId,
          items: cart.map((i) => ({
            productId: i.productId,
            companyId: i.sourceCompanyId || (companyId !== ALL_COMPANIES ? companyId : ''),
            quantity: i.quantity,
            priceTier: i.tierOverride || tierId,
            unitPrice: i.unitPrice,
          })),
          payments: validPayments,
        } as any);
      }
      setCart([]);
      setClientId('');
      setVoucherType('NONE');
      setSplitPayments([]);
      setIsCredit(false);
      setCreditAccountId('new');
      setCreditName('');
      setShowCheckout(false);
      if (sourceQuoteId) {
        setSourceQuoteId('');
        setSearchParams({});
      }
    } catch {
      // errors handled by mutation onError
    }
  };

  return (
    <div className="-m-4 lg:-m-8 h-[calc(100vh-4rem)] flex bg-surface">
      {/* Products panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre… (Ctrl+K)"
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
            />
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={ingredientFilter}
              onChange={(e) => setIngredientFilter(e.target.value)}
              placeholder="Ingrediente activo…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value={ALL_COMPANIES}>Todos los almacenes</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category tabs */}
        <div className="bg-white border-b border-gray-200 px-6 py-2 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setOnlyInStock((v) => !v)}
            title={onlyInStock ? 'Mostrar todos (incluye agotados)' : 'Ocultar productos sin stock'}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
              onlyInStock
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
            }`}
          >
            {onlyInStock ? '✓ Con stock' : 'Con stock'}
          </button>
          <div className="w-px bg-gray-200 my-1 mx-1" />
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
              <div className="text-sm mb-3">
                {search ? 'Sin resultados para tu búsqueda' : onlyInStock ? 'Sin productos con stock en este almacén' : 'Sin productos en esta categoría'}
              </div>
              {onlyInStock && !search && (
                <button
                  onClick={() => setOnlyInStock(false)}
                  className="text-xs text-primary-600 hover:text-primary-800 font-medium underline underline-offset-2"
                >
                  Mostrar todos los productos (incluye agotados)
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5 gap-4">
              {filteredProducts.map((p) => {
                const effectiveCompanyForPrice = companyId === ALL_COMPANIES
                  ? findSourceCompanyForProduct(p.id) || ''
                  : companyId;
                const price = tierId && effectiveCompanyForPrice
                  ? resolvePrice(p, tierId, effectiveCompanyForPrice)
                  : undefined;
                const qty = cartQty(p.id);
                const stock = stockByProduct[p.id] ?? 0;
                const available = stock - qty;
                const stockColor =
                  stock === 0
                    ? 'bg-red-50 text-red-600'
                    : stock <= 10
                    ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-gray-50 text-gray-600';
                const sourceLabel = companyId === ALL_COMPANIES && effectiveCompanyForPrice
                  ? companyNameById[effectiveCompanyForPrice]
                  : null;
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
                    <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-1 rounded-md shadow-sm ${stockColor}`}>
                      Stock: {stock}
                    </span>
                    <div className="w-full aspect-square rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center mb-3 group-hover:bg-primary-100 transition-colors">
                      <Package size={32} />
                    </div>
                    <div className="text-sm font-medium text-gray-800 leading-tight line-clamp-2 min-h-[2.5rem]">
                      {p.name}
                    </div>
                    {sourceLabel && (
                      <div className="mt-1 text-[11px] text-gray-500 truncate" title={sourceLabel}>
                        📍 {sourceLabel}
                      </div>
                    )}
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

      {/* Cart panel — fixed drawer on mobile, static panel on desktop */}
      <aside className={`fixed inset-y-0 right-0 z-40 w-[85vw] max-w-sm bg-white border-l border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out lg:static lg:w-96 xl:w-[440px] 2xl:w-[500px] lg:max-w-none lg:z-auto lg:translate-x-0 ${cartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart size={20} className="text-primary-600" />
              <div>
                <div className="text-base font-semibold text-gray-800">Carrito</div>
                <div className="text-sm text-gray-500">
                  {cart.length} {cart.length === 1 ? 'producto' : 'productos'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-sm text-gray-400 hover:text-red-500 transition-colors"
                >
                  Limpiar
                </button>
              )}
              <button
                onClick={() => setCartOpen(false)}
                className="lg:hidden text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-gray-400" />
            <span className="text-sm text-gray-500 shrink-0">Rango:</span>
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
                      <div className="text-base font-medium text-gray-800 truncate">{item.name}</div>
                      {companyId === ALL_COMPANIES && item.sourceCompanyId && (
                        <div className="text-[11px] text-primary-700 bg-primary-50 inline-block px-1.5 py-0.5 rounded mt-0.5 mr-1">
                          📍 {companyNameById[item.sourceCompanyId] || '—'}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-sm text-gray-500">
                          S/ {item.unitPrice.toFixed(2)} · {item.unit}
                        </span>
                        <button
                          onClick={() => setEditingPriceFor(isEditing ? null : item.productId)}
                          className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium transition-colors flex items-center gap-0.5 ${
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
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => setQty(item.productId, parseFloat(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="text-sm font-semibold w-10 text-center border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
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
            <div className="flex justify-between text-base text-gray-600">
              <span>Subtotal</span>
              <span className="font-medium">S/ {(subtotal / (1 + IGV_RATE)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base text-gray-600">
              <span>IGV (18%)</span>
              <span className="font-medium">S/ {(subtotal - subtotal / (1 + IGV_RATE)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-gray-100">
              <span className="text-base font-semibold text-gray-700">Total</span>
              <span className="text-2xl font-bold text-primary-600">S/ {total.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (cart.length === 0) { toast.error('El carrito está vacío'); return; }
                  setShowQuoteModal(true);
                }}
                className="flex-1 mt-2 py-3 bg-white border border-primary-600 text-primary-700 rounded-xl hover:bg-primary-50 font-semibold transition-colors flex items-center justify-center gap-2"
                title="Guardar como cotización"
              >
                <ScrollText size={18} />
                Cotización
              </button>
              <button
                onClick={openCheckout}
                className="flex-1 mt-2 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-semibold transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <CreditCard size={18} />
                Cobrar
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Checkout modal */}
      {showQuoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowQuoteModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-card-hover w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><ScrollText size={18} /> Nueva Cotización</h2>
              <button onClick={() => setShowQuoteModal(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente</label>
                <select
                  value={quoteClientId}
                  onChange={(e) => {
                    setQuoteClientId(e.target.value);
                    const c = clients.find(cl => cl.id === e.target.value);
                    setQuoteClientName(c?.name || '');
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">— Cliente ocasional —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {!quoteClientId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre del cliente <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input value={quoteClientName} onChange={(e) => setQuoteClientName(e.target.value)} placeholder="Cliente ocasional" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Válida hasta</label>
                <input type="date" value={quoteValidUntil} onChange={(e) => setQuoteValidUntil(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Observaciones <span className="text-gray-400 font-normal">(opcional)</span></label>
                <textarea value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="bg-primary-50 rounded-xl p-4 flex items-center justify-between">
                <span className="text-sm text-gray-600">Total cotización</span>
                <span className="text-2xl font-bold text-primary-700">S/ {total.toFixed(2)}</span>
              </div>
              <button
                onClick={async () => {
                  try {
                    await createQuote.mutateAsync({
                      companyId: companyId === ALL_COMPANIES ? (cart[0]?.sourceCompanyId || '') : companyId,
                      clientId: quoteClientId || undefined,
                      clientName: quoteClientName || undefined,
                      validUntil: quoteValidUntil,
                      notes: quoteNotes || undefined,
                      sellerId: sellerId || (isFieldSeller ? user?.id : undefined),
                      items: cart.map(i => ({
                        productId: i.productId,
                        companyId: i.sourceCompanyId || (companyId !== ALL_COMPANIES ? companyId : ''),
                        quantity: i.quantity,
                        priceTier: i.tierOverride || tierId,
                        unitPrice: i.unitPrice,
                      })),
                    } as any);
                    setShowQuoteModal(false);
                    setCart([]);
                    setQuoteClientId('');
                    setQuoteClientName('');
                    setQuoteNotes('');
                  } catch { /* toast handled by hook */ }
                }}
                disabled={createQuote.isPending}
                className="w-full py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-semibold transition-colors shadow-sm"
              >
                {createQuote.isPending ? 'Guardando…' : 'Guardar cotización'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCheckout(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="bg-primary-600 rounded-t-2xl px-6 py-6 text-white shrink-0">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-white/70 text-sm mb-1">{cart.length} {cart.length === 1 ? 'producto' : 'productos'}</p>
                  <p className="text-4xl font-bold tracking-tight">S/ {total.toFixed(2)}</p>
                </div>
                <button onClick={() => setShowCheckout(false)} className="p-2 rounded-xl hover:bg-white/20 transition-colors mt-1">
                  <X size={20} />
                </button>
              </div>
              {/* Cart items summary */}
              <div className="bg-white/10 rounded-xl px-4 py-3 max-h-32 overflow-y-auto space-y-2">
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between text-sm">
                    <span className="text-white/80 truncate flex-1 mr-3">
                      <span className="font-bold text-white mr-2">{item.quantity}×</span>{item.name}
                    </span>
                    <span className="text-white font-semibold shrink-0">S/ {(item.quantity * item.unitPrice).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-3 text-xs text-white/60">
                <span>Base imponible: S/ {(subtotal / (1 + IGV_RATE)).toFixed(2)}</span>
                <span>IGV 18%: S/ {(subtotal - subtotal / (1 + IGV_RATE)).toFixed(2)}</span>
              </div>
            </div>

            {/* Step indicator */}
            <div className="px-6 pt-5 pb-1 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCheckoutStep(1)}
                  className={`flex items-center gap-2 ${checkoutStep === 1 ? 'text-primary-700' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                    checkoutStep === 1 ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500'
                  }`}>1</span>
                  <span className="text-sm font-semibold">Detalles</span>
                </button>
                <div className={`h-0.5 flex-1 rounded-full transition-colors ${checkoutStep === 2 ? 'bg-primary-300' : 'bg-gray-200'}`} />
                <div className={`flex items-center gap-2 ${checkoutStep === 2 ? 'text-primary-700' : 'text-gray-400'}`}>
                  <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                    checkoutStep === 2 ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500'
                  }`}>2</span>
                  <span className="text-sm font-semibold">Pago</span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {checkoutStep === 1 && (
                <>
                  {/* Vendedor (solo ADMIN puede atribuir) */}
                  {!isFieldSeller && sellerOptions.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <User size={14} className="text-gray-500" />
                        <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Vendedor</span>
                        <span className="text-xs text-gray-400 font-normal normal-case">opcional</span>
                      </div>
                      <select
                        value={sellerId}
                        onChange={(e) => setSellerId(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 bg-white"
                      >
                        <option value="">— Sin atribuir —</option>
                        {sellerOptions.map((s) => <option key={s.id} value={s.id}>{s.fullName || s.username}</option>)}
                      </select>
                    </div>
                  )}
                  {isFieldSeller && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
                      <User size={14} className="text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-800">Vendedor: <strong>{user?.fullName || user?.username}</strong></span>
                    </div>
                  )}

                  {/* Cliente */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <User size={14} className="text-gray-500" />
                      <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Cliente</span>
                      <span className="text-xs text-gray-400 font-normal normal-case">opcional</span>
                    </div>
                    <select
                      value={clientId}
                      onChange={(e) => { setClientId(e.target.value); if (!e.target.value) setIsCredit(false); }}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 bg-white"
                    >
                      <option value="">— Consumidor final —</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* Comprobante */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ScrollText size={14} className="text-gray-500" />
                      <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Comprobante</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {(['NONE', 'BOLETA', 'FACTURA'] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setVoucherType(v)}
                          className={`py-3 rounded-xl text-sm font-semibold transition-colors border-2 ${
                            voucherType === v
                              ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:bg-primary-50'
                          }`}
                        >
                          {v === 'NONE' ? 'Ninguno' : v === 'BOLETA' ? 'Boleta' : 'Factura'}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {checkoutStep === 2 && (
                <>
                  {/* Tipo de pago */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Tag size={14} className="text-gray-500" />
                      <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Tipo de pago</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setIsCredit(false)}
                        className={`py-3 rounded-xl text-sm font-semibold transition-colors border-2 flex items-center justify-center gap-2 ${
                          !isCredit ? 'bg-primary-600 text-white border-primary-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:bg-primary-50'
                        }`}
                      >
                        <CreditCard size={16} /> Pago inmediato
                      </button>
                      <button
                        type="button"
                        disabled={!clientId}
                        onClick={() => setIsCredit(true)}
                        className={`py-3 rounded-xl text-sm font-semibold transition-colors border-2 flex items-center justify-center gap-2 ${
                          isCredit ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        <Landmark size={16} /> A crédito
                      </button>
                    </div>
                    {!clientId && (
                      <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                        <User size={11} /> Selecciona un cliente en el paso 1 para habilitar el crédito
                      </p>
                    )}
                  </div>

                  {/* Crédito — cuenta */}
                  {isCredit && (
                    <>
                      <div className="border-t border-gray-100" />
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Landmark size={14} className="text-orange-500" />
                          <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Cuenta de crédito</span>
                        </div>
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => { setCreditAccountId('new'); setCreditName(''); }}
                            className={`w-full px-4 py-3 rounded-xl text-sm font-semibold border-2 text-left transition-colors ${
                              creditAccountId === 'new' ? 'bg-orange-50 border-orange-400 text-orange-800' : 'bg-white border-gray-200 text-gray-500 hover:border-orange-300'
                            }`}
                          >
                            + Nueva cuenta
                          </button>
                          {(openCredits as CreditAccount[] | undefined)?.map((acc) => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => setCreditAccountId(acc.id)}
                              className={`w-full px-4 py-3 rounded-xl border-2 text-left transition-colors ${
                                creditAccountId === acc.id ? 'bg-orange-50 border-orange-400' : 'bg-white border-gray-200 hover:border-orange-300'
                              }`}
                            >
                              <div className="font-semibold text-gray-800">{acc.name || 'Sin nombre'}</div>
                              <div className="text-sm text-red-500 mt-0.5">Deuda actual: S/ {acc.pendingAmount.toFixed(2)}</div>
                            </button>
                          ))}
                        </div>
                        {creditAccountId === 'new' && (
                          <input
                            value={creditName}
                            onChange={(e) => setCreditName(e.target.value)}
                            placeholder="Nombre de la cuenta  (ej: Tomates, Maíz)"
                            className="mt-3 w-full px-4 py-3 border-2 border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                            autoFocus
                          />
                        )}
                      </div>
                    </>
                  )}

                  {/* Pago inmediato — métodos */}
                  {!isCredit && (
                    <>
                      <div className="border-t border-gray-100" />
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <CreditCard size={14} className="text-gray-500" />
                          <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Método de pago</span>
                        </div>
                        <div className="space-y-3">
                          {splitPayments.map((p, idx) => (
                            <div key={idx} className="bg-gray-50 rounded-xl p-4 space-y-3">
                              <div className="flex flex-wrap gap-2">
                                {paymentMethods.map((m) => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => { const next = [...splitPayments]; next[idx] = { ...next[idx], paymentMethodId: m.id }; setSplitPayments(next); }}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border-2 ${getPaymentMethodColors(m.name, p.paymentMethodId === m.id)}`}
                                  >
                                    {m.name}
                                  </button>
                                ))}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">S/</span>
                                  <input
                                    type="number" min="0" step="0.01"
                                    value={p.amount || ''}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => { const next = [...splitPayments]; next[idx] = { ...next[idx], amount: parseFloat(e.target.value) || 0 }; setSplitPayments(next); }}
                                    placeholder="0.00"
                                    className="w-full pl-9 pr-3 py-3 border-2 border-gray-200 rounded-xl text-base text-right font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 bg-white"
                                  />
                                </div>
                                {splitPayments.length > 1 && (
                                  <button type="button" onClick={() => setSplitPayments(splitPayments.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50">
                                    <X size={18} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Estado del pago */}
                        {splitPayments.length > 0 && (
                          <div className={`mt-3 rounded-xl px-4 py-3 flex items-center justify-between ${
                            Math.abs(splitRemaining) <= 0.01 ? 'bg-green-50 border-2 border-green-200' :
                            splitRemaining > 0 ? 'bg-orange-50 border-2 border-orange-200' : 'bg-blue-50 border-2 border-blue-200'
                          }`}>
                            <span className={`font-bold text-base ${Math.abs(splitRemaining) <= 0.01 ? 'text-green-700' : splitRemaining > 0 ? 'text-orange-700' : 'text-blue-700'}`}>
                              {Math.abs(splitRemaining) <= 0.01 ? '✓ Pago completo' : splitRemaining > 0 ? `Falta S/ ${splitRemaining.toFixed(2)}` : `Vuelto S/ ${Math.abs(splitRemaining).toFixed(2)}`}
                            </span>
                            {splitRemaining > 0.01 && (
                              <button type="button" onClick={() => {
                                const idx = splitPayments.findIndex(p => p.amount === 0);
                                if (idx >= 0) { const next = [...splitPayments]; next[idx] = { ...next[idx], amount: splitRemaining }; setSplitPayments(next); }
                                else { const last = splitPayments.length - 1; const next = [...splitPayments]; next[last] = { ...next[last], amount: (next[last].amount || 0) + splitRemaining }; setSplitPayments(next); }
                              }} className="text-sm font-bold text-orange-700 hover:text-orange-900 underline underline-offset-2">
                                Completar →
                              </button>
                            )}
                          </div>
                        )}

                        {paymentMethods.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const used = new Set(splitPayments.map(p => p.paymentMethodId));
                              const next = paymentMethods.find(m => !used.has(m.id)) || paymentMethods[0];
                              if (!next) return;
                              setSplitPayments([...splitPayments, { paymentMethodId: next.id, amount: Math.max(0, splitRemaining) }]);
                            }}
                            className="mt-3 w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-400 hover:border-primary-400 hover:text-primary-600 transition-colors"
                          >
                            + Agregar método de pago
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t-2 border-gray-100 shrink-0 flex items-center gap-3">
              {checkoutStep === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowCheckout(false)}
                    className="px-5 py-3.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckoutStep(2)}
                    className="flex-1 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-base transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    Siguiente <ChevronRight size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setCheckoutStep(1)}
                    className="px-4 py-3.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft size={18} /> Atrás
                  </button>
                  <button
                    onClick={confirmSale}
                    disabled={createSale.isPending}
                    className={`flex-1 py-3.5 text-white rounded-xl disabled:opacity-50 font-bold text-base transition-colors shadow-sm flex items-center justify-center gap-2 ${
                      isCredit ? 'bg-orange-500 hover:bg-orange-600' : 'bg-primary-600 hover:bg-primary-700'
                    }`}
                  >
                    {isCredit ? <Landmark size={18} /> : <CreditCard size={18} />}
                    {createSale.isPending ? 'Procesando…' : isCredit ? `A Crédito · S/ ${total.toFixed(2)}` : `Confirmar · S/ ${total.toFixed(2)}`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Mobile overlay */}
      {cartOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setCartOpen(false)}
        />
      )}

      {/* Mobile FAB — open cart */}
      <button
        onClick={() => setCartOpen(true)}
        className="lg:hidden fixed bottom-6 right-4 left-4 z-20 py-3.5 bg-gray-900 text-white rounded-2xl shadow-xl flex items-center justify-between px-5 active:scale-95 transition-transform"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShoppingCart size={22} />
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {cart.length > 9 ? '9+' : cart.length}
              </span>
            )}
          </div>
          <span className="font-semibold text-sm">
            {cart.length === 0 ? 'Carrito vacío' : `${cart.length} ${cart.length === 1 ? 'producto' : 'productos'}`}
          </span>
        </div>
        <span className="text-lg font-bold">S/ {total.toFixed(2)}</span>
      </button>
    </div>
  );
}
