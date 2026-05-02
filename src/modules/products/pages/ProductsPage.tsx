import React, { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../hooks/useProducts';
import { productService } from '../services/productService';
import { categoryService } from '../../categories/services/categoryService';
import { laboratoryService } from '../../laboratories/services/laboratoryService';
import { usePriceTiers } from '../../price-tiers/hooks/usePriceTiers';
import { useCategories } from '../../categories/hooks/useCategories';
import { useLaboratories } from '../../laboratories/hooks/useLaboratories';
import { useUnits } from '../../units/hooks/useUnits';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useUsers } from '../../users/hooks/useUsers';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { Plus, Search, Edit2, Trash2, ChevronDown, ChevronUp, Copy, X, Layers, Download, Upload, Truck, ImagePlus, Loader2, Tag, Boxes, Receipt, Wallet, PackageSearch, FlaskConical, Percent, BookOpen } from 'lucide-react';
import { ProductSuppliersModal } from '../components/ProductSuppliersModal';
import { PriceCatalogView } from '../components/PriceCatalogView';
import { downloadProductCatalogPdf } from '../utils/productCatalogPdf';
import toast from 'react-hot-toast';
import type { Product, ProductCommission } from '../../../shared/types';

const TAX_TYPES = [
  { value: 'GRAVADO', label: 'Gravado (IGV 18%)' },
  { value: 'EXONERADO', label: 'Exonerado' },
  { value: 'INAFECTO', label: 'Inafecto' },
];

