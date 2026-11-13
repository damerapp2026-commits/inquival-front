import React, { useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { FileDown, ChevronDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getStatementCredits } from '../services/clientStatementService';
import { downloadClientStatementPdf } from '../utils/creditsPdf';
import { ClientStatementModal } from '../../clients/components/ClientStatementModal';
import { Modal } from '../../../shared/components/Modal';
import { ClientStatementPeriodFilter } from './ClientStatementPeriodFilter';
import { ClientStatementAccountSelector } from './ClientStatementAccountSelector';
import { filterStatementCredits, selectClientStatementData, selectedStatementPeriod, statementPeriodError, statementPeriodSelection } from '../utils/clientStatementPeriod';
import type { Client, CreditAccount } from '../../../shared/types';

interface Props {
  client: Client;
  credits?: CreditAccount[];
  variant?: 'button' | 'icon';
  label?: string;
}

const MENU_WIDTH = 240;

export function ExportClientStatementButton({ client, credits, variant = 'button', label = 'Estado de cuenta' }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [periodSelection, setPeriodSelection] = useState(() => statementPeriodSelection());
  const [selectedCreditIds, setSelectedCreditIds] = useState<string[] | undefined>();
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const period = selectedStatementPeriod(periodSelection);
  const periodError = statementPeriodError(period);
  const { data: loadedCredits, isLoading: loadingCredits, isError: creditsError, refetch } = useQuery({
    queryKey: ['credits', 'client', client.id, 'statement'],
    queryFn: () => getStatementCredits(client.id),
    enabled: showSummaryModal && credits === undefined,
  });
  const availableCredits = credits ?? loadedCredits ?? [];
  const periodCredits = periodError ? [] : filterStatementCredits(availableCredits, period);
  const exportCredits = periodError ? [] : selectClientStatementData(availableCredits, undefined, period, selectedCreditIds).credits;

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const top = rect.bottom + 4;
    let left = rect.right - MENU_WIDTH;
    if (left < 8) left = 8;
    if (left + MENU_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - MENU_WIDTH - 8;
    }
    setCoords({ top, left });
  }, [open]);

  const handleExportSummary = async () => {
    if (periodError || !exportCredits.length) return;
    setLoading(true);
    try {
      await downloadClientStatementPdf({ client, credits: availableCredits, mode: 'summary', period, creditIds: selectedCreditIds });
      toast.success('PDF generado');
      setOpen(false);
      setShowSummaryModal(false);
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
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  setShowSummaryModal(true);
                }}
                disabled={loading}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  {loading && <Loader2 size={11} className="animate-spin" />}
                  <div>
                    <div className="font-medium text-gray-800">Resumen de cuenta</div>
                    <div className="text-[10px] text-gray-500">Elegir periodo y descargar PDF</div>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  setShowDetailModal(true);
                }}
                disabled={loading}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs border-t border-gray-100 disabled:opacity-50"
              >
                <div>
                  <div className="font-medium text-gray-800">Detallado</div>
                  <div className="text-[10px] text-gray-500">Ver ventas y créditos en pantalla</div>
                </div>
              </button>
            </div>
          </>,
          document.body,
        )}
      {(showDetailModal || showSummaryModal) && createPortal(
        <div onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <ClientStatementModal client={showDetailModal ? client : null} onClose={() => setShowDetailModal(false)}
        selection={{ period: periodSelection, creditIds: selectedCreditIds }} onSelectionChange={value => { setPeriodSelection(value.period); setSelectedCreditIds(value.creditIds); }} />
      <Modal isOpen={showSummaryModal} onClose={() => { if (!loading) setShowSummaryModal(false); }} title="Exportar estado de cuenta" size="lg">
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700">{client.name}</p>
          <ClientStatementPeriodFilter value={periodSelection} onChange={setPeriodSelection} disabled={loading} />
          {loadingCredits && credits === undefined ? <p role="status" className="text-sm text-gray-500">Cargando cuentas del cliente...</p>
            : creditsError && credits === undefined ? <div className="text-sm text-red-600"><p role="alert">No se pudieron cargar las cuentas.</p><button type="button" onClick={() => { void refetch(); }} className="mt-2 text-primary-700 hover:underline">Reintentar</button></div>
            : <ClientStatementAccountSelector credits={periodCredits} value={selectedCreditIds} onChange={setSelectedCreditIds} disabled={loading} />}
          {!loadingCredits && !creditsError && !periodError && !periodCredits.length && <p className="text-sm text-gray-500">No hay cuentas creadas en el periodo seleccionado.</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={loading} onClick={() => setShowSummaryModal(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 disabled:opacity-50">Cancelar</button>
            <button type="button" disabled={loading || loadingCredits || (creditsError && credits === undefined) || !!periodError || !exportCredits.length} onClick={() => { void handleExportSummary(); }} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
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
