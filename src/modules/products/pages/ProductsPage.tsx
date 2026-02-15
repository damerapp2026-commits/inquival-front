import React, { useState } from 'react';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../hooks/useProducts';
import { usePriceTiers } from '../../price-tiers/hooks/usePriceTiers';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import type { Product } from '../../../shared/types';

export function ProductsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const { data, isLoading } = useProducts({ page, limit: 20, search: debouncedSearch });
  const { data: priceTiers } = usePriceTiers();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [form, setForm] = useState({ name: '', description: '', category: '', unit: 'kg', prices: [] as { priceTierId: string; price: number }[] });

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', category: '', unit: 'kg', prices: [] }); setShowModal(true); };
  const openEdit = (product: Product) => { setEditing(product); setForm({ name: product.name, description: product.description || '', category: product.category, unit: product.unit, prices: product.prices || [] }); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await updateProduct.mutateAsync({ id: editing.id, data: form });
    else await createProduct.mutateAsync(form);
    setShowModal(false);
  };

  const handlePriceChange = (tierId: string, price: number) => {
    setForm((prev) => {
      const prices = [...prev.prices];
      const idx = prices.findIndex((p) => p.priceTierId === tierId);
      if (idx >= 0) prices[idx] = { priceTierId: tierId, price };
      else prices.push({ priceTierId: tierId, price });
      return { ...prev, prices };
    });
  };

  const products = data?.data || [];
  const total = data?.total || 0;
  const tiers = Array.isArray(priceTiers) ? priceTiers : [];

  const columns = [
    { key: 'name', header: 'Nombre' },
    { key: 'category', header: 'Categoría' },
    { key: 'unit', header: 'Unidad' },
    { key: 'prices', header: 'Precios', render: (item: Product) => (
      <div className="text-xs space-y-1">
        {item.prices?.map((p) => { const tier = tiers.find((t: any) => t.id === p.priceTierId); return <div key={p.priceTierId}><span className="font-medium">{tier?.name || 'N/A'}:</span> S/ {p.price.toFixed(2)}</div>; })}
      </div>
    )},
    { key: 'isActive', header: 'Estado', render: (item: Product) => <span className={`px-2 py-1 rounded-full text-xs ${item.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.isActive ? 'Activo' : 'Inactivo'}</span> },
    { key: 'actions', header: 'Acciones', render: (item: Product) => (
      <div className="flex gap-2">
        <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800"><Edit2 size={16} /></button>
        <button onClick={() => deleteProduct.mutate(item.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Productos</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><Plus size={18} /> Nuevo Producto</button>
      </div>
      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Buscar productos..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500" />
      </div>
      <DataTable columns={columns} data={products} isLoading={isLoading} />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Producto' : 'Nuevo Producto'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label><select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg"><option value="kg">Kilogramo</option><option value="litro">Litro</option><option value="saco">Saco</option><option value="unidad">Unidad</option><option value="galon">Galón</option></select></div>
          </div>
          {tiers.length > 0 && <div><label className="block text-sm font-medium text-gray-700 mb-2">Precios por Rango</label><div className="space-y-2">{tiers.map((tier: any) => (<div key={tier.id} className="flex items-center gap-3"><span className="text-sm w-32">{tier.name}</span><input type="number" step="0.01" min="0" placeholder="0.00" value={form.prices.find((p) => p.priceTierId === tier.id)?.price || ''} onChange={(e) => handlePriceChange(tier.id, parseFloat(e.target.value) || 0)} className="flex-1 px-3 py-2 border rounded-lg" /></div>))}</div></div>}
          <button type="submit" className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">{editing ? 'Actualizar' : 'Crear'}</button>
        </form>
      </Modal>
    </div>
  );
}
