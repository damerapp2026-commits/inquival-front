import React from 'react';

interface Column<T> { key: string; header: string; render?: (item: T) => React.ReactNode; }
interface DataTableProps<T> { columns: Column<T>[]; data: T[]; isLoading?: boolean; onRowClick?: (item: T) => void; }

export function DataTable<T extends { id?: string }>({ columns, data, isLoading, onRowClick }: DataTableProps<T>) {
  if (isLoading) return <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded" />)}</div>;

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>{columns.map((col) => <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col.header}</th>)}</tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">No hay datos disponibles</td></tr>
          ) : data.map((item, index) => (
            <tr key={item.id || index} onClick={() => onRowClick?.(item)} className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}>
              {columns.map((col) => <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{col.render ? col.render(item) : (item as any)[col.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
