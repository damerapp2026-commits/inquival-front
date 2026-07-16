import { lazy, Suspense, useState, useMemo, useEffect, useRef } from 'react';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useProducts } from '../../products/hooks/useProducts';
import { useCategories } from '../../categories/hooks/useCategories';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useClients } from '../../clients/hooks/useClients';
import { SmartSearchSelect } from '../../../shared/components/SmartSearchSelect';
import { usePriceTiers } from '../../price-tiers/hooks/usePriceTiers';
import { usePaymentMethods } from '../../payment-methods/hooks/usePaymentMethods';
import { useCreateSale } from '../../sales/hooks/useSales';
import { useQuote, useConvertQuote } from '../../quotes/hooks/useQuotes';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { stockService } from '../../stock/services/stockService';
import { Search, Plus, Minus, Trash2, Package, X, ShoppingCart, CreditCard, User, Pencil, Tag, ScrollText, Landmark, ChevronLeft, ChevronRight, Receipt, Building2, FileText, CheckCircle2, Eye, Banknote, Calendar, Gift, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Product, ProductPrice, Category, Company, Client, PriceTier, PaymentMethod, CreditAccount } from '../../../shared/types';
import { useOpenClientCredits } from '../../credits/hooks/useCredits';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useUsers } from '../../users/hooks/useUsers';
import type { VoucherSnapshot } from '../../sales/components/VoucherPreviewModal';
import { useTodayTipoCambio } from '../../../shared/hooks/useLookup';
import { getQuoteItemProductName, getQuoteItemProductUnit, getQuoteItemTaxType, useQuoteProducts } from '../../quotes/hooks/useQuoteProducts';

const IGV_RATE = 0.18;
const POS_PRODUCT_BATCH_SIZE = 120;
const QuickClientModal = lazy(() => import('../../clients/components/QuickClientModal').then((m) => ({ default: m.QuickClientModal })));
const VoucherPreviewModal = lazy(() => import('../../sales/components/VoucherPreviewModal').then((m) => ({ default: m.VoucherPreviewModal })));

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

type TaxType = 'GRAVADO' | 'EXONERADO' | 'INAFECTO';

interface CartItem {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxType: TaxType;
  tierOverride?: string;
  isCustomPrice?: boolean;
  sourceCompanyId?: string;
}

interface BonusCartItem {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  taxType: TaxType;
  sourceCompanyId?: string;
}

interface PosDraft {
  cart: CartItem[];
  bonusItems: BonusCartItem[];
  companyId?: string;
  tierId?: string;
  clientId?: string;
  voucherType?: 'NONE' | 'BOLETA' | 'FACTURA';
  sellerId?: string;
  currency?: 'PEN' | 'USD';
  exchangeRate?: number;
}

const POS_DRAFT_KEY = 'inquival:pos:draft:v1';

