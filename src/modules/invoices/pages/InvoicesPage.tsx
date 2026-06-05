import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, FileText, Wallet, Search, X, List, Layers, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { usePurchases, useUpdatePurchaseMeta } from '../../purchases/hooks/usePurchases';
import { useCashRegisters } from '../../cash-register/hooks/useCashRegister';
import { Modal } from '../../../shared/components/Modal';
import type { Purchase, CashRegister, CashRegisterEntry } from '../../../shared/types';

type ActiveTab = 'purchases' | 'cash';
type ViewMode = 'list' | 'grouped';
type CashEntryWithDate = CashRegisterEntry & { registerDate: string };

interface PurchaseGroup {
  supplier: string;
  items: Purchase[];
  totalPen: number;
  countBoleta: number;
  countFactura: number;
  countContado: number;
  countCredito: number;
}

interface CashGroup {
  empresa: string;
  items: CashEntryWithDate[];
  total: number;
  countBoleta: number;
  countFactura: number;
}

const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
const yearStart = () => `${new Date().getFullYear()}-01-01`;

const voucherBadge = (type: string) =>
  type === 'BOLETA' ? 'bg-primary-100 text-primary-800' : 'bg-blue-100 text-blue-800';

const cleanDesc = (desc: string) => desc.replace(/\s*\[.*?\]\s*$/, '');

