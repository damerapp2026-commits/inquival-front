import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Option { value: string; label: string; sublabel?: string; }
interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  minChars?: number;
}

export function SearchableSelect({ options, value, onChange, placeholder = 'Buscar...', required, className = '', minChars = 2 }: SearchableSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedLabel = options.find(o => o.value === value)?.label || '';

  const filtered = search.length >= minChars
    ? options.filter(o => {
        const q = search.toLowerCase();
        return o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q));
      })
    : [];

  useEffect(() => { setHighlightedIndex(0); }, [search, isOpen]);

  useEffect(() => {
    if (isOpen && filtered.length > 0) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen, filtered.length]);

  const updatePosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const dropdown = document.getElementById('ss-dropdown');
        if (dropdown && dropdown.contains(e.target as Node)) return;
        setIsOpen(false);
        if (!value) setSearch('');
        else setSearch(selectedLabel);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, selectedLabel]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handler = () => updatePosition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [isOpen, updatePosition]);

  const handleFocus = () => {
    setIsOpen(true);
    setSearch('');
    updatePosition();
  };

  const handleSelect = (optionValue: string, label: string) => {
    onChange(optionValue);
    setSearch(label);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setSearch('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) { setIsOpen(true); return; }
      if (filtered.length === 0) return;
      setHighlightedIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length === 0) return;
      setHighlightedIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      if (isOpen && filtered.length > 0) {
        e.preventDefault();
        const opt = filtered[highlightedIndex];
        if (opt) handleSelect(opt.value, opt.label);
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
        setSearch(value ? selectedLabel : '');
      }
    }
  };

  const dropdown = isOpen ? createPortal(
    <div
      id="ss-dropdown"
      style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
      className="bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto"
    >
      {search.length < minChars ? (
        <div className="px-3 py-2 text-xs text-gray-400">Escribe al menos {minChars} caracter{minChars > 1 ? 'es' : ''}...</div>
      ) : filtered.length === 0 ? (
        <div className="px-3 py-2 text-xs text-gray-400">Sin resultados</div>
      ) : (
        filtered.map((o, idx) => (
          <button
            key={o.value}
            ref={(el) => { optionRefs.current[idx] = el; }}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleSelect(o.value, o.label); }}
            onMouseEnter={() => setHighlightedIndex(idx)}
            className={`w-full text-left px-3 py-2 text-sm ${idx === highlightedIndex ? 'bg-primary-100' : o.value === value ? 'bg-primary-50 font-medium' : 'hover:bg-primary-50'}`}
          >
            <div>{o.label}</div>
            {o.sublabel && <div className="text-xs text-gray-400 mt-0.5">{o.sublabel}</div>}
          </button>
        ))
      )}
    </div>,
    document.body,
  ) : null;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : selectedLabel}
          onChange={(e) => { setSearch(e.target.value); setIsOpen(true); if (!e.target.value) onChange(''); }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full px-2 py-1.5 border rounded text-sm bg-white pr-7 ${className}`}
          required={required}
          autoComplete="off"
        />
        {value && (
          <button type="button" onClick={handleClear} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs leading-none">&times;</button>
        )}
      </div>
      {dropdown}
    </div>
  );
}
