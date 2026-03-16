import React, { useState } from 'react';
import { useSales, useCreateSale, useCancelSale, useUpdateVoucher } from '../hooks/useSales';
import { saleService } from '../services/saleService';
import { useLoans, useCreateLoan, useReturnLoanItems } from '../../loans/hooks/useLoans';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts } from '../../products/hooks/useProducts';
import { useClients } from '../../clients/hooks/useClients';
import { usePriceTiers } from '../../price-tiers/hooks/usePriceTiers';
import { usePaymentMethods } from '../../payment-methods/hooks/usePaymentMethods';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { Plus, Receipt, Trash2, Eye, CalendarDays, HandshakeIcon, RotateCcw, XCircle, Copy, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import type { Sale, Loan, Company, Product, ProductPrice, Client, PriceTier, PaymentMethod } from '../../../shared/types';

function getMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

interface PaymentSplit {
  paymentMethodId: string;
  amount: number;
}

// 'MIXED' and 'CREDIT' are special UI-only modes; any other string is a paymentMethod ID
type PaymentMode = string; // paymentMethodId | 'MIXED' | 'CREDIT'

export function SalesPage() {
  const [activeTab, setActiveTab] = useState<'sales' | 'boletas' | 'facturas' | 'loans'>('sales');
  const [page, setPage] = useState(1);
  const [boletaPage, setBoletaPage] = useState(1);
  const [facturaPage, setFacturaPage] = useState(1);
  const [loanPage, setLoanPage] = useState(1);
  const [companyFilter, setCompanyFilter] = useState('');
  const [startDate, setStartDate] = useState(getMonthStart);
  const [endDate, setEndDate] = useState(getToday);
  const [showModal, setShowModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [viewingLoan, setViewingLoan] = useState<Loan | null>(null);
  const [returningLoan, setReturningLoan] = useState<Loan | null>(null);
  const [loanStatusFilter, setLoanStatusFilter] = useState('');

  const { data, isLoading } = useSales({ page, limit: 10, companyId: companyFilter || undefined, startDate, endDate });
  const { data: boletasData, isLoading: boletasLoading } = useSales({ page: boletaPage, limit: 10, companyId: companyFilter || undefined, startDate, endDate, voucherType: 'BOLETA' });
  const { data: facturasData, isLoading: facturasLoading } = useSales({ page: facturaPage, limit: 10, companyId: companyFilter || undefined, startDate, endDate, voucherType: 'FACTURA' });
  const { data: loansData, isLoading: loansLoading } = useLoans({ page: loanPage, limit: 10, status: loanStatusFilter || undefined, startDate, endDate });
  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 200 });
  const { data: clientsData } = useClients({ limit: 200 });
  const { data: priceTiers } = usePriceTiers();
  const { data: paymentMethodsData } = usePaymentMethods();
  const createSale = useCreateSale();
  const cancelSale = useCancelSale();
  const updateVoucher = useUpdateVoucher();
  const createLoan = useCreateLoan();
  const returnLoanItems = useReturnLoanItems();

  const [cancellingsale, setCancellingSale] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [form, setForm] = useState({
    clientId: '',
    voucherType: 'NONE' as string,
    paymentMode: '' as PaymentMode, // paymentMethodId, 'MIXED', or 'CREDIT'
    mixedPayments: [{ paymentMethodId: '', amount: 0 }] as PaymentSplit[],
    items: [{ productId: '', companyId: '', quantity: 0, priceTier: '', unitPrice: 0, subtotal: 0 }],
  });

  const [loanForm, setLoanForm] = useState({
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
      items: [{ productId: '', companyId: '', quantity: 0, priceTier: '', unitPrice: 0, subtotal: 0 }],
    });
    setShowModal(true);
  };

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { productId: '', companyId: '', quantity: 0, priceTier: '', unitPrice: 0, subtotal: 0 }] }));
  const removeItem = (idx: number) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const updateItem = (idx: number, field: string, value: any) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === 'productId' && items[idx].priceTier) {
        const product = products.find((p: Product) => p.id === value);
        const priceEntry = product?.prices?.find((p: ProductPrice) => p.priceTierId === items[idx].priceTier);
        if (priceEntry) items[idx].unitPrice = priceEntry.price;
      }
      if (field === 'priceTier' && items[idx].productId) {
        const product = products.find((p: Product) => p.id === items[idx].productId);
        const priceEntry = product?.prices?.find((p: ProductPrice) => p.priceTierId === value);
        if (priceEntry) items[idx].unitPrice = priceEntry.price;
      }
      items[idx].subtotal = items[idx].quantity * items[idx].unitPrice;
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
    const payload: any = {
      clientId: form.clientId || undefined,
      voucherType: form.voucherType,
      isCredit,
      items: form.items.map(({ subtotal, ...item }) => item),
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
    await createSale.mutateAsync(payload);
    setShowModal(false);
  };

  // Loan form handlers
  const openLoanCreate = () => {
    setLoanForm({ borrowerName: '', notes: '', items: [{ productId: '', companyId: '', quantity: 0 }] });
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
  const sales = data?.data || [];
  const total = data?.total || 0;
  const totalAmount = data?.totalAmount || 0;
  const boletas = boletasData?.data || [];
  const boletasTotal = boletasData?.total || 0;
  const boletasTotalAmount = boletasData?.totalAmount || 0;
  const boletasBaseAmount = boletasData?.totalBaseAmount || 0;
  const boletasIgv = boletasData?.totalIgv || 0;
  const facturas = facturasData?.data || [];
  const facturasTotal = facturasData?.total || 0;
  const facturasTotalAmount = facturasData?.totalAmount || 0;
  const facturasBaseAmount = facturasData?.totalBaseAmount || 0;
  const facturasIgv = facturasData?.totalIgv || 0;
  const loans = loansData?.data || [];
  const loansTotal = loansData?.total || 0;

  const getCompanyName = (id?: string) => id ? companyList.find((c: Company) => c.id === id)?.name || 'N/A' : 'Mixta';
  const getClientName = (id?: string) => id ? clients.find((c: Client) => c.id === id)?.name || 'N/A' : 'Sin cliente';
  const getProductName = (id: string) => products.find((p: Product) => p.id === id)?.name || id;

  const getSaleBaseAmount = (sale: Sale) => {
    return sale.items.reduce((sum, item) => {
      const product = products.find((p: Product) => p.id === item.productId);
      const taxType = product?.taxType || 'GRAVADO';
      const base = taxType === 'GRAVADO' ? Math.round((item.subtotal / 1.18) * 100) / 100 : item.subtotal;
      return sum + base;
    }, 0);
  };

  const getSaleIgv = (sale: Sale) => {
    return Math.round((sale.total - getSaleBaseAmount(sale)) * 100) / 100;
  };

  const handleExportVouchers = async (voucherType: 'BOLETA' | 'FACTURA') => {
    try {
      const result = await saleService.getAll({ limit: 9999, companyId: companyFilter || undefined, startDate, endDate, voucherType });
      const allSales: Sale[] = result?.data || [];
      if (allSales.length === 0) { toast.error('No hay datos para exportar'); return; }

      const rows = allSales.filter(s => !s.isCancelled).map(sale => {
        const companyIds = [...new Set(sale.items.map((i: any) => i.companyId))];
        const empresa = companyIds.length === 1 ? getCompanyName(companyIds[0]) : 'Mixta';
        const productosStr = sale.items.map((i: any) => `${getProductName(i.productId)} x${i.quantity}`).join(', ');
        const baseAmount = getSaleBaseAmount(sale);
        const igv = getSaleIgv(sale);
        const paymentLabel = sale.isCredit ? 'Crédito' : sale.payments?.map(p => p.paymentMethodName).join(' + ') || 'Efectivo';

        return {
          'Fecha': new Date(sale.date).toLocaleDateString('es-PE'),
          'Cliente': getClientName(sale.clientId),
          'Empresa': empresa,
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

  const getPaymentLabel = (sale: Sale) => {
    if (sale.isCredit) return <span className="text-orange-600 font-medium">Crédito</span>;
    if (sale.payments && sale.payments.length > 0) {
      const label = sale.payments.map(p => p.paymentMethodName).join(' + ');
      return <span className="text-green-600">{label}</span>;
    }
    return <span className="text-green-600">Efectivo</span>;
  };

  const salesColumns = [
    { key: 'date', header: 'Fecha', render: (item: Sale) => new Date(item.date).toLocaleDateString('es-PE') },
    { key: 'companyId', header: 'Empresa', render: (item: Sale) => {
      const companyIds = [...new Set(item.items.map(i => i.companyId))];
      if (companyIds.length === 1) return getCompanyName(companyIds[0]);
      return <span className="text-purple-600 font-medium">Mixta</span>;
    }},
    { key: 'clientId', header: 'Cliente', render: (item: Sale) => getClientName(item.clientId) },
    { key: 'items', header: 'Items', render: (item: Sale) => `${item.items.length} producto(s)` },
    { key: 'total', header: 'Total', render: (item: Sale) => item.isCancelled ? <span className="line-through text-gray-400">S/ {item.total.toFixed(2)}</span> : `S/ ${item.total.toFixed(2)}` },
    { key: 'voucherType', header: 'Comprobante', render: (item: Sale) => {
      if (item.voucherType === 'BOLETA') return <span className="text-green-600 font-medium">Boleta</span>;
      if (item.voucherType === 'FACTURA') return <span className="text-blue-600 font-medium">Factura</span>;
      return <span className="text-gray-400">-</span>;
    }},
    { key: 'payment', header: 'Pago', render: (item: Sale) => item.isCancelled ? <span className="text-red-600 font-medium">Anulada</span> : getPaymentLabel(item) },
    { key: 'actions', header: '', render: (item: Sale) => (
      <div className="flex items-center gap-2">
        <button onClick={(e) => { e.stopPropagation(); setViewingSale(item); }} className="text-green-600 hover:text-green-800 flex items-center gap-1 text-xs font-medium"><Eye size={15} /> Ver</button>
        {!item.isCancelled && (
          <button onClick={(e) => { e.stopPropagation(); setCancellingSale(item); setCancelReason(''); }} className="text-red-500 hover:text-red-700 flex items-center gap-1 text-xs font-medium"><XCircle size={15} /> Anular</button>
        )}
      </div>
    )},
  ];

  const voucherColumns = [
    { key: 'date', header: 'Fecha', render: (item: Sale) => new Date(item.date).toLocaleDateString('es-PE') },
    { key: 'companyId', header: 'Empresa', render: (item: Sale) => {
      const companyIds = [...new Set(item.items.map(i => i.companyId))];
      if (companyIds.length === 1) return getCompanyName(companyIds[0]);
      return <span className="text-purple-600 font-medium">Mixta</span>;
    }},
    { key: 'clientId', header: 'Cliente', render: (item: Sale) => getClientName(item.clientId) },
    { key: 'items', header: 'Items', render: (item: Sale) => `${item.items.length} producto(s)` },
    { key: 'baseAmount', header: 'Valor Venta', render: (item: Sale) => {
      const base = getSaleBaseAmount(item);
      return item.isCancelled ? <span className="line-through text-gray-400">S/ {base.toFixed(2)}</span> : `S/ ${base.toFixed(2)}`;
    }},
    { key: 'igv', header: 'IGV', render: (item: Sale) => {
      const igv = getSaleIgv(item);
      return item.isCancelled ? <span className="line-through text-gray-400">S/ {igv.toFixed(2)}</span> : igv > 0 ? <span className="text-orange-600">S/ {igv.toFixed(2)}</span> : <span className="text-gray-400">S/ 0.00</span>;
    }},
    { key: 'total', header: 'Total', render: (item: Sale) => item.isCancelled ? <span className="line-through text-gray-400">S/ {item.total.toFixed(2)}</span> : <span className="font-medium">S/ {item.total.toFixed(2)}</span> },
    { key: 'payment', header: 'Pago', render: (item: Sale) => item.isCancelled ? <span className="text-red-600 font-medium">Anulada</span> : getPaymentLabel(item) },
    { key: 'actions', header: '', render: (item: Sale) => (
      <div className="flex items-center gap-2">
        <button onClick={(e) => { e.stopPropagation(); setViewingSale(item); }} className="text-green-600 hover:text-green-800 flex items-center gap-1 text-xs font-medium"><Eye size={15} /> Ver</button>
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
      RETURNED: 'bg-green-100 text-green-700',
    };
    const labels: Record<string, string> = { ACTIVE: 'Activo', PARTIAL: 'Parcial', RETURNED: 'Devuelto' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || ''}`}>{labels[status] || status}</span>;
  };

  const loanColumns = [
    { key: 'date', header: 'Fecha', render: (item: Loan) => new Date(item.date).toLocaleDateString('es-PE') },
    { key: 'borrowerName', header: 'Prestatario', render: (item: Loan) => item.borrowerName },
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

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Receipt size={24} /> Ventas</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={openLoanCreate} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            <HandshakeIcon size={18} /> Préstamo
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            <Plus size={18} /> Nueva Venta
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {(activeTab === 'sales' || activeTab === 'boletas' || activeTab === 'facturas') && (
          <select value={companyFilter} onChange={(e) => { setCompanyFilter(e.target.value); setPage(1); setBoletaPage(1); setFacturaPage(1); }} className="px-3 py-2 border rounded-lg">
            <option value="">Todas las empresas</option>
            {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name} - {c.ruc}</option>)}
          </select>
        )}
        {activeTab === 'loans' && (
          <select value={loanStatusFilter} onChange={(e) => { setLoanStatusFilter(e.target.value); setLoanPage(1); }} className="px-3 py-2 border rounded-lg">
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activo</option>
            <option value="PARTIAL">Parcial</option>
            <option value="RETURNED">Devuelto</option>
          </select>
        )}
        <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); setBoletaPage(1); setFacturaPage(1); setLoanPage(1); }} className="px-3 py-2 border rounded-lg" />
        <span className="text-gray-500 text-sm">hasta</span>
        <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); setBoletaPage(1); setFacturaPage(1); setLoanPage(1); }} className="px-3 py-2 border rounded-lg" />
        {(startDate !== getMonthStart() || endDate !== getToday()) && (
          <button onClick={() => { setStartDate(getMonthStart()); setEndDate(getToday()); setPage(1); setBoletaPage(1); setFacturaPage(1); setLoanPage(1); }} className="flex items-center gap-1 px-3 py-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100">
            <CalendarDays size={14} /> Este mes
          </button>
        )}
      </div>

      {/* Total del período */}
      {activeTab === 'sales' && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-green-700">{total} venta(s) en el período</span>
          <span className="text-lg font-bold text-green-700">Total: S/ {totalAmount.toFixed(2)}</span>
        </div>
      )}
      {activeTab === 'boletas' && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-green-700">{boletasTotal} boleta(s) en el período</span>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-green-700">Valor Venta: S/ {boletasBaseAmount.toFixed(2)}</span>
              <button onClick={() => handleExportVouchers('BOLETA')} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 border border-green-300 rounded hover:bg-green-200 transition-colors">
                <Download size={14} /> Excel
              </button>
            </div>
          </div>
          <div className="flex items-center justify-end gap-4 text-xs text-green-600">
            <span>Total: S/ {boletasTotalAmount.toFixed(2)}</span>
            <span>IGV: S/ {boletasIgv.toFixed(2)}</span>
          </div>
        </div>
      )}
      {activeTab === 'facturas' && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-blue-700">{facturasTotal} factura(s) en el período</span>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-blue-700">Valor Venta: S/ {facturasBaseAmount.toFixed(2)}</span>
              <button onClick={() => handleExportVouchers('FACTURA')} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded hover:bg-blue-200 transition-colors">
                <Download size={14} /> Excel
              </button>
            </div>
          </div>
          <div className="flex items-center justify-end gap-4 text-xs text-blue-600">
            <span>Total: S/ {facturasTotalAmount.toFixed(2)}</span>
            <span>IGV: S/ {facturasIgv.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex border-b mb-4">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sales' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Ventas
        </button>
        <button
          onClick={() => setActiveTab('boletas')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'boletas' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
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
          <DataTable columns={salesColumns} data={sales} isLoading={isLoading} rowClassName={(sale: Sale) => sale?.isCancelled ? 'bg-red-50 opacity-60' : sale?.isCredit ? 'hover:bg-yellow-50' : 'hover:bg-green-50'} />
          <Pagination page={page} totalPages={Math.ceil(total / 10)} onPageChange={setPage} />
        </>
      )}

      {/* Boletas Tab */}
      {activeTab === 'boletas' && (
        <>
          <DataTable columns={voucherColumns} data={boletas} isLoading={boletasLoading} rowClassName={(sale: Sale) => sale?.isCancelled ? 'bg-red-50 opacity-60' : sale?.isCredit ? 'hover:bg-yellow-50' : 'hover:bg-green-50'} />
          <Pagination page={boletaPage} totalPages={Math.ceil(boletasTotal / 10)} onPageChange={setBoletaPage} />
        </>
      )}

      {/* Facturas Tab */}
      {activeTab === 'facturas' && (
        <>
          <DataTable columns={voucherColumns} data={facturas} isLoading={facturasLoading} rowClassName={(sale: Sale) => sale?.isCancelled ? 'bg-red-50 opacity-60' : sale?.isCredit ? 'hover:bg-yellow-50' : 'hover:bg-blue-50'} />
          <Pagination page={facturaPage} totalPages={Math.ceil(facturasTotal / 10)} onPageChange={setFacturaPage} />
        </>
      )}

      {/* Loans Tab */}
      {activeTab === 'loans' && (
        <>
          <DataTable columns={loanColumns} data={loans} isLoading={loansLoading} rowClassName={(loan: Loan) => loan.status === 'RETURNED' ? 'hover:bg-green-50' : 'hover:bg-purple-50'} />
          <Pagination page={loanPage} totalPages={Math.ceil(loansTotal / 10)} onPageChange={setLoanPage} />
        </>
      )}

      {/* Modal crear venta */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Venta" size="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Método de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago</label>
            {paymentMethods.length === 0 ? (
              <div className="text-sm text-gray-400 py-2">Cargando métodos de pago...</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {paymentMethods.map((m: PaymentMethod) => (
                  <button key={m.id} type="button" onClick={() => setForm({ ...form, paymentMode: m.id })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.paymentMode === m.id ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
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
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">S/</span>
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
                  La suma (S/ {form.mixedPayments.reduce((s, p) => s + p.amount, 0).toFixed(2)}) debe ser igual al total (S/ {saleTotal.toFixed(2)})
                </p>
              )}
            </div>
          )}

          {/* Cliente y Boleta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente {isCredit ? '(obligatorio)' : '(opcional)'}</label>
              <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required={isCredit}>
                <option value="">Sin cliente</option>
                {clients.map((c: Client) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comprobante</label>
              <div className="flex gap-1">
                {[{ value: 'NONE', label: 'No' }, { value: 'BOLETA', label: 'Boleta' }, { value: 'FACTURA', label: 'Factura' }].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setForm({ ...form, voucherType: opt.value })}
                    className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${form.voucherType === opt.value
                      ? opt.value === 'BOLETA' ? 'bg-green-600 text-white border-green-600' : opt.value === 'FACTURA' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-600 text-white border-gray-600'
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
              <button type="button" onClick={addItem} className="text-sm text-green-600 hover:text-green-800 font-medium">+ Agregar producto</button>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {form.items.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 relative">
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Empresa</label>
                      <select value={item.companyId} onChange={(e) => updateItem(idx, 'companyId', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm bg-white" required>
                        <option value="">Seleccionar...</option>
                        {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Producto</label>
                      <SearchableSelect
                        options={products.map((p: Product) => ({ value: p.id, label: p.name }))}
                        value={item.productId}
                        onChange={(v) => updateItem(idx, 'productId', v)}
                        placeholder="Buscar producto..."
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
                      <input type="number" min="0.01" step="0.01" value={item.unitPrice || ''} onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 border rounded text-sm" required />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Subtotal</label>
                      <div className="px-2 py-1.5 bg-white border rounded text-sm font-medium text-gray-700">S/ {item.subtotal.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total y Submit */}
          <div className="bg-green-50 p-3 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium text-green-800">Total de la venta</span>
            <span className="text-xl font-bold text-green-700">S/ {saleTotal.toFixed(2)}</span>
          </div>
          <button type="submit" disabled={createSale.isPending || !paymentValid} className="w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50">
            {createSale.isPending ? 'Registrando...' : 'Registrar Venta'}
          </button>
        </form>
      </Modal>

      {/* Modal detalle de venta */}
      <Modal isOpen={!!viewingSale} onClose={() => setViewingSale(null)} title="Detalle de Venta" size="lg">
        {viewingSale && (
          <div className="space-y-4">
            {/* Banner anulada */}
            {viewingSale.isCancelled && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <span className="text-sm font-medium text-red-700">Venta anulada</span>
                {viewingSale.cancelReason && <p className="text-xs text-red-600 mt-1">Razón: {viewingSale.cancelReason}</p>}
              </div>
            )}

            {/* Info general */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">Fecha</span>
                <span className="text-sm font-medium">{new Date(viewingSale.date).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">Cliente</span>
                <span className="text-sm font-medium">{getClientName(viewingSale.clientId)}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">Tipo de pago</span>
                <span className={`text-sm font-medium ${viewingSale.isCredit ? 'text-orange-600' : 'text-green-600'}`}>
                  {viewingSale.isCredit ? 'Crédito' : 'Pago inmediato'}
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500 mb-1">Comprobante</span>
                {viewingSale.isCancelled ? (
                  <span className={`text-sm font-medium ${viewingSale.voucherType === 'BOLETA' ? 'text-green-600' : viewingSale.voucherType === 'FACTURA' ? 'text-blue-600' : 'text-gray-500'}`}>
                    {viewingSale.voucherType === 'BOLETA' ? 'Boleta' : viewingSale.voucherType === 'FACTURA' ? 'Factura' : 'Sin comprobante'}
                  </span>
                ) : (
                  <div className="flex gap-1">
                    {([['NONE', 'No'], ['BOLETA', 'Boleta'], ['FACTURA', 'Factura']] as const).map(([val, label]) => (
                      <button key={val} type="button"
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${viewingSale.voucherType === val ? (val === 'BOLETA' ? 'bg-green-600 text-white' : val === 'FACTURA' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white') : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                        disabled={updateVoucher.isPending}
                        onClick={() => {
                          if (viewingSale.voucherType !== val) {
                            updateVoucher.mutate({ id: viewingSale.id, voucherType: val }, {
                              onSuccess: () => setViewingSale({ ...viewingSale, voucherType: val }),
                            });
                          }
                        }}
                      >{label}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Desglose de pagos */}
            {!viewingSale.isCredit && viewingSale.payments && viewingSale.payments.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Desglose de pagos</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Método</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {viewingSale.payments.map((payment, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium">{payment.paymentMethodName}</td>
                          <td className="px-3 py-2 text-right text-green-600 font-medium">S/ {payment.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Productos */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Productos ({viewingSale.items.length})</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Empresa</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Cant.</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">P. Unit.</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">IGV Unit.</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {viewingSale.items.map((item, idx) => {
                      const product = products.find((p: Product) => p.id === item.productId);
                      const company = companyList.find((c: Company) => c.id === item.companyId);
                      const tier = tiers.find((t: PriceTier) => t.id === item.priceTier);
                      const taxType = product?.taxType || 'GRAVADO';
                      const igvUnit = taxType === 'GRAVADO' ? Math.round((item.unitPrice - item.unitPrice / 1.18) * 100) / 100 : 0;
                      return (
                        <tr key={idx}>
                          <td className="px-3 py-2">
                            <div className="font-medium">{product?.name || item.productId}</div>
                            {tier && <div className="text-xs text-gray-400">{tier.name}</div>}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{company?.name || 'N/A'}</td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">S/ {item.unitPrice.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">
                            {igvUnit > 0 ? (
                              <span className="inline-flex items-center gap-1 text-orange-600">
                                S/ {igvUnit.toFixed(2)}
                                <button
                                  type="button"
                                  onClick={() => { navigator.clipboard.writeText(igvUnit.toFixed(2)); toast.success('IGV copiado'); }}
                                  className="text-gray-400 hover:text-orange-600 transition-colors"
                                  title="Copiar IGV"
                                >
                                  <Copy size={13} />
                                </button>
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">S/ {item.subtotal.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total */}
            <div className="bg-green-50 p-3 rounded-lg flex items-center justify-between">
              <span className="text-sm font-medium text-green-800">Total</span>
              <span className="text-xl font-bold text-green-700">S/ {viewingSale.total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal crear préstamo */}
      <Modal isOpen={showLoanModal} onClose={() => setShowLoanModal(false)} title="Nuevo Préstamo" size="lg">
        <form onSubmit={handleLoanSubmit} className="space-y-5 pb-4">
          {/* Prestatario (obligatorio) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del local (obligatorio)</label>
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
                      <label className="block text-xs text-gray-500 mb-1">Empresa</label>
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
                <span className="text-sm font-medium">{new Date(viewingLoan.date).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="block text-xs text-gray-500">Prestatario</span>
                <span className="text-sm font-medium">{viewingLoan.borrowerName}</span>
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
              <h3 className="text-sm font-medium text-gray-700 mb-2">Productos prestados</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Empresa</th>
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
                        <td className="px-3 py-2 text-right text-green-600">{item.returnedQuantity}</td>
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
                    <div key={idx} className="bg-green-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-green-700">Devolución #{idx + 1}</span>
                        <span className="text-xs text-gray-500">{new Date(ret.date).toLocaleDateString('es-PE')}</span>
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
              <button onClick={() => { setViewingLoan(null); openReturn(viewingLoan); }} className="w-full py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
                Registrar Devolución
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Modal devolución */}
      <Modal isOpen={!!returningLoan} onClose={() => setReturningLoan(null)} title="Registrar Devolución">
        {returningLoan && (
          <form onSubmit={handleReturnSubmit} className="space-y-4">
            <div className="bg-purple-50 rounded-lg p-3">
              <span className="text-sm text-purple-700">Préstamo a: <strong>{returningLoan.borrowerName}</strong></span>
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

      {/* Modal anular venta */}
      <Modal isOpen={!!cancellingsale} onClose={() => setCancellingSale(null)} title="Anular Venta">
        {cancellingsale && (
          <form onSubmit={async (e) => { e.preventDefault(); await cancelSale.mutateAsync({ id: cancellingsale.id, reason: cancelReason }); setCancellingSale(null); }} className="space-y-4">
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-sm text-red-700">Esta acción <strong>anulará la venta</strong> por S/ {cancellingsale.total.toFixed(2)}:</p>
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
