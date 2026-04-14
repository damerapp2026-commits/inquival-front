import React, { useState } from 'react';
import { useKardex } from '../hooks/useKardex';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts } from '../../products/hooks/useProducts';
import { DataTable } from '../../../shared/components/DataTable';
import { Pagination } from '../../../shared/components/Pagination';
import { ClipboardList, Search, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import type { Company, Product } from '../../../shared/types';

const MOVEMENT_LABELS: Record<string, { label: string; color: string; isEntry: boolean }> = {
  PURCHASE: { label: 'Compra', color: 'bg-primary-100 text-primary-800', isEntry: true },
  SALE: { label: 'Venta', color: 'bg-red-100 text-red-800', isEntry: false },
  ADJUSTMENT_IN: { label: 'Ajuste +', color: 'bg-blue-100 text-blue-800', isEntry: true },
  ADJUSTMENT_OUT: { label: 'Ajuste -', color: 'bg-orange-100 text-orange-800', isEntry: false },
  TRANSFER_IN: { label: 'Transf. entrada', color: 'bg-purple-100 text-purple-800', isEntry: true },
  TRANSFER_OUT: { label: 'Transf. salida', color: 'bg-yellow-100 text-yellow-800', isEntry: false },
  LOAN_OUT: { label: 'Préstamo', color: 'bg-indigo-100 text-indigo-800', isEntry: false },
  LOAN_RETURN: { label: 'Dev. préstamo', color: 'bg-teal-100 text-teal-800', isEntry: true },
};

interface StockMovement {
  id: string;
  productId: string;
  companyId: string;
  movementType: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceId?: string;
  referenceType?: string;
  description: string;
  userId?: string;
  date: string;
}

export function KardexPage() {
  const [page, setPage] = useState(1);
  const [companyId, setCompanyId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [movementType, setMovementType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 200 });

  const companyList = Array.isArray(companies) ? companies : [];
  const products = productsData?.data || [];

  const [selectedProductId, setSelectedProductId] = useState('');

  const params: any = { page, limit: 25 };
  if (companyId) params.companyId = companyId;
  if (selectedProductId) params.productId = selectedProductId;
  if (movementType) params.movementType = movementType;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const { data, isLoading } = useKardex(params);
  const movements = data?.data || [];
  const total = data?.total || 0;

  const getProductName = (id: string) => products.find((p: Product) => p.id === id)?.name || id;
  const getCompanyName = (id: string) => companyList.find((c: Company) => c.id === id)?.name || id;

  const filteredProducts = productSearch
    ? products.filter((p: Product) => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    : products;

  const resetFilters = () => {
    setCompanyId('');
    setSelectedProductId('');
    setProductSearch('');
    setMovementType('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const columns = [
    {
      key: 'date', header: 'Fecha', render: (item: StockMovement) =>
        new Date(item.date).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    },
    { key: 'productId', header: 'Producto', render: (item: StockMovement) => <span className="font-medium">{getProductName(item.productId)}</span> },
    { key: 'companyId', header: 'Empresa', render: (item: StockMovement) => getCompanyName(item.companyId) },
    {
      key: 'movementType', header: 'Tipo', render: (item: StockMovement) => {
        const info = MOVEMENT_LABELS[item.movementType] || { label: item.movementType, color: 'bg-gray-100 text-gray-800' };
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${info.color}`}>{info.label}</span>;
      },
    },
    {
      key: 'entrada', header: 'Entrada', render: (item: StockMovement) => {
        const info = MOVEMENT_LABELS[item.movementType];
        return info?.isEntry ? (
          <span className="text-primary-600 font-semibold flex items-center gap-1"><ArrowUpCircle size={14} /> +{item.quantity}</span>
        ) : <span className="text-gray-300">-</span>;
      },
    },
    {
      key: 'salida', header: 'Salida', render: (item: StockMovement) => {
        const info = MOVEMENT_LABELS[item.movementType];
        return !info?.isEntry ? (
          <span className="text-red-600 font-semibold flex items-center gap-1"><ArrowDownCircle size={14} /> -{item.quantity}</span>
        ) : <span className="text-gray-300">-</span>;
      },
    },
    { key: 'previousStock', header: 'Stock Ant.', render: (item: StockMovement) => <span className="text-gray-500">{item.previousStock}</span> },
    { key: 'newStock', header: 'Stock Nuevo', render: (item: StockMovement) => <span className="font-semibold">{item.newStock}</span> },
    {
      key: 'description', header: 'Descripcion', render: (item: StockMovement) =>
        <span className="text-sm text-gray-600 max-w-[200px] truncate block" title={item.description}>{item.description}</span>,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ClipboardList size={24} /> Kardex
        </h1>
        <button onClick={resetFilters} className="text-sm text-gray-500 hover:text-gray-700 underline">Limpiar filtros</button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Empresa</label>
            <select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setPage(1); }} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
              <option value="">Todas</option>
              {companyList.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Producto</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={selectedProductId ? getProductName(selectedProductId) : productSearch}
                onChange={(e) => { setProductSearch(e.target.value); setSelectedProductId(''); }}
                onFocus={() => { if (selectedProductId) { setProductSearch(''); setSelectedProductId(''); } }}
                className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
              {productSearch && !selectedProductId && filteredProducts.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredProducts.slice(0, 10).map((p: Product) => (
                    <button key={p.id} onClick={() => { setSelectedProductId(p.id); setProductSearch(''); setPage(1); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0">
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo movimiento</label>
            <select value={movementType} onChange={(e) => { setMovementType(e.target.value); setPage(1); }} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
              <option value="">Todos</option>
              <option value="PURCHASE">Compra</option>
              <option value="SALE">Venta</option>
              <option value="ADJUSTMENT_IN">Ajuste +</option>
              <option value="ADJUSTMENT_OUT">Ajuste -</option>
              <option value="TRANSFER_IN">Transf. entrada</option>
              <option value="TRANSFER_OUT">Transf. salida</option>
              <option value="LOAN_OUT">Préstamo</option>
              <option value="LOAN_RETURN">Dev. préstamo</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
      </div>

      <DataTable columns={columns} data={movements} isLoading={isLoading} />
      <Pagination page={page} totalPages={Math.ceil(total / 25)} onPageChange={setPage} />

      {!isLoading && movements.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <ClipboardList size={48} className="mx-auto mb-3 text-gray-300" />
          <p>No hay movimientos registrados con los filtros seleccionados.</p>
          <p className="text-sm mt-1">Los movimientos se registran automaticamente al crear compras, ventas, ajustes y transferencias.</p>
        </div>
      )}
    </div>
  );
}
