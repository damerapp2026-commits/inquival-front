import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { Building2, Check, ChevronDown, Loader2, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../app/providers/AuthProvider';
import { useBranch } from '../../app/providers/BranchProvider';
import { api, getPendingWriteCount, subscribePendingWrites } from '../services/api';
import { Modal } from './Modal';

export function BranchSelector() {
  const { user } = useAuth();
  const { branches, currentBranch, selectBranch, refreshBranches } = useBranch();
  const writes = useSyncExternalStore(subscribePendingWrites, getPendingWriteCount);
  const mutations = useIsMutating();
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();
  const nameId = useId();
  const [form, setForm] = useState({ name: '', address: '', phone: '' });
  const busy = !!(writes || mutations || saving || switching);
  const searchable = branches.length > 5;
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return branches.filter(branch => `${branch.name} ${branch.address || ''}`.toLocaleLowerCase('es').includes(query));
  }, [branches, search]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    if (searchable) searchRef.current?.focus();
    else optionRefs.current[Math.max(0, branches.findIndex(branch => branch.id === currentBranch?.id))]?.focus();
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open, searchable]);

  useEffect(() => { if (busy) setOpen(false); }, [busy]);

  const toggleMenu = () => {
    setSearch('');
    setOpen(value => !value);
  };
  const choose = async (id: string) => {
    setOpen(false);
    if (id === currentBranch?.id) { triggerRef.current?.focus(); return; }
    setSwitching(true);
    try { await selectBranch(id); }
    catch (error: any) { toast.error(error.message); setSwitching(false); triggerRef.current?.focus(); }
  };
  const navigateOptions = (event: KeyboardEvent) => {
    const index = optionRefs.current.findIndex(option => option === document.activeElement);
    let next = index;
    if (event.key === 'ArrowDown') next = (index + 1) % filtered.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + filtered.length) % filtered.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = filtered.length - 1;
    else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const start = index + 1;
      for (let offset = 0; offset < filtered.length; offset++) {
        const candidate = (start + offset) % filtered.length;
        if (filtered[candidate].name.toLocaleLowerCase('es').startsWith(event.key.toLocaleLowerCase('es'))) { next = candidate; break; }
      }
    } else return;
    event.preventDefault();
    optionRefs.current[next]?.focus();
  };
  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await api.post('/branches', form);
      await refreshBranches();
      setShowCreate(false);
      setForm({ name: '', address: '', phone: '' });
      toast.success('Sucursal creada. Ya puedes seleccionarla.');
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'No se pudo crear la sucursal';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally { setSaving(false); }
  };

  if (user?.role !== 'ADMIN') return <span className="text-white text-sm truncate max-w-40" title="Sucursal asignada">{currentBranch?.name}</span>;
  return <>
    <div ref={rootRef} className="relative shrink-0"
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); triggerRef.current?.focus(); }
      }}>
      <button ref={triggerRef} id="active-branch" type="button" aria-label="Sucursal activa" aria-describedby={nameId}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        disabled={busy} title={busy ? 'Espera a que termine la operación en curso' : currentBranch?.name}
        onClick={toggleMenu}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setSearch(''); setOpen(true); }
        }}
        className={`group flex h-12 w-44 sm:w-60 items-center gap-2.5 rounded-xl border bg-white px-2.5 sm:px-3 text-left shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600 disabled:cursor-wait disabled:opacity-70 ${open ? 'border-emerald-200 ring-2 ring-white/25' : 'border-white/70 hover:bg-emerald-50 hover:shadow-md'}`}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          {switching ? <Loader2 size={17} className="animate-spin" /> : <Building2 size={17} strokeWidth={1.8} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] leading-3 text-slate-400">Sucursal</span>
          <span id={nameId} className="mt-0.5 block truncate text-[13px] sm:text-sm font-semibold leading-4 text-slate-700">{switching ? 'Cambiando…' : currentBranch?.name}</span>
        </span>
        <ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute -right-[52px] sm:right-0 top-full z-50 mt-3 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-100 bg-white text-slate-700 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.22)]">
          <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
            <span className="text-sm font-semibold text-slate-800">Sucursales</span>
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500">{branches.length}</span>
          </div>
          {searchable && <div className="px-3 pb-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-100">
              <Search size={15} className="shrink-0 text-slate-400" />
              <input ref={searchRef} aria-label="Buscar sucursal" placeholder="Buscar sucursal…" value={search}
                onChange={event => { setSearch(event.target.value); setFocusedIndex(0); }}
                onKeyDown={event => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault(); optionRefs.current[event.key === 'ArrowDown' ? 0 : filtered.length - 1]?.focus();
                  }
                }} className="min-w-0 w-full bg-transparent py-2 text-sm outline-none placeholder:text-slate-400" />
            </div>
          </div>}
          <div id={listId} role="listbox" aria-label="Sucursales disponibles" onKeyDown={navigateOptions}
            className="max-h-72 overflow-y-auto px-2 pb-2 scrollbar-thin">
            {filtered.map((branch, index) => {
              const selected = branch.id === currentBranch?.id;
              return <button key={branch.id} ref={element => { optionRefs.current[index] = element; }}
                type="button" role="option" aria-label={branch.name} aria-selected={selected}
                tabIndex={index === focusedIndex ? 0 : -1} onFocus={() => setFocusedIndex(index)}
                onClick={() => { void choose(branch.id); }} disabled={busy}
                className={`mt-1 flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${selected ? 'border-emerald-100 bg-emerald-50/80 text-emerald-800' : 'border-transparent hover:bg-slate-50 text-slate-600'}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-emerald-100/80 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}><Building2 size={17} strokeWidth={1.8} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{branch.name}</span>
                  {branch.address && <span className="mt-0.5 block truncate text-xs text-slate-400">{branch.address}</span>}
                </span>
                {selected && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><Check size={12} strokeWidth={3} /></span>}
              </button>;
            })}
            {!filtered.length && <div className="px-4 py-7 text-center text-sm text-slate-400">No se encontraron sucursales</div>}
          </div>
          <div className="border-t border-slate-100 p-3">
            <button type="button" disabled={busy} onClick={() => { setOpen(false); setShowCreate(true); }}
              className="flex w-full items-center gap-2.5 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-60">
              <Plus size={17} /> Crear sucursal
            </button>
          </div>
        </div>
      )}
    </div>
    <Modal isOpen={showCreate} onClose={() => { if (!saving) setShowCreate(false); }} title="Nueva sucursal">
      <form onSubmit={create} className="space-y-4">
        <p className="text-sm text-gray-500">Tendrá su propio almacén, clientes, productos y caja. Empezará sin ventas, compras ni saldos.</p>
        <div><label htmlFor="branch-name" className="block text-sm font-medium mb-1">Nombre de la sucursal</label>
          <input id="branch-name" autoFocus required minLength={2} maxLength={80} value={form.name}
            onChange={event => setForm({ ...form, name: event.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
        <div><label htmlFor="branch-address" className="block text-sm font-medium mb-1">Dirección</label>
          <input id="branch-address" maxLength={250} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
        <div><label htmlFor="branch-phone" className="block text-sm font-medium mb-1">Teléfono</label>
          <input id="branch-phone" type="tel" maxLength={40} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
        <button type="submit" disabled={saving || form.name.trim().length < 2} className="w-full py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50">{saving ? 'Creando sucursal…' : 'Crear sucursal'}</button>
      </form>
    </Modal>
  </>;
}