function readPosDraft(): PosDraft | null {
  try {
    const raw = window.localStorage.getItem(POS_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PosDraft;
    return {
      ...parsed,
      cart: Array.isArray(parsed.cart) ? parsed.cart : [],
      bonusItems: Array.isArray(parsed.bonusItems) ? parsed.bonusItems : [],
    };
  } catch {
    return null;
  }
}

function writePosDraft(draft: PosDraft) {
  try {
    window.localStorage.setItem(POS_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage can be unavailable in private mode; the POS should keep working.
  }
}

function clearPosDraft() {
  try {
    window.localStorage.removeItem(POS_DRAFT_KEY);
  } catch {
    // ignore
  }
}

function normalizeTaxType(value: unknown): TaxType {
  const v = String(value || '').trim().toUpperCase();
  return v === 'EXONERADO' || v === 'INAFECTO' ? v : 'GRAVADO';
}

function productInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function resolvePrice(product: Product, tierId: string, companyId: string): number | undefined {
  if (!product.prices?.length) return undefined;
  const global = product.prices.find((p: ProductPrice) => p.priceTierId === tierId && !p.companyId);
  return global?.price;
}

export function POSPage() {
  const persistedDraft = useMemo(() => readPosDraft(), []);
  const { user } = useAuth();
  const isSellerRole = user?.role === 'VENDEDOR' || user?.role === 'VENDEDOR_CAMPO';
  const { data: usersData } = useUsers({ limit: 200 });
  const sellerOptions: any[] = useMemo(() => {
    const raw: any = usersData;
    const list: any[] = Array.isArray(raw) ? raw : raw?.data || [];
    return list.filter((u) => u.isActive !== false && (u.role === 'VENDEDOR' || u.role === 'VENDEDOR_CAMPO' || u.role === 'ADMIN'));
  }, [usersData]);

  const [search, setSearch] = useState('');
  const [ingredientFilter, setIngredientFilter] = useState('');
  const [categoryId, setCategoryId] = useState<string>(''); // '' = Todos
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [visibleProductLimit, setVisibleProductLimit] = useState(POS_PRODUCT_BATCH_SIZE);
  const debouncedSearch = useDebounce(search);
  const debouncedIngredient = useDebounce(ingredientFilter);

  const { data: productsData, isLoading: productsLoading, isFetching: productsFetching } = useProducts({
    page: 1,
    limit: visibleProductLimit,
    search: debouncedSearch || undefined,
    activeIngredient: debouncedIngredient || undefined,
    category: categoryId || undefined,
  });
  const { data: categoriesData } = useCategories();
  const { data: companiesData } = useCompanies();
  const { data: priceTiers } = usePriceTiers();
  const { data: paymentMethodsData } = usePaymentMethods();
  const createSale = useCreateSale();

  const products: Product[] = useMemo(() => {
    const raw: any = productsData;
    const list: Product[] = Array.isArray(raw) ? raw : raw?.data || [];
    return list.filter((p) => p.isActive);
  }, [productsData]);
  const productsTotal = Array.isArray(productsData) ? products.length : productsData?.total || products.length;
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const categories: Category[] = useMemo(() => {
    const list: Category[] = Array.isArray(categoriesData) ? categoriesData : [];
    return list.filter((c) => c.isActive);
  }, [categoriesData]);

  const companies: Company[] = useMemo(() => {
    const list: Company[] = Array.isArray(companiesData) ? companiesData : [];
    return list.filter((c) => c.isActive);
  }, [companiesData]);

  const tiers: PriceTier[] = useMemo(() => {
    const list: PriceTier[] = Array.isArray(priceTiers) ? priceTiers : [];
    return list.filter((t) => t.isActive).sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }, [priceTiers]);
  const tierById = useMemo(() => new Map(tiers.map((tier) => [tier.id, tier])), [tiers]);

  const paymentMethods: PaymentMethod[] = useMemo(() => {
    const raw: any = paymentMethodsData;
    const list: PaymentMethod[] = Array.isArray(raw) ? raw : raw?.data || [];
    return list.filter((p) => p.isActive);
  }, [paymentMethodsData]);
  const paymentMethodById = useMemo(() => new Map(paymentMethods.map((method) => [method.id, method])), [paymentMethods]);
  const [companyId, setCompanyId] = useState<string>(persistedDraft?.companyId || '');
  const [tierId, setTierId] = useState<string>(persistedDraft?.tierId || '');
  const [cart, setCart] = useState<CartItem[]>(persistedDraft?.cart || []);
  const [showCheckout, setShowCheckout] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const convertQuote = useConvertQuote();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromQuoteId = searchParams.get('fromQuote') || '';
  const { data: preloadedQuote } = useQuote(fromQuoteId);
  const quoteItems = useMemo(() => preloadedQuote?.items || [], [preloadedQuote]);
  const { productById: quoteProductById, isLoading: quoteProductsLoading } = useQuoteProducts(quoteItems, products);
  const [sourceQuoteId, setSourceQuoteId] = useState<string>('');
  const [clientId, setClientId] = useState<string>(persistedDraft?.clientId || '');
  const [voucherType, setVoucherType] = useState<'NONE' | 'BOLETA' | 'FACTURA'>(persistedDraft?.voucherType || 'NONE');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [splitPayments, setSplitPayments] = useState<{ paymentMethodId: string; amount: number }[]>([]);
  const [isCredit, setIsCredit] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [creditName, setCreditName] = useState('');
  const [creditDueDays, setCreditDueDays] = useState('');
  const { data: clientsData } = useClients(
    { limit: 500 },
    { enabled: showCheckout || showQuickClient || !!clientId },
  );
  const clients: Client[] = useMemo(() => {
    const raw: any = clientsData;
    const list: Client[] = Array.isArray(raw) ? raw : raw?.data || [];
    return list.filter((c) => c.isActive);
  }, [clientsData]);
  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);

  const [checkoutStep, setCheckoutStep] = useState<1 | 2>(1);
  const [sellerId, setSellerId] = useState<string>(persistedDraft?.sellerId || '');
  const todayLocal = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  })();
  const [saleDate, setSaleDate] = useState<string>(todayLocal);
  /** Venta de cortesía: solo ADMIN puede activar. Total = 0, sin pago. */
  const [isCourtesy, setIsCourtesy] = useState(false);
  /** Moneda de la venta. Los precios del carrito son en esta moneda. */
  const [currency, setCurrency] = useState<'PEN' | 'USD'>(persistedDraft?.currency || 'PEN');
  /** Tipo de cambio USD → PEN (requerido cuando currency === 'USD'). */
  const [exchangeRate, setExchangeRate] = useState<number>(persistedDraft?.exchangeRate || 3.75);
  const [bonusItems, setBonusItems] = useState<BonusCartItem[]>(persistedDraft?.bonusItems || []);
  const { data: tipoCambioData } = useTodayTipoCambio(currency === 'USD');
  useEffect(() => {
    if (currency === 'USD' && tipoCambioData?.venta) {
      setExchangeRate(tipoCambioData.venta);
    }
  }, [currency, tipoCambioData]);

  const computedDueDate = (() => {
    const days = parseInt(creditDueDays, 10);
    if (!Number.isFinite(days) || days <= 0) return '';
    const [yy, mm, dd] = saleDate.split('-').map(Number);
    const d = new Date(yy, (mm || 1) - 1, dd || 1);
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mmStr = String(d.getMonth() + 1).padStart(2, '0');
    const ddStr = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mmStr}-${ddStr}`;
  })();
  const searchRef = useRef<HTMLInputElement>(null);
  const [successSale, setSuccessSale] = useState<VoucherSnapshot | null>(null);
  const [voucherPreview, setVoucherPreview] = useState<VoucherSnapshot | null>(null);

  const { data: openCredits } = useOpenClientCredits(isCredit ? clientId : '');

  const stockSummaryQuery = useQuery({
    queryKey: ['stock-by-product-summary'],
    queryFn: stockService.getByProductSummary,
    staleTime: 30_000,
  });
  const stockReady = stockSummaryQuery.isSuccess;

  // { [companyId]: { [productId]: quantity } }
  const stockByCompany = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    const summary = Array.isArray(stockSummaryQuery.data) ? stockSummaryQuery.data : [];
    summary.forEach((row) => {
      const productId = row.productId;
      if (!productId) return;
      (row.byCompany || []).forEach((item) => {
        if (!item.companyId) return;
        if (!result[item.companyId]) result[item.companyId] = {};
        result[item.companyId][productId] = item.quantity;
      });
    });
    return result;
  }, [stockSummaryQuery.data]);

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
  const findSourceCompanyForProduct = (productId: string, requestedQty = 1): string | null => {
    let sufficientId: string | null = null;
    let sufficientQty = 0;
    let bestId: string | null = null;
    let bestQty = 0;
    Object.entries(stockByCompany).forEach(([cid, map]) => {
      const qty = map[productId] || 0;
      if (qty >= requestedQty && qty > sufficientQty) {
        sufficientId = cid;
        sufficientQty = qty;
      }
      if (qty > 0 && qty > bestQty) {
        bestId = cid;
        bestQty = qty;
      }
    });
    if (sufficientId) return sufficientId;
    return bestId;
  };

  const stockForProductInCompany = (productId: string, cid?: string): number => {
    if (!cid) return 0;
    return stockByCompany[cid]?.[productId] ?? 0;
  };

  const resolveSourceCompanyForProduct = (productId: string, requestedQty: number, preferredCompanyId?: string): string | undefined => {
    if (preferredCompanyId && stockForProductInCompany(productId, preferredCompanyId) >= requestedQty) {
      return preferredCompanyId;
    }
    const withEnoughStock = findSourceCompanyForProduct(productId, requestedQty);
    if (withEnoughStock) return withEnoughStock;
    if (preferredCompanyId && stockForProductInCompany(productId, preferredCompanyId) > 0) {
      return preferredCompanyId;
    }
    return findSourceCompanyForProduct(productId, 1) || undefined;
  };

  const companyNameById = useMemo(() => {
    const map: Record<string, string> = {};
    companies.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [companies]);

  // Preload cart from quote (if ?fromQuote=... param)
  useEffect(() => {
    if (!preloadedQuote || productsLoading || quoteProductsLoading || !stockReady || sourceQuoteId === preloadedQuote.id) return;
    if (preloadedQuote.status === 'CONVERTED' || preloadedQuote.status === 'REJECTED') {
      toast.error('Esta cotización ya no puede convertirse');
      navigate('/quotes');
      return;
    }
    setCompanyId(ALL_COMPANIES);
    if (preloadedQuote.clientId) setClientId(preloadedQuote.clientId);
    const unavailableItems: string[] = [];
    const adjustedItems: string[] = [];
    const items: CartItem[] = preloadedQuote.items.flatMap((i: any) => {
      const p = quoteProductById.get(i.productId);
      const requestedQty = Number(i.quantity || 0);
      const preferredCompanyId = i.sourceCompanyId || i.companyId || preloadedQuote.companyId || undefined;
      const sourceCompanyId = resolveSourceCompanyForProduct(i.productId, requestedQty, preferredCompanyId);
      const availableQty = stockForProductInCompany(i.productId, sourceCompanyId);
      const name = getQuoteItemProductName(i, p);
      if (!sourceCompanyId || availableQty <= 0) {
        unavailableItems.push(name);
        return [];
      }
      const quantity = requestedQty > availableQty ? availableQty : requestedQty;
      if (quantity !== requestedQty) adjustedItems.push(`${name}: ${requestedQty} → ${quantity}`);
      return [{
        productId: i.productId,
        name,
        unit: getQuoteItemProductUnit(i, p),
        quantity,
        unitPrice: i.unitPrice,
        taxType: normalizeTaxType(getQuoteItemTaxType(i, p)),
        tierOverride: i.priceTier,
        isCustomPrice: true,
        sourceCompanyId,
      }];
    });
    setCart(items);
    setSourceQuoteId(preloadedQuote.id);
    toast.success(`Cotización ${preloadedQuote.quoteNumber} cargada`);
    if (adjustedItems.length > 0) {
      toast(`Cantidades ajustadas por stock: ${adjustedItems.slice(0, 3).join(', ')}${adjustedItems.length > 3 ? '…' : ''}`, { icon: '⚠️' });
    }
    if (unavailableItems.length > 0) {
      toast.error(`Sin stock: ${unavailableItems.slice(0, 3).join(', ')}${unavailableItems.length > 3 ? '…' : ''}`);
    }
  }, [preloadedQuote, productsLoading, quoteProductsLoading, quoteProductById, stockReady, stockByCompany, sourceQuoteId, navigate]);

  // Defaults once data loads
  useEffect(() => {
    if (!companyId && companies.length) setCompanyId(ALL_COMPANIES);
  }, [companies, companyId]);
  useEffect(() => {
    if (isSellerRole && user?.id && sellerId !== user.id) setSellerId(user.id);
  }, [isSellerRole, user?.id, sellerId]);
  useEffect(() => {
    if (!tierId && tiers.length) setTierId(tiers[0].id);
  }, [tiers, tierId]);
  useEffect(() => {
    if (!paymentMethodId && paymentMethods.length) setPaymentMethodId(paymentMethods[0].id);
  }, [paymentMethods, paymentMethodId]);

  useEffect(() => {
    if (cart.length === 0 && bonusItems.length === 0) {
      clearPosDraft();
      return;
    }
    writePosDraft({
      cart,
      bonusItems,
      companyId,
      tierId,
      clientId,
      voucherType,
      sellerId,
      currency,
      exchangeRate,
    });
  }, [cart, bonusItems, companyId, tierId, clientId, voucherType, sellerId, currency, exchangeRate]);

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

  // Re-resolve prices when the selected tier/company or product prices change.
  useEffect(() => {
    if (!tierId || !companyId) return;
    setCart((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((item) => {
        if (item.isCustomPrice) return item;
        const effectiveTier = item.tierOverride || tierId;
        const product = productById.get(item.productId);
        if (!product) return item;
        const itemCompany = item.sourceCompanyId || (companyId !== ALL_COMPANIES ? companyId : '');
        if (!itemCompany) return item;
        const price = resolvePrice(product, effectiveTier, itemCompany);
        if (price == null || price === item.unitPrice) return item;
        changed = true;
        return { ...item, unitPrice: price };
      });
      return changed ? next : prev;
    });
  }, [tierId, companyId, productById]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (categoryId && p.categoryId !== categoryId) return false;
      if (onlyInStock && (stockByProduct[p.id] ?? 0) <= 0) return false;
      return true;
    });
  }, [products, categoryId, onlyInStock, stockByProduct]);
  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleProductLimit),
    [filteredProducts, visibleProductLimit],
  );
  const isInitialProductsLoading = (productsLoading || productsFetching) && products.length === 0;
  const cartByProductId = useMemo(() => new Map(cart.map((item) => [item.productId, item])), [cart]);
  const bonusByProductId = useMemo(() => new Map(bonusItems.map((item) => [item.productId, item])), [bonusItems]);

  useEffect(() => {
    setVisibleProductLimit(POS_PRODUCT_BATCH_SIZE);
  }, [debouncedSearch, debouncedIngredient, categoryId, onlyInStock, companyId]);

  const cartQty = (productId: string) => cartByProductId.get(productId)?.quantity || 0;

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
          unitPrice: price ?? 0,
          taxType: normalizeTaxType(product.taxType),
          sourceCompanyId,
          isCustomPrice: price == null ? true : undefined,
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
      const item = cartByProductId.get(productId);
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
    const item = cartByProductId.get(productId);
    const stock = stockForCartItem(item);
    if (value > stock) { toast.error(`Solo hay ${stock} en stock`); value = stock; }
    if (value <= 0) { removeFromCart(productId); return; }
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, quantity: value } : i));
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
    setBonusItems((prev) => prev.filter((b) => b.productId !== productId));
  };

  const clearCart = () => {
    clearPosDraft();
    setCart([]);
    setBonusItems([]);
  };

  const setItemTier = (productId: string, newTierId: string) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.productId !== productId) return i;
        const product = productById.get(i.productId);
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

  const addBonusRow = (item: CartItem) => {
    setBonusItems((prev) => {
      if (prev.find((b) => b.productId === item.productId)) return prev;
      return [...prev, { productId: item.productId, name: item.name, unit: item.unit, quantity: 1, taxType: item.taxType, sourceCompanyId: item.sourceCompanyId }];
    });
  };

  const removeBonusRow = (productId: string) => {
    setBonusItems((prev) => prev.filter((b) => b.productId !== productId));
  };

  const updateBonusQty = (productId: string, delta: number) => {
    setBonusItems((prev) =>
      prev.map((b) => b.productId === productId ? { ...b, quantity: Math.max(1, b.quantity + delta) } : b)
    );
  };

  const setBonusQty = (productId: string, value: number) => {
    if (isNaN(value) || value <= 0) { removeBonusRow(productId); return; }
    setBonusItems((prev) => prev.map((b) => b.productId === productId ? { ...b, quantity: value } : b));
  };

  const reconcileCartStock = (): boolean => {
    const adjusted: string[] = [];
    const removed: string[] = [];
    let changed = false;

    const nextCart = cart.flatMap((item) => {
      const sourceCompanyId = companyId === ALL_COMPANIES
        ? resolveSourceCompanyForProduct(item.productId, item.quantity, item.sourceCompanyId)
        : companyId;
      const available = stockForProductInCompany(item.productId, sourceCompanyId);

      if (!sourceCompanyId || available <= 0) {
        changed = true;
        removed.push(item.name);
        return [];
      }

      const quantity = item.quantity > available ? available : item.quantity;
      if (quantity !== item.quantity || sourceCompanyId !== item.sourceCompanyId) {
        changed = true;
        adjusted.push(`${item.name}: ${item.quantity} → ${quantity}`);
      }

      return [{ ...item, sourceCompanyId, quantity }];
    });

    if (adjusted.length > 0) {
      toast(`Se ajustó el carrito por stock: ${adjusted.slice(0, 3).join(', ')}${adjusted.length > 3 ? '…' : ''}`, { icon: '⚠️' });
    }
    if (removed.length > 0) {
      toast.error(`Se quitaron productos sin stock: ${removed.slice(0, 3).join(', ')}${removed.length > 3 ? '…' : ''}`);
    }

    if (changed) setCart(nextCart);
    return changed;
  };

  const [editingPriceFor, setEditingPriceFor] = useState<string | null>(null);

  // Solo los items GRAVADO contribuyen IGV. Los precios en carrito vienen con IGV incluido,
  // así que la base gravada se obtiene dividiendo el total gravado entre (1 + IGV_RATE).
  const { gravadoBase, exoneradoBase, inafectoBase, igv, total } = useMemo(() => {
    let gravadoConIgv = 0;
    let exo = 0;
    let inaf = 0;
    for (const i of cart) {
      const sub = i.quantity * i.unitPrice;
      if (i.taxType === 'EXONERADO') exo += sub;
      else if (i.taxType === 'INAFECTO') inaf += sub;
      else gravadoConIgv += sub;
    }
    const base = gravadoConIgv / (1 + IGV_RATE);
    const igvAmount = gravadoConIgv - base;
    return {
      gravadoBase: base,
      exoneradoBase: exo,
      inafectoBase: inaf,
      igv: igvAmount,
      total: gravadoConIgv + exo + inaf,
    };
  }, [cart]);

  const openCheckout = () => {
    if (cart.length === 0 && bonusItems.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }
    if (reconcileCartStock()) return;
    const effectiveIsCourtesy = total < 0.001;
    if (!paymentMethodId && !effectiveIsCourtesy) {
      toast.error('No hay métodos de pago configurados');
      return;
    }
    const itemMissingSource = cart.find((i) => !i.sourceCompanyId && companyId === ALL_COMPANIES);
    if (itemMissingSource) {
      toast.error(`Selecciona un almacén para "${itemMissingSource.name}"`);
      return;
    }
    setIsCredit(false);
    setCreditName('');
    setCreditDueDays('');
    setIsCourtesy(effectiveIsCourtesy);
    setSplitPayments(effectiveIsCourtesy ? [] : [{ paymentMethodId, amount: 0 }]);
    setCheckoutStep(1);
    setShowCheckout(true);
  };

  const splitTotal = Math.round(splitPayments.reduce((s, p) => s + (p.amount || 0), 0) * 100) / 100;
  const splitRemaining = Math.round((total - splitTotal) * 100) / 100;
  const downPayment = isCredit ? Math.min(splitTotal, total) : 0;
  const creditPending = isCredit ? Math.max(0, Math.round((total - downPayment) * 100) / 100) : 0;
  const downPaymentExceedsTotal = isCredit && splitTotal > total + 0.01;

  const selectedClient = clientById.get(clientId);
  const creditLimit = typeof selectedClient?.creditLimit === 'number' ? selectedClient.creditLimit : 0;
  const currentDebt = (openCredits as CreditAccount[] | undefined)?.reduce((s, acc) => s + acc.pendingAmount, 0) ?? 0;
  const creditOverLimit = isCredit && creditLimit > 0 && currentDebt + creditPending > creditLimit + 0.001;
  const creditDelta = creditOverLimit
    ? currentDebt + creditPending - creditLimit
    : Math.max(creditLimit - currentDebt - creditPending, 0);

  const sym = currency === 'USD' ? '$' : 'S/';

  const confirmSale = async () => {
    if (isCourtesy) {
      // pure bonificación: no payment needed
    } else if (isCredit) {
      if (!clientId) { toast.error('Selecciona un cliente para la venta a crédito'); return; }
      if (creditOverLimit) {
        toast.error(`Esta venta supera el límite de crédito del cliente (S/ ${creditLimit.toFixed(2)})`);
        return;
      }
      if (downPaymentExceedsTotal) {
        toast.error('El anticipo no puede superar el total. Cambia a "Pago inmediato" si cubre todo.');
        return;
      }
      const partial = splitPayments.filter(p => p.paymentMethodId && p.amount > 0);
      if (partial.length > 0 && Math.abs(splitTotal - total) <= 0.01) {
        toast.error('El anticipo cubre el total. Cambia a "Pago inmediato".');
        return;
      }
    } else {
      const validPayments = splitPayments.filter(p => p.paymentMethodId && p.amount > 0);
      if (validPayments.length === 0) { toast.error('Ingresa al menos un método de pago con monto'); return; }
      const overpay = Math.round((splitTotal - total) * 100) / 100;
      if (overpay < -0.01) {
        toast.error(`La suma de pagos (${sym} ${splitTotal.toFixed(2)}) es menor al total (${sym} ${total.toFixed(2)})`);
        return;
      }
      if (overpay > 0.01) {
        const cashIdx = validPayments.findIndex(p => (paymentMethodById.get(p.paymentMethodId)?.name || '').toLowerCase().includes('efectivo'));
        if (cashIdx < 0 || validPayments[cashIdx].amount + 0.01 < overpay) {
          toast.error(`La suma de pagos (${sym} ${splitTotal.toFixed(2)}) supera el total (${sym} ${total.toFixed(2)}). Solo Efectivo permite vuelto.`);
          return;
        }
      }
    }
    let validPayments = splitPayments.filter(p => p.paymentMethodId && p.amount > 0);
    if (!isCredit && !isCourtesy) {
      const overpay = Math.round((splitTotal - total) * 100) / 100;
      if (overpay > 0.01) {
        const cashIdx = validPayments.findIndex(p => (paymentMethodById.get(p.paymentMethodId)?.name || '').toLowerCase().includes('efectivo'));
        if (cashIdx >= 0) {
          validPayments = validPayments.map((p, i) =>
            i === cashIdx ? { ...p, amount: Math.round((p.amount - overpay) * 100) / 100 } : p,
          );
        }
      }
    }
    const saleTotal = total;
    const saleVoucherType = voucherType;
    const snapshotSellerId = sellerId || user?.id || '';
    const snapshotSeller = sellerOptions.find((s) => s.id === snapshotSellerId);
    const sellerName: string = snapshotSeller?.fullName || snapshotSeller?.username
      || user?.fullName || user?.username
      || 'Sin asignar';
    // saleDate viene como YYYY-MM-DD; preservamos la hora actual al combinar.
    const now = new Date();
    const [yy, mm, dd] = saleDate.split('-').map(Number);
    const saleDateObj = new Date(yy, (mm || 1) - 1, dd || 1, now.getHours(), now.getMinutes(), now.getSeconds());
    const saleSnapshotBase = {
      total: saleTotal,
      voucherType: saleVoucherType as VoucherSnapshot['voucherType'],
      date: saleDateObj,
      items: [
        ...cart.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          subtotal: i.quantity * i.unitPrice,
        })),
        ...bonusItems.map((b) => ({
          name: `${b.name} (Bonificación)`,
          quantity: b.quantity,
          unitPrice: 0,
          subtotal: 0,
        })),
      ],
      payments: validPayments.map((p) => ({
        methodName: paymentMethodById.get(p.paymentMethodId)?.name || '',
        amount: p.amount,
      })),
      isCredit,
      creditDueDate: isCredit && computedDueDate ? computedDueDate : undefined,
      sellerName,
      clientName: clientById.get(clientId)?.name,
      clientDocument: clientById.get(clientId)?.documentNumber,
      clientPhone: clientById.get(clientId)?.phone,
      igv,
      baseImponible: gravadoBase,
      isCourtesy: isCourtesy || undefined,
      currency: currency !== 'PEN' ? currency : undefined,
      exchangeRate: currency === 'USD' ? exchangeRate : undefined,
      totalUsd: currency === 'USD' ? saleTotal : undefined,
    };
    try {
      const effectiveSellerId = sellerId || user?.id;
      let saleResult: any;
      if (sourceQuoteId) {
        saleResult = await convertQuote.mutateAsync({
          id: sourceQuoteId,
          payload: {
            companyId: companyId === ALL_COMPANIES ? (cart[0]?.sourceCompanyId || '') : companyId,
            clientId: clientId || undefined,
            voucherType,
            isCredit,
            creditName: isCredit && creditName.trim() ? creditName.trim() : undefined,
            creditDueDate: isCredit && computedDueDate ? computedDueDate : undefined,
            payments: validPayments,
            sellerId: effectiveSellerId,
            items: [
              ...cart.map((i) => ({
                productId: i.productId,
                companyId: i.sourceCompanyId || (companyId !== ALL_COMPANIES ? companyId : ''),
                quantity: i.quantity,
                priceTier: i.tierOverride || tierId,
                unitPrice: i.unitPrice,
              })),
              ...bonusItems.map((b) => ({
                productId: b.productId,
                companyId: b.sourceCompanyId || (companyId !== ALL_COMPANIES ? companyId : ''),
                quantity: b.quantity,
                priceTier: tierId,
                unitPrice: 0,
              })),
            ],
            date: saleDateObj.toISOString(),
            isCourtesy: isCourtesy || undefined,
            currency: currency !== 'PEN' ? currency : undefined,
            exchangeRate: currency === 'USD' ? exchangeRate : undefined,
          },
        });
      } else {
        saleResult = await createSale.mutateAsync({
          clientId: clientId || undefined,
          voucherType,
          isCredit,
          creditName: isCredit && creditName.trim() ? creditName.trim() : undefined,
          creditDueDate: isCredit && computedDueDate ? computedDueDate : undefined,
          sellerId: effectiveSellerId,
          items: [
            ...cart.map((i) => ({
              productId: i.productId,
              companyId: i.sourceCompanyId || (companyId !== ALL_COMPANIES ? companyId : ''),
              quantity: i.quantity,
              priceTier: i.tierOverride || tierId,
              unitPrice: i.unitPrice,
            })),
            ...bonusItems.map((b) => ({
              productId: b.productId,
              companyId: b.sourceCompanyId || (companyId !== ALL_COMPANIES ? companyId : ''),
              quantity: b.quantity,
              priceTier: tierId,
              unitPrice: 0,
            })),
          ],
          payments: validPayments,
          date: saleDateObj.toISOString(),
          isCourtesy: isCourtesy || undefined,
          currency: currency !== 'PEN' ? currency : undefined,
          exchangeRate: currency === 'USD' ? exchangeRate : undefined,
        } as any);
      }
      setCart([]);
      setBonusItems([]);
      clearPosDraft();
      setClientId('');
      setVoucherType('NONE');
      setSplitPayments([]);
      setIsCredit(false);
      setCreditName('');
      setCreditDueDays('');
      setSaleDate(todayLocal);
      setIsCourtesy(false);
      setCurrency('PEN');
      setExchangeRate(3.75);
      setShowCheckout(false);
      if (sourceQuoteId) {
        setSourceQuoteId('');
        setSearchParams({});
      }
      const saleId = saleResult?.id || saleResult?.sale?.id || '';
      const saleNumber = saleResult?.saleNumber || saleResult?.sale?.saleNumber;
      setSuccessSale({ id: saleId, voucherNumber: saleNumber, ...saleSnapshotBase });
    } catch {
      // errors handled by mutation onError
    }
  };

  // Keyboard shortcuts for success modal
  useEffect(() => {
    if (!successSale) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setSuccessSale(null); }
      else if (e.key === 'Enter') { e.preventDefault(); setSuccessSale(null); searchRef.current?.focus(); }
      else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        setVoucherPreview(successSale);
        setSuccessSale(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [successSale]);

  return (
    <div className="-mx-4 -mt-4 -mb-20 lg:-m-8 h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] flex bg-surface">
      {/* Products panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre… (Ctrl+K)"
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
            />
          </div>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={ingredientFilter}
              onChange={(e) => setIngredientFilter(e.target.value)}
              placeholder="Ingrediente activo…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
            />
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
          {isInitialProductsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5 gap-4">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="bg-white rounded-2xl shadow-card overflow-hidden animate-pulse">
                  <div className="aspect-square bg-primary-50" />
                  <div className="p-3 space-y-3">
                    <div className="h-4 bg-gray-100 rounded w-4/5" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-5 bg-gray-100 rounded w-14" />
                      <div className="h-5 bg-gray-100 rounded w-12" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
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
              {visibleProducts.map((p) => {
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
                    className="relative bg-white rounded-2xl shadow-card text-left overflow-hidden hover:shadow-card-hover hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-card"
                  >
                    <div className="aspect-square relative bg-gradient-to-br from-primary-50 to-primary-100 overflow-hidden">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-4xl font-bold text-primary-300 tracking-tight select-none">
                            {productInitials(p.name)}
                          </span>
                        </div>
                      )}
                      {qty > 0 && (
                        <span className="absolute top-2 right-2 bg-primary-600 text-white text-xs font-bold rounded-full min-w-[24px] h-6 px-1.5 flex items-center justify-center shadow">
                          {qty}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-sm font-medium text-gray-800 leading-tight line-clamp-2 min-h-[2.5rem]">
                        {p.name}
                      </div>
                      {sourceLabel && (
                        <div className="mt-1 text-[11px] text-gray-500 truncate" title={sourceLabel}>
                          📍 {sourceLabel}
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-lg font-bold text-primary-600 truncate">
                          {price != null ? `${currency === 'USD' ? '$' : 'S/'} ${price.toFixed(2)}` : isCourtesy ? '$ 0.00' : '—'}
                        </span>
                        <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md ${stockColor}`}>
                          {stock === 0 ? 'Agotado' : `${stock} uds`}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {productsTotal > products.length && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleProductLimit((limit) => limit + POS_PRODUCT_BATCH_SIZE)}
                disabled={productsFetching}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {productsFetching ? 'Cargando...' : `Mostrar ${Math.min(POS_PRODUCT_BATCH_SIZE, productsTotal - products.length)} más`}
                <span className="ml-2 text-gray-400">
                  ({products.length} de {productsTotal})
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cart panel — fixed drawer on mobile, static panel on desktop */}
      <aside className={`fixed inset-y-0 right-0 z-40 w-[calc(100vw-32px)] max-w-md sm:w-[85vw] sm:max-w-sm bg-white border-l border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out lg:static lg:w-96 xl:w-[440px] 2xl:w-[500px] lg:max-w-none lg:z-auto lg:translate-x-0 ${cartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
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
            {isSellerRole ? (
              <span className="flex-1 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                {tierById.get(tierId)?.name || '—'}
              </span>
            ) : (
              <select
                value={tierId}
                onChange={(e) => setTierId(e.target.value)}
                className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white"
              >
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Toggles: USD y Cortesía */}
          <div className="flex items-center gap-2 mt-1">
            {/* Toggle USD */}
            <button
              type="button"
              onClick={() => setCurrency(currency === 'USD' ? 'PEN' : 'USD')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                currency === 'USD'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-emerald-400 hover:text-emerald-600'
              }`}
              title="Activar venta en dólares"
            >
              <DollarSign size={12} />
              USD
            </button>

          </div>
          {currency === 'USD' && (
            <div className="mt-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
              Precios y pagos en dólares (USD)
            </div>
          )}
          {bonusItems.length > 0 && (
            <div className="mt-1 text-[11px] text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-2 py-1 flex items-center gap-1">
              <Gift size={10} /> {bonusItems.length} fila(s) de bonificación en el carrito
            </div>
          )}
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
                : tierById.get(effectiveTierId)?.name || '';
              const isOverridden = !!item.tierOverride || !!item.isCustomPrice;
              const isEditing = editingPriceFor === item.productId;
              const bonusRow = bonusByProductId.get(item.productId);
              return (
                <div key={item.productId}>
                  <div className="rounded-xl p-3 group bg-gray-50">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-white text-primary-600">
                        <Package size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-medium text-gray-800 leading-tight break-words">{item.name}</div>
                        {companyId === ALL_COMPANIES && item.sourceCompanyId && (
                          <div className="text-[11px] text-primary-700 bg-primary-50 inline-block px-1.5 py-0.5 rounded mt-1 mr-1 max-w-full break-words">
                            📍 {companyNameById[item.sourceCompanyId] || '—'}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-sm text-gray-500">
                            {currency === 'USD' ? '$' : 'S/'} {item.unitPrice.toFixed(2)} · {item.unit}
                          </span>
                          {isSellerRole ? (
                            <span
                              className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium ${
                                isOverridden ? 'bg-primary-100 text-primary-700' : 'text-gray-400'
                              }`}
                            >
                              {effectiveTierName}
                            </span>
                          ) : (
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
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQty(item.productId, -1)}
                          className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 flex items-center justify-center"
                        >
                          <Minus size={13} />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => setQty(item.productId, parseFloat(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="text-sm font-semibold w-12 h-8 text-center border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onClick={() => updateQty(item.productId, 1)}
                          className="w-8 h-8 rounded-lg bg-primary-600 text-white hover:bg-primary-700 flex items-center justify-center"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {!bonusRow && (
                          <button
                            onClick={() => addBonusRow(item)}
                            className="text-[10px] font-semibold text-violet-600 px-2 py-1 rounded-lg border border-violet-200 bg-white hover:bg-violet-50"
                            title="Agregar fila de bonificación para este producto"
                          >
                            +Bonif.
                          </button>
                        )}
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center"
                          title="Quitar producto"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  {isEditing && !isSellerRole && (
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
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">{currency === 'USD' ? '$' : 'S/'}</span>
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
                  {bonusRow && (
                    <div className="mt-1.5 rounded-xl p-3 bg-violet-50 border border-violet-200 ml-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-violet-100 text-violet-600">
                          <Gift size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-violet-800 truncate">{item.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] bg-violet-200 text-violet-700 rounded px-1.5 py-0.5 font-semibold">Bonificación</span>
                            <span className="text-xs text-violet-600">{currency === 'USD' ? '$' : 'S/'} 0.00 · {item.unit}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateBonusQty(item.productId, -1)}
                            className="w-6 h-6 rounded-md bg-white border border-violet-200 text-violet-500 hover:bg-violet-100 flex items-center justify-center"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={bonusRow.quantity}
                            onChange={(e) => setBonusQty(item.productId, parseFloat(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            className="text-sm font-semibold w-10 text-center border border-violet-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-violet-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => updateBonusQty(item.productId, 1)}
                            className="w-6 h-6 rounded-md bg-violet-500 text-white hover:bg-violet-600 flex items-center justify-center"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <button
                          onClick={() => removeBonusRow(item.productId)}
                          className="text-violet-300 hover:text-red-500 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {(cart.length > 0 || bonusItems.length > 0) && (
          <div className="border-t border-gray-100 px-5 py-4 space-y-2">
            {gravadoBase > 0 && (
              <div className="flex justify-between text-base text-gray-600">
                <span>Subtotal gravado</span>
                <span className="font-medium">{currency === 'USD' ? '$' : 'S/'} {gravadoBase.toFixed(2)}</span>
              </div>
            )}
            {exoneradoBase > 0 && (
              <div className="flex justify-between text-base text-gray-600">
                <span>Exonerado</span>
                <span className="font-medium">{currency === 'USD' ? '$' : 'S/'} {exoneradoBase.toFixed(2)}</span>
              </div>
            )}
            {inafectoBase > 0 && (
              <div className="flex justify-between text-base text-gray-600">
                <span>Inafecto</span>
                <span className="font-medium">{currency === 'USD' ? '$' : 'S/'} {inafectoBase.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base text-gray-600">
              <span>IGV (18%)</span>
              <span className="font-medium">{currency === 'USD' ? '$' : 'S/'} {igv.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-gray-100">
              <span className="text-base font-semibold text-gray-700">
                Total {currency === 'USD' && <span className="text-xs font-normal text-emerald-600">USD</span>}
                {isCourtesy && <span className="text-xs font-normal text-violet-600 ml-1">Bonificación</span>}
              </span>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary-600">{currency === 'USD' ? '$' : 'S/'} {total.toFixed(2)}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (cart.length === 0) { toast.error('El carrito está vacío'); return; }
                  const resolvedCompany = companyId === ALL_COMPANIES ? (cart[0]?.sourceCompanyId || '') : companyId;
                  navigate('/quotes/new', {
                    state: {
                      cart: {
                        companyId: resolvedCompany,
                        tierId,
                        sellerId: sellerId || (isSellerRole ? user?.id : ''),
                        items: cart.map((i) => ({
                          productId: i.productId,
                          name: i.name,
                          unit: i.unit,
                          quantity: i.quantity,
                          unitPrice: i.unitPrice,
                          tierOverride: i.tierOverride,
                          sourceCompanyId: i.sourceCompanyId || resolvedCompany || undefined,
                        })),
                      },
                    },
                  });
                }}
                className="flex-1 mt-2 py-3 bg-white border border-primary-600 text-primary-700 rounded-xl hover:bg-primary-50 font-semibold transition-colors flex items-center justify-center gap-2"
                title="Cotizar este carrito"
              >
                <ScrollText size={18} />
                Cotizar
              </button>
              <button
                onClick={openCheckout}
                className="flex-1 mt-2 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-semibold transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <CreditCard size={18} />
                Comprar
              </button>
            </div>
          </div>
        )}
      </aside>

      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCheckout(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className={`rounded-t-2xl px-6 py-6 text-white shrink-0 ${isCourtesy ? 'bg-violet-600' : currency === 'USD' ? 'bg-emerald-600' : 'bg-primary-600'}`}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-white/70 text-sm mb-1">
                    {cart.length + bonusItems.length} {(cart.length + bonusItems.length) === 1 ? 'producto' : 'productos'}
                    {isCourtesy && <span className="ml-2 bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">BONIF.</span>}
                    {!isCourtesy && bonusItems.length > 0 && <span className="ml-2 bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">+BONIF.</span>}
                    {currency === 'USD' && !isCourtesy && <span className="ml-2 bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">USD</span>}
                  </p>
                  <p className="text-4xl font-bold tracking-tight">{currency === 'USD' ? '$' : 'S/'} {total.toFixed(2)}</p>
                </div>
                <div className="flex items-start gap-2">
                  <label className="flex items-center gap-2 bg-white/15 hover:bg-white/25 transition-colors rounded-xl px-3 py-2 cursor-pointer" title="Fecha de la venta">
                    <Calendar size={16} className="text-white/90 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-white/70 leading-none">Fecha</span>
                      <input
                        type="date"
                        value={saleDate}
                        max={todayLocal}
                        onChange={(e) => setSaleDate(e.target.value || todayLocal)}
                        className="bg-transparent border-0 text-white text-sm font-semibold focus:outline-none [color-scheme:dark] cursor-pointer p-0 mt-0.5"
                      />
                    </div>
                  </label>
                  <button onClick={() => setShowCheckout(false)} className="p-2 rounded-xl hover:bg-white/20 transition-colors">
                    <X size={20} />
                  </button>
                </div>
              </div>
              {/* Cart items summary */}
              <div className="bg-white/10 rounded-xl px-4 py-3 max-h-32 overflow-y-auto space-y-2">
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between text-sm">
                    <span className="text-white/80 truncate flex-1 mr-3">
                      <span className="font-bold text-white mr-2">{item.quantity}×</span>{item.name}
                    </span>
                    <span className="text-white font-semibold shrink-0">{currency === 'USD' ? '$' : 'S/'} {(item.quantity * item.unitPrice).toFixed(2)}</span>
                  </div>
                ))}
                {bonusItems.map((b) => (
                  <div key={`bonus-${b.productId}`} className="flex items-center justify-between text-sm">
                    <span className="text-white/60 truncate flex-1 mr-3">
                      <span className="font-bold text-white/80 mr-2">{b.quantity}×</span>{b.name}
                      <span className="ml-1 text-white/40 text-xs">(Bonif.)</span>
                    </span>
                    <span className="text-white/60 font-semibold shrink-0">{currency === 'USD' ? '$' : 'S/'} 0.00</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 justify-between mt-3 text-xs text-white/60">
                <span>Base imponible: {currency === 'USD' ? '$' : 'S/'} {gravadoBase.toFixed(2)}</span>
                {exoneradoBase > 0 && <span>Exonerado: {currency === 'USD' ? '$' : 'S/'} {exoneradoBase.toFixed(2)}</span>}
                {inafectoBase > 0 && <span>Inafecto: {currency === 'USD' ? '$' : 'S/'} {inafectoBase.toFixed(2)}</span>}
                <span>IGV 18%: {currency === 'USD' ? '$' : 'S/'} {igv.toFixed(2)}</span>
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
                  {!isSellerRole && sellerOptions.length > 0 && (
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
                        <option value="">— Yo mismo ({user?.fullName || user?.username}) —</option>
                        {sellerOptions.map((s) => <option key={s.id} value={s.id}>{s.fullName || s.username}</option>)}
                      </select>
                    </div>
                  )}
                  {isSellerRole && (
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
                    <SmartSearchSelect
                      items={clients}
                      value={clientId}
                      onChange={(id) => {
                        setClientId(id);
                        if (!id) setIsCredit(false);
                        setClientSearch('');
                      }}
                      getId={(c) => c.id}
                      getLabel={(c) => c.name}
                      getSubLabel={(c) => (
                        <span className="flex items-center gap-2">
                          {c.documentNumber && <span className="font-mono">{c.documentNumber}</span>}
                          {c.phone && <span>· {c.phone}</span>}
                        </span>
                      )}
                      searchFields={(c) => [c.name, c.documentNumber, c.phone]}
                      placeholder="Buscar por nombre, DNI/RUC o teléfono…"
                      emptyText="No se encontraron clientes con esa búsqueda"
                      onAddNew={(text) => { setClientSearch(text); setShowQuickClient(true); }}
                      addNewLabel="Añadir nuevo cliente"
                    />
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* Tipo de cambio — solo visible cuando la venta es en USD */}

                  {/* Comprobante */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ScrollText size={14} className="text-gray-500" />
                      <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Tipo de comprobante</span>
                    </div>
                    <div className="space-y-2">
                      {([
                        { v: 'BOLETA', icon: Receipt, title: 'Boleta de venta', subtitle: 'Para consumidores finales', iconBg: 'bg-primary-100 text-primary-700' },
                        { v: 'FACTURA', icon: Building2, title: 'Factura', subtitle: 'Para empresas con RUC', iconBg: 'bg-blue-100 text-blue-700' },
                        { v: 'NONE', icon: FileText, title: 'Nota de venta', subtitle: 'Sin comprobante SUNAT', iconBg: 'bg-amber-100 text-amber-700' },
                      ] as const).map(({ v, icon: Icon, title, subtitle, iconBg }) => {
                        const selected = voucherType === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setVoucherType(v)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors ${
                              selected
                                ? 'bg-primary-50 border-primary-500 shadow-sm'
                                : 'bg-white border-gray-200 hover:border-primary-300 hover:bg-primary-50/40'
                            }`}
                          >
                            <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                              <Icon size={18} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-bold ${selected ? 'text-primary-800' : 'text-gray-800'}`}>{title}</div>
                              <div className={`text-xs ${selected ? 'text-primary-700/80' : 'text-gray-500'}`}>{subtitle}</div>
                            </div>
                            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              selected ? 'bg-primary-600 border-primary-600' : 'border-gray-300'
                            }`}>
                              {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {checkoutStep === 2 && (
                <>
                  {/* TOTAL banner */}
                  <div className={`-mt-1 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 ${
                    isCourtesy ? 'bg-violet-50 border-violet-100' : currency === 'USD' ? 'bg-emerald-50 border-emerald-100' : 'bg-primary-50 border-primary-100'
                  }`}>
                    <div>
                      <span className={`text-xs font-bold uppercase tracking-wider ${isCourtesy ? 'text-violet-700' : currency === 'USD' ? 'text-emerald-700' : 'text-primary-700'}`}>
                        {isCourtesy ? 'Bonificación' : currency === 'USD' ? 'Total a cobrar (USD)' : 'Total a cobrar'}
                      </span>
                    </div>
                    <span className={`text-2xl font-bold tabular-nums ${isCourtesy ? 'text-violet-800' : currency === 'USD' ? 'text-emerald-800' : 'text-primary-800'}`}>
                      {isCourtesy ? 'S/ 0.00' : `${currency === 'USD' ? '$' : 'S/'} ${total.toFixed(2)}`}
                    </span>
                  </div>
                  {/* Cortesía: mensaje en lugar de métodos de pago */}
                  {isCourtesy && (
                    <div className="flex items-center gap-3 p-4 bg-violet-50 border-2 border-violet-200 rounded-xl">
                      <Gift size={20} className="text-violet-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-violet-800">Bonificación registrada</p>
                        <p className="text-xs text-violet-600 mt-0.5">No requiere pago. Quedará registrada en caja con monto S/ 0.00.</p>
                      </div>
                    </div>
                  )}

                  {/* Tipo de pago + Crédito + Métodos — todo oculto en cortesía */}
                  {!isCourtesy && (<>
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

                  {/* Crédito — detalles */}
                  {isCredit && (
                    <>
                      <div className="border-t border-gray-100" />
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Landmark size={14} className="text-orange-500" />
                          <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Detalles del crédito</span>
                        </div>
                        {creditLimit > 0 && (
                          <div className={`mb-3 p-3.5 rounded-xl border-2 text-sm ${
                            creditOverLimit ? 'bg-red-50 border-red-200 text-red-700' : 'bg-orange-50 border-orange-200 text-orange-800'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs">Deuda actual</span>
                              <span className="font-semibold tabular-nums">S/ {currentDebt.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-xs">+ Saldo de esta venta</span>
                              <span className="font-semibold tabular-nums">S/ {creditPending.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1 pt-1 border-t border-current/20">
                              <span className="text-xs font-semibold">= Deuda total</span>
                              <span className="font-semibold tabular-nums">S/ {(currentDebt + creditPending).toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-xs">− Límite del cliente</span>
                              <span className="font-semibold tabular-nums">S/ {creditLimit.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-current/30">
                              <span className="text-xs font-bold uppercase tracking-wide">{creditOverLimit ? 'Excede el límite por' : 'Disponible tras la venta'}</span>
                              <span className="font-bold tabular-nums">S/ {creditDelta.toFixed(2)}</span>
                            </div>
                            {creditOverLimit && (
                              <div className="mt-2 text-xs">Esta venta supera el límite de crédito del cliente.</div>
                            )}
                          </div>
                        )}
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Plazo de pago <span className="text-gray-400 font-normal">(opcional)</span>
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min={1}
                                step={1}
                                value={creditDueDays}
                                onChange={(e) => setCreditDueDays(e.target.value.replace(/\D/g, ''))}
                                placeholder="Ej: 30"
                                className="w-full px-4 py-3 pr-16 border-2 border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-medium pointer-events-none">días</span>
                            </div>
                            {computedDueDate && (
                              <p className="mt-1.5 text-xs text-gray-500">
                                Vence el <span className="font-semibold text-gray-700">{new Date(computedDueDate + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Nota <span className="text-gray-400 font-normal">(opcional)</span>
                            </label>
                            <input
                              value={creditName}
                              onChange={(e) => setCreditName(e.target.value)}
                              placeholder="Ej: Tomates, Maíz"
                              className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Métodos de pago — total (pago inmediato) o anticipo (crédito parcial) */}
                  <>
                      <div className="border-t border-gray-100" />
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <CreditCard size={14} className={isCredit ? 'text-orange-500' : 'text-gray-500'} />
                          <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                            {isCredit ? 'Anticipo' : 'Método de pago'}
                          </span>
                          {isCredit && (
                            <span className="text-xs text-gray-400 font-normal normal-case">opcional</span>
                          )}
                        </div>
                        {isCredit && (
                          <p className="-mt-2 mb-3 text-xs text-gray-500">
                            ¿El cliente pagó una parte ahora? Indica el anticipo y el saldo quedará a crédito.
                          </p>
                        )}
                        <div className="space-y-3">
                          {splitPayments.map((p, idx) => {
                            const selectedMethod = paymentMethodById.get(p.paymentMethodId);
                            const isCash = (selectedMethod?.name || '').toLowerCase().includes('efectivo');
                            return (
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
                                {isCash && (
                                  <div className="flex items-center gap-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                    <Banknote size={12} /> Monto recibido
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">{currency === 'USD' ? '$' : 'S/'}</span>
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
                            );
                          })}
                        </div>

                        {/* Estado del pago */}
                        {splitPayments.length > 0 && (
                          isCredit ? (
                            splitTotal > 0.01 && (
                              <div className={`mt-3 rounded-xl px-4 py-3 ${
                                downPaymentExceedsTotal ? 'bg-red-50 border-2 border-red-200' : 'bg-orange-50 border-2 border-orange-200'
                              }`}>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium text-gray-600">Anticipo</span>
                                  <span className="font-bold tabular-nums text-gray-800">{sym} {downPayment.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm mt-1">
                                  <span className="font-medium text-orange-700">Saldo a crédito</span>
                                  <span className="font-bold tabular-nums text-orange-700">{sym} {creditPending.toFixed(2)}</span>
                                </div>
                                {downPaymentExceedsTotal && (
                                  <div className="mt-2 text-xs text-red-700">
                                    El anticipo supera el total. Reduce el monto o cambia a "Pago inmediato".
                                  </div>
                                )}
                              </div>
                            )
                          ) : (
                            <div className={`mt-3 rounded-xl px-4 py-3 flex items-center justify-between ${
                              Math.abs(splitRemaining) <= 0.01 ? 'bg-green-50 border-2 border-green-200' :
                              splitRemaining > 0 ? 'bg-orange-50 border-2 border-orange-200' : 'bg-blue-50 border-2 border-blue-200'
                            }`}>
                              <span className={`font-bold text-base ${Math.abs(splitRemaining) <= 0.01 ? 'text-green-700' : splitRemaining > 0 ? 'text-orange-700' : 'text-blue-700'}`}>
                                {Math.abs(splitRemaining) <= 0.01 ? '✓ Pago completo' : splitRemaining > 0 ? `Falta ${sym} ${splitRemaining.toFixed(2)}` : `Vuelto ${sym} ${Math.abs(splitRemaining).toFixed(2)}`}
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
                          )
                        )}

                        {paymentMethods.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const used = new Set(splitPayments.map(p => p.paymentMethodId));
                              const next = paymentMethods.find(m => !used.has(m.id)) || paymentMethods[0];
                              if (!next) return;
                              setSplitPayments([...splitPayments, { paymentMethodId: next.id, amount: isCredit ? 0 : Math.max(0, splitRemaining) }]);
                            }}
                            className="mt-3 w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-400 hover:border-primary-400 hover:text-primary-600 transition-colors"
                          >
                            + Agregar método de pago
                          </button>
                        )}
                      </div>
                    </>
                  </>)}
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
                    disabled={createSale.isPending || creditOverLimit || downPaymentExceedsTotal}
                    className={`flex-1 py-3.5 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-bold text-base transition-colors shadow-sm flex items-center justify-center gap-2 ${
                      isCourtesy ? 'bg-violet-600 hover:bg-violet-700' : isCredit ? 'bg-orange-500 hover:bg-orange-600' : currency === 'USD' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary-600 hover:bg-primary-700'
                    }`}
                  >
                    {isCourtesy ? <Gift size={18} /> : isCredit ? <Landmark size={18} /> : <CreditCard size={18} />}
                    {createSale.isPending
                      ? 'Procesando…'
                      : isCourtesy
                        ? 'Confirmar Bonificación · S/ 0.00'
                        : isCredit
                          ? downPayment > 0
                            ? `Anticipo ${sym} ${downPayment.toFixed(2)} + Crédito ${sym} ${creditPending.toFixed(2)}`
                            : `A Crédito · ${sym} ${total.toFixed(2)}`
                          : `Confirmar · ${sym} ${total.toFixed(2)}`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Success modal */}
      {successSale && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setSuccessSale(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Green header */}
            <div className="relative bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 text-white px-8 pt-8 pb-7 text-center overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full" />
              <div className="absolute -bottom-12 -left-8 w-28 h-28 bg-white/10 rounded-full" />
              <button
                type="button"
                onClick={() => setSuccessSale(null)}
                className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
              <div className="relative">
                <div className="inline-flex w-16 h-16 rounded-full bg-white/20 items-center justify-center mb-3 backdrop-blur">
                  <CheckCircle2 size={36} strokeWidth={2.5} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold">¡Venta registrada!</h2>
                <p className="text-primary-50 text-sm mt-1">
                  {successSale.voucherType === 'BOLETA' ? 'Boleta emitida correctamente'
                    : successSale.voucherType === 'FACTURA' ? 'Factura emitida correctamente'
                    : 'Nota de venta generada'}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 pt-6 pb-5 text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-semibold text-gray-700">
                {successSale.voucherType === 'BOLETA' ? <Receipt size={13} />
                  : successSale.voucherType === 'FACTURA' ? <Building2 size={13} />
                  : <FileText size={13} />}
                {successSale.voucherType === 'BOLETA' ? 'Boleta de venta'
                  : successSale.voucherType === 'FACTURA' ? 'Factura'
                  : 'Nota de venta'}
                {(successSale.voucherNumber || successSale.id) && (
                  <span className="text-gray-400 font-mono">· {successSale.voucherNumber || `#${successSale.id.slice(-6).toUpperCase()}`}</span>
                )}
              </div>
              <div className="text-3xl font-bold text-gray-900 tabular-nums">
                {successSale.currency === 'USD' && successSale.totalUsd != null
                  ? `$ ${successSale.totalUsd.toFixed(2)}`
                  : `S/ ${successSale.total.toFixed(2)}`}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setVoucherPreview(successSale); setSuccessSale(null); }}
                  className="flex flex-col items-center gap-1 px-3 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <Eye size={18} className="text-gray-600" />
                  <span className="text-sm font-semibold text-gray-700">Ver comprobante</span>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 border border-gray-200 rounded px-1.5 py-px">V</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setSuccessSale(null); searchRef.current?.focus(); }}
                  className="flex flex-col items-center gap-1 px-3 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm"
                >
                  <Plus size={18} />
                  <span className="text-sm font-semibold">Nueva venta</span>
                  <span className="text-[10px] uppercase tracking-wider text-primary-100 border border-primary-400 rounded px-1.5 py-px">Enter ↵</span>
                </button>
              </div>

              <p className="text-xs text-gray-400 pt-1">
                <span className="border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 font-mono">Esc</span> para cerrar
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Voucher preview */}
      {voucherPreview && (
        <Suspense fallback={null}>
          <VoucherPreviewModal sale={voucherPreview} onClose={() => setVoucherPreview(null)} />
        </Suspense>
      )}

      {/* Quick client creation */}
      {showQuickClient && (
        <Suspense fallback={null}>
          <QuickClientModal
            isOpen={showQuickClient}
            onClose={() => setShowQuickClient(false)}
            onCreated={(client) => { setClientId(client.id); setClientSearch(''); }}
            prefillName={clientSearch.trim() && !/^\d+$/.test(clientSearch.trim()) ? clientSearch.trim() : undefined}
            prefillDocument={clientSearch.trim() && /^\d+$/.test(clientSearch.trim()) ? clientSearch.trim() : undefined}
          />
        </Suspense>
      )}

      {/* Mobile overlay */}
      {cartOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setCartOpen(false)}
        />
      )}

      {/* Mobile FAB — open cart (sits above the bottom-nav) */}
      <button
        onClick={() => setCartOpen(true)}
        className="lg:hidden fixed bottom-20 right-4 left-4 z-20 py-3.5 bg-gray-900 text-white rounded-2xl shadow-xl flex items-center justify-between px-5 active:scale-95 transition-transform"
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
        <span className="text-lg font-bold">{currency === 'USD' ? '$' : 'S/'} {total.toFixed(2)}</span>
      </button>
    </div>
  );
}
