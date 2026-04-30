import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuotes, useUpdateQuoteStatus } from '../hooks/useQuotes';
import { useProducts } from '../../products/hooks/useProducts';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useClients } from '../../clients/hooks/useClients';
import { useAuth } from '../../../app/providers/AuthProvider';
import { DataTable } from '../../../shared/components/DataTable';
import { Pagination } from '../../../shared/components/Pagination';
import { ScrollText, Download, Printer, CheckCircle2, XCircle, ShoppingCart } from 'lucide-react';
import type { Quote, QuoteStatus, Product, Company, Client } from '../../../shared/types';
import { downloadQuotePdf, printQuotePdf } from '../utils/quotePdf';

const STATUS_LABELS: Record<QuoteStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  ACCEPTED: { label: 'Aceptada', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  REJECTED: { label: 'Rechazada', color: 'bg-gray-100 text-gray-600 border-gray-300' },
  EXPIRED: { label: 'Vencida', color: 'bg-red-100 text-red-700 border-red-300' },
  CONVERTED: { label: 'Vendida', color: 'bg-green-100 text-green-700 border-green-300' },
};

export function QuotesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | ''>('');
  const { data, isLoading } = useQuotes({ page, limit: 20, status: statusFilter || undefined });
  const { data: productsData } = useProducts({ limit: 500 });
  const { data: companiesData } = useCompanies();
  const { data: clientsData } = useClients();
  const { user } = useAuth();
  const updateStatus = useUpdateQuoteStatus();

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

  const getCompany = (id?: string) => companies.find(c => c.id === id);
  const getClient = (id?: string) => clients.find(c => c.id === id);
  const vendor = { name: user?.fullName, email: user?.email };
  const pdfParams = (q: Quote) => ({ quote: q, products, company: getCompany(q.companyId), client: getClient(q.clientId), vendor });

  const columns = [
    { key: 'quoteNumber', header: 'Nº Cotización', render: (q: Quote) => <span className="font-mono font-medium text-gray-800">{q.quoteNumber}</span> },
    { key: 'issueDate', header: 'Emisión', render: (q: Quote) => new Date(q.issueDate).toLocaleDateString('es-PE') },
    { key: 'validUntil', header: 'Válida hasta', render: (q: Quote) => {
      const d = new Date(q.validUntil);
      const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return (
        <span className={days < 0 ? 'text-red-600 font-medium' : days <= 3 ? 'text-orange-600 font-medium' : 'text-gray-700'}>
          {d.toLocaleDateString('es-PE')} {q.status === 'PENDING' && days >= 0 && <span className="text-xs text-gray-400">({days}d)</span>}
        </span>
      );
    }},
    { key: 'clientName', header: 'Cliente', render: (q: Quote) => q.clientName || '—' },
    { key: 'items', header: 'Ítems', render: (q: Quote) => `${q.items.length}` },
    { key: 'total', header: 'Total', render: (q: Quote) => <span className="font-medium">S/ {q.total.toFixed(2)}</span> },
    { key: 'status', header: 'Estado', render: (q: Quote) => {
      const meta = STATUS_LABELS[q.status];
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}>{meta.label}</span>;
    }},
    { key: 'actions', header: '', render: (q: Quote) => (
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); downloadQuotePdf(pdfParams(q)); }} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded" title="Descargar PDF">
          <Download size={15} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); printQuotePdf(pdfParams(q)); }} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded" title="Ver / imprimir PDF">
          <Printer size={15} />
        </button>
        {q.status === 'PENDING' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); navigate(`/pos?fromQuote=${q.id}`); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Convertir a venta">
              <ShoppingCart size={15} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: q.id, status: 'ACCEPTED' }); }} disabled={updateStatus.isPending} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-40 disabled:cursor-not-allowed" title="Marcar aceptada">
              <CheckCircle2 size={15} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: q.id, status: 'REJECTED' }); }} disabled={updateStatus.isPending} className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-40 disabled:cursor-not-allowed" title="Marcar rechazada">
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
    )},
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><ScrollText size={24} /> Cotizaciones</h1>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        {([{ id: '', label: 'Todas' }, { id: 'PENDING', label: 'Pendientes' }, { id: 'ACCEPTED', label: 'Aceptadas' }, { id: 'CONVERTED', label: 'Vendidas' }, { id: 'EXPIRED', label: 'Vencidas' }, { id: 'REJECTED', label: 'Rechazadas' }] as const).map(f => (
          <button key={f.id} onClick={() => { setStatusFilter(f.id as any); setPage(1); }} className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${statusFilter === f.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={quotes} isLoading={isLoading} hoverClass="hover:bg-primary-50" />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
    </div>
  );
}
