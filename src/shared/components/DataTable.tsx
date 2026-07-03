import React, { useRef } from 'react';
import { FixedScrollbar } from './FixedScrollbar';

interface Column<T> { key: string; header: string; render?: (item: T) => React.ReactNode; }
interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
  hoverClass?: string;
  rowClassName?: (item: T) => string;
  renderSubRow?: (item: T) => React.ReactNode;
  compact?: boolean;
}

export function DataTable<T extends { id?: string }>({
  columns,
  data,
  isLoading,
  onRowClick,
  hoverClass,
  rowClassName,
  renderSubRow,
  compact = false,
}: DataTableProps<T>) {
  const tableWrapRef = useRef<HTMLDivElement>(null);

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
              data.map((item, index) => {
                const subRow = renderSubRow?.(item);
                return (
                  <React.Fragment key={item.id || index}>
                    <tr
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
                    {subRow && (
                      <tr>
                        <td colSpan={columns.length} className="px-0 py-0">
                          {subRow}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <FixedScrollbar targetRef={tableWrapRef} deps={[isLoading, data, columns]} />
    </>
  );
}
