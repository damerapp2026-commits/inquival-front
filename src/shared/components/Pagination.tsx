import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps { page: number; totalPages: number; onPageChange: (page: number) => void; }

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const [inputValue, setInputValue] = useState(String(page));

  useEffect(() => { setInputValue(String(page)); }, [page]);

  const handleSubmit = () => {
    const num = parseInt(inputValue, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      onPageChange(num);
    } else {
      setInputValue(String(page));
    }
  };

  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="p-2 rounded-lg border border-gray-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 hover:border-gray-300 transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm text-gray-500">Página</span>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        className="w-12 text-center text-sm font-medium border border-gray-200 rounded-lg py-1 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
      />
      <span className="text-sm text-gray-500">de {totalPages}</span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="p-2 rounded-lg border border-gray-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 hover:border-gray-300 transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
