import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Search, X, Plus } from 'lucide-react';

interface SmartSearchSelectProps<T> {
  items: T[];
  value: string;
  onChange: (id: string) => void;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => ReactNode;
  searchFields: (item: T) => Array<string | undefined | null>;
  placeholder?: string;
  emptyText?: string;
  maxResults?: number;
  /** Footer button shown when no exact match exists; tap fires this and closes the panel. Receives the current search text. */
  onAddNew?: (searchText: string) => void;
  addNewLabel?: string;
  /** Visual treatment for the selected chip */
  accent?: 'primary' | 'gray';
  className?: string;
}

export function SmartSearchSelect<T>({
  items,
  value,
  onChange,
  getId,
  getLabel,
  getSubLabel,
  searchFields,
  placeholder = 'Buscar…',
  emptyText = 'Sin resultados',
  maxResults = 30,
  onAddNew,
  addNewLabel = 'Añadir nuevo',
  accent = 'primary',
  className = '',
}: SmartSearchSelectProps<T>) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selected = items.find((i) => getId(i) === value);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const q = search.trim().toLowerCase();
  const matches = q
    ? items
        .filter((i) => searchFields(i).some((f) => (f || '').toLowerCase().includes(q)))
        .slice(0, maxResults)
    : [];

  useEffect(() => { setHighlightedIndex(0); }, [search, open]);

  useEffect(() => {
    if (open && matches.length > 0) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, open, matches.length]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      if (matches.length === 0) return;
      setHighlightedIndex((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (matches.length === 0) return;
      setHighlightedIndex((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      if (open && matches.length > 0) {
        e.preventDefault();
        const item = matches[highlightedIndex];
        if (item) { onChange(getId(item)); setSearch(''); setOpen(false); }
      } else if (open && matches.length === 0 && q && onAddNew) {
        e.preventDefault();
        onAddNew(search.trim()); setSearch(''); setOpen(false);
      }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); setOpen(false); }
    }
  };

  const accentChip = accent === 'primary'
    ? 'border-primary-300 bg-primary-50 text-primary-800'
    : 'border-gray-300 bg-gray-50 text-gray-800';
  const accentChipBtn = accent === 'primary'
    ? 'text-primary-700 hover:bg-primary-100'
    : 'text-gray-700 hover:bg-gray-200';

  if (selected) {
    return (
      <div className={`flex items-center justify-between gap-2 px-4 py-3 border-2 rounded-xl ${accentChip} ${className}`}>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{getLabel(selected)}</div>
          {getSubLabel && (
            <div className="text-xs opacity-80 mt-0.5 truncate">{getSubLabel(selected)}</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => { onChange(''); setSearch(''); }}
          className={`p-1.5 rounded-lg flex-shrink-0 ${accentChipBtn}`}
          title="Quitar"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 bg-white"
        autoComplete="off"
      />
      {open && q.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {matches.length > 0 ? (
            matches.map((item, idx) => {
              const id = getId(item);
              return (
                <button
                  key={id}
                  ref={(el) => { optionRefs.current[idx] = el; }}
                  type="button"
                  onClick={() => { onChange(id); setSearch(''); setOpen(false); }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`w-full text-left px-4 py-2.5 border-b border-gray-50 last:border-0 ${idx === highlightedIndex ? 'bg-primary-100' : 'hover:bg-primary-50'}`}
                >
                  <div className="text-sm font-medium text-gray-800">{getLabel(item)}</div>
                  {getSubLabel && (
                    <div className="text-xs text-gray-500 mt-0.5">{getSubLabel(item)}</div>
                  )}
                </button>
              );
            })
          ) : (
            <div className="px-4 py-3 text-xs text-gray-400 text-center">{emptyText}</div>
          )}
          {onAddNew && (
            <button
              type="button"
              onClick={() => { onAddNew(search.trim()); setSearch(''); setOpen(false); }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-primary-700 hover:bg-primary-50 border-t border-gray-100 sticky bottom-0 bg-white"
            >
              <Plus size={15} /> {addNewLabel} <span className="text-gray-400 font-normal truncate">"{search.trim()}"</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
