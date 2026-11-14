import React, { useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { FileDown, ChevronDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getStatementCredits, getStatementSales } from '../services/clientStatementService';
import { downloadClientStatementPdf } from '../utils/creditsPdf';
import { Modal } from '../../../shared/components/Modal';
import { ClientStatementPeriodFilter } from './ClientStatementPeriodFilter';
import { ClientStatementAccountSelector } from './ClientStatementAccountSelector';
import { filterStatementCredits, selectClientStatementData, selectedStatementPeriod, statementPeriodError, statementPeriodSelection } from '../utils/clientStatementPeriod';
import type { Client } from '../../../shared/types';
import { formatDateEs } from '../../../shared/utils/date.util';
import { formatMoney, saleCurrencyAmount } from '../utils/money';

interface Props {
  client: Client;
  variant?: 'button' | 'icon';
  label?: string;
}

const MENU_WIDTH = 240;
type ExportMode = 'summary' | 'sales' | 'payments';
const EXPORT_FORMATS: { mode: ExportMode; label: string; description: string; title: string }[] = [
  { mode: 'summary', label: 'Resumen de cuenta', description: 'Montos, abonos aplicados y saldo pendiente', title: 'Exportar estado de cuenta' },
  { mode: 'sales', label: 'Detalle de ventas', description: 'Notas de venta, productos, cantidades y precios', title: 'Exportar detalle de ventas' },
  { mode: 'payments', label: 'Detalle de abonos', description: 'Fechas, métodos, montos y observaciones', title: 'Exportar detalle de abonos' },
];

export function ExportClientStatementButton({ client, variant = 'button', label = 'Estado de cuenta' }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode | null>(null);
  const [periodSelection, setPeriodSelection] = useState(() => statementPeriodSelection());
  const [selectedCreditIds, setSelectedCreditIds] = useState<string[] | undefined>();
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const period = selectedStatementPeriod(periodSelection);
  const periodError = statementPeriodError(period);
  const { data: loadedCredits, isLoading: loadingCredits, isError: creditsError, refetch } = useQuery({
    queryKey: ['credits', 'client', client.id, 'statement'],
    queryFn: () => getStatementCredits(client.id),
    enabled: exportMode !== null,
  });
  const { data: loadedSales, isLoading: loadingSales, isError: salesError, refetch: refetchSales } = useQuery({
    queryKey: ['sales', 'client', client.id, 'statement'],
    queryFn: () => getStatementSales(client.id),
    enabled: exportMode === 'sales',
  });
  const format = EXPORT_FORMATS.find(item => item.mode === exportMode);
  const loadingData = loadingCredits || (exportMode === 'sales' && loadingSales);
  const dataError = creditsError || (exportMode === 'sales' && salesError);
  const availableCredits = loadedCredits ?? [];
  const periodCredits = periodError ? [] : filterStatementCredits(availableCredits, period);
  const exportData = periodError ? { credits: [], sales: [] } : selectClientStatementData(availableCredits, exportMode === 'sales' ? loadedSales : undefined, period, selectedCreditIds);
  const empty = exportMode === 'sales' ? !exportData.sales.length : !exportData.credits.length;

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const top = rect.bottom + 4 + 172 <= window.innerHeight - 8 ? rect.bottom + 4 : Math.max(8, rect.top - 176);
    let left = rect.right - MENU_WIDTH;
    if (left < 8) left = 8;
    if (left + MENU_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - MENU_WIDTH - 8;
    }
    setCoords({ top, left });
  }, [open]);

  const handleExport = async () => {
    if (!exportMode || periodError || empty || loadingData || dataError) return;
    setLoading(true);
    try {
      await downloadClientStatementPdf({ client, credits: availableCredits, sales: exportMode === 'sales' ? loadedSales : undefined, mode: exportMode, period, creditIds: selectedCreditIds });
      toast.success('PDF generado');
      setOpen(false);
      setExportMode(null);
    } catch {
      toast.error('Error al generar el PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
  };

  const closeMenu = () => setOpen(false);

  return (
    <>
      {variant === 'icon' ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          className="text-gray-500 hover:text-primary-600"
          title="Descargar estado de cuenta"
        >
          <FileDown size={16} />
        </button>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300"
        >
          <FileDown size={12} /> {label} <ChevronDown size={11} />
        </button>
      )}
      {open && coords &&
        createPortal(
          <>
            <div
              className="fixed inset-0"
              style={{ zIndex: 9998 }}
              onClick={(e) => {
                e.stopPropagation();
                closeMenu();
              }}
            />
            <div
              className="fixed bg-white border border-gray-200 rounded-lg shadow-xl py-1"
              style={{ top: coords.top, left: coords.left, width: MENU_WIDTH, zIndex: 9999 }}
              onClick={(e) => e.stopPropagation()}
            >
              {EXPORT_FORMATS.map((item, index) => <button
                key={item.mode}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  setExportMode(item.mode);
                }}
                disabled={loading}
                className={`w-full text-left px-3 py-2 hover:bg-gray-50 text-xs disabled:opacity-50 ${index ? 'border-t border-gray-100' : ''}`}
              >
                <div className="flex items-center gap-2">
                  {loading && <Loader2 size={11} className="animate-spin" />}
                  <div>
                    <div className="font-medium text-gray-800">{item.label}</div>
                    <div className="text-[10px] text-gray-500">{item.description}</div>
                  </div>
                </div>
              </button>)}
            </div>
          </>,
          document.body,
        )}
      {exportMode !== null && createPortal(
        <div onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <Modal isOpen onClose={() => { if (!loading) setExportMode(null); }} title={format?.title || 'Exportar estado de cuenta'} size="lg">
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700">{client.name}</p>
          <p className="text-xs text-gray-500">{format?.description}</p>
          <ClientStatementPeriodFilter value={periodSelection} onChange={setPeriodSelection} disabled={loading} />
          {loadingData ? <p role="status" className="text-sm text-gray-500">Cargando {exportMode === 'sales' ? 'cuentas y ventas' : 'cuentas'} del cliente...</p>
            : dataError ? <div className="text-sm text-red-600"><p role="alert">No se pudieron cargar los datos completos del cliente.</p><button type="button" onClick={() => { void refetch(); if (exportMode === 'sales') void refetchSales(); }} className="mt-2 text-primary-700 hover:underline">Reintentar</button></div>
            : <ClientStatementAccountSelector credits={periodCredits} value={selectedCreditIds} onChange={setSelectedCreditIds} disabled={loading}
                totalAccounts={new Set(availableCredits.map(credit => credit.id)).size} periodError={periodError}
                onShowAll={period ? () => setPeriodSelection(statementPeriodSelection('all')) : undefined} />}
          {exportMode === 'sales' && !loadingData && !dataError && !periodError && <p className="text-xs text-gray-600">{exportData.sales.length ? `Se exportarán ${exportData.sales.length} ventas con sus productos.` : 'No hay ventas para las cuentas y el periodo seleccionados.'}</p>}
          {exportMode === 'sales' && !loadingData && !dataError && exportData.sales.length > 0 && <div className="max-h-52 overflow-auto rounded-lg border border-gray-200">
            <table className="w-full text-xs" aria-label="Ventas a exportar">
              <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Nota de venta</th><th className="px-3 py-2 text-left">Fecha</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
              <tbody>{exportData.sales.slice(0, 20).map(sale => {
                const total = saleCurrencyAmount(sale, sale.total, sale.totalUsd);
                return <tr key={sale.id} className="border-t border-gray-100"><td className="px-3 py-2">{sale.saleNumber || 'Venta sin número'}</td><td className="px-3 py-2 whitespace-nowrap">{formatDateEs(sale.date)}</td><td className="px-3 py-2 text-right whitespace-nowrap">{total == null ? 'No registrado' : formatMoney(total, sale.currency)}</td></tr>;
              })}</tbody>
            </table>
            {exportData.sales.length > 20 && <p className="px-3 py-2 text-xs text-gray-500">Vista previa de 20 de {exportData.sales.length} ventas. El PDF incluirá todas las seleccionadas.</p>}
          </div>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={loading} onClick={() => setExportMode(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 disabled:opacity-50">Cancelar</button>
            <button type="button" disabled={loading || loadingData || dataError || !!periodError || empty} onClick={() => { void handleExport(); }} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} {loading ? 'Generando...' : 'Descargar PDF'}
            </button>
          </div>
        </div>
      </Modal>
        </div>, document.body,
      )}
    </>
  );
}
