import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../hooks/useProducts';
import { productService } from '../services/productService';
import { categoryService } from '../../categories/services/categoryService';
import { usePriceTiers } from '../../price-tiers/hooks/usePriceTiers';
import { useCategories } from '../../categories/hooks/useCategories';
import { useUnits } from '../../units/hooks/useUnits';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { Plus, Search, Edit2, Trash2, ChevronDown, ChevronUp, Copy, X, Layers, Download, Upload, Truck } from 'lucide-react';
import { ProductSuppliersModal } from '../components/ProductSuppliersModal';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import type { Product } from '../../../shared/types';

const TAX_TYPES = [
  { value: 'GRAVADO', label: 'Gravado (IGV 18%)' },
  { value: 'EXONERADO', label: 'Exonerado' },
  { value: 'INAFECTO', label: 'Inafecto' },
];

interface BulkProduct {
  name: string;
  description: string;
  categoryId: string;
  unit: string;
  taxType: string;
  prices: { priceTierId: string; companyId?: string; price: number }[];
  initialStocks: { companyId: string; quantity: number }[];
  expanded: boolean;
}

export function ProductsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeIngredientFilter, setActiveIngredientFilter] = useState('');
  const debouncedSearch = useDebounce(search);
  const debouncedIngredient = useDebounce(activeIngredientFilter);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [priceCompanyFilter, setPriceCompanyFilter] = useState('');

  const queryClient = useQueryClient();
  const { data, isLoading } = useProducts({ page, limit: 20, search: debouncedSearch, activeIngredient: debouncedIngredient || undefined });
  const { data: priceTiers } = usePriceTiers();
  const { data: categories } = useCategories();
  const { data: companies } = useCompanies();
  const { data: unitsData } = useUnits();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [form, setForm] = useState({ name: '', description: '', categoryId: '', unit: '', activeIngredient: '', taxType: 'GRAVADO', tracksLot: false, prices: [] as { priceTierId: string; companyId?: string; price: number }[], initialStocks: [] as { companyId: string; quantity: number }[] });
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [suppliersTarget, setSuppliersTarget] = useState<Product | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkProducts, setBulkProducts] = useState<BulkProduct[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const allUnits: { value: string; label: string }[] = Array.isArray(unitsData)
    ? unitsData.filter((u: any) => u.isActive).map((u: any) => ({ value: u.name, label: u.abbreviation ? `${u.name} (${u.abbreviation})` : u.name }))
    : [];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const emptyBulkProduct = (): BulkProduct => ({ name: '', description: '', categoryId: '', unit: '', taxType: 'GRAVADO', prices: [], initialStocks: [], expanded: true });


  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', categoryId: '', unit: allUnits[0]?.value || '', activeIngredient: '', taxType: 'GRAVADO', tracksLot: false, prices: [], initialStocks: [] }); setShowModal(true); };
  const openEdit = (product: Product) => { setEditing(product); setForm({ name: product.name, description: product.description || '', categoryId: product.categoryId, unit: product.unit, activeIngredient: product.activeIngredient || '', taxType: product.taxType || 'GRAVADO', tracksLot: product.tracksLot || false, prices: product.prices || [], initialStocks: [] }); setShowModal(true); };
  const openBulk = () => { setBulkProducts([emptyBulkProduct()]); setShowBulkModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      const { initialStocks, ...editData } = form;
      await updateProduct.mutateAsync({ id: editing.id, data: editData });
    } else {
      const payload: any = { name: form.name, description: form.description, categoryId: form.categoryId, unit: form.unit, activeIngredient: form.activeIngredient || undefined, taxType: form.taxType, tracksLot: form.tracksLot, prices: form.prices };
      const validStocks = form.initialStocks.filter(s => s.quantity > 0 && s.companyId);
      if (validStocks.length > 0) payload.initialStocks = validStocks;
      await createProduct.mutateAsync(payload);
    }
    setShowModal(false);
  };

  const handleStockChange = (companyId: string, quantity: number) => {
    setForm(prev => {
      const stocks = [...prev.initialStocks];
      const idx = stocks.findIndex(s => s.companyId === companyId);
      if (idx >= 0) stocks[idx] = { companyId, quantity };
      else stocks.push({ companyId, quantity });
      return { ...prev, initialStocks: stocks };
    });
  };

  const handlePriceChange = (tierId: string, price: number, companyId?: string) => {
    setForm((prev) => {
      const prices = [...prev.prices];
      const idx = prices.findIndex((p) => p.priceTierId === tierId && (p.companyId || undefined) === companyId);
      if (idx >= 0) prices[idx] = { priceTierId: tierId, ...(companyId ? { companyId } : {}), price };
      else prices.push({ priceTierId: tierId, ...(companyId ? { companyId } : {}), price });
      return { ...prev, prices };
    });
  };

  const updateBulkProduct = (index: number, field: string, value: any) => {
    setBulkProducts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const updateBulkPrice = (index: number, tierId: string, price: number, companyId?: string) => {
    setBulkProducts(prev => prev.map((p, i) => {
      if (i !== index) return p;
      const prices = [...p.prices];
      const idx = prices.findIndex(pr => pr.priceTierId === tierId && (pr.companyId || undefined) === companyId);
      if (idx >= 0) prices[idx] = { priceTierId: tierId, ...(companyId ? { companyId } : {}), price };
      else prices.push({ priceTierId: tierId, ...(companyId ? { companyId } : {}), price });
      return { ...p, prices };
    }));
  };

  const updateBulkStock = (index: number, companyId: string, quantity: number) => {
    setBulkProducts(prev => prev.map((p, i) => {
      if (i !== index) return p;
      const stocks = [...p.initialStocks];
      const idx = stocks.findIndex(s => s.companyId === companyId);
      if (idx >= 0) stocks[idx] = { companyId, quantity };
      else stocks.push({ companyId, quantity });
      return { ...p, initialStocks: stocks };
    }));
  };

  const removeBulkProduct = (index: number) => {
    setBulkProducts(prev => prev.filter((_, i) => i !== index));
  };

  const duplicateBulkProduct = (index: number) => {
    setBulkProducts(prev => {
      const copy = { ...prev[index], prices: [...prev[index].prices], name: prev[index].name + ' (copia)', expanded: true };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const toggleExpand = (index: number) => {
    setBulkProducts(prev => prev.map((p, i) => i === index ? { ...p, expanded: !p.expanded } : p));
  };

  const handleBulkSubmit = async () => {
    const valid = bulkProducts.filter(p => p.name && p.categoryId);
    if (valid.length === 0) { toast.error('Agrega al menos un producto con nombre y categoría'); return; }
    setBulkLoading(true);
    let created = 0;
    let errors = 0;
    for (const p of valid) {
      try {
        const payload: any = { name: p.name, description: p.description, categoryId: p.categoryId, unit: p.unit, taxType: p.taxType, prices: p.prices };
        const validStocks = p.initialStocks.filter(s => s.quantity > 0 && s.companyId);
        if (validStocks.length > 0) payload.initialStocks = validStocks;
        await createProduct.mutateAsync(payload);
        created++;
      } catch { errors++; }
    }
    setBulkLoading(false);
    toast.success(`${created} producto(s) creado(s)${errors > 0 ? `, ${errors} con error` : ''}`);
    if (created > 0) setShowBulkModal(false);
  };

  const handleExport = async () => {
    try {
      const allData = await productService.getAll({ page: 1, limit: 9999 });
      const allProducts: Product[] = allData?.data || allData || [];
      const tiersList = Array.isArray(priceTiers) ? priceTiers : [];
      const catsList = Array.isArray(categories) ? categories : [];
      const compsList = Array.isArray(companies) ? companies : [];

      const rows = allProducts.map((p: Product) => {
        const row: any = {
          Nombre: p.name,
          Descripcion: p.description || '',
          Categoria: catsList.find((c: any) => c.id === p.categoryId)?.name || '',
          Unidad: p.unit,
          Tipo_IGV: p.taxType || 'GRAVADO',
          Estado: p.isActive ? 'Activo' : 'Inactivo',
        };
        tiersList.forEach((t: any) => {
          const globalPrice = p.prices?.find(pr => pr.priceTierId === t.id && !pr.companyId);
          row[`Precio_${t.name}`] = globalPrice?.price || 0;
        });
        compsList.forEach((c: any) => {
          tiersList.forEach((t: any) => {
            const companyPrice = p.prices?.find(pr => pr.priceTierId === t.id && pr.companyId === c.id);
            row[`Precio_${c.name}_${t.name}`] = companyPrice?.price || 0;
          });
        });
        compsList.forEach((c: any) => { row[`Stock_${c.name}`] = 0; });
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Productos');
      XLSX.writeFile(wb, `productos_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`${allProducts.length} producto(s) exportado(s)`);
    } catch { toast.error('Error al exportar'); }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);
        if (rows.length === 0) { toast.error('El archivo está vacío'); return; }

        const tiersList = Array.isArray(priceTiers) ? priceTiers : [];
        let catsList: any[] = Array.isArray(categories) ? [...categories] : [];

        // Auto-crear categorías que no existen
        const uniqueCatNames = [...new Set(rows.map(r => String(r.Categoria || '').trim()).filter(Boolean))];
        let createdCats = 0;
        for (const catName of uniqueCatNames) {
          const exists = catsList.find((c: any) => c.name?.toLowerCase() === catName.toLowerCase());
          if (!exists) {
            try {
              const newCat = await categoryService.create({ name: catName });
              catsList.push(newCat);
              createdCats++;
            } catch { /* categoría ya existe o error */ }
          }
        }
        if (createdCats > 0) {
          await queryClient.invalidateQueries({ queryKey: ['categories'] });
          toast.success(`${createdCats} categoría(s) creada(s) automáticamente`);
        }

        const imported: BulkProduct[] = rows.map(row => {
          const catName = String(row.Categoria || '').trim();
          const cat = catsList.find((c: any) => c.name?.toLowerCase() === catName.toLowerCase());
          const prices: { priceTierId: string; companyId?: string; price: number }[] = [];
          tiersList.forEach((t: any) => {
            const val = row[`Precio_${t.name}`];
            prices.push({ priceTierId: t.id, price: Number(val) || 0 });
          });
          const compsList = Array.isArray(companies) ? companies : [];
          compsList.forEach((c: any) => {
            tiersList.forEach((t: any) => {
              const val = row[`Precio_${c.name}_${t.name}`];
              if (val && Number(val) > 0) prices.push({ priceTierId: t.id, companyId: c.id, price: Number(val) });
            });
          });
          const initialStocks: { companyId: string; quantity: number }[] = [];
          compsList.forEach((c: any) => {
            const val = row[`Stock_${c.name}`];
            if (val && Number(val) > 0) initialStocks.push({ companyId: c.id, quantity: Number(val) });
          });
          const rawTaxType = String(row.Tipo_IGV || '').trim().toUpperCase();
          const taxType = ['GRAVADO', 'EXONERADO', 'INAFECTO'].includes(rawTaxType) ? rawTaxType : 'GRAVADO';
          return {
            name: String(row.Nombre || ''),
            description: String(row.Descripcion || ''),
            categoryId: cat?.id || '',
            unit: String(row.Unidad || 'kg'),
            taxType,
            prices,
            initialStocks,
            expanded: false,
          };
        });

        setBulkProducts(imported);
        setShowBulkModal(true);
        toast.success(`${imported.length} producto(s) cargados desde Excel`);
      } catch { toast.error('Error al leer el archivo'); }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    const tiersList = Array.isArray(priceTiers) ? priceTiers : [];
    const catsList = Array.isArray(categories) ? categories : [];
    const compsList = Array.isArray(companies) ? companies : [];
    const header: any = { Nombre: 'Ejemplo Producto', Descripcion: '', Categoria: catsList[0]?.name || 'Fertilizantes', Unidad: 'kg', Tipo_IGV: 'GRAVADO' };
    tiersList.forEach((t: any) => { header[`Precio_${t.name}`] = 0; });
    compsList.forEach((c: any) => { tiersList.forEach((t: any) => { header[`Precio_${c.name}_${t.name}`] = 0; }); });
    compsList.forEach((c: any) => { header[`Stock_${c.name}`] = 0; });

    const ws = XLSX.utils.json_to_sheet([header]);
    const catNames = catsList.filter((c: any) => c.isActive).map((c: any) => c.name).join(', ');
    const unitNames = allUnits.map(u => u.value).join(', ');
    XLSX.utils.sheet_add_aoa(ws, [[`Categorías válidas: ${catNames}`], [`Unidades disponibles: ${unitNames} (o cualquier otra, se agrega automáticamente)`], [`Tipo_IGV válidos: GRAVADO, EXONERADO, INAFECTO`]], { origin: `A${3}` });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'plantilla_productos.xlsx');
  };

  const products = data?.data || [];
  const total = data?.total || 0;
  const tiers = Array.isArray(priceTiers) ? priceTiers : [];
  const cats = Array.isArray(categories) ? categories : [];
  const comps = Array.isArray(companies) ? companies : [];

  const getPricesForDisplay = (product: Product) => {
    if (!priceCompanyFilter) {
      return product.prices?.filter(p => !p.companyId) || [];
    }
    return tiers.map((t: any) => {
      const companyPrice = product.prices?.find(p => p.priceTierId === t.id && p.companyId === priceCompanyFilter);
      if (companyPrice) return companyPrice;
      const globalPrice = product.prices?.find(p => p.priceTierId === t.id && !p.companyId);
      return globalPrice || null;
    }).filter(Boolean) as typeof product.prices;
  };

  const columns = [
    { key: 'name', header: 'Nombre' },
    { key: 'categoryId', header: 'Categoría', render: (item: Product) => { const cat = cats.find((c: any) => c.id === item.categoryId); return cat?.name || item.categoryId; } },
    { key: 'activeIngredient', header: 'Ingrediente Activo', render: (item: Product) => item.activeIngredient ? <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">{item.activeIngredient}</span> : <span className="text-gray-300">—</span> },
    { key: 'unit', header: 'Unidad' },
    { key: 'taxType', header: 'IGV', render: (item: Product) => {
      const t = TAX_TYPES.find(tx => tx.value === (item.taxType || 'GRAVADO'));
      const colors = item.taxType === 'EXONERADO' ? 'bg-yellow-100 text-yellow-800' : item.taxType === 'INAFECTO' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800';
      return <span className={`px-2 py-1 rounded-full text-xs ${colors}`}>{t?.label || 'Gravado'}</span>;
    }},
    { key: 'prices', header: 'Precios', render: (item: Product) => {
      const displayPrices = getPricesForDisplay(item);
      return (
        <div className="text-xs space-y-1">
          {displayPrices.map((p) => {
            const tier = tiers.find((t: any) => t.id === p.priceTierId);
            const isCompanySpecific = !!p.companyId;
            return (
              <div key={`${p.priceTierId}-${p.companyId || 'global'}`}>
                <span className="font-medium">{tier?.name || 'N/A'}:</span> S/ {p.price.toFixed(2)}
                {priceCompanyFilter && !isCompanySpecific && <span className="text-gray-400 ml-1">(global)</span>}
              </div>
            );
          })}
        </div>
      );
    }},
    { key: 'isActive', header: 'Estado', render: (item: Product) => <span className={`px-2 py-1 rounded-full text-xs ${item.isActive ? 'bg-primary-100 text-primary-800' : 'bg-red-100 text-red-800'}`}>{item.isActive ? 'Activo' : 'Inactivo'}</span> },
    { key: 'actions', header: 'Acciones', render: (item: Product) => (
      <div className="flex gap-2">
        <button onClick={() => setSuppliersTarget(item)} className="text-gray-500 hover:text-primary-600" title="Ver proveedores"><Truck size={16} /></button>
        <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800" title="Editar"><Edit2 size={16} /></button>
        <button onClick={() => setDeleteTarget(item)} className="text-red-600 hover:text-red-800" title="Desactivar"><Trash2 size={16} /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Productos</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleDownloadTemplate} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"><Download size={16} /> Plantilla .xlsx</button>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"><Upload size={16} /> Importar</button>
          <button onClick={openBulk} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"><Layers size={16} /> Carga Masiva</button>
          <button onClick={openCreate} className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"><Plus size={16} /> Nuevo Producto</button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
        </div>
      </div>
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar productos..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" />
        </div>
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Filtrar por ingrediente activo..." value={activeIngredientFilter} onChange={(e) => { setActiveIngredientFilter(e.target.value); setPage(1); }} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" />
        </div>
        {comps.length > 0 && (
          <select value={priceCompanyFilter} onChange={(e) => setPriceCompanyFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            <option value="">Precios globales</option>
            {comps.filter((c: any) => c.isActive).map((c: any) => <option key={c.id} value={c.id}>Precios: {c.name}</option>)}
          </select>
        )}
      </div>
      <DataTable columns={columns} data={products} isLoading={isLoading} />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Producto' : 'Nuevo Producto'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Ingrediente Activo <span className="text-gray-400 font-normal">(opcional)</span></label><input value={form.activeIngredient} onChange={(e) => setForm({ ...form, activeIngredient: e.target.value })} placeholder="Ej: Glifosato, Clorpirifos..." className="w-full px-3 py-2 border rounded-lg" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label><select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required><option value="">Seleccionar...</option>{cats.filter((c: any) => c.isActive).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
                <option value="">Seleccionar...</option>
                {allUnits.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipo IGV</label><select value={form.taxType} onChange={(e) => setForm({ ...form, taxType: e.target.value })} className="w-full px-3 py-2 border rounded-lg">{TAX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
          </div>
          {!editing && comps.length > 0 && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
              <label className="block text-sm font-medium text-blue-800">Stock Inicial por Empresa (opcional)</label>
              <p className="text-xs text-blue-600">Si ya tienes existencias de este producto, ingresa la cantidad por cada empresa.</p>
              <div className="space-y-2">
                {comps.filter((c: any) => c.isActive).map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="text-sm w-40 truncate font-medium">{c.name}</span>
                    <input type="number" step="0.01" min="0" placeholder="0" value={form.initialStocks.find(s => s.companyId === c.id)?.quantity || ''} onChange={(e) => handleStockChange(c.id, parseFloat(e.target.value) || 0)} className="flex-1 px-3 py-2 border rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-start gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50/50">
            <input type="checkbox" id="tracksLot" checked={form.tracksLot} onChange={(e) => setForm({ ...form, tracksLot: e.target.checked })} className="mt-0.5 h-4 w-4 text-primary-600 border-gray-300 rounded" />
            <label htmlFor="tracksLot" className="text-sm cursor-pointer select-none">
              <span className="font-medium text-gray-800">Rastrea lote y vencimiento</span>
              <span className="block text-xs text-gray-500">Activa esta opción para productos perecibles o controlados. Al registrar compras se pedirá el lote y fecha de vencimiento.</span>
            </label>
          </div>

          {tiers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Precios Globales (por defecto)</label>
              <div className="space-y-2">
                {tiers.map((tier: any) => (
                  <div key={tier.id} className="flex items-center gap-3">
                    <span className="text-sm w-32">{tier.name}</span>
                    <input type="number" step="0.01" min="0" placeholder="0.00" value={form.prices.find((p) => p.priceTierId === tier.id && !p.companyId)?.price || ''} onChange={(e) => handlePriceChange(tier.id, parseFloat(e.target.value) || 0)} className="flex-1 px-3 py-2 border rounded-lg" />
                  </div>
                ))}
              </div>
              {comps.filter((c: any) => c.isActive).map((company: any) => (
                <div key={company.id} className="mt-4 border border-orange-200 bg-orange-50 rounded-lg p-3">
                  <label className="block text-sm font-medium text-orange-800 mb-2">Precios para {company.name} (opcional)</label>
                  <div className="space-y-2">
                    {tiers.map((tier: any) => (
                      <div key={tier.id} className="flex items-center gap-3">
                        <span className="text-sm w-32">{tier.name}</span>
                        <input type="number" step="0.01" min="0" placeholder={`Global: ${form.prices.find((p: any) => p.priceTierId === tier.id && !p.companyId)?.price || '0.00'}`} value={form.prices.find((p: any) => p.priceTierId === tier.id && p.companyId === company.id)?.price || ''} onChange={(e) => handlePriceChange(tier.id, parseFloat(e.target.value) || 0, company.id)} className="flex-1 px-3 py-2 border rounded-lg" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <button type="submit" disabled={editing ? updateProduct.isPending : createProduct.isPending} className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">{editing ? (updateProduct.isPending ? 'Actualizando...' : 'Actualizar') : (createProduct.isPending ? 'Creando...' : 'Crear')}</button>
        </form>
      </Modal>
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Desactivar Producto">
        <div className="space-y-4">
          <p className="text-gray-600">¿Deseas desactivar el producto <strong>{deleteTarget?.name}</strong>? No volverá a aparecer en listados ni en nuevas ventas, pero su historial se mantiene intacto.</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button onClick={async () => { if (deleteTarget) { await deleteProduct.mutateAsync(deleteTarget.id); setDeleteTarget(null); } }} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Desactivar</button>
          </div>
        </div>
      </Modal>
      <ProductSuppliersModal product={suppliersTarget} onClose={() => setSuppliersTarget(null)} />
      <Modal isOpen={showBulkModal} onClose={() => setShowBulkModal(false)} title={`Carga Masiva de Productos (${bulkProducts.length})`} size="xl">
        <div className="space-y-3">
          {bulkProducts.map((bp, idx) => (
            <div key={idx} className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer" onClick={() => toggleExpand(idx)}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500">#{idx + 1}</span>
                  <span className="font-medium">{bp.name || 'Sin nombre'}</span>
                  {bp.categoryId && <span className="text-xs text-gray-500">{cats.find((c: any) => c.id === bp.categoryId)?.name}</span>}
                  {!bp.name && <span className="text-xs text-red-500">* Requerido</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={(e) => { e.stopPropagation(); duplicateBulkProduct(idx); }} className="p-1 text-gray-400 hover:text-blue-600" title="Duplicar"><Copy size={15} /></button>
                  {bulkProducts.length > 1 && <button type="button" onClick={(e) => { e.stopPropagation(); removeBulkProduct(idx); }} className="p-1 text-gray-400 hover:text-red-600" title="Eliminar"><X size={15} /></button>}
                  {bp.expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
              </div>
              {bp.expanded && (
                <div className="p-4 space-y-3 border-t">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label><input value={bp.name} onChange={(e) => updateBulkProduct(idx, 'name', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Nombre del producto" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label><input value={bp.description} onChange={(e) => updateBulkProduct(idx, 'description', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Opcional" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label><select value={bp.categoryId} onChange={(e) => updateBulkProduct(idx, 'categoryId', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="">Seleccionar...</option>{cats.filter((c: any) => c.isActive).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label><select value={bp.unit} onChange={(e) => updateBulkProduct(idx, 'unit', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">{allUnits.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipo IGV</label><select value={bp.taxType} onChange={(e) => updateBulkProduct(idx, 'taxType', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">{TAX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                  </div>
                  {comps.length > 0 && (
                    <div><label className="block text-sm font-medium text-gray-700 mb-2">Stock Inicial por Empresa</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{comps.filter((c: any) => c.isActive).map((c: any) => (
                        <div key={c.id} className="flex items-center gap-2">
                          <span className="text-xs w-20 truncate">{c.name}</span>
                          <input type="number" step="0.01" min="0" placeholder="0" value={bp.initialStocks.find(s => s.companyId === c.id)?.quantity || ''} onChange={(e) => updateBulkStock(idx, c.id, parseFloat(e.target.value) || 0)} className="flex-1 px-2 py-1.5 border rounded-lg text-sm" />
                        </div>
                      ))}</div>
                    </div>
                  )}
                  {tiers.length > 0 && (
                    <div><label className="block text-sm font-medium text-gray-700 mb-2">Precios por Rango</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{tiers.map((tier: any) => (
                        <div key={tier.id} className="flex items-center gap-2">
                          <span className="text-xs w-20 truncate">{tier.name}</span>
                          <input type="number" step="0.01" min="0" placeholder="0.00" value={bp.prices.find(p => p.priceTierId === tier.id)?.price || ''} onChange={(e) => updateBulkPrice(idx, tier.id, parseFloat(e.target.value) || 0)} className="flex-1 px-2 py-1.5 border rounded-lg text-sm" />
                        </div>
                      ))}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" onClick={() => setBulkProducts(prev => [...prev, emptyBulkProduct()])} className="flex-1 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 text-sm">+ Agregar otro producto</button>
            <button type="button" onClick={handleDownloadTemplate} className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-500 hover:text-blue-600 text-sm"><Download size={14} /> Plantilla Excel</button>
          </div>
          <button type="button" onClick={handleBulkSubmit} disabled={bulkLoading} className="w-full py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
            {bulkLoading ? 'Creando productos...' : `Crear ${bulkProducts.filter(p => p.name && p.categoryId).length} producto(s)`}
          </button>
        </div>
      </Modal>
    </div>
  );
}
