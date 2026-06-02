import React, { useRef, useEffect, useState } from 'react';

interface Column<T> { key: string; header: string; render?: (item: T) => React.ReactNode; }
interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
  hoverClass?: string;
  rowClassName?: (item: T) => string;
  compact?: boolean;
}

export function DataTable<T extends { id?: string }>({
  columns,
  data,
  isLoading,
  onRowClick,
  hoverClass,
  rowClassName,
  compact = false,
}: DataTableProps<T>) {
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const fixedBarRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [barLeft, setBarLeft] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const [innerWidth, setInnerWidth] = useState(0);

  const syncGeometry = () => {
    const el = tableWrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setBarLeft(rect.left);
    setBarWidth(rect.width);
    setInnerWidth(el.scrollWidth);
    setHasOverflow(el.scrollWidth > el.clientWidth + 1);
  };

  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;

    syncGeometry();

    const ro = new ResizeObserver(syncGeometry);
    ro.observe(el);

    // Reposicionar cuando el sidebar se colapsa/expande o la ventana cambia
    let raf = 0;
    const onAnyScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(syncGeometry); };
    window.addEventListener('resize', syncGeometry);
    window.addEventListener('scroll', onAnyScroll, true);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncGeometry);
      window.removeEventListener('scroll', onAnyScroll, true);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => { syncGeometry(); }, [data, columns]);

  // Scroll bidireccional — se re-engancha cada vez que la barra fija monta/desmonta
  useEffect(() => {
    const tableEl = tableWrapRef.current;
    const barEl = fixedBarRef.current;
    if (!tableEl || !barEl) return;
    let lock = false;
    const onTable = () => { if (!lock) { lock = true; barEl.scrollLeft = tableEl.scrollLeft; lock = false; } };
    const onBar   = () => { if (!lock) { lock = true; tableEl.scrollLeft = barEl.scrollLeft; lock = false; } };
    tableEl.addEventListener('scroll', onTable);
    barEl.addEventListener('scroll', onBar);
    return () => {
      tableEl.removeEventListener('scroll', onTable);
      barEl.removeEventListener('scroll', onBar);
    };
  }, [hasOverflow]);

  if (isLoading)
    return (
      <div className="bg-white rounded-xl shadow-card p-4 animate-pulse space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );

  return (
    <>
      <div ref={tableWrapRef} className="overflow-x-auto bg-white rounded-xl shadow-card">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${compact ? 'px-3 py-2' : 'px-4 sm:px-6 py-3'} text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/60`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-10 text-center text-sm text-gray-400">
                  No hay datos disponibles
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={item.id || index}
                  onClick={() => onRowClick?.(item)}
                  className={`transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${
                    rowClassName ? rowClassName(item) : hoverClass || (onRowClick ? 'hover:bg-primary-50/40' : '')
                  }`.trim()}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`${compact ? 'px-3 py-2' : 'px-4 sm:px-6 py-3.5'} whitespace-nowrap text-sm text-gray-700`}
                    >
                      {col.render ? col.render(item) : (item as any)[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Scrollbar horizontal fija al fondo del viewport — solo desktop con overflow */}
      {hasOverflow && (
        <div
          ref={fixedBarRef}
          className="hidden lg:block fixed bottom-0 overflow-x-auto z-40 bg-white border-t border-gray-200"
          style={{ left: barLeft, width: barWidth }}
        >
          <div style={{ width: innerWidth, height: '1px' }} />
        </div>
      )}
    </>
  );
}
