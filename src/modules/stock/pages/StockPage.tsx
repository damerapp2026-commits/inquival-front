import React, { useState } from 'react';
import { useStock, useStockAlerts, useTransferStock } from '../hooks/useStock';
import { useStockAdjustments, useCreateStockAdjustment } from '../hooks/useStockAdjustments';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts } from '../../products/hooks/useProducts';
import { DataTable } from '../../../shared/components/DataTable';
import { Modal } from '../../../shared/components/Modal';
import { Pagination } from '../../../shared/components/Pagination';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { Package, ArrowRightLeft, AlertTriangle, Trash2, Plus, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import type { Stock, Company, Product, StockAdjustment } from '../../../shared/types';

export function StockPage() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'adjustments' | 'transfers'>('inventory');
  const [page, setPage] = useState(1);
  const [companyId, setCompanyId] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjPage, setAdjPage] = useState(1);
  const [showLowStockDetail, setShowLowStockDetail] = useState(false);
  const [showAllLowStock, setShowAllLowStock] = useState(false);

  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 200 });
  const { data, isLoading } = useStock(companyId, { page, limit: 20 });
  const { data: alerts } = useStockAlerts(companyId, 10);
  const transferStock = useTransferStock();
  const { data: adjustmentsData, isLoading: adjLoading } = useStockAdjustments({ page: adjPage, limit: 20, companyId: companyId || undefined });
  const createAdjustment = useCreateStockAdjustment();

  const [transferForm, setTransferForm] = useState({ fromCompanyId: '', toCompanyId: '', items: [{ productId: '', quantity: 0 }] as { productId: string; quantity: number }[] });
  const [adjForm, setAdjForm] = useState({ productId: '', companyId: '', type: 'INCREASE' as 'INCREASE' | 'DECREASE', quantity: 0, reason: '' });

  const companyList = Array.isArray(companies) ? companies : [];
  const products = productsData?.data || [];
  const stockItems = data?.data || [];
  const total = data?.total || 0;
  const alertList = Array.isArray(alerts) ? alerts : [];
  const adjustments = adjustmentsData?.data || [];
  const adjTotal = adjustmentsData?.total || 0;

  const getProductName = (id: string) => products.find((p: Product) => p.id === id)?.name || 'N/A';
  const getCompanyName = (id: string) => companyList.find((c: Company) => c.id === id)?.name || 'N/A';

  const openTransfer = () => { setTransferForm({ fromCompanyId: companyId || '', toCompanyId: '', items: [{ productId: '', quantity: 0 }] }); setShowTransfer(true); };
  const openAdjustment = (preset?: { productId?: string; companyId?: string }) => {
    setAdjForm({
      productId: preset?.productId || '',
      companyId: preset?.companyId || companyId || (companyList[0]?.id || ''),
      type: 'INCREASE',
      quantity: 0,
      reason: '',
    });
    setShowAdjustment(true);
  };

  const addTransferItem = () => setTransferForm(prev => ({ ...prev, items: [...prev.items, { productId: '', quantity: 0 }] }));
  const removeTransferItem = (idx: number) => setTransferForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  const updateTransferItem = (idx: number, field: string, value: any) => setTransferForm(prev => { const items = [...prev.items]; items[idx] = { ...items[idx], [field]: value }; return { ...prev, items }; });

  const handleTransfer = async (e: React.FormEvent) => { e.preventDefault(); await transferStock.mutateAsync(transferForm); setShowTransfer(false); };
  const handleAdjustment = async (e: React.FormEvent) => { e.preventDefault(); await createAdjustment.mutateAsync(adjForm); setShowAdjustment(false); };

  React.useEffect(() => { if (!companyId && companyList.length > 0) setCompanyId(companyList[0].id); }, [companyList, companyId]);

  const stockColumns = [
    { key: 'productId', header: 'Producto', render: (item: Stock) => getProductName(item.productId) },
    { key: 'quantity', header: 'Cantidad', render: (item: Stock) => <span className={item.quantity <= 10 ? 'text-red-600 font-bold' : ''}>{item.quantity}</span> },
    { key: 'lastUpdated', header: 'Ultima actualizacion', render: (item: Stock) => new Date(item.lastUpdated).toLocaleDateString('es-PE') },
  ];

  const adjColumns = [
    { key: 'date', header: 'Fecha', render: (item: StockAdjustment) => new Date(item.date).toLocaleDateString('es-PE') },
    { key: 'productId', header: 'Producto', render: (item: StockAdjustment) => getProductName(item.productId) },
    { key: 'companyId', header: 'Empresa', render: (item: StockAdjustment) => getCompanyName(item.companyId) },
    { key: 'type', header: 'Tipo', render: (item: StockAdjustment) => item.type === 'INCREASE' ? <span className="text-primary-600 font-medium">Aumento</span> : <span className="text-red-600 font-medium">Disminucion</span> },
    { key: 'quantity', header: 'Cantidad', render: (item: StockAdjustment) => item.quantity },
    { key: 'previousQuantity', header: 'Anterior', render: (item: StockAdjustment) => item.previousQuantity },
    { key: 'newQuantity', header: 'Nuevo', render: (item: StockAdjustment) => item.newQuantity },
    { key: 'reason', header: 'Razon', render: (item: StockAdjustment) => <span className="text-sm text-gray-600">{item.reason}</span> },
  ];

  const tabs = [
    { id: 'inventory' as const, label: 'Inventario', icon: Package },
    { id: 'adjustments' as const, label: 'Ajustes', icon: ClipboardList },
    { id: 'transfers' as const, label: 'Transferencias', icon: ArrowRightLeft },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Package size={24} /> Stock</h1>
        <div className="flex flex-wrap gap-2">
          {activeTab === 'inventory' && <button onClick={() => openAdjustment()} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"><Plus size={18} /> Ajuste</button>}
          {activeTab === 'inventory' && <button onClick={openTransfer} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><ArrowRightLeft size={18} /> Transferir</button>}
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b">
        {tabs.map(tab => { const Icon = tab.icon; return (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setPage(1); setAdjPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Icon size={16} />{tab.label}
          </button>
        ); })}
      </div>

      {alertList.length > 0 && activeTab === 'inventory' && (() => {
        // Clasificar alertas en 3 grupos: agotados, críticos, sin referencia
        type AlertItem = Stock & { _name: string };
        const enriched: AlertItem[] = alertList.map((a: Stock) => ({ ...a, _name: getProductName(a.productId) }));
        const orphan = enriched.filter(a => a._name === 'N/A');
        const known = enriched.filter(a => a._name !== 'N/A');
        const outOfStock = known.filter(a => a.quantity === 0).sort((a, b) => a._name.localeCompare(b._name));
        const critical = known.filter(a => a.quantity > 0).sort((a, b) => a.quantity - b.quantity || a._name.localeCompare(b._name));

        const MAX_VISIBLE = 30;
        const visibleCritical = showAllLowStock ? critical : critical.slice(0, MAX_VISIBLE);
        const hiddenCount = Math.max(0, critical.length - MAX_VISIBLE);

        return (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowLowStockDetail(v => !v)}
              className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-yellow-100 transition-colors"
            >
              <div className="flex items-center gap-2 text-yellow-900">
                <AlertTriangle size={18} className="flex-shrink-0" />
                <div>
                  <div className="font-semibold">Stock bajo ({alertList.length} productos)</div>
                  <div className="text-xs text-yellow-800 mt-0.5">
                    {outOfStock.length > 0 && <span className="text-red-700 font-medium">{outOfStock.length} agotados</span>}
                    {outOfStock.length > 0 && critical.length > 0 && <span className="mx-1">·</span>}
                    {critical.length > 0 && <span>{critical.length} con poco stock</span>}
                    {orphan.length > 0 && <span className="ml-1 text-gray-600">· {orphan.length} sin referencia</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-yellow-800 text-sm font-medium flex-shrink-0">
                {showLowStockDetail ? <>Ocultar <ChevronUp size={16} /></> : <>Ver detalle <ChevronDown size={16} /></>}
              </div>
            </button>

            {showLowStockDetail && (
              <div className="px-3 pb-3 pt-1 space-y-3 border-t border-yellow-200">
                {outOfStock.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">Agotados ({outOfStock.length})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {outOfStock.map((a) => (
                        <button
                          key={`${a.productId}-${a.companyId}`}
                          onClick={() => openAdjustment({ productId: a.productId, companyId: a.companyId })}
                          className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs font-medium border border-red-200 transition-colors"
                          title="Click para ajustar stock"
                        >
                          {a._name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {critical.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-yellow-800 uppercase tracking-wide mb-2">Stock crítico ({critical.length})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {visibleCritical.map((a) => (
                        <button
                          key={`${a.productId}-${a.companyId}`}
                          onClick={() => openAdjustment({ productId: a.productId, companyId: a.companyId })}
                          className="px-2 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 rounded text-xs font-medium border border-yellow-300 transition-colors"
                          title="Click para ajustar stock"
                        >
                          {a._name} <span className="text-yellow-700">· {a.quantity}</span>
                        </button>
                      ))}
                      {!showAllLowStock && hiddenCount > 0 && (
                        <button
                          onClick={() => setShowAllLowStock(true)}
                          className="px-2 py-1 bg-white hover:bg-gray-50 text-gray-700 rounded text-xs font-medium border border-gray-300"
                        >
                          Ver más (+{hiddenCount})
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {orphan.length > 0 && (
                  <div className="pt-2 border-t border-yellow-200">
                    <div className="text-xs font-medium text-gray-600 mb-1">
                      {orphan.length} {orphan.length === 1 ? 'registro sin referencia' : 'registros sin referencia'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Estos registros referencian productos que ya no existen en la base. Es seguro ignorarlos o limpiarlos manualmente desde Mongo.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {(activeTab === 'inventory' || activeTab === 'adjustments') && (
        <div className="mb-4 flex gap-2">
          {companyList.map((c: Company) => (
            <button key={c.id} onClick={() => { setCompanyId(c.id); setPage(1); setAdjPage(1); }} className={`px-4 py-2 rounded-lg font-medium ${companyId === c.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'inventory' && (
        <>
          <DataTable columns={stockColumns} data={stockItems} isLoading={isLoading} />
          <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
        </>
      )}

      {activeTab === 'adjustments' && (
        <>
          <div className="flex justify-end mb-3">
            <button onClick={() => openAdjustment()} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"><Plus size={18} /> Nuevo Ajuste</button>
          </div>
          <DataTable columns={adjColumns} data={adjustments} isLoading={adjLoading} />
          <Pagination page={adjPage} totalPages={Math.ceil(adjTotal / 20)} onPageChange={setAdjPage} />
        </>
      )}

      {activeTab === 'transfers' && (
        <div className="text-center py-12 text-gray-500">
          <ArrowRightLeft size={48} className="mx-auto mb-4 text-gray-300" />
          <p>Usa el boton "Transferir Stock" desde la pestana de Inventario para mover productos entre empresas.</p>
        </div>
      )}

      <Modal isOpen={showTransfer} onClose={() => setShowTransfer(false)} title="Transferir Stock entre Empresas">
        <form onSubmit={handleTransfer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
              <select value={transferForm.fromCompanyId} onChange={(e) => setTransferForm({ ...transferForm, fromCompanyId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
                <option value="">Seleccionar...</option>
                {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Hacia</label>
              <select value={transferForm.toCompanyId} onChange={(e) => setTransferForm({ ...transferForm, toCompanyId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
                <option value="">Seleccionar...</option>
                {companyList.filter((c: Company) => c.id !== transferForm.fromCompanyId).map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2"><label className="text-sm font-medium text-gray-700">Productos</label><button type="button" onClick={addTransferItem} className="text-sm text-primary-600 hover:text-primary-800">+ Agregar</button></div>
            <div className="space-y-2">
              {transferForm.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <SearchableSelect
                      options={products.map((p: Product) => ({ value: p.id, label: p.name }))}
                      value={item.productId}
                      onChange={(v) => updateTransferItem(idx, 'productId', v)}
                      placeholder="Buscar producto..."
                      required
                    />
                  </div>
                  <input type="number" placeholder="Cantidad" min="0.01" step="0.01" value={item.quantity || ''} onChange={(e) => updateTransferItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-28 px-2 py-1 border rounded text-sm" required />
                  {transferForm.items.length > 1 && <button type="button" onClick={() => removeTransferItem(idx)} className="text-red-500"><Trash2 size={14} /></button>}
                </div>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Realizar Transferencia</button>
        </form>
      </Modal>

      <Modal isOpen={showAdjustment} onClose={() => setShowAdjustment(false)} title="Ajuste de Stock">
        <form onSubmit={handleAdjustment} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
            <select value={adjForm.companyId} onChange={(e) => setAdjForm({ ...adjForm, companyId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
              <option value="">Seleccionar...</option>
              {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
            <SearchableSelect
              options={products.map((p: Product) => ({ value: p.id, label: p.name }))}
              value={adjForm.productId}
              onChange={(v) => setAdjForm({ ...adjForm, productId: v })}
              placeholder="Buscar producto..."
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={adjForm.type} onChange={(e) => setAdjForm({ ...adjForm, type: e.target.value as 'INCREASE' | 'DECREASE' })} className="w-full px-3 py-2 border rounded-lg">
                <option value="INCREASE">Aumento</option>
                <option value="DECREASE">Disminucion</option>
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
              <input type="number" min="0.01" step="0.01" value={adjForm.quantity || ''} onChange={(e) => setAdjForm({ ...adjForm, quantity: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Razon</label>
            <textarea value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} required placeholder="Motivo del ajuste..." />
          </div>
          <button type="submit" className="w-full py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">Registrar Ajuste</button>
        </form>
      </Modal>
    </div>
  );
}