interface BulkProduct {
  name: string;
  description: string;
  categoryId: string;
  laboratoryId: string;
  unit: string;
  taxType: string;
  prices: { priceTierId: string; companyId?: string; price: number }[];
  initialStocks: { companyId: string; quantity: number }[];
  expanded: boolean;
}

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: 'list' | 'catalog' = searchParams.get('view') === 'catalog' ? 'catalog' : 'list';
  const setView = (v: 'list' | 'catalog') => {
    const next = new URLSearchParams(searchParams);
    if (v === 'list') next.delete('view'); else next.set('view', v);
    setSearchParams(next, { replace: true });
  };

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeIngredientFilter, setActiveIngredientFilter] = useState('');
  const [laboratoryFilter, setLaboratoryFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const debouncedSearch = useDebounce(search);
  const debouncedIngredient = useDebounce(activeIngredientFilter);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [priceCompanyFilter, setPriceCompanyFilter] = useState('');

  const queryClient = useQueryClient();
  const { data, isLoading } = useProducts({ page, limit: 20, search: debouncedSearch, activeIngredient: debouncedIngredient || undefined, laboratoryId: laboratoryFilter || undefined, category: categoryFilter || undefined });
  const { data: priceTiers } = usePriceTiers();
  const { data: categories } = useCategories();
  const { data: laboratories } = useLaboratories();
  const { data: companies } = useCompanies();
  const { data: unitsData } = useUnits();
  const { data: fieldSellersData } = useUsers({ limit: 100, role: 'VENDEDOR_CAMPO' });
  const fieldSellers: any[] = Array.isArray(fieldSellersData)
    ? fieldSellersData
    : (fieldSellersData as any)?.data || [];
  const activeFieldSellers = fieldSellers.filter((u: any) => u.isActive !== false);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [form, setForm] = useState({ name: '', description: '', categoryId: '', laboratoryId: '', unit: '', activeIngredient: '', taxType: 'GRAVADO', tracksLot: false, imageUrl: '', prices: [] as { priceTierId: string; companyId?: string; price: number }[], initialStocks: [] as { companyId: string; quantity: number }[], commissions: [] as ProductCommission[] });
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [suppliersTarget, setSuppliersTarget] = useState<Product | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkProducts, setBulkProducts] = useState<BulkProduct[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pricesTab, setPricesTab] = useState<string>('global');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const allUnits: { value: string; label: string }[] = Array.isArray(unitsData)
    ? unitsData.filter((u: any) => u.isActive).map((u: any) => ({ value: u.name, label: u.abbreviation ? `${u.name} (${u.abbreviation})` : u.name }))
    : [];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const emptyBulkProduct = (): BulkProduct => ({ name: '', description: '', categoryId: '', laboratoryId: '', unit: '', taxType: 'GRAVADO', prices: [], initialStocks: [], expanded: true });


  const openCreate = () => { setEditing(null); setPricesTab('global'); setForm({ name: '', description: '', categoryId: '', laboratoryId: '', unit: allUnits[0]?.value || '', activeIngredient: '', taxType: 'GRAVADO', tracksLot: false, imageUrl: '', prices: [], initialStocks: [], commissions: [] }); setShowModal(true); };
  const openEdit = (product: Product) => { setEditing(product); setPricesTab('global'); setForm({ name: product.name, description: product.description || '', categoryId: product.categoryId, laboratoryId: product.laboratoryId || '', unit: product.unit, activeIngredient: product.activeIngredient || '', taxType: product.taxType || 'GRAVADO', tracksLot: product.tracksLot || false, imageUrl: product.imageUrl || '', prices: product.prices || [], initialStocks: [], commissions: product.commissions || [] }); setShowModal(true); };
  const openBulk = () => { setBulkProducts([emptyBulkProduct()]); setShowBulkModal(true); };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Solo se permiten imágenes'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('La imagen no puede superar 5 MB'); return; }
    setUploadingImage(true);
    try {
      const { url } = await productService.uploadImage(file);
      setForm((prev) => ({ ...prev, imageUrl: url }));
      toast.success('Imagen subida');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al subir imagen');
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCommissions = form.commissions.filter((c) => c.workerId && c.value > 0);
    if (editing) {
      const { initialStocks, ...editData } = form;
      const editPayload: any = { ...editData, commissions: cleanCommissions, imageUrl: form.imageUrl || null, laboratoryId: form.laboratoryId || null };
      await updateProduct.mutateAsync({ id: editing.id, data: editPayload });
    } else {
      const payload: any = { name: form.name, description: form.description, categoryId: form.categoryId, unit: form.unit, activeIngredient: form.activeIngredient || undefined, taxType: form.taxType, tracksLot: form.tracksLot, prices: form.prices };
      if (cleanCommissions.length > 0) payload.commissions = cleanCommissions;
      if (form.laboratoryId) payload.laboratoryId = form.laboratoryId;
      if (form.imageUrl) payload.imageUrl = form.imageUrl;
      const validStocks = form.initialStocks.filter(s => s.quantity > 0 && s.companyId);
      if (validStocks.length > 0) payload.initialStocks = validStocks;
      await createProduct.mutateAsync(payload);
    }
    setShowModal(false);
  };

  const handleCommissionChange = (workerId: string, patch: Partial<ProductCommission>) => {
    setForm((prev) => {
      const list = [...prev.commissions];
      const idx = list.findIndex((c) => c.workerId === workerId);
      if (idx >= 0) list[idx] = { ...list[idx], ...patch };
      else list.push({ workerId, type: 'PERCENT', value: 0, ...patch });
      return { ...prev, commissions: list };
    });
  };

  const handleCommissionRemove = (workerId: string) => {
    setForm((prev) => ({ ...prev, commissions: prev.commissions.filter((c) => c.workerId !== workerId) }));
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
        if (p.laboratoryId) payload.laboratoryId = p.laboratoryId;
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
      const XLSX = await import('xlsx');
      const allData = await productService.getAll({ page: 1, limit: 9999 });
      const allProducts: Product[] = allData?.data || allData || [];
      const tiersList = Array.isArray(priceTiers) ? priceTiers : [];
      const catsList = Array.isArray(categories) ? categories : [];
      const labsList = Array.isArray(laboratories) ? laboratories : [];
      const compsList = Array.isArray(companies) ? companies : [];

      const rows = allProducts.map((p: Product) => {
        const row: any = {
          Nombre: p.name,
          Descripcion: p.description || '',
          Categoria: catsList.find((c: any) => c.id === p.categoryId)?.name || '',
          Laboratorio: p.laboratoryId ? (labsList.find((l: any) => l.id === p.laboratoryId)?.name || '') : '',
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
        const XLSX = await import('xlsx');
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);
        if (rows.length === 0) { toast.error('El archivo está vacío'); return; }

        const tiersList = Array.isArray(priceTiers) ? priceTiers : [];
        let catsList: any[] = Array.isArray(categories) ? [...categories] : [];
        let labsList: any[] = Array.isArray(laboratories) ? [...laboratories] : [];

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

        // Auto-crear laboratorios que no existen
        const uniqueLabNames = [...new Set(rows.map(r => String(r.Laboratorio || '').trim()).filter(Boolean))];
        let createdLabs = 0;
        for (const labName of uniqueLabNames) {
          const exists = labsList.find((l: any) => l.name?.toLowerCase() === labName.toLowerCase());
          if (!exists) {
            try {
              const newLab = await laboratoryService.create({ name: labName });
              labsList.push(newLab);
              createdLabs++;
            } catch { /* laboratorio ya existe o error */ }
          }
        }
        if (createdLabs > 0) {
          await queryClient.invalidateQueries({ queryKey: ['laboratories'] });
          toast.success(`${createdLabs} laboratorio(s) creado(s) automáticamente`);
        }

        const imported: BulkProduct[] = rows.map(row => {
          const catName = String(row.Categoria || '').trim();
          const cat = catsList.find((c: any) => c.name?.toLowerCase() === catName.toLowerCase());
          const labName = String(row.Laboratorio || '').trim();
          const lab = labName ? labsList.find((l: any) => l.name?.toLowerCase() === labName.toLowerCase()) : null;
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
            laboratoryId: lab?.id || '',
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

  const [exportingCatalog, setExportingCatalog] = useState(false);
  const handleExportCatalog = async () => {
    setExportingCatalog(true);
    const t = toast.loading('Generando catálogo PDF…');
    try {
      const result = await productService.getAll({
        limit: 1000,
        search: debouncedSearch || undefined,
        activeIngredient: debouncedIngredient || undefined,
        laboratoryId: laboratoryFilter || undefined,
        category: categoryFilter || undefined,
      });
      const allProducts: Product[] = result?.data || [];
      const catsList = Array.isArray(categories) ? categories : [];
      const labsList = Array.isArray(laboratories) ? laboratories : [];
      const enriched = allProducts.map((p) => ({
        ...p,
        categoryName: catsList.find((c: any) => c.id === p.categoryId)?.name,
        laboratoryName: labsList.find((l: any) => l.id === p.laboratoryId)?.name,
      }));
      if (enriched.length === 0) { toast.dismiss(t); toast.error('No hay productos con los filtros actuales'); return; }
      await downloadProductCatalogPdf({ products: enriched, includeImages: true, withPrices: false });
      toast.dismiss(t);
      toast.success(`Catálogo generado (${enriched.length} producto${enriched.length > 1 ? 's' : ''})`);
    } catch (err) {
      toast.dismiss(t);
      toast.error('Error al generar el catálogo');
    } finally {
      setExportingCatalog(false);
    }
  };

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const tiersList = Array.isArray(priceTiers) ? priceTiers : [];
    const catsList = Array.isArray(categories) ? categories : [];
    const labsList = Array.isArray(laboratories) ? laboratories : [];
    const compsList = Array.isArray(companies) ? companies : [];
    const header: any = {
      Nombre: 'Ejemplo Producto',
      Descripcion: '',
      Categoria: catsList[0]?.name || 'Fertilizantes',
      Laboratorio: labsList[0]?.name || 'FARMEX',
      Unidad: 'kg',
      Tipo_IGV: 'GRAVADO',
    };
    tiersList.forEach((t: any) => { header[`Precio_${t.name}`] = 0; });
    compsList.forEach((c: any) => { tiersList.forEach((t: any) => { header[`Precio_${c.name}_${t.name}`] = 0; }); });
    compsList.forEach((c: any) => { header[`Stock_${c.name}`] = 0; });

    const ws = XLSX.utils.json_to_sheet([header]);
    const catNames = catsList.filter((c: any) => c.isActive).map((c: any) => c.name).join(', ');
    const labNames = labsList.filter((l: any) => l.isActive).map((l: any) => l.name).join(', ');
    const unitNames = allUnits.map(u => u.value).join(', ');
    XLSX.utils.sheet_add_aoa(
      ws,
      [
        [`Categorías válidas: ${catNames || '(crear en /categories)'} — si pones una nueva se crea automáticamente`],
        [`Laboratorios válidos: ${labNames || '(crear en /laboratories)'} — si pones uno nuevo se crea automáticamente. Dejar vacío = sin laboratorio.`],
        [`Unidades disponibles: ${unitNames}`],
        [`Tipo_IGV válidos: GRAVADO, EXONERADO, INAFECTO`],
      ],
      { origin: `A${3}` },
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'plantilla_productos.xlsx');
  };

  const products = data?.data || [];
  const total = data?.total || 0;
  const tiers = Array.isArray(priceTiers) ? priceTiers : [];
  const cats = Array.isArray(categories) ? categories : [];
  const labs = Array.isArray(laboratories) ? laboratories : [];
  const labsById = new Map<string, any>(labs.map((l: any) => [l.id, l]));
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
    { key: 'laboratoryId', header: 'Laboratorio', render: (item: Product) => {
      const lab = item.laboratoryId ? labsById.get(item.laboratoryId) : null;
      return lab ? <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-medium">{lab.name}</span> : <span className="text-gray-300">—</span>;
    }},
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Productos</h1>
        {view === 'list' && (
          <div className="flex flex-wrap gap-2">
            <button onClick={handleExportCatalog} disabled={exportingCatalog} className="flex items-center gap-2 px-3 py-2 border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 text-sm disabled:opacity-60 disabled:cursor-wait">
              {exportingCatalog ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
              Catálogo PDF
            </button>
            <button onClick={handleDownloadTemplate} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"><Download size={16} /> Plantilla .xlsx</button>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"><Upload size={16} /> Importar</button>
            <button onClick={openBulk} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"><Layers size={16} /> Carga Masiva</button>
            <button onClick={openCreate} className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"><Plus size={16} /> Nuevo Producto</button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
          </div>
        )}
      </div>

      <div className="flex gap-1 mb-5 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setView('list')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${view === 'list' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Listado
        </button>
        <button
          type="button"
          onClick={() => setView('catalog')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${view === 'catalog' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Catálogo de precios
        </button>
      </div>

      {view === 'catalog' && <PriceCatalogView enabled={view === 'catalog'} />}

      {view === 'list' && (<>
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar productos..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" />
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Ingrediente activo..." value={activeIngredientFilter} onChange={(e) => { setActiveIngredientFilter(e.target.value); setPage(1); }} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm bg-white">
          <option value="">Todas las categorías</option>
          {cats.filter((c: any) => c.isActive).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={laboratoryFilter} onChange={(e) => { setLaboratoryFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm bg-white">
          <option value="">Todos los laboratorios</option>
          {labs.filter((l: any) => l.isActive).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      {comps.length > 0 && (
        <div className="mb-4">
          <select value={priceCompanyFilter} onChange={(e) => setPriceCompanyFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-white">
            <option value="">Precios globales</option>
            {comps.filter((c: any) => c.isActive).map((c: any) => <option key={c.id} value={c.id}>Precios: {c.name}</option>)}
          </select>
        </div>
      )}
      <DataTable columns={columns} data={products} isLoading={isLoading} />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
      </>)}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar producto' : 'Nuevo producto'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Imagen + datos básicos */}
          <section className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Imagen</label>
              <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
              <div
                onClick={() => !uploadingImage && imageInputRef.current?.click()}
                className={`relative aspect-square w-full rounded-2xl border-2 border-dashed transition-colors overflow-hidden ${
                  uploadingImage ? 'border-gray-300 bg-gray-50 cursor-wait' : 'border-gray-300 bg-gray-50/60 hover:border-primary-400 hover:bg-primary-50/40 cursor-pointer'
                } ${form.imageUrl ? 'border-solid border-gray-200' : ''}`}
              >
                {form.imageUrl ? (
                  <>
                    <img src={form.imageUrl} alt="Producto" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                      <span className="text-white text-xs font-medium bg-black/50 px-3 py-1.5 rounded-lg">Cambiar imagen</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setForm({ ...form, imageUrl: '' }); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 text-gray-600 hover:text-red-600 hover:bg-white shadow-sm flex items-center justify-center"
                      title="Quitar imagen"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
                    {uploadingImage ? (
                      <><Loader2 size={28} className="animate-spin text-primary-500" /><span className="text-xs font-medium">Subiendo...</span></>
                    ) : (
                      <><ImagePlus size={28} /><span className="text-xs font-medium text-center px-3">Click para subir<br /><span className="text-[10px] text-gray-400">JPG, PNG · máx 5 MB</span></span></>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nombre <span className="text-red-500 normal-case">*</span></label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors" placeholder="Ej: Fertilizante Foliar 1L" required />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Descripción</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none" placeholder="Detalles adicionales..." />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Ingrediente activo <span className="text-gray-400 normal-case font-normal">— opcional</span></label>
                <input value={form.activeIngredient} onChange={(e) => setForm({ ...form, activeIngredient: e.target.value })} placeholder="Ej: Glifosato, Clorpirifos..." className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors" />
              </div>
            </div>
          </section>

          {/* Clasificación */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Tag size={14} className="text-gray-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Clasificación</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Categoría <span className="text-red-500">*</span></label>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white" required>
                  <option value="">Seleccionar...</option>
                  {cats.filter((c: any) => c.isActive).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><FlaskConical size={12} /> Laboratorio</label>
                <select value={form.laboratoryId} onChange={(e) => setForm({ ...form, laboratoryId: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                  <option value="">Sin laboratorio</option>
                  {labs.filter((l: any) => l.isActive).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Unidad <span className="text-red-500">*</span></label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white" required>
                  <option value="">Seleccionar...</option>
                  {allUnits.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><Receipt size={12} /> Tipo IGV</label>
                <select value={form.taxType} onChange={(e) => setForm({ ...form, taxType: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                  {TAX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Lote */}
          <label htmlFor="tracksLot" className="flex items-start gap-3 p-3.5 border border-gray-200 rounded-xl bg-gray-50/60 hover:bg-gray-50 cursor-pointer transition-colors">
            <input type="checkbox" id="tracksLot" checked={form.tracksLot} onChange={(e) => setForm({ ...form, tracksLot: e.target.checked })} className="mt-0.5 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
            <span className="select-none">
              <span className="block text-sm font-medium text-gray-800">Rastrear lote y vencimiento</span>
              <span className="block text-xs text-gray-500 mt-0.5">Para productos perecibles o controlados. Al registrar compras se pedirá lote y fecha de vencimiento.</span>
            </span>
          </label>

          {/* Stock inicial */}
          {!editing && comps.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Boxes size={14} className="text-gray-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Stock inicial <span className="normal-case font-normal text-gray-400">— opcional, por almacén</span></h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {comps.filter((c: any) => c.isActive).map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-xl bg-white">
                    <PackageSearch size={14} className="text-gray-400 shrink-0" />
                    <span className="text-sm flex-1 truncate text-gray-700">{c.name}</span>
                    <input type="number" step="0.01" min="0" placeholder="0" value={form.initialStocks.find(s => s.companyId === c.id)?.quantity || ''} onChange={(e) => handleStockChange(c.id, parseFloat(e.target.value) || 0)} className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Precios */}
          {tiers.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Wallet size={14} className="text-gray-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Precios</h3>
              </div>

              {comps.filter((c: any) => c.isActive).length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1.5 mb-3 border-b border-gray-200">
                    <button type="button" onClick={() => setPricesTab('global')} className={`px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${pricesTab === 'global' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                      Global
                    </button>
                    {comps.filter((c: any) => c.isActive).map((c: any) => (
                      <button key={c.id} type="button" onClick={() => setPricesTab(c.id)} className={`px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${pricesTab === c.id ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {pricesTab === 'global'
                      ? 'Precios por defecto. Se aplican si no defines uno específico para un almacén.'
                      : 'Precios específicos para este almacén. Si lo dejas vacío se usa el precio global.'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {tiers.map((tier: any) => {
                      const isGlobal = pricesTab === 'global';
                      const value = form.prices.find((p) => p.priceTierId === tier.id && (isGlobal ? !p.companyId : p.companyId === pricesTab))?.price || '';
                      const globalFallback = !isGlobal ? form.prices.find((p) => p.priceTierId === tier.id && !p.companyId)?.price : null;
                      return (
                        <div key={tier.id} className="flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-xl bg-white">
                          <span className="text-sm flex-1 truncate text-gray-700">{tier.name}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">S/</span>
                            <input type="number" step="0.01" min="0" placeholder={globalFallback ? globalFallback.toFixed(2) : '0.00'} value={value} onChange={(e) => handlePriceChange(tier.id, parseFloat(e.target.value) || 0, isGlobal ? undefined : pricesTab)} className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {tiers.map((tier: any) => (
                    <div key={tier.id} className="flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-xl bg-white">
                      <span className="text-sm flex-1 truncate text-gray-700">{tier.name}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">S/</span>
                        <input type="number" step="0.01" min="0" placeholder="0.00" value={form.prices.find((p) => p.priceTierId === tier.id && !p.companyId)?.price || ''} onChange={(e) => handlePriceChange(tier.id, parseFloat(e.target.value) || 0)} className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Comisiones por vendedor */}
          {activeFieldSellers.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Percent size={14} className="text-gray-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Comisiones por vendedor de campo</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Define cuánto gana cada vendedor por unidad vendida de este producto. Vendedores sin valor (o en 0) no reciben comisión.
              </p>
              <div className="space-y-2">
                {activeFieldSellers.map((seller: any) => {
                  const entry = form.commissions.find((c) => c.workerId === seller.id);
                  const isActive = !!entry && entry.value > 0;
                  return (
                    <div key={seller.id} className={`flex items-center gap-2 px-3 py-2 border rounded-xl ${isActive ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                      <span className="text-sm flex-1 truncate text-gray-700 font-medium">{seller.fullName || seller.username}</span>
                      <select
                        value={entry?.type || 'PERCENT'}
                        onChange={(e) => handleCommissionChange(seller.id, { type: e.target.value as 'PERCENT' | 'AMOUNT' })}
                        className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white"
                      >
                        <option value="PERCENT">% sobre venta</option>
                        <option value="AMOUNT">S/ por unidad</option>
                      </select>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          value={entry?.value || ''}
                          onChange={(e) => handleCommissionChange(seller.id, { value: parseFloat(e.target.value) || 0 })}
                          className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="text-xs text-gray-400 w-3">{entry?.type === 'AMOUNT' ? 'S/' : '%'}</span>
                      </div>
                      {isActive && (
                        <button type="button" onClick={() => handleCommissionRemove(seller.id)} className="text-gray-400 hover:text-red-500" title="Quitar comisión">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors">Cancelar</button>
            <button type="submit" disabled={editing ? updateProduct.isPending : createProduct.isPending} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors shadow-sm">
              {editing ? (updateProduct.isPending ? 'Actualizando...' : 'Guardar cambios') : (createProduct.isPending ? 'Creando...' : 'Crear producto')}
            </button>
          </div>
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
                  {bp.laboratoryId && <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full font-medium">{labsById.get(bp.laboratoryId)?.name}</span>}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label><select value={bp.categoryId} onChange={(e) => updateBulkProduct(idx, 'categoryId', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="">Seleccionar...</option>{cats.filter((c: any) => c.isActive).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Laboratorio</label><select value={bp.laboratoryId} onChange={(e) => updateBulkProduct(idx, 'laboratoryId', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="">Sin laboratorio</option>{labs.filter((l: any) => l.isActive).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label><select value={bp.unit} onChange={(e) => updateBulkProduct(idx, 'unit', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">{allUnits.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipo IGV</label><select value={bp.taxType} onChange={(e) => updateBulkProduct(idx, 'taxType', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">{TAX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                  </div>
                  {comps.length > 0 && (
                    <div><label className="block text-sm font-medium text-gray-700 mb-2">Stock Inicial por Almacén</label>
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
