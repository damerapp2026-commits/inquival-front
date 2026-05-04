import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUsers, useCreateUser, useUpdateUser, useChangePassword, useToggleUserStatus } from '../hooks/useUsers';
import { useProducts } from '../../products/hooks/useProducts';
import { productService } from '../../products/services/productService';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { Plus, Search, Edit2, Key, Power, Percent, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { User, Product, ProductCommission } from '../../../shared/types';

interface UserCommissionRow {
  productId: string;
  value: number;
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);

  const params: any = { page, limit: 20, search: debouncedSearch };
  if (roleFilter) params.role = roleFilter;
  if (statusFilter) params.isActive = statusFilter;

  const { data, isLoading } = useUsers(params);
  const { data: productsData } = useProducts({ limit: 1000 });
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const changePassword = useChangePassword();
  const toggleStatus = useToggleUserStatus();

  const [createForm, setCreateForm] = useState({ username: '', email: '', password: '', fullName: '', role: 'VENDEDOR' });
  const [editForm, setEditForm] = useState({ fullName: '', role: '', username: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '' });

  const allProducts: Product[] = useMemo(() => {
    const raw: any = productsData;
    const list: Product[] = Array.isArray(raw) ? raw : raw?.data || [];
    return list.filter((p) => p.isActive);
  }, [productsData]);

  // Comisiones del usuario en edición: productId → S/ por unidad
  const [userCommissions, setUserCommissions] = useState<UserCommissionRow[]>([]);
  const [originalCommissions, setOriginalCommissions] = useState<Record<string, number>>({});
  const [productPicker, setProductPicker] = useState('');
  const [savingCommissions, setSavingCommissions] = useState(false);

  // Reinicia comisiones al abrir el modal con los datos actuales
  useEffect(() => {
    if (!editingUser) return;
    const rows: UserCommissionRow[] = [];
    const original: Record<string, number> = {};
    allProducts.forEach((p) => {
      const entry = p.commissions?.find((c) => c.workerId === editingUser.id);
      if (entry && entry.type === 'AMOUNT' && entry.value > 0) {
        rows.push({ productId: p.id, value: entry.value });
        original[p.id] = entry.value;
      }
    });
    setUserCommissions(rows);
    setOriginalCommissions(original);
    setProductPicker('');
  }, [editingUser, allProducts]);

  const openCreate = () => {
    setCreateForm({ username: '', email: '', password: '', fullName: '', role: 'VENDEDOR' });
    setShowCreateModal(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({ fullName: user.fullName, role: user.role, username: user.username, email: user.email || '' });
  };

  const closeEdit = () => {
    setEditingUser(null);
    setUserCommissions([]);
    setOriginalCommissions({});
  };

  const openPassword = (user: User) => {
    setPasswordUser(user);
    setPasswordForm({ newPassword: '' });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { username: createForm.username, password: createForm.password, fullName: createForm.fullName, role: createForm.role };
    if (createForm.email) payload.email = createForm.email;
    await createUser.mutateAsync(payload);
    setShowCreateModal(false);
  };

  const isSellerRole = editForm.role === 'VENDEDOR' || editForm.role === 'VENDEDOR_CAMPO';

  const productsById = useMemo(() => {
    const map = new Map<string, Product>();
    allProducts.forEach((p) => map.set(p.id, p));
    return map;
  }, [allProducts]);

  const availableForPicker = useMemo(() => {
    const taken = new Set(userCommissions.map((c) => c.productId));
    return allProducts.filter((p) => !taken.has(p.id));
  }, [allProducts, userCommissions]);

  const addCommissionProduct = (productId: string) => {
    if (!productId) return;
    if (userCommissions.some((c) => c.productId === productId)) return;
    setUserCommissions((prev) => [...prev, { productId, value: 0 }]);
    setProductPicker('');
  };

  const updateCommissionValue = (productId: string, value: number) => {
    setUserCommissions((prev) => prev.map((c) => (c.productId === productId ? { ...c, value } : c)));
  };

  const removeCommissionProduct = (productId: string) => {
    setUserCommissions((prev) => prev.filter((c) => c.productId !== productId));
  };

  const persistCommissionDiff = async () => {
    if (!editingUser) return;
    const current = new Map(userCommissions.map((c) => [c.productId, c.value]));
    const productIds = new Set([...current.keys(), ...Object.keys(originalCommissions)]);
    const updates: Promise<unknown>[] = [];

    productIds.forEach((productId) => {
      const previousValue = originalCommissions[productId];
      const nextValue = current.get(productId);
      const product = productsById.get(productId);
      if (!product) return;

      const wasPresent = typeof previousValue === 'number' && previousValue > 0;
      const willBePresent = typeof nextValue === 'number' && nextValue > 0;

      if (wasPresent && willBePresent && previousValue === nextValue) return;
      if (!wasPresent && !willBePresent) return;

      const others = (product.commissions || []).filter((c) => c.workerId !== editingUser.id);
      const nextCommissions: ProductCommission[] = willBePresent
        ? [...others, { workerId: editingUser.id, type: 'AMOUNT', value: nextValue }]
        : others;

      updates.push(productService.update(product.id, { commissions: nextCommissions }));
    });

    if (updates.length === 0) return;
    setSavingCommissions(true);
    try {
      await Promise.all(updates);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    } finally {
      setSavingCommissions(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const payload: any = { fullName: editForm.fullName, role: editForm.role, username: editForm.username };
    if (editForm.email) payload.email = editForm.email;
    else payload.email = '';
    try {
      await updateUser.mutateAsync({ id: editingUser.id, data: payload });
      if (isSellerRole) {
        await persistCommissionDiff();
        toast.success('Comisiones actualizadas');
      }
      closeEdit();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al guardar comisiones');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;
    await changePassword.mutateAsync({ id: passwordUser.id, data: passwordForm });
    setPasswordUser(null);
  };

  const users = data?.data || [];
  const total = data?.total || 0;

  const columns = [
    { key: 'fullName', header: 'Nombre' },
    { key: 'username', header: 'Usuario' },
    { key: 'email', header: 'Email', render: (item: User) => <span>{item.email || '-'}</span> },
    {
      key: 'role', header: 'Rol', render: (item: User) => {
        const colorClass = item.role === 'ADMIN'
          ? 'bg-purple-100 text-purple-800'
          : item.role === 'VENDEDOR_CAMPO'
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-blue-100 text-blue-800';
        const label = item.role === 'VENDEDOR_CAMPO' ? 'Vendedor Campo' : item.role;
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>{label}</span>
        );
      },
    },
    {
      key: 'isActive', header: 'Estado', render: (item: User) => (
        <span className={`px-2 py-1 rounded-full text-xs ${item.isActive ? 'bg-primary-100 text-primary-800' : 'bg-red-100 text-red-800'}`}>
          {item.isActive ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'actions', header: 'Acciones', render: (item: User) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800" title="Editar"><Edit2 size={16} /></button>
          <button onClick={() => openPassword(item)} className="text-yellow-600 hover:text-yellow-800" title="Cambiar contrasena"><Key size={16} /></button>
          <button onClick={() => toggleStatus.mutate(item.id)} disabled={toggleStatus.isPending} className={`${item.isActive ? 'text-red-600 hover:text-red-800' : 'text-primary-600 hover:text-primary-800'} disabled:opacity-40 disabled:cursor-not-allowed`} title={item.isActive ? 'Desactivar' : 'Activar'}><Power size={16} /></button>
        </div>
      ),
    },
  ];

  const isSavingEdit = updateUser.isPending || savingCommissions;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus size={18} /> Nuevo Usuario
        </button>
      </div>

      <div className="mb-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="Buscar por nombre o usuario..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500">
          <option value="">Todos los roles</option>
          <option value="ADMIN">Admin</option>
          <option value="VENDEDOR">Vendedor</option>
          <option value="VENDEDOR_CAMPO">Vendedor de Campo</option>
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500">
          <option value="">Todos los estados</option>
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </select>
      </div>

      <DataTable columns={columns} data={users} isLoading={isLoading} />
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />

      {/* Modal Crear */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nuevo Usuario">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
            <input value={createForm.fullName} onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
            <input value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required minLength={3} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-gray-400">(opcional)</span></label>
            <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contrasena</label>
            <input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required minLength={6} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
            <select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
              <option value="VENDEDOR">Vendedor</option>
              <option value="VENDEDOR_CAMPO">Vendedor de Campo</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            Las comisiones por producto las podés asignar después, editando al usuario.
          </p>
          <button type="submit" disabled={createUser.isPending} className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {createUser.isPending ? 'Creando...' : 'Crear Usuario'}
          </button>
        </form>
      </Modal>

      {/* Modal Editar */}
      <Modal isOpen={!!editingUser} onClose={closeEdit} title="Editar Usuario" size={isSellerRole ? 'lg' : 'default'}>
        <form onSubmit={handleEdit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
              <input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
              <input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required minLength={3} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-gray-400">(opcional)</span></label>
              <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option value="VENDEDOR">Vendedor</option>
                <option value="VENDEDOR_CAMPO">Vendedor de Campo</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>

          {isSellerRole && (
            <section className="pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Percent size={14} className="text-gray-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Comisiones por producto</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Soles fijos por unidad vendida. Los cambios se guardan al hacer "Guardar cambios" (afecta a cada producto).
              </p>

              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select
                    value={productPicker}
                    onChange={(e) => addCommissionProduct(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Agregar producto…</option>
                    {availableForPicker.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {userCommissions.length === 0 ? (
                <div className="px-4 py-6 border border-dashed border-gray-300 rounded-xl bg-gray-50 text-center text-xs text-gray-500">
                  Este trabajador todavía no cobra comisión por ningún producto.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {userCommissions.map((row) => {
                    const product = productsById.get(row.productId);
                    if (!product) return null;
                    return (
                      <div key={row.productId} className="flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-xl bg-white">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate text-gray-700 font-medium">{product.name}</div>
                          {product.unit && (
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider">por {product.unit}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500 font-medium">S/</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={row.value || ''}
                            onChange={(e) => updateCommissionValue(row.productId, parseFloat(e.target.value) || 0)}
                            className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <span className="text-xs text-gray-400">/ unidad</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCommissionProduct(row.productId)}
                          className="text-gray-400 hover:text-red-500"
                          title="Quitar comisión"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          <button type="submit" disabled={isSavingEdit} className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {isSavingEdit ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </form>
      </Modal>

      {/* Modal Cambiar Contrasena */}
      <Modal isOpen={!!passwordUser} onClose={() => setPasswordUser(null)} title={`Cambiar contrasena - ${passwordUser?.fullName}`}>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contrasena</label>
            <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ newPassword: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required minLength={6} />
          </div>
          <button type="submit" disabled={changePassword.isPending} className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {changePassword.isPending ? 'Cambiando...' : 'Cambiar Contrasena'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
