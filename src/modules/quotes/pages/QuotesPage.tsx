import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuotes, useUpdateQuoteStatus } from '../hooks/useQuotes';
import { useProducts } from '../../products/hooks/useProducts';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useClients } from '../../clients/hooks/useClients';
import { useAuth } from '../../../app/providers/AuthProvider';
import { DataTable } from '../../../shared/components/DataTable';
import { Pagination } from '../../../shared/components/Pagination';
import { ScrollText, Download, Printer, CheckCircle2, XCircle, ShoppingCart, Plus, Search, Calendar, Eye, X, Trash2, AlertTriangle, List, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import type { Quote, QuoteStatus, Product, Company, Client } from '../../../shared/types';
import { downloadQuotePdf, printQuotePdf } from '../utils/quotePdf';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useDeleteQuote } from '../hooks/useQuotes';

const STATUS_LABELS: Record<QuoteStatus, { label: string; short: string; color: string; chip: string }> = {
  PENDING:   { label: 'Borrador',  short: 'borr.',  color: 'bg-yellow-100 text-yellow-800 border-yellow-300', chip: 'text-yellow-700' },
  ACCEPTED:  { label: 'Aceptada',  short: 'acep.',  color: 'bg-green-100 text-green-700 border-green-300',     chip: 'text-green-700' },
  REJECTED:  { label: 'Rechazada', short: 'rech.',  color: 'bg-red-100 text-red-600 border-red-300',           chip: 'text-red-600' },
  EXPIRED:   { label: 'Vencida',   short: 'venc.',  color: 'bg-orange-100 text-orange-700 border-orange-300',  chip: 'text-orange-600' },
  CONVERTED: { label: 'Facturada', short: 'fact.',  color: 'bg-blue-100 text-blue-700 border-blue-300',        chip: 'text-blue-700' },
};

