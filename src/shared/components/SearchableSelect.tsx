import React, { useState, useRef, useEffect } from 'react';

interface Option { value: string; label: string; }
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
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find(o => o.value === value)?.label || '';

  const filtered = search.length >= minChars
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (!value) setSearch('');
        else setSearch(selectedLabel);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, selectedLabel]);

  const handleFocus = () => {
    setIsOpen(true);
    setSearch('');
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

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : selectedLabel}
          onChange={(e) => { setSearch(e.target.value); setIsOpen(true); if (!e.target.value) onChange(''); }}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={`w-full px-2 py-1.5 border rounded text-sm bg-white pr-7 ${className}`}
          required={required}
          autoComplete="off"
        />
        {value && (
          <button type="button" onClick={handleClear} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs leading-none">&times;</button>
        )}
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {search.length < minChars ? (
            <div className="px-3 py-2 text-xs text-gray-400">Escribe al menos {minChars} caracteres...</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">Sin resultados</div>
          ) : (
            filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => handleSelect(o.value, o.label)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-green-50 ${o.value === value ? 'bg-green-50 font-medium' : ''}`}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
