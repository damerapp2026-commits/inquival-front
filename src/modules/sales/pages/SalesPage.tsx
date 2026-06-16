import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { useSales, useCreateSale, useCancelSale, useUpdateVoucher } from '../hooks/useSales';
import { saleService } from '../services/saleService';
import { useLoans, useCreateLoan, useReturnLoanItems } from '../../loans/hooks/useLoans';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts } from '../../products/hooks/useProducts';
import { useClients } from '../../clients/hooks/useClients';
import { usePriceTiers } from '../../price-tiers/hooks/usePriceTiers';
import { usePaymentMethods } from '../../payment-methods/hooks/usePaymentMethods';
import { stockService } from '../../stock/services/stockService';
import { useUsers } from '../../users/hooks/useUsers';
import { useAuth } from '../../../app/providers/AuthProvider';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { Plus, Receipt, Trash2, Eye, CalendarDays, HandshakeIcon, RotateCcw, XCircle, Copy, Download, FileText, X, CheckCircle2, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { VoucherPreviewModal, type VoucherSnapshot, resolveClientLocation } from '../components/VoucherPreviewModal';
import { EditSaleItemsModal } from '../components/EditSaleItemsModal';
import { ClientSalesHistoryModal } from '../components/ClientSalesHistoryModal';
import type { Sale, Loan, Company, Product, ProductPrice, Client, PriceTier, PaymentMethod, Stock } from '../../../shared/types';
import { formatDateEs } from '../../../shared/utils/date.util';
import { useTodayTipoCambio } from '../../../shared/hooks/useLookup';

function saleSym(s: { currency?: string }): string { return s.currency === 'USD' ? '$' : 'S/'; }
function saleDispTotal(s: { currency?: string; total: number; totalUsd?: number }): number {
  return s.currency === 'USD' && s.totalUsd != null ? s.totalUsd : s.total;
}
function itemDispPrice(s: { currency?: string }, item: { unitPrice: number; unitPriceUsd?: number }): number {
  return s.currency === 'USD' && item.unitPriceUsd != null ? item.unitPriceUsd : item.unitPrice;
}
function itemDispSub(s: { currency?: string }, item: { subtotal: number; subtotalUsd?: number }): number {
  return s.currency === 'USD' && item.subtotalUsd != null ? item.subtotalUsd : item.subtotal;
}

function getMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function monthRange(year: number, month: number) {
  const mm = String(month).padStart(2, '0');
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(daysInMonth(year, month)).padStart(2, '0')}`,
  };
}

interface PaymentSplit {
  paymentMethodId: string;
  amount: number;
}

// 'MIXED' and 'CREDIT' are special UI-only modes; any other string is a paymentMethod ID
type PaymentMode = string; // paymentMethodId | 'MIXED' | 'CREDIT'

export function SalesPage() {
  const { user } = useAuth();
  const isSellerRole = user?.role === 'VENDEDOR' || user?.role === 'VENDEDOR_CAMPO';
  // When set, opens a modal listing every sale for that client (ignores date range)
  const [clientHistoryId, setClientHistoryId] = useState<string | null>(null);

  const { data: sellersData } = useUsers({ limit: 200 });
  const sellers: any[] = useMemo(() => {
    const raw: any = sellersData;
    const list: any[] = Array.isArray(raw) ? raw : raw?.data || [];
    return list.filter((u: any) => u.role === 'VENDEDOR' || u.role === 'VENDEDOR_CAMPO' || u.role === 'ADMIN');
  }, [sellersData]);
  const sellerNameById = useMemo(() => {
    const map: Record<string, string> = {};
    sellers.forEach((s: any) => { map[s.id] = s.fullName || s.username; });
    return map;
  }, [sellers]);
  // Lookup amplio (todos los roles) para resolver el nombre del operador
  // (createdBy) cuando una venta no tiene vendedor asignado — típico cuando un
  // admin registra la venta sin elegir trabajador en el POS.
  const userNameById = useMemo(() => {
    const raw: any = sellersData;
    const list: any[] = Array.isArray(raw) ? raw : raw?.data || [];
    const map: Record<string, string> = {};
    list.forEach((u: any) => { map[u.id] = u.fullName || u.username || ''; });
    if (user?.id && !map[user.id]) map[user.id] = user.fullName || user.username || '';
    return map;
  }, [sellersData, user]);

  // Todos los filtros en URL params para que persistan al navegar y volver
  const [searchParams, setSearchParams] = useSearchParams();
  const updateParams = (updates: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(updates)) {
        if (!v) sp.delete(k); else sp.set(k, v);
      }
      return sp;
    }, { replace: true });
  };
  const _tab = searchParams.get('tab') || 'sales';
  const activeTab = (['sales', 'boletas', 'facturas', 'loans'].includes(_tab) ? _tab : 'sales') as 'sales' | 'boletas' | 'facturas' | 'loans';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const boletaPage = Math.max(1, parseInt(searchParams.get('bPage') || '1', 10));
  const facturaPage = Math.max(1, parseInt(searchParams.get('fPage') || '1', 10));
  const loanPage = Math.max(1, parseInt(searchParams.get('lPage') || '1', 10));
  const sellerFilter = searchParams.get('seller') || '';
  const clientFilter = searchParams.get('client') || '';
  const paymentMethodFilter = searchParams.get('paymentMethod') || '';
  const productFilter = searchParams.get('product') || '';
  const startDate = searchParams.get('startDate') || getMonthStart();
  const endDate = searchParams.get('endDate') || getToday();
  const loanStatusFilter = searchParams.get('loanStatus') || '';

  const setActiveTab = (v: 'sales' | 'boletas' | 'facturas' | 'loans') =>
    updateParams({ tab: v !== 'sales' ? v : null, page: null, bPage: null, fPage: null, lPage: null });
  const setPage = (p: number) => updateParams({ page: p > 1 ? String(p) : null });
  const setBoletaPage = (p: number) => updateParams({ bPage: p > 1 ? String(p) : null });
  const setFacturaPage = (p: number) => updateParams({ fPage: p > 1 ? String(p) : null });
  const setLoanPage = (p: number) => updateParams({ lPage: p > 1 ? String(p) : null });
  const setSellerFilter = (v: string) => updateParams({ seller: v || null, page: null, bPage: null, fPage: null });
  const setClientFilter = (v: string) => updateParams({ client: v || null, page: null, bPage: null, fPage: null });
  const setPaymentMethodFilter = (v: string) => updateParams({ paymentMethod: v || null, page: null, bPage: null, fPage: null });
  const setProductFilter = (v: string) => updateParams({ product: v || null, page: null, bPage: null, fPage: null });
  const setStartDate = (v: string) => updateParams({ startDate: v !== getMonthStart() ? v : null, page: null, bPage: null, fPage: null, lPage: null });
  const setEndDate = (v: string) => updateParams({ endDate: v !== getToday() ? v : null, page: null, bPage: null, fPage: null, lPage: null });
  const setLoanStatusFilter = (v: string) => updateParams({ loanStatus: v || null, lPage: null });
  const resetDateFilter = () => updateParams({ startDate: null, endDate: null, page: null, bPage: null, fPage: null, lPage: null });
  const selectedYear = Number((startDate || getToday()).slice(0, 4));
  const selectedMonth = Number((startDate || getToday()).slice(5, 7));
  const yearOptions = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i);
  const setDatePeriod = (year: number, month: number) => {
    const range = monthRange(year, month);
    updateParams({ startDate: range.start, endDate: range.end, page: null, bPage: null, fPage: null, lPage: null });
  };

  const effectiveSellerId = isSellerRole ? user?.id : (sellerFilter || undefined);
  const [showModal, setShowModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [viewingLoan, setViewingLoan] = useState<Loan | null>(null);
  const [returningLoan, setReturningLoan] = useState<Loan | null>(null);

  const { data, isLoading } = useSales({ page, limit: 50, clientId: clientFilter || undefined, startDate, endDate, sellerId: effectiveSellerId, excludeCancelled: 'true' });
  const { data: boletasData, isLoading: boletasLoading } = useSales({ page: boletaPage, limit: 50, clientId: clientFilter || undefined, startDate, endDate, voucherType: 'BOLETA', sellerId: effectiveSellerId, excludeCancelled: 'true' });
  const { data: facturasData, isLoading: facturasLoading } = useSales({ page: facturaPage, limit: 50, clientId: clientFilter || undefined, startDate, endDate, voucherType: 'FACTURA', sellerId: effectiveSellerId, excludeCancelled: 'true' });
  const { data: periodTotalsData } = useSales({ limit: 9999, clientId: clientFilter || undefined, startDate, endDate, sellerId: effectiveSellerId, excludeCancelled: 'true' });
  const { data: loansData, isLoading: loansLoading } = useLoans({ page: loanPage, limit: 10, status: loanStatusFilter || undefined, startDate, endDate });
  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 10000 });
  const { data: clientsData } = useClients({ limit: 9999 });
  const { data: priceTiers } = usePriceTiers();
  const { data: paymentMethodsData } = usePaymentMethods();
  const createSale = useCreateSale();
  const cancelSale = useCancelSale();
  const updateVoucher = useUpdateVoucher();
  const createLoan = useCreateLoan();
  const returnLoanItems = useReturnLoanItems();

  const openSaleId = searchParams.get('openSaleId');
  useEffect(() => {
    if (!openSaleId || viewingSale) return;
    const allSales: Sale[] = [
      ...(data?.data || []),
      ...(boletasData?.data || []),
      ...(facturasData?.data || []),
    ];
    const found = allSales.find((s) => s.id === openSaleId);
    if (found) {
      setViewingSale(found);
      const next = new URLSearchParams(searchParams);
      next.delete('openSaleId');
      setSearchParams(next, { replace: true });
    } else {
      // Sale not in current page; widen date range to current month and let user search
      saleService.getAll({ search: openSaleId, limit: 1 })
        .then((r: any) => {
          const list: Sale[] = r?.data || r || [];
          const sale = Array.isArray(list) ? list.find((s) => s.id === openSaleId) : undefined;
          if (sale) {
            setViewingSale(sale);
            const next = new URLSearchParams(searchParams);
            next.delete('openSaleId');
            setSearchParams(next, { replace: true });
          }
        })
        .catch(() => { /* ignore */ });
    }
  }, [openSaleId, data, boletasData, facturasData, viewingSale, searchParams, setSearchParams]);

  const activeCompanies: Company[] = (Array.isArray(companies) ? companies : []).filter((c: Company) => c.isActive);
  const stockQueries = useQueries({
    queries: activeCompanies.map((c) => ({
      queryKey: ['stock', c.id],
      queryFn: () => stockService.getByCompany(c.id, { limit: 9999 }),
      staleTime: 60_000,
    })),
  });
  const stockByCompany = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    activeCompanies.forEach((c, i) => {
      const raw = stockQueries[i]?.data;
      const stocks: Stock[] = Array.isArray(raw) ? raw : (raw as any)?.data || [];
      map[c.id] = new Set(stocks.filter(s => s.quantity > 0).map(s => s.productId));
    });
    return map;
  }, [activeCompanies, stockQueries]);

  const stockQtyByCompany = useMemo(() => {
    const map: Record<string, Map<string, number>> = {};
    activeCompanies.forEach((c, i) => {
      const raw = stockQueries[i]?.data;
      const stocks: Stock[] = Array.isArray(raw) ? raw : (raw as any)?.data || [];
      const inner = new Map<string, number>();
      stocks.forEach((s) => inner.set(s.productId, s.quantity));
      map[c.id] = inner;
    });
    return map;
  }, [activeCompanies, stockQueries]);

  const getProductsForCompany = (companyId: string): Product[] => {
    if (!companyId) return products;
    const productIds = stockByCompany[companyId];
    if (!productIds) return products;
    return products.filter((p: Product) => productIds.has(p.id));
  };


  const [cancellingsale, setCancellingSale] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [voucherPreview, setVoucherPreview] = useState<VoucherSnapshot | null>(null);
  const [successSale, setSuccessSale] = useState<VoucherSnapshot | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  const [form, setForm] = useState({
    clientId: '',
    voucherType: 'NONE' as string,
    paymentMode: '' as PaymentMode, // paymentMethodId, 'MIXED', or 'CREDIT'
    mixedPayments: [{ paymentMethodId: '', amount: 0 }] as PaymentSplit[],
    items: [{ productId: '', companyId: '', quantity: 0, priceTier: '', unitPrice: 0, subtotal: 0, isBonus: false }],
    currency: 'PEN' as 'PEN' | 'USD',
  });
  const { data: tipoCambioData } = useTodayTipoCambio(showModal && form.currency === 'USD');
  const exchangeRate = tipoCambioData?.venta || 3.41;

  const [loanForm, setLoanForm] = useState<{
    loanType: 'OUTGOING' | 'INCOMING';
    borrowerName: string;
    notes: string;
    items: { productId: string; companyId: string; quantity: number }[];
  }>({
    loanType: 'OUTGOING',
    borrowerName: '',
    notes: '',
    items: [{ productId: '', companyId: '', quantity: 0 }],
  });

  const [returnForm, setReturnForm] = useState<{ items: { productId: string; companyId: string; quantity: number; max: number }[]; notes: string }>({ items: [], notes: '' });

  const saleTotal = form.items.reduce((s, i) => s + i.subtotal, 0);
  const isCredit = form.paymentMode === 'CREDIT';
  const isMixed = form.paymentMode === 'MIXED';

  // Sale form handlers
  const openCreate = () => {
    const defaultMethodId = paymentMethods.length > 0 ? paymentMethods[0].id : '';
    setForm({
      clientId: '', voucherType: 'NONE', paymentMode: defaultMethodId,
      mixedPayments: [{ paymentMethodId: '', amount: 0 }],
      items: [{ productId: '', companyId: '', quantity: 0, priceTier: '', unitPrice: 0, subtotal: 0, isBonus: false }],
      currency: 'PEN',
    });
    setShowModal(true);
  };

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { productId: '', companyId: '', quantity: 0, priceTier: '', unitPrice: 0, subtotal: 0, isBonus: false }] }));
  const removeItem = (idx: number) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const getUnitPrice = (product: Product | undefined, tierId: string, companyId: string): number | undefined => {
    if (!product?.prices?.length) return undefined;
    const globalPrice = product.prices.find((p: ProductPrice) => p.priceTierId === tierId && !p.companyId);
    return globalPrice?.price;
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === 'isBonus') {
        if (value) {
          items[idx].unitPrice = 0;
          items[idx].subtotal = 0;
        } else {
          const item = items[idx];
          if (item.productId && item.priceTier && item.companyId) {
            const product = products.find((p: Product) => p.id === item.productId);
            const price = getUnitPrice(product, item.priceTier, item.companyId);
            if (price != null) {
              items[idx].unitPrice = price;
              items[idx].subtotal = item.quantity * price;
            }
          }
        }
        return { ...prev, items };
      }
      if (field === 'companyId') {
        const available = getProductsForCompany(value);
        if (!available.find(p => p.id === items[idx].productId)) {
          items[idx].productId = '';
          items[idx].unitPrice = 0;
          items[idx].subtotal = 0;
        }
      }
      const item = items[idx];
      if ((field === 'productId' || field === 'priceTier' || field === 'companyId') && item.productId && item.priceTier && item.companyId) {
        const product = products.find((p: Product) => p.id === item.productId);
        const price = getUnitPrice(product, item.priceTier, item.companyId);
        if (price != null && !item.isBonus) items[idx].unitPrice = price;
      }
      if (item.isBonus) {
        items[idx].unitPrice = 0;
        items[idx].subtotal = 0;
      } else {
        items[idx].subtotal = items[idx].quantity * items[idx].unitPrice;
      }
      return { ...prev, items };
    });
  };

  // Mixed payment split handlers
  const addPaymentSplit = () => {
    setForm(prev => {
      const usedAmount = prev.mixedPayments.reduce((s, p) => s + p.amount, 0);
      const remaining = Math.round((saleTotal - usedAmount) * 100) / 100;
      return { ...prev, mixedPayments: [...prev.mixedPayments, { paymentMethodId: '', amount: Math.max(0, remaining) }] };
    });
  };

  const removePaymentSplit = (idx: number) => {
    setForm(prev => {
      const mixedPayments = prev.mixedPayments.filter((_, i) => i !== idx);
      if (mixedPayments.length === 1) {
        mixedPayments[0] = { ...mixedPayments[0], amount: saleTotal };
      }
      return { ...prev, mixedPayments };
    });
  };

  const updatePayment = (idx: number, field: 'paymentMethodId' | 'amount', value: any) => {
    setForm(prev => {
      const mixedPayments = [...prev.mixedPayments];
      mixedPayments[idx] = { ...mixedPayments[idx], [field]: value };
      return { ...prev, mixedPayments };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isUsd = form.currency === 'USD';
    const payload: any = {
      clientId: form.clientId || undefined,
      voucherType: form.voucherType,
      isCredit,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      items: form.items.map(({ subtotal, isBonus, ...item }) => item),
      ...(isUsd ? { currency: 'USD', exchangeRate } : {}),
    };
    if (!isCredit) {
      if (isMixed) {
        payload.payments = form.mixedPayments.map(p => ({
          paymentMethodId: p.paymentMethodId,
          amount: p.amount,
        }));
      } else {
        // Single payment method — full total
        payload.payments = [{ paymentMethodId: form.paymentMode, amount: Math.round(saleTotal * 100) / 100 }];
      }
    }
    const saleResult = await createSale.mutateAsync(payload);
    setShowModal(false);

    // Construir snapshot para el modal de éxito
    const client = form.clientId ? clientMap.get(form.clientId) : undefined;
    const sellerUser = user;
    const snapshot: VoucherSnapshot = {
      id: saleResult?.id || '',
      voucherNumber: saleResult?.saleNumber,
      total: saleResult?.total ?? saleTotal,
      totalUsd: saleResult?.totalUsd,
      currency: form.currency !== 'PEN' ? form.currency : undefined,
      exchangeRate: isUsd ? exchangeRate : undefined,
      voucherType: form.voucherType as VoucherSnapshot['voucherType'],
      date: new Date(),
      items: form.items.map((item) => {
        const product = productMap.get(item.productId);
        const name = product?.name || item.productId;
        return {
          name: item.isBonus ? `${name} (Bonificación)` : name,
          quantity: item.quantity,
          unitPrice: item.isBonus ? 0 : item.unitPrice,
          subtotal: item.isBonus ? 0 : item.subtotal,
        };
      }),
      payments: isCredit ? [] : (isMixed
        ? form.mixedPayments.map((p) => ({
            methodName: paymentMethods.find((m) => m.id === p.paymentMethodId)?.name || '',
            amount: p.amount,
          }))
        : [{ methodName: paymentMethods.find((m) => m.id === form.paymentMode)?.name || '', amount: saleTotal }]
      ),
      isCredit,
      sellerName: sellerUser?.fullName || sellerUser?.username || 'Sin asignar',
      clientName: client?.name,
      clientPhone: client?.phone,
      clientLocation: resolveClientLocation(client),
    };
    setSuccessSale(snapshot);
  };

  // Loan form handlers
  const openLoanCreate = () => {
    setLoanForm({ loanType: 'OUTGOING', borrowerName: '', notes: '', items: [{ productId: '', companyId: '', quantity: 0 }] });
    setShowLoanModal(true);
  };

  const addLoanItem = () => setLoanForm(prev => ({ ...prev, items: [...prev.items, { productId: '', companyId: '', quantity: 0 }] }));
  const removeLoanItem = (idx: number) => setLoanForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const updateLoanItem = (idx: number, field: string, value: any) => {
    setLoanForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, items };
    });
  };

  const handleLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createLoan.mutateAsync(loanForm);
    setShowLoanModal(false);
  };

  // Return handlers
  const openReturn = (loan: Loan) => {
    setReturnForm({
      items: loan.items
        .filter(i => i.quantity - i.returnedQuantity > 0)
        .map(i => ({ productId: i.productId, companyId: i.companyId, quantity: 0, max: i.quantity - i.returnedQuantity })),
      notes: '',
    });
    setReturningLoan(loan);
  };

  const updateReturnItem = (idx: number, quantity: number) => {
    setReturnForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], quantity: Math.min(quantity, items[idx].max) };
      return { ...prev, items };
    });
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningLoan) return;
    const itemsToReturn = returnForm.items.filter(i => i.quantity > 0).map(({ max, ...item }) => item);
    if (itemsToReturn.length === 0) return;
    await returnLoanItems.mutateAsync({ loanId: returningLoan.id, data: { items: itemsToReturn, notes: returnForm.notes || undefined } });
    setReturningLoan(null);
  };

  const companyList = Array.isArray(companies) ? companies : [];
  const products = productsData?.data || [];
  const clients = clientsData?.data || [];
  const tiers = Array.isArray(priceTiers) ? priceTiers : [];
  const paymentMethods: PaymentMethod[] = Array.isArray(paymentMethodsData) ? paymentMethodsData.filter((m: PaymentMethod) => m.isActive) : [];

  // Client-side payment-method filter. When active, paginate locally on the
  // already-fetched periodTotalsData (limit 9999) instead of the per-page
  // server response, so the visible count and pagination match the filter.
  const matchesPaymentMethod = useMemo(() => (sale: Sale): boolean => {
    if (!paymentMethodFilter) return true;
    if (paymentMethodFilter === '__CREDIT__') return !!sale.isCredit;
    if (sale.isCredit) return false;
    return (sale.payments || []).some((p) => p.paymentMethodId === paymentMethodFilter);
  }, [paymentMethodFilter]);
  const isPaymentFilterActive = !!paymentMethodFilter;
  const matchesProduct = useMemo(() => (sale: Sale): boolean => {
    if (!productFilter) return true;
    return sale.items.some((item) => item.productId === productFilter);
  }, [productFilter]);
  const isProductFilterActive = !!productFilter;
  const isClientSideFilterActive = isPaymentFilterActive || isProductFilterActive;
  const PAGE_SIZE = 50;
  const periodSales: Sale[] = useMemo(
    () => (periodTotalsData?.data || []).filter(matchesPaymentMethod).filter(matchesProduct),
    [periodTotalsData, matchesPaymentMethod, matchesProduct]
  );
  const periodSalesBoletas = useMemo(() => periodSales.filter((s) => s.voucherType === 'BOLETA'), [periodSales]);
  const periodSalesFacturas = useMemo(() => periodSales.filter((s) => s.voucherType === 'FACTURA'), [periodSales]);
  const sales: Sale[] = isClientSideFilterActive
    ? periodSales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : (data?.data || []);
  const boletas: Sale[] = isClientSideFilterActive
    ? periodSalesBoletas.slice((boletaPage - 1) * PAGE_SIZE, boletaPage * PAGE_SIZE)
    : (boletasData?.data || []);
  const facturas: Sale[] = isClientSideFilterActive
    ? periodSalesFacturas.slice((facturaPage - 1) * PAGE_SIZE, facturaPage * PAGE_SIZE)
    : (facturasData?.data || []);
  const salesPaginationTotal = isClientSideFilterActive ? periodSales.length : (data?.total || 0);
  const boletasPaginationTotal = isClientSideFilterActive ? periodSalesBoletas.length : (boletasData?.total || 0);
  const facturasPaginationTotal = isClientSideFilterActive ? periodSalesFacturas.length : (facturasData?.total || 0);
  const loans = loansData?.data || [];
  const loansTotal = loansData?.total || 0;

  const companyMap = useMemo(() => new Map<string, Company>(companyList.map((c: Company) => [c.id, c])), [companyList]);
  const clientMap = useMemo(() => new Map<string, Client>(clients.map((c: Client) => [c.id, c])), [clients]);
  const productMap = useMemo(() => new Map<string, Product>(products.map((p: Product) => [p.id, p])), [products]);

  const getCompanyName = (id?: string) => id ? companyMap.get(id)?.name || 'N/A' : 'Mixta';
  const getClientName = (id?: string, nameFromSale?: string) =>
    nameFromSale || (id ? clientMap.get(id)?.name || id : 'Sin cliente');
  const getProductName = (id: string) => productMap.get(id)?.name || id;
  const getSellerName = (sale: Sale) => sale.sellerName
    || (sale.sellerId ? sellerNameById[sale.sellerId] : '')
    || (sale.createdBy ? userNameById[sale.createdBy] : '')
    || '—';

  const saleBaseById = useMemo(() => {
    const allSales: Sale[] = [...sales, ...boletas, ...facturas];
    const map = new Map<string, { base: number; igv: number }>();
    for (const sale of allSales) {
      const base = sale.items.reduce((sum: number, item: any) => {
        const product = productMap.get(item.productId);
        const taxType = product?.taxType || 'GRAVADO';
        const b = taxType === 'GRAVADO' ? (item.subtotal / 1.18) : item.subtotal;
        return sum + b;
      }, 0);
      const roundedBase = Math.round(base * 100) / 100;
      const igv = Math.round((sale.total - roundedBase) * 100) / 100;
      map.set(sale.id, { base: roundedBase, igv });
    }
    return map;
  }, [sales, boletas, facturas, productMap]);

  const getSaleBaseAmount = (sale: Sale) => {
    const cached = saleBaseById.get(sale.id);
    if (cached) return cached.base;
    const base = sale.items.reduce((sum: number, item: any) => {
      const product = productMap.get(item.productId);
      const taxType = product?.taxType || 'GRAVADO';
      const b = taxType === 'GRAVADO' ? (item.subtotal / 1.18) : item.subtotal;
      return sum + b;
    }, 0);
    return Math.round(base * 100) / 100;
  };

  const getSaleIgv = (sale: Sale) => {
    const cached = saleBaseById.get(sale.id);
    if (cached) return cached.igv;
    return Math.round((sale.total - getSaleBaseAmount(sale)) * 100) / 100;
  };

  const periodBoletas = periodSales.filter((s) => s.voucherType === 'BOLETA');
  const periodFacturas = periodSales.filter((s) => s.voucherType === 'FACTURA');
  // Cuando se filtra por un método de pago concreto, el "total" relevante es
  // sólo la porción de la venta cobrada con ese método (no el total de la
  // venta). Para crédito o sin filtro, vale el total completo.
  const isMethodPortionFilter = isPaymentFilterActive && paymentMethodFilter !== '__CREDIT__';
  const portionInFilter = (sale: Sale): number => {
    if (!isMethodPortionFilter) return sale.total;
    if (sale.isCredit) return 0;
    return Math.round(
      (sale.payments || [])
        .filter((p) => p.paymentMethodId === paymentMethodFilter)
        .reduce((s, p) => s + (p.amount || 0), 0) * 100,
    ) / 100;
  };
  const sumTotal = (arr: Sale[]) => Math.round(arr.reduce((s, sale) => s + portionInFilter(sale), 0) * 100) / 100;
  const sumBase = (arr: Sale[]) => Math.round(arr.reduce((s, sale) => s + getSaleBaseAmount(sale), 0) * 100) / 100;
  const sumIgv = (arr: Sale[]) => Math.round(arr.reduce((s, sale) => s + getSaleIgv(sale), 0) * 100) / 100;

  const total = periodSales.length;
  const totalAmount = sumTotal(periodSales);
  const totalAmountPen = sumTotal(periodSales.filter(s => s.currency !== 'USD'));
  const totalAmountUsd = Math.round(
    periodSales.filter(s => s.currency === 'USD').reduce((s, sale) => s + saleDispTotal(sale), 0) * 100,
  ) / 100;
  const contadoSales = periodSales.filter(s => !s.isCredit);
  const creditoSales = periodSales.filter(s => s.isCredit);
  const totalContadoPen = Math.round(contadoSales.filter(s => s.currency !== 'USD').reduce((acc, s) => acc + s.total, 0) * 100) / 100;
  const totalContadoUsd = Math.round(contadoSales.filter(s => s.currency === 'USD').reduce((acc, s) => acc + saleDispTotal(s), 0) * 100) / 100;
  const totalCreditoPen = Math.round(creditoSales.filter(s => s.currency !== 'USD').reduce((acc, s) => acc + s.total, 0) * 100) / 100;
  const totalCreditoUsd = Math.round(creditoSales.filter(s => s.currency === 'USD').reduce((acc, s) => acc + saleDispTotal(s), 0) * 100) / 100;
  const boletasTotal = periodBoletas.length;
  const boletasTotalAmount = sumTotal(periodBoletas);
  const boletasBaseAmount = sumBase(periodBoletas);
  const boletasIgv = sumIgv(periodBoletas);
  const facturasTotal = periodFacturas.length;
  const facturasTotalAmount = sumTotal(periodFacturas);
  const facturasBaseAmount = sumBase(periodFacturas);
  const facturasIgv = sumIgv(periodFacturas);


  const handleExportVouchers = async (voucherType: 'BOLETA' | 'FACTURA') => {
    try {
      const XLSX = await import('xlsx');
      const result = await saleService.getAll({ limit: 9999, startDate, endDate, voucherType, clientId: clientFilter || undefined, sellerId: effectiveSellerId || undefined });
      const allSales: Sale[] = (result?.data || []).filter(matchesPaymentMethod).filter(matchesProduct);
      if (allSales.length === 0) { toast.error('No hay datos para exportar'); return; }

      const rows = allSales.filter(s => !s.isCancelled).map(sale => {
        const companyIds = [...new Set(sale.items.map((i: any) => i.companyId))];
        const almacen = companyIds.length === 1 ? getCompanyName(companyIds[0]) : 'Mixto';
        const productosStr = sale.items.map((i: any) => `${getProductName(i.productId)} x${i.quantity}`).join(', ');
        const baseAmount = getSaleBaseAmount(sale);
        const igv = getSaleIgv(sale);
        const paymentLabel = sale.isCredit ? 'Crédito' : sale.payments?.map(p => p.paymentMethodName).join(' + ') || 'Efectivo';

        return {
          'Fecha': formatDateEs(sale.date),
          'Cliente': getClientName(sale.clientId, sale.clientName),
          'Almacén': almacen,
          'Productos': productosStr,
          'Valor Venta': Math.round(baseAmount * 100) / 100,
          'IGV': Math.round(igv * 100) / 100,
          'Total': Math.round(sale.total * 100) / 100,
          'Método de Pago': paymentLabel,
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      const sheetName = voucherType === 'BOLETA' ? 'Boletas' : 'Facturas';
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const prefix = voucherType === 'BOLETA' ? 'boletas' : 'facturas';
      const monthStr = startDate.slice(0, 7);
      XLSX.writeFile(wb, `${prefix}_${monthStr}.xlsx`);
      toast.success(`${rows.length} ${sheetName.toLowerCase()} exportada(s)`);
    } catch {
      toast.error('Error al exportar');
    }
  };


  const handleExportSales = async () => {
    try {
      if (periodSales.length === 0) { toast.error('No hay datos para exportar'); return; }
      const XLSX = await import('xlsx');

      const rows = periodSales.map((sale) => {
        const companyIds = [...new Set(sale.items.map((i: any) => i.companyId))];
        const almacen = companyIds.length === 1 ? getCompanyName(companyIds[0]) : 'Mixto';
        const productosStr = sale.items.map((i: any) => `${getProductName(i.productId)} x${i.quantity}`).join(', ');
        const paymentLabel = sale.isCredit ? 'Crédito' : sale.payments?.map(p => p.paymentMethodName).join(' + ') || 'Efectivo';

        return {
          'Fecha': formatDateEs(sale.date),
          'N°': sale.saleNumber || '',
          'Cliente': getClientName(sale.clientId, sale.clientName),
          'Vendedor': getSellerName(sale),
          'Almacén': almacen,
          'Productos': productosStr,
          'Tipo': sale.isCredit ? 'Crédito' : 'Contado',
          'Comprobante': sale.voucherType === 'BOLETA' ? 'Boleta' : sale.voucherType === 'FACTURA' ? 'Factura' : '-',
          'Método de Pago': paymentLabel,
          'Moneda': sale.currency || 'PEN',
          'Total': Math.round(saleDispTotal(sale) * 100) / 100,
          'Estado': sale.isCancelled ? 'Anulada' : 'Activa',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
      XLSX.writeFile(wb, `ventas_${startDate}_a_${endDate}.xlsx`);
      toast.success(`${rows.length} venta(s) exportada(s)`);
    } catch {
      toast.error('Error al exportar');
    }
  };

  const getPaymentLabel = (sale: Sale) => {
    if (sale.isCredit) return <span className="text-orange-600 font-medium">Crédito</span>;
    if (sale.payments && sale.payments.length > 0) {
      const label = sale.payments.map(p => p.paymentMethodName).join(' + ');
      return <span className="text-primary-600">{label}</span>;
    }
    return <span className="text-primary-600">Efectivo</span>;
  };

  const salesColumns = [
    { key: 'saleNumber', header: 'N°', render: (item: Sale) => <span className="font-mono text-xs text-gray-700">{item.saleNumber || `NV-${item.id.slice(-8).toUpperCase()}`}</span> },
    { key: 'date', header: 'Fecha', render: (item: Sale) => formatDateEs(item.date) },
    ...(!isSellerRole ? [{ key: 'sellerId', header: 'Vendedor', render: (item: Sale) => {
      const name = getSellerName(item);
      return name === '—' ? <span className="text-gray-300">—</span> : <span className="text-emerald-700">{name}</span>;
    }}] : []),
    { key: 'clientId', header: 'Cliente', render: (item: Sale) => (
      <div className="max-w-[130px] truncate">
        {item.clientId ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setClientHistoryId(item.clientId!); }}
            className="text-primary-700 hover:text-primary-900 hover:underline text-left truncate w-full"
            title={getClientName(item.clientId, item.clientName)}
          >
            {getClientName(item.clientId, item.clientName)}
          </button>
        ) : <span className="text-gray-400">Sin cliente</span>}
      </div>
    ) },
    { key: 'items', header: 'Items', render: (item: Sale) => `${item.items.length} producto(s)` },
    { key: 'total', header: isMethodPortionFilter ? 'Cobrado' : 'Total', render: (item: Sale) => {
      const sym = saleSym(item);
      const disp = saleDispTotal(item);
      if (item.isCancelled) return <span className="line-through text-gray-400">{sym} {disp.toFixed(2)}</span>;
      const portion = portionInFilter(item);
      const isPartial = isMethodPortionFilter && Math.abs(portion - item.total) > 0.005;
      return isPartial ? (
        <div className="leading-tight">
          <div className="font-medium">S/ {portion.toFixed(2)}</div>
          <div className="text-[10px] text-gray-400">de {sym} {disp.toFixed(2)}</div>
        </div>
      ) : `${sym} ${disp.toFixed(2)}`;
    }},
    { key: 'voucherType', header: 'Comprobante', render: (item: Sale) => {
      if (item.voucherType === 'BOLETA') return <span className="text-primary-600 font-medium">Boleta</span>;
      if (item.voucherType === 'FACTURA') return <span className="text-blue-600 font-medium">Factura</span>;
      return <span className="text-gray-400">-</span>;
    }},
    { key: 'payment', header: 'Pago', render: (item: Sale) => item.isCancelled ? <span className="text-red-600 font-medium">Anulada</span> : getPaymentLabel(item) },
    { key: 'actions', header: '', render: (item: Sale) => (
      <div className="flex items-center gap-2">
        <button onClick={(e) => { e.stopPropagation(); setViewingSale(item); }} className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-xs font-medium"><Eye size={15} /> Ver</button>
        {!item.isCancelled && (
          <button onClick={(e) => { e.stopPropagation(); setCancellingSale(item); setCancelReason(''); }} className="text-red-500 hover:text-red-700 flex items-center gap-1 text-xs font-medium"><XCircle size={15} /> Anular</button>
        )}
      </div>
    )},
  ];

  const voucherColumns = [
    { key: 'saleNumber', header: 'N°', render: (item: Sale) => <span className="font-mono text-xs text-gray-700">{item.saleNumber || `NV-${item.id.slice(-8).toUpperCase()}`}</span> },
    { key: 'date', header: 'Fecha', render: (item: Sale) => formatDateEs(item.date) },
    ...(!isSellerRole ? [{ key: 'sellerId', header: 'Vendedor', render: (item: Sale) => {
      const name = getSellerName(item);
      return name === '—' ? <span className="text-gray-300">—</span> : <span className="text-emerald-700">{name}</span>;
    }}] : []),
    { key: 'clientId', header: 'Cliente', render: (item: Sale) => (
      <div className="max-w-[130px] truncate">
        {item.clientId ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setClientHistoryId(item.clientId!); }}
            className="text-primary-700 hover:text-primary-900 hover:underline text-left truncate w-full"
            title={getClientName(item.clientId, item.clientName)}
          >
            {getClientName(item.clientId, item.clientName)}
          </button>
        ) : <span className="text-gray-400">Sin cliente</span>}
      </div>
    ) },
    { key: 'items', header: 'Items', render: (item: Sale) => `${item.items.length} producto(s)` },
    { key: 'baseAmount', header: 'Valor Venta', render: (item: Sale) => {
      const base = getSaleBaseAmount(item);
      return item.isCancelled ? <span className="line-through text-gray-400">S/ {base.toFixed(2)}</span> : `S/ ${base.toFixed(2)}`;
    }},
    { key: 'igv', header: 'IGV', render: (item: Sale) => {
      const igv = getSaleIgv(item);
      return item.isCancelled ? <span className="line-through text-gray-400">S/ {igv.toFixed(2)}</span> : igv > 0 ? <span className="text-orange-600">S/ {igv.toFixed(2)}</span> : <span className="text-gray-400">S/ 0.00</span>;
    }},
    { key: 'total', header: isMethodPortionFilter ? 'Cobrado' : 'Total', render: (item: Sale) => {
      const sym = saleSym(item);
      const disp = saleDispTotal(item);
      if (item.isCancelled) return <span className="line-through text-gray-400">{sym} {disp.toFixed(2)}</span>;
      const portion = portionInFilter(item);
      const isPartial = isMethodPortionFilter && Math.abs(portion - item.total) > 0.005;
      return isPartial ? (
        <div className="leading-tight">
          <div className="font-medium">S/ {portion.toFixed(2)}</div>
          <div className="text-[10px] text-gray-400">de {sym} {disp.toFixed(2)}</div>
        </div>
      ) : <span className="font-medium">{sym} {disp.toFixed(2)}</span>;
    }},
    { key: 'payment', header: 'Pago', render: (item: Sale) => item.isCancelled ? <span className="text-red-600 font-medium">Anulada</span> : getPaymentLabel(item) },
    { key: 'actions', header: '', render: (item: Sale) => (
      <div className="flex items-center gap-2">
        <button onClick={(e) => { e.stopPropagation(); setViewingSale(item); }} className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-xs font-medium"><Eye size={15} /> Ver</button>
        {!item.isCancelled && (
          <button onClick={(e) => { e.stopPropagation(); setCancellingSale(item); setCancelReason(''); }} className="text-red-500 hover:text-red-700 flex items-center gap-1 text-xs font-medium"><XCircle size={15} /> Anular</button>
        )}
      </div>
    )},
  ];

  const loanStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: 'bg-blue-100 text-blue-700',
      PARTIAL: 'bg-yellow-100 text-yellow-700',
      RETURNED: 'bg-primary-100 text-primary-700',
    };
    const labels: Record<string, string> = { ACTIVE: 'Activo', PARTIAL: 'Parcial', RETURNED: 'Devuelto' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || ''}`}>{labels[status] || status}</span>;
  };

  const loanTypeBadge = (loanType?: string) => loanType === 'INCOMING'
    ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">← Pedimos</span>
    : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">→ Prestamos</span>;

  const loanColumns = [
    { key: 'date', header: 'Fecha', render: (item: Loan) => formatDateEs(item.date) },
    { key: 'loanType', header: 'Tipo', render: (item: Loan) => loanTypeBadge(item.loanType) },
    { key: 'borrowerName', header: 'Tienda', render: (item: Loan) => item.borrowerName },
    { key: 'items', header: 'Productos', render: (item: Loan) => item.items.map(i => `${getProductName(i.productId)} x${i.quantity}`).join(', ') },
    { key: 'status', header: 'Estado', render: (item: Loan) => loanStatusBadge(item.status) },
    { key: 'actions', header: '', render: (item: Loan) => (
      <div className="flex items-center gap-2">
        <button onClick={(e) => { e.stopPropagation(); setViewingLoan(item); }} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs font-medium"><Eye size={15} /> Ver</button>
        {item.status !== 'RETURNED' && (
          <button onClick={(e) => { e.stopPropagation(); openReturn(item); }} className="text-purple-600 hover:text-purple-800 flex items-center gap-1 text-xs font-medium"><RotateCcw size={15} /> Devolver</button>
        )}
      </div>
    )},
  ];

  const mixedSumValid = !isMixed || (
    Math.round(form.mixedPayments.reduce((s, p) => s + p.amount, 0) * 100) / 100 === Math.round(saleTotal * 100) / 100
  );
  const paymentValid = isCredit || (form.paymentMode !== '' && (isMixed ? mixedSumValid : true));

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buenos días,' : hour < 19 ? 'Buenas tardes,' : 'Buenas noches,';
  const sellerFirstName = (user?.fullName || user?.username || '').split(' ')[0] || 'Vendedor';
  const formattedToday = now.toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div>
      {isSellerRole && (
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary-600 via-primary-500 to-orange-400 px-5 py-5 sm:px-7 sm:py-6 text-white shadow-card-hover">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium text-white/85">{greeting}</div>
              <h2 className="text-2xl sm:text-3xl font-bold mt-0.5 truncate">{sellerFirstName}</h2>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-white/90">
              <CalendarDays size={16} />
              <span className="capitalize">{formattedToday}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Receipt size={24} /> {isSellerRole ? 'Mis Ventas' : 'Ventas'}</h1>
        {!isSellerRole && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={openLoanCreate} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              <HandshakeIcon size={18} /> Préstamo
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              <Plus size={18} /> Nueva Venta
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {!isSellerRole && (activeTab === 'sales' || activeTab === 'boletas' || activeTab === 'facturas') && sellers.length > 0 && (
          <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            <option value="">Responsables</option>
            {sellers.map((s: any) => <option key={s.id} value={s.id}>{(s.fullName || s.username) + (s.role === 'ADMIN' ? ' (Admin)' : '')}</option>)}
          </select>
        )}
        {(activeTab === 'sales' || activeTab === 'boletas' || activeTab === 'facturas') && (
          <div className="min-w-[220px] flex items-center gap-1">
            <div className="flex-1">
              <SearchableSelect
                options={clients.map((c: Client) => ({ value: c.id, label: c.name, sublabel: c.documentNumber }))}
                value={clientFilter}
                onChange={(v) => setClientFilter(v)}
                placeholder="Buscar cliente..."
                minChars={1}
              />
            </div>
            {clientFilter && (
              <button
                type="button"
                onClick={() => setClientFilter('')}
                title="Limpiar cliente"
                className="px-2 py-2 text-gray-500 hover:text-gray-800"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
        {(activeTab === 'sales' || activeTab === 'boletas' || activeTab === 'facturas') && (
          <div className="min-w-[220px] flex items-center gap-1">
            <div className="flex-1">
              <SearchableSelect
                options={products.map((p: Product) => ({ value: p.id, label: p.name }))}
                value={productFilter}
                onChange={(v) => setProductFilter(v)}
                placeholder="Buscar producto..."
                minChars={1}
              />
            </div>
            {productFilter && (
              <button
                type="button"
                onClick={() => setProductFilter('')}
                title="Limpiar producto"
                className="px-2 py-2 text-gray-500 hover:text-gray-800"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
        {(activeTab === 'sales' || activeTab === 'boletas' || activeTab === 'facturas') && paymentMethods.length > 0 && (
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">Métodos de Pago</option>
            <option value="__CREDIT__">Crédito</option>
            {paymentMethods.map((m: PaymentMethod) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
        {activeTab === 'loans' && (
          <select value={loanStatusFilter} onChange={(e) => setLoanStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activo</option>
            <option value="PARTIAL">Parcial</option>
            <option value="RETURNED">Devuelto</option>
          </select>
        )}
        <select
          value={selectedYear}
          onChange={(e) => setDatePeriod(Number(e.target.value), selectedMonth)}
          className="px-3 py-2 border rounded-lg text-sm bg-white"
          title="Año"
        >
          {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
        <select
          value={selectedMonth}
          onChange={(e) => setDatePeriod(selectedYear, Number(e.target.value))}
          className="px-3 py-2 border rounded-lg text-sm bg-white"
          title="Mes"
        >
          <option value={1}>Enero</option>
          <option value={2}>Febrero</option>
          <option value={3}>Marzo</option>
          <option value={4}>Abril</option>
          <option value={5}>Mayo</option>
          <option value={6}>Junio</option>
          <option value={7}>Julio</option>
          <option value={8}>Agosto</option>
          <option value={9}>Septiembre</option>
          <option value={10}>Octubre</option>
          <option value={11}>Noviembre</option>
          <option value={12}>Diciembre</option>
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border rounded-lg text-sm min-w-[150px]" aria-label="Desde" />
        <span className="text-gray-500 text-sm">hasta</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border rounded-lg text-sm min-w-[150px]" aria-label="Hasta" />
        {(startDate !== getMonthStart() || endDate !== getToday()) && (
          <button onClick={resetDateFilter} className="flex items-center gap-1 px-3 py-2 text-sm text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100">
            <CalendarDays size={14} /> Este mes
          </button>
        )}
      </div>

      {/* Total del período */}
      {activeTab === 'sales' && (() => {
        const filterMethodName = isMethodPortionFilter
          ? (paymentMethods.find((m) => m.id === paymentMethodFilter)?.name || '')
          : '';
        const fullPeriodTotal = periodSales.reduce((s, sale) => s + sale.total, 0);
        const showSplit = isMethodPortionFilter && Math.abs(fullPeriodTotal - totalAmount) > 0.005;
        return (
          <div className="mb-4 bg-primary-50 border border-primary-200 rounded-lg px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-primary-700">{total} venta(s) en el período</span>
              <button onClick={handleExportSales} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-700 bg-primary-100 border border-primary-300 rounded hover:bg-primary-200 transition-colors">
                <Download size={14} /> Excel
              </button>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-primary-700">
                {filterMethodName ? `Cobrado en ${filterMethodName}: ` : 'Total: '}
                S/ {(filterMethodName ? totalAmount : totalAmountPen).toFixed(2)}
                {showSplit && (
                  <span className="ml-2 text-xs font-medium text-primary-600/70">
                    (de S/ {fullPeriodTotal.toFixed(2)} en ventas)
                  </span>
                )}
              </div>
              {!filterMethodName && totalAmountUsd > 0 && (
                <div className="text-sm font-semibold text-emerald-600">+ $ {totalAmountUsd.toFixed(2)} USD</div>
              )}
              <div className="flex gap-4 justify-end mt-1">
                <span className="text-xs text-gray-600">
                  Contado: <span className="font-semibold text-gray-800">S/ {totalContadoPen.toFixed(2)}</span>
                  {totalContadoUsd > 0 && <span className="text-emerald-600 ml-1">+ $ {totalContadoUsd.toFixed(2)}</span>}
                </span>
                <span className="text-xs text-gray-600">
                  Crédito: <span className="font-semibold text-purple-700">S/ {totalCreditoPen.toFixed(2)}</span>
                  {totalCreditoUsd > 0 && <span className="text-emerald-600 ml-1">+ $ {totalCreditoUsd.toFixed(2)}</span>}
                </span>
              </div>
            </div>
          </div>
        );
      })()}
      {activeTab === 'boletas' && (
        <div className="mb-4 bg-primary-50 border border-primary-200 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-primary-700">{boletasTotal} boleta(s) en el período</span>
          <button onClick={() => handleExportVouchers('BOLETA')} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-700 bg-primary-100 border border-primary-300 rounded hover:bg-primary-200 transition-colors">
            <Download size={14} /> Excel
          </button>
        </div>
      )}
      {activeTab === 'facturas' && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-blue-700">{facturasTotal} factura(s) en el período</span>
          <button onClick={() => handleExportVouchers('FACTURA')} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded hover:bg-blue-200 transition-colors">
            <Download size={14} /> Excel
          </button>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex border-b mb-4">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sales' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Ventas
        </button>
        <button
          onClick={() => setActiveTab('boletas')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'boletas' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Boletas
        </button>
        <button
          onClick={() => setActiveTab('facturas')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'facturas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Facturas
        </button>
        <button
          onClick={() => setActiveTab('loans')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'loans' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Préstamos
        </button>
      </div>

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <>
          <DataTable columns={salesColumns} data={sales} isLoading={isLoading} rowClassName={(sale: Sale) => sale?.isCancelled ? 'bg-red-50 opacity-60' : sale?.isCredit ? 'hover:bg-yellow-50' : 'hover:bg-primary-50'} />
          <Pagination page={page} totalPages={Math.ceil(salesPaginationTotal / 50)} onPageChange={setPage} />
        </>
      )}

      {/* Boletas Tab */}
      {activeTab === 'boletas' && (
        <>
          <DataTable columns={voucherColumns} data={boletas} isLoading={boletasLoading} rowClassName={(sale: Sale) => sale?.isCancelled ? 'bg-red-50 opacity-60' : sale?.isCredit ? 'hover:bg-yellow-50' : 'hover:bg-primary-50'} />
          <Pagination page={boletaPage} totalPages={Math.ceil(boletasPaginationTotal / 50)} onPageChange={setBoletaPage} />
        </>
      )}

      {/* Facturas Tab */}
      {activeTab === 'facturas' && (
        <>
          <DataTable columns={voucherColumns} data={facturas} isLoading={facturasLoading} rowClassName={(sale: Sale) => sale?.isCancelled ? 'bg-red-50 opacity-60' : sale?.isCredit ? 'hover:bg-yellow-50' : 'hover:bg-blue-50'} />
          <Pagination page={facturaPage} totalPages={Math.ceil(facturasPaginationTotal / 50)} onPageChange={setFacturaPage} />
        </>
      )}

      {/* Loans Tab */}
      {activeTab === 'loans' && (
        <>
          <DataTable columns={loanColumns} data={loans} isLoading={loansLoading} rowClassName={(loan: Loan) => loan.status === 'RETURNED' ? 'hover:bg-primary-50' : 'hover:bg-purple-50'} />
          <Pagination page={loanPage} totalPages={Math.ceil(loansTotal / 10)} onPageChange={setLoanPage} />
        </>
      )}

      {/* Modal crear venta */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Venta" size="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Moneda */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Moneda</label>
            <div className="flex gap-2 items-center">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setForm({ ...form, currency: 'PEN' })}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.currency === 'PEN' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                S/ Soles
              </button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setForm({ ...form, currency: 'USD' })}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.currency === 'USD' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                $ USD
              </button>
            </div>
          </div>

          {/* Método de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago</label>
            {paymentMethods.length === 0 ? (
              <div className="text-sm text-gray-400 py-2">Cargando métodos de pago...</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {paymentMethods.map((m: PaymentMethod) => (
                  <button key={m.id} type="button" onClick={() => setForm({ ...form, paymentMode: m.id })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.paymentMode === m.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                    {m.name}
                  </button>
                ))}
                <button type="button" onClick={() => setForm({ ...form, paymentMode: 'MIXED', mixedPayments: [{ paymentMethodId: '', amount: 0 }, { paymentMethodId: '', amount: 0 }] })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${isMixed ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  Mixto
                </button>
                <button type="button" onClick={() => setForm({ ...form, paymentMode: 'CREDIT' })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${isCredit ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  Crédito
                </button>
              </div>
            )}
          </div>

          {/* Mixed payment split (solo si es Mixto) */}
          {isMixed && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-blue-800">Dividir pago</label>
                <button type="button" onClick={addPaymentSplit} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Agregar método</button>
              </div>
              <div className="space-y-2">
                {form.mixedPayments.map((payment, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={payment.paymentMethodId}
                      onChange={(e) => updatePayment(idx, 'paymentMethodId', e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                      required
                    >
                      <option value="">Seleccionar método...</option>
                      {paymentMethods.map((m: PaymentMethod) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <div className="relative w-32">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">{form.currency === 'USD' ? '$' : 'S/'}</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={payment.amount || ''}
                        onChange={(e) => updatePayment(idx, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full pl-7 pr-2 py-2 border rounded-lg text-sm"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    {form.mixedPayments.length > 2 && (
                      <button type="button" onClick={() => removePaymentSplit(idx)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!mixedSumValid && saleTotal > 0 && (
                <p className="text-xs text-red-500 mt-2">
                  La suma ({form.currency === 'USD' ? '$' : 'S/'} {form.mixedPayments.reduce((s, p) => s + p.amount, 0).toFixed(2)}) debe ser igual al total ({form.currency === 'USD' ? '$' : 'S/'} {saleTotal.toFixed(2)})
                </p>
              )}
            </div>
          )}

          {/* Cliente y Boleta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente {isCredit ? '(obligatorio)' : '(opcional)'}</label>
              <SearchableSelect
                options={clients.map((c: Client) => ({ value: c.id, label: c.name, sublabel: c.documentNumber }))}
                value={form.clientId}
                onChange={(v) => setForm(prev => ({ ...prev, clientId: v }))}
                placeholder={isCredit ? 'Buscar cliente (obligatorio)...' : 'Buscar cliente (opcional)...'}
                required={isCredit}
                minChars={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comprobante</label>
              <div className="flex gap-1">
                {[{ value: 'NONE', label: 'No' }, { value: 'BOLETA', label: 'Boleta' }, { value: 'FACTURA', label: 'Factura' }].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setForm({ ...form, voucherType: opt.value })}
                    className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${form.voucherType === opt.value
                      ? opt.value === 'BOLETA' ? 'bg-primary-600 text-white border-primary-600' : opt.value === 'FACTURA' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-600 text-white border-gray-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Productos</label>
              <button type="button" onClick={addItem} className="text-sm text-primary-600 hover:text-primary-800 font-medium">+ Agregar producto</button>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {form.items.map((item, idx) => (
                <div key={idx} className={`rounded-lg p-3 relative ${item.isBonus ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => updateItem(idx, 'isBonus', !item.isBonus)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${item.isBonus ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
                    >
                      {item.isBonus ? '🎁 Bonificación' : 'Bonificación'}
                    </button>
                    {form.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Almacén</label>
                      <select value={item.companyId} onChange={(e) => updateItem(idx, 'companyId', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm bg-white" required>
                        <option value="">Seleccionar...</option>
                        {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Producto</label>
                      <SearchableSelect
                        options={getProductsForCompany(item.companyId).map((p: Product) => ({ value: p.id, label: p.name, sublabel: p.activeIngredient }))}
                        value={item.productId}
                        onChange={(v) => updateItem(idx, 'productId', v)}
                        placeholder={item.companyId ? "Buscar producto o ingrediente..." : "Selecciona almacén primero"}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Rango precio</label>
                      <select value={item.priceTier} onChange={(e) => updateItem(idx, 'priceTier', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm bg-white" required>
                        <option value="">Seleccionar...</option>
                        {tiers.map((t: PriceTier) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                      <input type="number" min="0.01" step="0.01" value={item.quantity || ''} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 border rounded text-sm" required />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Precio unit.</label>
                      {item.isBonus ? (
                        <div className="px-2 py-1.5 bg-amber-100 border border-amber-200 rounded text-sm font-medium text-amber-700">Gratis</div>
                      ) : (
                        <input type="number" min="0.01" step="0.01" value={item.unitPrice || ''} onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 border rounded text-sm" required />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Subtotal</label>
                      <div className={`px-2 py-1.5 border rounded text-sm font-medium ${item.isBonus ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-white text-gray-700'}`}>
                        {item.isBonus ? 'S/ 0.00' : `${form.currency === 'USD' ? '$' : 'S/'} ${item.subtotal.toFixed(2)}`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total y Submit */}
          <div className="bg-primary-50 p-3 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium text-primary-800">Total de la venta</span>
            <span className="text-xl font-bold text-primary-700">{form.currency === 'USD' ? '$' : 'S/'} {saleTotal.toFixed(2)}</span>
          </div>
          <button type="submit" disabled={createSale.isPending || !paymentValid} className="w-full py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50">
            {createSale.isPending ? 'Registrando...' : 'Registrar Venta'}
          </button>
        </form>
      </Modal>

      {/* Modal detalle de venta */}
      {viewingSale && (() => {
        const sale = viewingSale;
        const baseImponible = getSaleBaseAmount(sale);
        const igv = getSaleIgv(sale);
        const paymentLabel = sale.isCredit
          ? 'Crédito'
          : sale.payments && sale.payments.length > 0
            ? sale.payments.map((p) => p.paymentMethodName).join(' + ')
            : 'Efectivo';
        const voucherLabel = sale.voucherType === 'BOLETA' ? 'Boleta' : sale.voucherType === 'FACTURA' ? 'Factura' : 'Nota de venta';
        const client = sale.clientId ? clientMap.get(sale.clientId) : undefined;
        const sellerName = sale.sellerName
          || (sale.sellerId ? sellerNameById[sale.sellerId] : '')
          || (sale.createdBy ? userNameById[sale.createdBy] : '')
          || 'Sin asignar';
        const openVoucherPreview = () => {
          setVoucherPreview({
            id: sale.id,
            total: sale.total,
            voucherType: sale.voucherType,
            date: new Date(sale.date),
            items: sale.items.map((it) => ({
              name: productMap.get(it.productId)?.name || it.productId,
              quantity: it.quantity,
              unitPrice: itemDispPrice(sale, it),
              subtotal: itemDispSub(sale, it),
            })),
            payments: (sale.payments || []).map((p) => ({
              methodName: p.paymentMethodName,
              amount: sale.currency === 'USD' && p.amountUsd != null ? p.amountUsd : p.amount,
            })),
            isCredit: sale.isCredit,
            sellerName,
            clientName: client?.name,
            clientDocument: client?.documentNumber,
            clientPhone: client?.phone,
            clientLocation: resolveClientLocation(client),
            igv,
            baseImponible,
            voucherNumber: sale.saleNumber,
            currency: sale.currency !== 'PEN' ? sale.currency : undefined,
            exchangeRate: sale.exchangeRate,
            totalUsd: sale.totalUsd,
          });
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setViewingSale(null)} />
            <div className="relative bg-white rounded-2xl shadow-card-hover w-full max-w-xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
                    <Receipt size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Detalle de venta</h2>
                    <p className="text-xs text-gray-500 font-mono">{sale.saleNumber || `NV-${sale.id.slice(-8).toUpperCase()}`}</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingSale(null)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
                {/* Total + desglose para venta a crédito */}
                {(() => {
                  const isUsd = sale.currency === 'USD';
                  const sym = saleSym(sale);
                  const totalDisplay = saleDispTotal(sale);
                  const anticipo = sale.isCredit
                    ? (sale.payments || []).reduce((s: number, p: any) => s + (isUsd && p.amountUsd != null ? p.amountUsd : (p.amount || 0)), 0)
                    : totalDisplay;
                  const pendienteCredito = sale.isCredit ? Math.max(0, totalDisplay - anticipo) : 0;
                  return (
                    <div className={`rounded-xl p-4 border ${sale.isCancelled ? 'bg-red-50 border-red-100' : sale.isCredit ? 'bg-orange-50/60 border-orange-100' : 'bg-primary-50/60 border-primary-100'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className={`text-xs font-semibold uppercase tracking-wide ${sale.isCancelled ? 'text-red-600' : sale.isCredit ? 'text-orange-700' : 'text-primary-700'}`}>
                            {sale.isCredit ? 'Total de la venta' : 'Total cobrado'}
                          </span>
                          <div className={`text-3xl font-bold mt-1 ${sale.isCancelled ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                            {saleSym(sale)} {saleDispTotal(sale).toFixed(2)}
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${sale.isCancelled ? 'bg-red-100 text-red-700' : sale.isCredit ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                          {sale.isCancelled ? 'Anulada' : sale.isCredit ? 'A crédito' : 'Completada'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {formatDateEs(sale.date, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {' · '}
                        {new Date(sale.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}
                      </div>
                      {sale.isCancelled && sale.cancelReason && (
                        <p className="text-xs text-red-600 mt-2">Razón: {sale.cancelReason}</p>
                      )}
                      {sale.isCredit && !sale.isCancelled && (
                        <div className="mt-3 pt-3 border-t border-orange-200/70 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="block text-[10px] uppercase tracking-wider text-orange-700/80 font-semibold">Cobrado en caja</span>
                            <div className="font-bold text-primary-700 tabular-nums">{sym} {anticipo.toFixed(2)}</div>
                          </div>
                          <div>
                            <span className="block text-[10px] uppercase tracking-wider text-orange-700/80 font-semibold">Saldo a crédito</span>
                            <div className="font-bold text-red-600 tabular-nums">{sym} {pendienteCredito.toFixed(2)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Comprobante + Método de pago */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-gray-200 rounded-xl p-3">
                    <span className="block text-xs text-gray-500 mb-1.5">Comprobante</span>
                    {sale.isCancelled ? (
                      <div className="text-sm font-medium text-gray-900">{voucherLabel}</div>
                    ) : (
                      <div className="flex gap-1">
                        {([['NONE', 'No'], ['BOLETA', 'Boleta'], ['FACTURA', 'Factura']] as const).map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                              sale.voucherType === val
                                ? val === 'BOLETA'
                                  ? 'bg-primary-600 text-white'
                                  : val === 'FACTURA'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            disabled={updateVoucher.isPending}
                            onClick={() => {
                              if (sale.voucherType !== val) {
                                updateVoucher.mutate(
                                  { id: sale.id, voucherType: val },
                                  { onSuccess: () => setViewingSale({ ...sale, voucherType: val }) },
                                );
                              }
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-xl p-3">
                    <span className="block text-xs text-gray-500 mb-1.5">Método de pago</span>
                    <div className={`text-sm font-medium ${sale.isCredit ? 'text-orange-600' : 'text-gray-900'}`}>
                      {paymentLabel}
                    </div>
                  </div>
                </div>

                {/* Cliente + Vendedor */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-gray-200 rounded-xl p-3">
                    <span className="block text-xs text-gray-500 mb-0.5">Cliente</span>
                    <div className="text-sm font-medium text-gray-900 truncate">{getClientName(sale.clientId, sale.clientName)}</div>
                    {sale.clientId && clientMap.get(sale.clientId)?.documentNumber && (
                      <div className="text-xs text-gray-500 mt-0.5">{clientMap.get(sale.clientId)?.documentNumber}</div>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-xl p-3">
                    <span className="block text-xs text-gray-500 mb-0.5">R. de Venta</span>
                    <div className="text-sm font-medium text-gray-900 truncate">{getSellerName(sale)}</div>
                  </div>
                </div>

                {/* Desglose de pagos (solo si hay más de uno) */}
                {!sale.isCredit && sale.payments && sale.payments.length > 1 && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Desglose de pagos
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-gray-100">
                        {sale.payments.map((payment, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 font-medium text-gray-700">{payment.paymentMethodName}</td>
                            <td className="px-4 py-2 text-right text-primary-600 font-medium">
                              S/ {payment.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Productos */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Productos · {sale.items.length}
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-2 text-left font-medium">Producto</th>
                        <th className="px-2 py-2 text-right font-medium">Cant.</th>
                        <th className="px-2 py-2 text-right font-medium">P. Unit.</th>
                        <th className="px-4 py-2 text-right font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sale.items.map((item, idx) => {
                        const product = productMap.get(item.productId);
                        const company = companyMap.get(item.companyId);
                        const tier = tiers.find((t: PriceTier) => t.id === item.priceTier);
                        return (
                          <tr key={idx}>
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-gray-900">{product?.name || item.productId}</div>
                              <div className="text-xs text-gray-400">
                                {[company?.name, tier?.name].filter(Boolean).join(' · ') || ''}
                              </div>
                            </td>
                            <td className="px-2 py-2.5 text-right text-gray-700">{item.quantity}</td>
                            <td className="px-2 py-2.5 text-right text-gray-500">{saleSym(sale)} {itemDispPrice(sale, item).toFixed(2)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{saleSym(sale)} {itemDispSub(sale, item).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Subtotal / IGV / Total */}
                <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="text-gray-900">{saleSym(sale)} {baseImponible.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">IGV</span>
                    <span className="text-gray-900">{saleSym(sale)} {igv.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-base font-semibold text-gray-900">Total</span>
                    <span className="text-lg font-bold text-primary-600">{saleSym(sale)} {saleDispTotal(sale).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
                <button
                  type="button"
                  onClick={openVoucherPreview}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors text-sm font-semibold"
                >
                  <FileText size={16} /> Ver comprobante
                </button>
                {!sale.isCancelled && user?.role === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => { setEditingSale(sale); setViewingSale(null); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors text-sm font-semibold"
                  >
                    Editar items
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingSale(null)}
                  className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal editar items (solo ADMIN, ventas NONE no anuladas) */}
      <EditSaleItemsModal
        sale={editingSale}
        onClose={() => setEditingSale(null)}
        products={products}
        companies={activeCompanies}
        priceTiers={Array.isArray(priceTiers) ? priceTiers : []}
        paymentMethods={paymentMethods}
        stockByCompanyMap={stockQtyByCompany}
      />

      {/* Modal éxito post-venta */}
      {successSale && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setSuccessSale(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header verde */}
            <div className="relative bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 text-white px-8 pt-8 pb-7 text-center overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full" />
              <div className="absolute -bottom-12 -left-8 w-28 h-28 bg-white/10 rounded-full" />
              <button
                type="button"
                onClick={() => setSuccessSale(null)}
                className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors"
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
                </button>
                <button
                  type="button"
                  onClick={() => { setSuccessSale(null); openCreate(); }}
                  className="flex flex-col items-center gap-1 px-3 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm"
                >
                  <Plus size={18} />
                  <span className="text-sm font-semibold">Nueva venta</span>
                </button>
              </div>
              <p className="text-xs text-gray-400 pt-1">Haz clic fuera para cerrar</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal vista previa del comprobante */}
      <VoucherPreviewModal sale={voucherPreview} onClose={() => setVoucherPreview(null)} />

      {/* Modal crear préstamo */}
      <Modal isOpen={showLoanModal} onClose={() => setShowLoanModal(false)} title="Nuevo Préstamo" size="lg">
        <form onSubmit={handleLoanSubmit} className="space-y-5 pb-4">
          {/* Dirección del préstamo */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLoanForm(prev => ({ ...prev, loanType: 'OUTGOING' }))}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${loanForm.loanType === 'OUTGOING' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}
            >
              → Prestamos a otra tienda
            </button>
            <button
              type="button"
              onClick={() => setLoanForm(prev => ({ ...prev, loanType: 'INCOMING' }))}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${loanForm.loanType === 'INCOMING' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}
            >
              ← Pedimos a otra tienda
            </button>
          </div>
          <div className={`rounded-lg px-3 py-2 text-xs ${loanForm.loanType === 'INCOMING' ? 'bg-orange-50 text-orange-700' : 'bg-purple-50 text-purple-700'}`}>
            {loanForm.loanType === 'INCOMING'
              ? 'El stock de tu almacén aumenta al registrar. Al devolver, el stock disminuye.'
              : 'El stock de tu almacén disminuye al registrar. Al devolver, el stock aumenta.'}
          </div>

          {/* Tienda (obligatorio) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {loanForm.loanType === 'INCOMING' ? 'Tienda que nos presta (obligatorio)' : 'Tienda que recibe (obligatorio)'}
            </label>
            <input type="text" value={loanForm.borrowerName} onChange={(e) => setLoanForm({ ...loanForm, borrowerName: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Ej: Tienda Don Juan, Ferretería El Sol..." required />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Productos</label>
              <button type="button" onClick={addLoanItem} className="text-sm text-purple-600 hover:text-purple-800 font-medium">+ Agregar producto</button>
            </div>
            <div className="space-y-3">
              {loanForm.items.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 relative">
                  {loanForm.items.length > 1 && (
                    <button type="button" onClick={() => removeLoanItem(idx)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Almacén</label>
                      <select value={item.companyId} onChange={(e) => updateLoanItem(idx, 'companyId', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm bg-white" required>
                        <option value="">Seleccionar...</option>
                        {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Producto</label>
                      <SearchableSelect
                        options={products.map((p: Product) => ({ value: p.id, label: p.name }))}
                        value={item.productId}
                        onChange={(v) => updateLoanItem(idx, 'productId', v)}
                        placeholder="Buscar producto..."
                        minChars={1}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                      <input type="number" min="0.01" step="0.01" value={item.quantity || ''} onChange={(e) => updateLoanItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 border rounded text-sm" required />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea value={loanForm.notes} onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Notas adicionales..." />
          </div>

          <button type="submit" disabled={createLoan.isPending} className="w-full py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
            {createLoan.isPending ? 'Registrando...' : 'Registrar Préstamo'}
          </button>
        </form>
      </Modal>

      {/* Modal detalle de préstamo */}
      <Modal isOpen={!!viewingLoan} onClose={() => setViewingLoan(null)} title="Detalle de Préstamo">
        {viewingLoan && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">Fecha</span>
                <span className="text-sm font-medium">{formatDateEs(viewingLoan.date, { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">{viewingLoan.loanType === 'INCOMING' ? 'Tienda que nos prestó' : 'Tienda que recibió'}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  {loanTypeBadge(viewingLoan.loanType)}
                  <span className="text-sm font-medium">{viewingLoan.borrowerName}</span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">Estado</span>
                {loanStatusBadge(viewingLoan.status)}
              </div>
              {viewingLoan.notes && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="block text-xs text-gray-500">Notas</span>
                  <span className="text-sm">{viewingLoan.notes}</span>
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                {viewingLoan.loanType === 'INCOMING' ? 'Productos recibidos (a devolver)' : 'Productos prestados'}
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Almacén</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Prestado</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Devuelto</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Pendiente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {viewingLoan.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-medium">{getProductName(item.productId)}</td>
                        <td className="px-3 py-2 text-gray-600">{getCompanyName(item.companyId)}</td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right text-primary-600">{item.returnedQuantity}</td>
                        <td className="px-3 py-2 text-right font-medium text-orange-600">{item.quantity - item.returnedQuantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Historial de devoluciones */}
            {viewingLoan.returns.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Historial de devoluciones</h3>
                <div className="space-y-2">
                  {viewingLoan.returns.map((ret, idx) => (
                    <div key={idx} className="bg-primary-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-primary-700">Devolución #{idx + 1}</span>
                        <span className="text-xs text-gray-500">{formatDateEs(ret.date)}</span>
                      </div>
                      <div className="text-sm text-gray-700">
                        {ret.items.map((ri, ridx) => (
                          <span key={ridx}>{ridx > 0 ? ', ' : ''}{getProductName(ri.productId)} x{ri.quantity}</span>
                        ))}
                      </div>
                      {ret.notes && <div className="text-xs text-gray-500 mt-1">{ret.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewingLoan.status !== 'RETURNED' && (
              <button onClick={() => { setViewingLoan(null); openReturn(viewingLoan); }} className={`w-full py-2.5 text-white rounded-lg font-medium ${viewingLoan.loanType === 'INCOMING' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-purple-600 hover:bg-purple-700'}`}>
                {viewingLoan.loanType === 'INCOMING' ? `Devolver a ${viewingLoan.borrowerName}` : 'Registrar Devolución'}
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Modal devolución */}
      <Modal isOpen={!!returningLoan} onClose={() => setReturningLoan(null)} title={returningLoan?.loanType === 'INCOMING' ? `Devolver a ${returningLoan.borrowerName}` : 'Registrar Devolución'}>
        {returningLoan && (
          <form onSubmit={handleReturnSubmit} className="space-y-4">
            <div className={`rounded-lg p-3 ${returningLoan.loanType === 'INCOMING' ? 'bg-orange-50' : 'bg-purple-50'}`}>
              <span className={`text-sm ${returningLoan.loanType === 'INCOMING' ? 'text-orange-700' : 'text-purple-700'}`}>
                {returningLoan.loanType === 'INCOMING'
                  ? <>Devolviendo a: <strong>{returningLoan.borrowerName}</strong> — el stock <strong>disminuirá</strong></>
                  : <>Préstamo a: <strong>{returningLoan.borrowerName}</strong></>}
              </span>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Items pendientes de devolución</h3>
              <div className="space-y-3">
                {returnForm.items.map((item, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-medium">{getProductName(item.productId)}</span>
                        <span className="text-xs text-gray-500 ml-2">({getCompanyName(item.companyId)})</span>
                      </div>
                      <span className="text-xs text-gray-500">Máx: {item.max}</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={item.max}
                      step="0.01"
                      value={item.quantity || ''}
                      onChange={(e) => updateReturnItem(idx, parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                      placeholder={`Cantidad a devolver (máx ${item.max})`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
              <textarea value={returnForm.notes} onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Notas sobre la devolución..." />
            </div>

            <button
              type="submit"
              disabled={returnLoanItems.isPending || returnForm.items.every(i => !i.quantity)}
              className="w-full py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50"
            >
              {returnLoanItems.isPending ? 'Registrando...' : 'Confirmar Devolución'}
            </button>
          </form>
        )}
      </Modal>

      {/* Modal: historial de ventas por cliente */}
      {clientHistoryId && (
        <ClientSalesHistoryModal
          clientId={clientHistoryId}
          client={clientMap.get(clientHistoryId)}
          onClose={() => setClientHistoryId(null)}
          onViewSale={(s) => { setClientHistoryId(null); setViewingSale(s); }}
        />
      )}

      {/* Modal anular venta */}
      <Modal isOpen={!!cancellingsale} onClose={() => setCancellingSale(null)} title="Anular Venta">
        {cancellingsale && (
          <form onSubmit={async (e) => { e.preventDefault(); await cancelSale.mutateAsync({ id: cancellingsale.id, reason: cancelReason }); setCancellingSale(null); }} className="space-y-4">
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-sm text-red-700">Esta acción <strong>anulará la venta</strong> por {saleSym(cancellingsale)} {saleDispTotal(cancellingsale).toFixed(2)}:</p>
              <ul className="text-xs text-red-600 mt-2 space-y-1 list-disc list-inside">
                <li>Se devolverá el stock de todos los productos</li>
                {!cancellingsale.isCredit && <li>Se eliminarán las entradas de caja asociadas</li>}
                {cancellingsale.isCredit && <li>Se anulará la cuenta por cobrar</li>}
              </ul>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razón de la anulación</label>
              <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Ej: Error en el registro, cliente desistió..." required />
            </div>
            <button type="submit" disabled={cancelSale.isPending} className="w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50">
              {cancelSale.isPending ? 'Anulando...' : 'Confirmar Anulación'}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