const STATUS_ORDER: QuoteStatus[] = ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'];

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function QuotesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | ''>('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewQuote, setViewQuote] = useState<Quote | null>(null);
  const [deleteQuote, setDeleteQuote] = useState<Quote | null>(null);
  const [calendarView, setCalendarView] = useState(false);
  const { user } = useAuth();
  const isSellerRole = user?.role === 'VENDEDOR' || user?.role === 'VENDEDOR_CAMPO';
  const sellerScope = isSellerRole ? user?.id : undefined;

  const { data, isLoading } = useQuotes({
    page,
    limit: 20,
    status: statusFilter || undefined,
    sellerId: sellerScope,
    search: debouncedSearch || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const { data: allQuotesData } = useQuotes({ limit: 1000, sellerId: sellerScope });
  const { data: productsData } = useProducts({ limit: 10000 });
  const { data: companiesData } = useCompanies();
  const { data: clientsData } = useClients();
  const updateStatus = useUpdateQuoteStatus();
  const deleteMutation = useDeleteQuote();

  const quotes: Quote[] = data?.data || [];
  const total = data?.total || 0;
  const products: Product[] = productsData?.data || [];
  const companies: Company[] = useMemo(() => {
    const raw: any = companiesData;
    return Array.isArray(raw) ? raw : (raw?.data ?? []);
  }, [companiesData]);

  const clients: Client[] = useMemo(() => {
    const raw: any = clientsData;
    return Array.isArray(raw) ? raw : (raw?.data ?? []);
  }, [clientsData]);

  const allQuotes: Quote[] = allQuotesData?.data || [];
  const stats = useMemo(() => {
    const counts: Record<QuoteStatus, number> = { PENDING: 0, ACCEPTED: 0, REJECTED: 0, EXPIRED: 0, CONVERTED: 0 };
    let totalAmount = 0;
    allQuotes.forEach((q) => {
      counts[q.status] = (counts[q.status] || 0) + 1;
      totalAmount += q.total || 0;
    });
    return { totalCount: allQuotes.length, totalAmount, counts };
  }, [allQuotes]);

  const clientById = useMemo(() => {
    const m: Record<string, Client> = {};
    clients.forEach((c) => { m[c.id] = c; });
    return m;
  }, [clients]);

  const getCompany = (id?: string) => companies.find(c => c.id === id);
  const getClient = (id?: string) => clients.find(c => c.id === id);
  const vendor = { name: user?.fullName, email: user?.email };
  const pdfParams = (q: Quote) => ({ quote: q, products, company: getCompany(q.companyId), client: getClient(q.clientId), vendor });

  const columns = [
    { key: 'quoteNumber', header: 'Nº', render: (q: Quote) => <span className="font-mono font-semibold text-primary-700">{q.quoteNumber}</span> },
    {
      key: 'clientName',
      header: 'Cliente',
      render: (q: Quote) => {
        const c = q.clientId ? clientById[q.clientId] : null;
        const name = c?.name || q.clientName || '—';
        const dni = c?.documentNumber;
        return (
          <div>
            <div className="font-medium text-gray-800">{name}</div>
            {dni && <div className="text-xs font-mono text-gray-400 mt-0.5">{dni}</div>}
          </div>
        );
      },
    },
    ...(!isSellerRole ? [{ key: 'sellerName', header: 'Vendedor', render: (q: Quote) => q.sellerName ? <span className="text-emerald-700 text-sm">{q.sellerName}</span> : <span className="text-gray-300">—</span> }] : []),
    { key: 'items', header: 'Items', render: (q: Quote) => <span className="text-sm text-gray-600">{q.items.length}</span> },
    { key: 'total', header: 'Total', render: (q: Quote) => <span className="font-medium text-gray-800">S/ {q.total.toFixed(2)}</span> },
    {
      key: 'status', header: 'Estado', render: (q: Quote) => {
        const meta = STATUS_LABELS[q.status];
        return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}>{meta.label}</span>;
      },
    },
    {
      key: 'issueDate', header: 'Fecha', render: (q: Quote) => {
        const d = new Date(q.issueDate);
        const v = new Date(q.validUntil);
        const days = Math.ceil((v.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return (
          <div className="text-sm">
            <div className="text-gray-700">{d.toLocaleDateString('es-PE')}</div>
            {q.status === 'PENDING' && (
              <div className={`text-xs mt-0.5 ${days < 0 ? 'text-red-500' : days <= 3 ? 'text-orange-500' : 'text-gray-400'}`}>
                {days < 0 ? `Venció hace ${Math.abs(days)}d` : `Vence en ${days}d`}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions', header: '', render: (q: Quote) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setViewQuote(q); }} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Ver detalle">
            <Eye size={15} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); navigate(`/quotes/${q.id}/edit`); }} className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded" title="Editar cotización">
            <Edit2 size={15} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteQuote(q); }} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar cotización">
            <Trash2 size={15} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); printQuotePdf(pdfParams(q)); }} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded" title="Ver / imprimir PDF">
            <Printer size={15} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); downloadQuotePdf(pdfParams(q)); }} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded" title="Descargar PDF">
            <Download size={15} />
          </button>
          {q.status === 'PENDING' && (
            <>
              <button onClick={(e) => { e.stopPropagation(); navigate(`/pos?fromQuote=${q.id}`); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Convertir a venta">
                <ShoppingCart size={15} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: q.id, status: 'ACCEPTED' }); }} disabled={updateStatus.isPending} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-40" title="Marcar aceptada">
                <CheckCircle2 size={15} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: q.id, status: 'REJECTED' }); }} disabled={updateStatus.isPending} className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-40" title="Marcar rechazada">
                <XCircle size={15} />
              </button>
            </>
          )}
          {q.status === 'ACCEPTED' && (
            <button onClick={(e) => { e.stopPropagation(); navigate(`/pos?fromQuote=${q.id}`); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Convertir a venta">
              <ShoppingCart size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('');
    setPage(1);
  };

  const hasActiveFilters = !!search || !!dateFrom || !!dateTo || !!statusFilter;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ScrollText size={24} className="text-primary-600" />
            {isSellerRole ? 'Mis Cotizaciones' : 'Cotizaciones'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona tus cotizaciones y propuestas comerciales</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle lista / calendario */}
          <div className="flex items-center p-1 bg-gray-100 rounded-xl gap-1">
            <button
              onClick={() => setCalendarView(false)}
              title="Vista lista"
              className={`p-2 rounded-lg transition-all ${!calendarView ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setCalendarView(true)}
              title="Vista calendario"
              className={`p-2 rounded-lg transition-all ${calendarView ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Calendar size={16} />
            </button>
          </div>
          <button
            onClick={() => navigate('/quotes/new')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
          >
            <Plus size={16} /> Nueva cotización
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Total cotizaciones</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalCount}</p>
          <p className="text-xs text-gray-500 mt-1">Histórico total</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Monto total</p>
          <p className="text-3xl font-bold text-primary-600 mt-1">S/ {stats.totalAmount.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Sumado de todas las cotizaciones</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Por estado</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {STATUS_ORDER.map((s) => (
              <span key={s} className={`text-sm font-medium ${STATUS_LABELS[s].chip}`}>
                {stats.counts[s] || 0} {STATUS_LABELS[s].short}
              </span>
            ))}
          </div>
        </div>
      </div>

      {calendarView ? (
        <CreditCalendar
          allQuotes={allQuotes}
          clientById={clientById}
          onSelectQuote={setViewQuote}
        />
      ) : (
        <>
          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Cliente, RUC/DNI, Nº de cotización"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><Calendar size={11} /> Desde</label>
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><Calendar size={11} /> Hasta</label>
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-800">Limpiar</button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-400 mr-1">Estado:</span>
              <button onClick={() => { setStatusFilter(''); setPage(1); }} className={`px-3 py-1 rounded-full text-xs font-medium border ${statusFilter === '' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>Todas</button>
              {STATUS_ORDER.map((s) => (
                <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }} className={`px-3 py-1 rounded-full text-xs font-medium border ${statusFilter === s ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
                  {STATUS_LABELS[s].label}
                </button>
              ))}
            </div>
          </div>

          <DataTable columns={columns} data={quotes} isLoading={isLoading} hoverClass="hover:bg-primary-50" />
          <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
        </>
      )}

      {/* Delete confirmation modal */}
      {deleteQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteQuote(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900">¿Eliminar cotización?</h3>
              <p className="text-sm text-gray-500">
                Se eliminará permanentemente la cotización{' '}
                <span className="font-semibold text-gray-700">{deleteQuote.quoteNumber}</span>.
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteQuote(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deleteMutation.mutate(deleteQuote.id, { onSuccess: () => setDeleteQuote(null) });
                }}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quote detail modal */}
      {viewQuote && (
        <QuoteDetailModal
          quote={viewQuote}
          products={products}
          client={getClient(viewQuote.clientId)}
          onClose={() => setViewQuote(null)}
          onPrint={() => printQuotePdf(pdfParams(viewQuote))}
          onDownload={() => downloadQuotePdf(pdfParams(viewQuote))}
        />
      )}
    </div>
  );
}

// ===== CREDIT CALENDAR =====

interface CreditCalendarProps {
  allQuotes: Quote[];
  clientById: Record<string, Client>;
  onSelectQuote: (q: Quote) => void;
}

function CreditCalendar({ allQuotes, clientById, onSelectQuote }: CreditCalendarProps) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const creditQuotes = useMemo(() => {
    return allQuotes
      .filter(q => q.paymentMethod === 'CRÉDITO' && q.creditDays)
      .map(q => {
        const issueParts = q.issueDate.slice(0, 10).split('-').map(Number);
        const due = new Date(issueParts[0], issueParts[1] - 1, issueParts[2] + q.creditDays!);
        return { ...q, dueDate: due, dueDateKey: toDateKey(due) };
      });
  }, [allQuotes]);

  const byDate = useMemo(() => {
    const m: Record<string, typeof creditQuotes[number][]> = {};
    creditQuotes.forEach(q => {
      if (!m[q.dueDateKey]) m[q.dueDateKey] = [];
      m[q.dueDateKey].push(q);
    });
    return m;
  }, [creditQuotes]);

  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstDay = new Date(year, monthIdx, 1);
  const lastDay = new Date(year, monthIdx + 1, 0);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const endOffset = lastDay.getDay() === 0 ? 0 : 7 - lastDay.getDay();
  const totalCells = startOffset + lastDay.getDate() + endOffset;
  const days = Array.from({ length: totalCells }, (_, i) =>
    new Date(year, monthIdx, i - startOffset + 1)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(today);

  const prevMonth = () => setMonth(new Date(year, monthIdx - 1, 1));
  const nextMonth = () => setMonth(new Date(year, monthIdx + 1, 1));

  const monthName = month.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Calendar header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <h2 className="text-base font-semibold text-gray-900 capitalize">{monthName}</h2>
          <p className="text-xs text-amber-600 mt-0.5">
            {creditQuotes.filter(q => q.dueDate.getMonth() === monthIdx && q.dueDate.getFullYear() === year).length} créditos vencen este mes
          </p>
        </div>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
          <div key={d} className="py-2.5 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 divide-x divide-gray-100">
        {days.map((day, i) => {
          const key = toDateKey(day);
          const dayQuotes = byDate[key] || [];
          const isCurrentMonth = day.getMonth() === monthIdx;
          const isToday = key === todayKey;
          const isPast = day < today && !isToday;

          return (
            <div
              key={i}
              className={`min-h-[90px] p-2 border-b border-gray-100 transition-colors
                ${isCurrentMonth ? (isPast ? 'bg-gray-50/40' : 'bg-white') : 'bg-gray-50/70'}
              `}
            >
              <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1
                ${isToday ? 'bg-primary-600 text-white' : isCurrentMonth ? (isPast ? 'text-gray-400' : 'text-gray-700') : 'text-gray-300'}
              `}>
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayQuotes.slice(0, 3).map((q, j) => {
                  const name = clientById[q.clientId || '']?.name || q.clientName || '—';
                  const isOverdue = isPast && q.status !== 'CONVERTED' && q.status !== 'REJECTED';
                  return (
                    <button
                      key={j}
                      onClick={() => onSelectQuote(q)}
                      title={`${name} — ${q.quoteNumber} (${q.creditDays}d)`}
                      className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate transition-colors
                        ${isOverdue
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }
                      `}
                    >
                      {name}
                    </button>
                  );
                })}
                {dayQuotes.length > 3 && (
                  <p className="text-[10px] text-gray-400 px-1">+{dayQuotes.length - 3} más</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
          <span>Crédito pendiente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-300" />
          <span>Plazo vencido</span>
        </div>
        <div className="ml-auto italic">Haz clic en un crédito para ver el detalle</div>
      </div>
    </div>
  );
}

// ===== QUOTE DETAIL MODAL =====

interface QuoteDetailModalProps {
  quote: Quote;
  products: Product[];
  client?: Client;
  onClose: () => void;
  onPrint: () => void;
  onDownload: () => void;
}

function QuoteDetailModal({ quote, products, client, onClose, onPrint, onDownload }: QuoteDetailModalProps) {
  const productById = useMemo(() => {
    const m: Record<string, Product> = {};
    products.forEach(p => { m[p.id] = p; });
    return m;
  }, [products]);

  const meta = STATUS_LABELS[quote.status];
  const issueDate = new Date(quote.issueDate).toLocaleDateString('es-PE');
  const validUntil = new Date(quote.validUntil).toLocaleDateString('es-PE');
  const daysLeft = Math.ceil((new Date(quote.validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const currSymbol = quote.currency === 'USD' ? 'US$' : 'S/';
  const isExonerado = (taxType?: string) => taxType === 'EXONERADO' || taxType === 'INAFECTO';
  const gravadoTotal = quote.items.filter(it => !isExonerado(productById[it.productId]?.taxType)).reduce((s, it) => s + it.subtotal, 0);
  const exoneradoTotal = quote.items.filter(it => isExonerado(productById[it.productId]?.taxType)).reduce((s, it) => s + it.subtotal, 0);
  const opGravadas = Math.round((gravadoTotal / 1.18) * 100) / 100;
  const igv = Math.round((gravadoTotal - opGravadas) * 100) / 100;
  const solEquiv = quote.currency === 'USD' && (quote.exchangeRate || 0) > 0 ? Math.round(quote.total * quote.exchangeRate! * 100) / 100 : null;

  const creditDueDate = useMemo(() => {
    if (!quote.creditDays) return null;
    const issueParts = quote.issueDate.slice(0, 10).split('-').map(Number);
    const due = new Date(issueParts[0], issueParts[1] - 1, issueParts[2] + quote.creditDays);
    return due.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }, [quote.issueDate, quote.creditDays]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
              <ScrollText size={18} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{quote.quoteNumber}</h2>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.color}`}>{meta.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onPrint} className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Imprimir PDF">
              <Printer size={16} />
            </button>
            <button onClick={onDownload} className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Descargar PDF">
              <Download size={16} />
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Cliente</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{client?.name || quote.clientName || '—'}</p>
                {client?.documentNumber && <p className="text-xs font-mono text-gray-400">{client.documentNumber}</p>}
                {client?.phone && <p className="text-xs text-gray-400">{client.phone}</p>}
              </div>
              {quote.sellerName && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Vendedor</p>
                  <p className="text-sm text-emerald-700 font-medium mt-0.5">{quote.sellerName}</p>
                </div>
              )}
              {quote.participantNames && quote.participantNames.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Participantes</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {quote.participantNames.map((name, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Emisión</p>
                <p className="text-sm text-gray-700 mt-0.5">{issueDate}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Válido hasta</p>
                <p className="text-sm text-gray-700 mt-0.5">{validUntil}</p>
                {quote.status === 'PENDING' && (
                  <p className={`text-xs mt-0.5 ${daysLeft < 0 ? 'text-red-500' : daysLeft <= 3 ? 'text-orange-500' : 'text-gray-400'}`}>
                    {daysLeft < 0 ? `Venció hace ${Math.abs(daysLeft)}d` : `Vence en ${daysLeft}d`}
                  </p>
                )}
              </div>
              {quote.paymentMethod === 'CRÉDITO' && creditDueDate && (
                <div>
                  <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider">Vence crédito ({quote.creditDays}d)</p>
                  <p className="text-sm font-semibold text-amber-700 mt-0.5">{creditDueDate}</p>
                </div>
              )}
            </div>
          </div>

          {/* Items table */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Productos</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Producto</th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Cant.</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">P. Unit.</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {quote.items.map((item, i) => {
                    const prod = productById[item.productId];
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-gray-800 font-medium">
                          {prod?.name || item.productId}
                          {(prod as any)?.code && <span className="ml-1.5 text-xs font-mono text-gray-400">{(prod as any).code}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-600">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">S/ {item.unitPrice.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-800">S/ {item.subtotal.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Op. Gravadas</span>
                <span className="tabular-nums">{currSymbol} {opGravadas.toFixed(2)}</span>
              </div>
              {exoneradoTotal > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Op. Exoneradas</span>
                  <span className="tabular-nums">{currSymbol} {exoneradoTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-500">
                <span>IGV (18%)</span>
                <span className="tabular-nums">{currSymbol} {igv.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 text-base pt-1.5 border-t border-gray-200">
                <span>Total</span>
                <span className="tabular-nums text-primary-700">{currSymbol} {quote.total.toFixed(2)}</span>
              </div>
              {solEquiv !== null && (
                <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-100">
                  <span>Equiv. en S/ (T.C. {quote.exchangeRate?.toFixed(2)})</span>
                  <span className="tabular-nums">S/ {solEquiv.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Pagos a cuenta / saldo */}
          {quote.payments && quote.payments.length > 0 && (() => {
            const paid = Math.round(quote.payments!.reduce((s, p) => s + p.amount, 0) * 100) / 100;
            const saldo = Math.round((quote.total - paid) * 100) / 100;
            return (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-2">Pagos a cuenta</p>
                <div className="space-y-1.5">
                  {quote.payments!.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        {p.paymentMethodName}
                      </span>
                      <span className="tabular-nums font-semibold text-emerald-700">{currSymbol} {p.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-emerald-200 space-y-1">
                  <div className="flex justify-between text-sm font-semibold text-emerald-700">
                    <span>A CUENTA</span>
                    <span className="tabular-nums">{currSymbol} {paid.toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between text-sm font-bold ${saldo > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    <span>SALDO</span>
                    <span className="tabular-nums">{currSymbol} {saldo.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Notes */}
          {quote.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Observaciones</p>
              <p className="text-sm text-amber-900">{quote.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