export function InvoicesPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('purchases');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(todayKey);
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [grModal, setGrModal] = useState<{ purchaseId: string; grSeries: string; grNumber: string; grDate: string } | null>(null);
  const updateMeta = useUpdatePurchaseMeta();

  const openGrModal = (p: Purchase) => {
    setGrModal({
      purchaseId: p.id,
      grSeries: p.grSeries || '',
      grNumber: p.grNumber || '',
      grDate: p.grDate ? p.grDate.slice(0, 10) : '',
    });
  };

  const handleGrSave = async () => {
    if (!grModal) return;
    await updateMeta.mutateAsync({
      id: grModal.purchaseId,
      data: { grSeries: grModal.grSeries, grNumber: grModal.grNumber, grDate: grModal.grDate },
    });
    setGrModal(null);
  };

  const { data: purchasesData, isLoading: purchasesLoading } = usePurchases({
    startDate, endDate, limit: 500, page: 1,
  });

  const { data: registersData, isLoading: registersLoading } = useCashRegisters({
    startDate, endDate, limit: 500, page: 1,
  });

  const purchases: Purchase[] = useMemo(() => {
    const all: Purchase[] = (purchasesData as any)?.data ?? [];
    return all.filter((p) => p.documentType === 'FACTURA' || p.documentType === 'BOLETA');
  }, [purchasesData]);

  const cashEntries: CashEntryWithDate[] = useMemo(() => {
    const registers: CashRegister[] = (registersData as any)?.data ?? [];
    return registers.flatMap((r) =>
      r.entries
        .filter((e) => !e.isDeleted && e.type === 'EXPENSE' && (e.voucherType === 'BOLETA' || e.voucherType === 'FACTURA'))
        .map((e) => ({ ...e, registerDate: r.date })),
    );
  }, [registersData]);

  const filteredPurchases = useMemo(() => {
    if (!search) return purchases;
    const q = search.toLowerCase();
    return purchases.filter(
      (p) =>
        p.supplier?.toLowerCase().includes(q) ||
        p.documentSeries?.toLowerCase().includes(q) ||
        p.documentNumber?.toLowerCase().includes(q),
    );
  }, [purchases, search]);

  const filteredCashEntries = useMemo(() => {
    if (!search) return cashEntries;
    const q = search.toLowerCase();
    return cashEntries.filter(
      (e) =>
        cleanDesc(e.description).toLowerCase().includes(q) ||
        e.voucherSeries?.toLowerCase().includes(q) ||
        e.voucherNumber?.toLowerCase().includes(q),
    );
  }, [cashEntries, search]);

  const purchaseGroups: PurchaseGroup[] = useMemo(() => {
    const map = new Map<string, PurchaseGroup>();
    for (const p of filteredPurchases) {
      const key = p.supplier || '(Sin proveedor)';
      if (!map.has(key)) {
        map.set(key, { supplier: key, items: [], totalPen: 0, countBoleta: 0, countFactura: 0, countContado: 0, countCredito: 0 });
      }
      const g = map.get(key)!;
      g.items.push(p);
      g.totalPen += p.totalCost || 0;
      if (p.documentType === 'BOLETA') g.countBoleta++;
      if (p.documentType === 'FACTURA') g.countFactura++;
      if (p.paymentType === 'CONTADO') g.countContado++;
      if (p.paymentType === 'CREDITO') g.countCredito++;
    }
    return Array.from(map.values()).sort((a, b) => b.totalPen - a.totalPen);
  }, [filteredPurchases]);

  const cashGroups: CashGroup[] = useMemo(() => {
    const map = new Map<string, CashGroup>();
    for (const e of filteredCashEntries) {
      const key = cleanDesc(e.description) || '(Sin descripción)';
      if (!map.has(key)) {
        map.set(key, { empresa: key, items: [], total: 0, countBoleta: 0, countFactura: 0 });
      }
      const g = map.get(key)!;
      g.items.push(e);
      g.total += e.amount;
      if (e.voucherType === 'BOLETA') g.countBoleta++;
      if (e.voucherType === 'FACTURA') g.countFactura++;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredCashEntries]);

  const totalPurchases = useMemo(() => filteredPurchases.reduce((s, p) => s + (p.totalCost || 0), 0), [filteredPurchases]);
  const totalCash = useMemo(() => filteredCashEntries.reduce((s, e) => s + e.amount, 0), [filteredCashEntries]);

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const isLoading = activeTab === 'purchases' ? purchasesLoading : registersLoading;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Receipt size={24} className="text-gray-800" />
        <h1 className="text-2xl font-bold text-gray-800">Facturas y Boletas</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Proveedor, serie, número..."
                className="pl-8 pr-8 py-2 border rounded-lg text-sm w-56"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* View mode toggle */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Vista</label>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              title="Vista lista"
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <List size={15} /> Lista
            </button>
            <button
              onClick={() => { setViewMode('grouped'); setExpandedGroups(new Set()); }}
              title="Agrupar por almacén"
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-l border-gray-200 transition-colors ${
                viewMode === 'grouped' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Layers size={15} /> Agrupado
            </button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500 mb-1">Compras con comprobante</div>
          <div className="text-xl font-bold text-gray-800">{filteredPurchases.length}</div>
          <div className="text-sm text-gray-500 mt-1">S/ {totalPurchases.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500 mb-1">Egresos de caja con comprobante</div>
          <div className="text-xl font-bold text-gray-800">{filteredCashEntries.length}</div>
          <div className="text-sm text-red-600 mt-1">- S/ {totalCash.toFixed(2)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-4">
        <button
          onClick={() => setActiveTab('purchases')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'purchases' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText size={15} />
          Compras ({viewMode === 'grouped' ? `${purchaseGroups.length} almacenes` : filteredPurchases.length})
        </button>
        <button
          onClick={() => setActiveTab('cash')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'cash' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Wallet size={15} />
          Caja Diaria ({viewMode === 'grouped' ? `${cashGroups.length} almacenes` : filteredCashEntries.length})
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      )}

      {/* PURCHASES TAB */}
      {!isLoading && activeTab === 'purchases' && (
        <>
          {filteredPurchases.length === 0 ? (
            <div className="bg-white rounded-lg border px-4 py-12 text-center text-gray-400 text-sm">
              No hay compras con boleta o factura en este período
            </div>
          ) : viewMode === 'list' ? (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serie - N°</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pago</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredPurchases.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{((d) => d ? `${d.slice(8,10)} - ${d.slice(5,7)} - ${d.slice(0,4)}` : '—')((p.issueDate || p.date)?.slice(0,10))}</td>
                        <td className="px-4 py-3 text-sm font-medium">{p.supplier}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${voucherBadge(p.documentType!)}`}>{p.documentType}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">
                          {p.documentSeries && p.documentNumber ? `${p.documentSeries}-${p.documentNumber}` : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium whitespace-nowrap">
                          {p.totalCostUsd != null ? `$ ${p.totalCostUsd.toFixed(2)}` : `S/ ${p.totalCost.toFixed(2)}`}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.paymentType === 'CONTADO' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {p.paymentType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <Link to={`/purchases/${p.id}`} state={{ from: '/invoices' }} className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-xs font-medium" title="Ver detalle">
                              <Eye size={15} /> Ver
                            </Link>
                            <button
                              onClick={() => openGrModal(p)}
                              title={p.grSeries || p.grNumber ? `GR: ${[p.grSeries, p.grNumber].filter(Boolean).join('-')}` : 'Añadir Guía de Remisión'}
                              className={`p-1 rounded hover:bg-gray-100 ${p.grSeries || p.grNumber ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                              <FileText size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-600">Total ({filteredPurchases.length} comprobantes)</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-800">S/ {totalPurchases.toFixed(2)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {purchaseGroups.map((g) => {
                const isOpen = expandedGroups.has(g.supplier);
                return (
                  <div key={g.supplier} className="bg-white rounded-lg border overflow-hidden">
                    <button
                      onClick={() => toggleGroup(g.supplier)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <span className="text-gray-400">
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                      <span className="flex-1 font-semibold text-gray-800 text-sm">{g.supplier}</span>
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        {g.countFactura > 0 && (
                          <span className="px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800">
                            {g.countFactura} factura{g.countFactura !== 1 ? 's' : ''}
                          </span>
                        )}
                        {g.countBoleta > 0 && (
                          <span className="px-2 py-0.5 rounded-full font-medium bg-primary-100 text-primary-800">
                            {g.countBoleta} boleta{g.countBoleta !== 1 ? 's' : ''}
                          </span>
                        )}
                        {g.countCredito > 0 && (
                          <span className="px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-800">
                            {g.countCredito} por pagar
                          </span>
                        )}
                        {g.countContado > 0 && (
                          <span className="px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                            {g.countContado} contado
                          </span>
                        )}
                        <span className="font-bold text-gray-800 text-sm">S/ {g.totalPen.toFixed(2)}</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Fecha</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Tipo</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Serie - N°</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase">Total</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase">Pago</th>
                              <th className="px-4 py-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {g.items.map((p) => (
                              <tr key={p.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2.5 text-sm text-gray-600 whitespace-nowrap">{((d) => d ? `${d.slice(8,10)} - ${d.slice(5,7)} - ${d.slice(0,4)}` : '—')((p.issueDate || p.date)?.slice(0,10))}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${voucherBadge(p.documentType!)}`}>{p.documentType}</span>
                                </td>
                                <td className="px-4 py-2.5 text-sm font-mono">
                                  {p.documentSeries && p.documentNumber ? `${p.documentSeries}-${p.documentNumber}` : <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-4 py-2.5 text-sm text-right font-medium whitespace-nowrap">
                                  {p.totalCostUsd != null ? `$ ${p.totalCostUsd.toFixed(2)}` : `S/ ${p.totalCost.toFixed(2)}`}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.paymentType === 'CONTADO' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {p.paymentType}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <div className="flex items-center gap-2 justify-center">
                                    <Link to={`/purchases/${p.id}`} state={{ from: '/invoices' }} className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-xs font-medium" title="Ver detalle">
                                      <Eye size={14} /> Ver
                                    </Link>
                                    <button
                                      onClick={() => openGrModal(p)}
                                      title={p.grSeries || p.grNumber ? `GR: ${[p.grSeries, p.grNumber].filter(Boolean).join('-')}` : 'Añadir Guía de Remisión'}
                                      className={`p-1 rounded hover:bg-gray-100 ${p.grSeries || p.grNumber ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                      <FileText size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="bg-gray-50 rounded-lg border px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">
                  Total — {purchaseGroups.length} {purchaseGroups.length === 1 ? 'almacén' : 'almacenes'}, {filteredPurchases.length} comprobante{filteredPurchases.length !== 1 ? 's' : ''}
                </span>
                <span className="text-sm font-bold text-gray-800">S/ {totalPurchases.toFixed(2)}</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* CASH TAB */}
      {!isLoading && activeTab === 'cash' && (
        <>
          {filteredCashEntries.length === 0 ? (
            <div className="bg-white rounded-lg border px-4 py-12 text-center text-gray-400 text-sm">
              No hay egresos con boleta o factura en este período
            </div>
          ) : viewMode === 'list' ? (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serie - N°</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCashEntries.map((e, idx) => (
                      <tr key={`${e.id}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{e.registerDate}</td>
                        <td className="px-4 py-3 text-sm">{cleanDesc(e.description)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${voucherBadge(e.voucherType)}`}>{e.voucherType}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">
                          {e.voucherSeries && e.voucherNumber ? `${e.voucherSeries}-${e.voucherNumber}` : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-red-600 whitespace-nowrap">- S/ {e.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-600">Total ({filteredCashEntries.length} comprobantes)</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-red-700">- S/ {totalCash.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {cashGroups.map((g) => {
                const isOpen = expandedGroups.has(g.empresa);
                return (
                  <div key={g.empresa} className="bg-white rounded-lg border overflow-hidden">
                    <button
                      onClick={() => toggleGroup(g.empresa)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <span className="text-gray-400">
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                      <span className="flex-1 font-semibold text-gray-800 text-sm">{g.empresa}</span>
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        {g.countFactura > 0 && (
                          <span className="px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800">
                            {g.countFactura} factura{g.countFactura !== 1 ? 's' : ''}
                          </span>
                        )}
                        {g.countBoleta > 0 && (
                          <span className="px-2 py-0.5 rounded-full font-medium bg-primary-100 text-primary-800">
                            {g.countBoleta} boleta{g.countBoleta !== 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="font-bold text-red-700 text-sm">- S/ {g.total.toFixed(2)}</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Fecha</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Tipo</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Serie - N°</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase">Monto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {g.items.map((e, idx) => (
                              <tr key={`${e.id}-${idx}`} className="hover:bg-gray-50">
                                <td className="px-4 py-2.5 text-sm text-gray-600 whitespace-nowrap">{e.registerDate}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${voucherBadge(e.voucherType)}`}>{e.voucherType}</span>
                                </td>
                                <td className="px-4 py-2.5 text-sm font-mono">
                                  {e.voucherSeries && e.voucherNumber ? `${e.voucherSeries}-${e.voucherNumber}` : <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-4 py-2.5 text-sm text-right font-medium text-red-600 whitespace-nowrap">- S/ {e.amount.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="bg-gray-50 rounded-lg border px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">
                  Total — {cashGroups.length} {cashGroups.length === 1 ? 'almacén' : 'almacenes'}, {filteredCashEntries.length} comprobante{filteredCashEntries.length !== 1 ? 's' : ''}
                </span>
                <span className="text-sm font-bold text-red-700">- S/ {totalCash.toFixed(2)}</span>
              </div>
            </div>
          )}
        </>
      )}

      <Modal isOpen={!!grModal} onClose={() => setGrModal(null)} title="Guía de Remisión">
        {grModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Serie</label>
                <input
                  value={grModal.grSeries}
                  onChange={(e) => setGrModal({ ...grModal, grSeries: e.target.value.toUpperCase() })}
                  placeholder="T001"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Correlativo</label>
                <input
                  value={grModal.grNumber}
                  onChange={(e) => setGrModal({ ...grModal, grNumber: e.target.value })}
                  placeholder="00000001"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                <input
                  type="date"
                  value={grModal.grDate}
                  onChange={(e) => setGrModal({ ...grModal, grDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setGrModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGrSave}
                disabled={updateMeta.isPending}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {updateMeta.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
