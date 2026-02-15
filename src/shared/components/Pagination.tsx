import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps { page: number; totalPages: number; onPageChange: (page: number) => void; }

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="p-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"><ChevronLeft size={16} /></button>
      <span className="text-sm text-gray-600">Página {page} de {totalPages}</span>
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="p-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"><ChevronRight size={16} /></button>
    </div>
  );
}
