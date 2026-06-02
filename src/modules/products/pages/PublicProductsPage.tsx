import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/services/api';
import { Search, Package, FlaskConical } from 'lucide-react';

interface PublicProduct {
  id: string;
  name: string;
  unit: string;
  categoryName: string;
  laboratoryName?: string;
  activeIngredient?: string;
}

function fetchPublicProducts(): Promise<PublicProduct[]> {
  return api.get('/products/public').then((r) => {
    const d = r.data;
    return Array.isArray(d) ? d : (d?.data ?? []);
  });
}

export function PublicProductsPage() {
  const { data = [], isLoading } = useQuery<PublicProduct[]>({
    queryKey: ['products-public'],
    queryFn: fetchPublicProducts,
    staleTime: 60_000,
  });

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const cats: string[] = [];
    data.forEach((p) => { if (p.categoryName && !seen.has(p.categoryName)) { seen.add(p.categoryName); cats.push(p.categoryName); } });
    return cats.sort((a, b) => a.localeCompare(b, 'es'));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((p) => {
      const matchCat = !activeCategory || p.categoryName === activeCategory;
      const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.laboratoryName?.toLowerCase().includes(q)) || (p.activeIngredient?.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [data, search, activeCategory]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Package size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Lista de Productos</h1>
              {!isLoading && <p className="text-xs text-gray-400">{data.length} productos disponibles</p>}
            </div>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto, laboratorio..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
            />
          </div>
        </div>
        {/* Category chips */}
        {categories.length > 0 && (
          <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveCategory('')}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                !activeCategory ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? '' : cat)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin productos{search ? ` para "${search}"` : ''}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <div key={p.id} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm leading-snug">{p.name}</p>
                    {p.activeIngredient && (
                      <p className="text-xs text-gray-500 mt-0.5">{p.activeIngredient}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.categoryName}</span>
                      {p.laboratoryName && (
                        <span className="text-[11px] bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <FlaskConical size={10} />
                          {p.laboratoryName}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg mt-0.5">{p.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {!isLoading && filtered.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-4">{filtered.length} producto{filtered.length !== 1 ? 's' : ''}</p>
        )}
      </div>
    </div>
  );
}
