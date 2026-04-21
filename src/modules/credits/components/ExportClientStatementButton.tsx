import React, { useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileDown, ChevronDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { creditService } from '../services/creditService';
import { downloadClientStatementPdf } from '../utils/creditsPdf';
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
  const [loading, setLoading] = useState<'summary' | 'detailed' | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  const handleExport = async (mode: 'summary' | 'detailed') => {
    setLoading(mode);
    try {
      let list: CreditAccount[] = credits || [];
      if (!credits) {
        const result = await creditService.getAll({ clientId: client.id, limit: 1000 });
        list = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
      }
      if (list.length === 0) {
        toast.error('Este cliente no tiene créditos para exportar');
        setOpen(false);
        return;
      }
      downloadClientStatementPdf({ client, credits: list, mode });
      toast.success('PDF generado');
      setOpen(false);
    } catch {
      toast.error('Error al generar el PDF');
    } finally {
      setLoading(null);
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
                  handleExport('summary');
                }}
                disabled={!!loading}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  {loading === 'summary' && <Loader2 size={11} className="animate-spin" />}
                  <div>
                    <div className="font-medium text-gray-800">Resumen por fecha</div>
                    <div className="text-[10px] text-gray-500">Listado de cuentas con totales</div>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExport('detailed');
                }}
                disabled={!!loading}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs border-t border-gray-100 disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  {loading === 'detailed' && <Loader2 size={11} className="animate-spin" />}
                  <div>
                    <div className="font-medium text-gray-800">Detallado</div>
                    <div className="text-[10px] text-gray-500">Productos y pagos de cada cuenta</div>
                  </div>
                </div>
              </button>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
