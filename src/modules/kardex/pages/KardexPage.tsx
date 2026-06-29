import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { useKardex } from '../hooks/useKardex';
import { kardexService } from '../services/kardexService';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useProducts } from '../../products/hooks/useProducts';
import { productService } from '../../products/services/productService';
import { useStockByProductSummary } from '../../stock/hooks/useStock';
import { useLaboratories } from '../../laboratories/hooks/useLaboratories';
import { useExpiringLots, useProductLotsByProduct } from '../../stock/hooks/useProductLots';
import { DataTable } from '../../../shared/components/DataTable';
import { Pagination } from '../../../shared/components/Pagination';
import { ClipboardList, Search, ArrowUpCircle, ArrowDownCircle, X, Package, FileText, Download, Printer, ArrowLeft } from 'lucide-react';
import type { Company, Product } from '../../../shared/types';

const MOVEMENT_LABELS: Record<string, { label: string; color: string; isEntry: boolean }> = {
  PURCHASE: { label: 'Compra', color: 'bg-primary-100 text-primary-800', isEntry: true },
  SALE: { label: 'Venta', color: 'bg-red-100 text-red-800', isEntry: false },
  ADJUSTMENT_IN: { label: 'Ajuste +', color: 'bg-blue-100 text-blue-800', isEntry: true },
  ADJUSTMENT_OUT: { label: 'Ajuste -', color: 'bg-orange-100 text-orange-800', isEntry: false },
  TRANSFER_IN: { label: 'Transf. entrada', color: 'bg-purple-100 text-purple-800', isEntry: true },
  TRANSFER_OUT: { label: 'Transf. salida', color: 'bg-yellow-100 text-yellow-800', isEntry: false },
  LOAN_OUT: { label: 'Préstamo salida', color: 'bg-indigo-100 text-indigo-800', isEntry: false },
  LOAN_RETURN: { label: 'Dev. préstamo', color: 'bg-teal-100 text-teal-800', isEntry: true },
  LOAN_IN: { label: 'Préstamo recibido', color: 'bg-cyan-100 text-cyan-800', isEntry: true },
  LOAN_RETURN_OUT: { label: 'Dev. préstamo salida', color: 'bg-amber-100 text-amber-800', isEntry: false },
};

interface StockMovement {
  id: string;
  productId: string;
  companyId: string;
  movementType: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  unitPrice?: number;
  referenceId?: string;
  referenceType?: string;
  description: string;
  displayDescription?: string;
  userId?: string;
  date: string;
}

type Tab = 'kardex' | 'movimientos';

export function KardexPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = (searchParams.get('tab') as Tab) || 'kardex';
  const tab: Tab = tabParam === 'movimientos' ? 'movimientos' : 'kardex';
  const productIdParam = searchParams.get('productId') || '';

  const { data: companies } = useCompanies();
  const { data: productsData } = useProducts({ limit: 10000 });
  const companyList: Company[] = Array.isArray(companies) ? companies : [];
  const products: Product[] = productsData?.data || [];

  const setTab = (next: Tab) => {
    const sp = new URLSearchParams(searchParams);
    sp.set('tab', next);
    setSearchParams(sp, { replace: true });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {productIdParam && (
            <button
              type="button"
              onClick={() => navigate('/kardex')}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              title="Volver al listado"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList size={24} /> Kardex
          </h1>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-4">
        <div className="flex border-b">
          <button
            onClick={() => setTab('kardex')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tab === 'kardex'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package size={16} /> Kardex
          </button>
          <button
            onClick={() => setTab('movimientos')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tab === 'movimientos'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={16} /> Movimientos
          </button>
        </div>

        <div className="p-4">
          {tab === 'kardex' ? (
            <KardexTab products={products} companyList={companyList} />
          ) : (
            <MovementsTab products={products} companyList={companyList} />
          )}
        </div>
      </div>
    </div>
  );
}

interface SubProps {
  products: Product[];
  companyList: Company[];
}

function KardexTab({ products, companyList }: SubProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const productIdParam = searchParams.get('productId') || '';
  const [productSearch, setProductSearch] = useState('');
  const [companyId, setCompanyId] = useState(searchParams.get('companyId') || '');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
  const [clienteFilter, setClienteFilter] = useState('');
  const [precioVentaFilter, setPrecioVentaFilter] = useState('');

  const setSelectedProductId = (id: string) => {
    const sp = new URLSearchParams(searchParams);
    if (id) {
      sp.set('tab', 'kardex');
      sp.set('productId', id);
      if (companyId) sp.set('companyId', companyId); else sp.delete('companyId');
      if (startDate) sp.set('startDate', startDate); else sp.delete('startDate');
      if (endDate) sp.set('endDate', endDate); else sp.delete('endDate');
    } else {
      sp.delete('productId');
    }
    setSearchParams(sp, { replace: true });
  };

  const productFromList = products.find((p) => p.id === productIdParam);
  const { data: fetchedProduct } = useQuery({
    queryKey: ['product', productIdParam],
    queryFn: () => productService.getById(productIdParam),
    enabled: !!productIdParam && !productFromList,
    staleTime: 60_000,
  });
  const selectedProduct = productFromList || fetchedProduct;

  const getProductName = (id: string) => {
    if (id === productIdParam && selectedProduct) return selectedProduct.name;
    return products.find((p) => p.id === id)?.name || id;
  };
  const getCompanyName = (id: string) => companyList.find((c) => c.id === id)?.name || id;

  const filteredProducts = (productSearch
    ? products.filter((p) => {
        const q = productSearch.toLowerCase();
        return (
          p.name?.toLowerCase().includes(q) ||
          (p as any).activeIngredient?.toLowerCase().includes(q) ||
          (p as any).description?.toLowerCase().includes(q)
        );
      })
    : products
  )
    .slice()
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }));

  // La vista del producto debe mostrar el kardex completo, en orden cronológico,
  // para coincidir con el formato Excel del cliente.
  const params: Record<string, any> = { page: 1, limit: 100000 };
  if (productIdParam) params.productId = productIdParam;
  if (companyId) params.companyId = companyId;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const { data: productLots } = useProductLotsByProduct(productIdParam || undefined, companyId || undefined);
  const { data: stockSummary } = useStockByProductSummary();

  const { data, isLoading } = useKardex(productIdParam ? params : undefined);
  const movementsRaw: StockMovement[] = productIdParam ? data?.data || [] : [];
  const movements: StockMovement[] = productIdParam
    ? [...movementsRaw].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : movementsRaw;
  const total: number = productIdParam ? data?.total || 0 : 0;

  React.useEffect(() => {
    setClienteFilter('');
    setPrecioVentaFilter('');
  }, [productIdParam]);

  const selectedProductStock = React.useMemo(() => {
    if (!productIdParam) return 0;
    const row = (stockSummary || []).find((s) => s.productId === productIdParam);
    if (!row) return 0;
    if (companyId) return row.byCompany.find((b) => b.companyId === companyId)?.quantity || 0;
    return row.totalQuantity;
  }, [stockSummary, productIdParam, companyId]);
  const hasStockWithoutMovements = !!productIdParam && !isLoading && movements.length === 0 && selectedProductStock > 0;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const descFor = (m: StockMovement) => m.displayDescription || m.description;

  const isEntry = (m: StockMovement) => MOVEMENT_LABELS[m.movementType]?.isEntry;

  const lotByPurchaseId = new Map<string, any>();
  if (Array.isArray(productLots)) {
    for (const lot of productLots as any[]) {
      if (lot.purchaseId) lotByPurchaseId.set(lot.purchaseId, lot);
    }
  }

  const displayMovements = movements.filter((m) => {
    if (clienteFilter) {
      const desc = (m.displayDescription || m.description || '').toLowerCase();
      if (!desc.includes(clienteFilter.toLowerCase())) return false;
    }
    if (precioVentaFilter !== '') {
      const p = parseFloat(precioVentaFilter);
      if (!isNaN(p) && (typeof m.unitPrice !== 'number' || Math.abs(m.unitPrice - p) > 0.009)) return false;
    }
    return true;
  });

  const lotStatusKardex = (expirationDate?: Date | string | null): { label: string; color: string } => {
    if (!expirationDate) return { label: 'Sin F.V.', color: 'text-gray-400 border-gray-200 bg-white' };
    const days = Math.ceil((new Date(expirationDate).getTime() - Date.now()) / 86400000);
    if (days < 0) return { label: `Vencido (${-days}d)`, color: 'text-red-700 border-red-200 bg-red-50' };
    if (days <= 30) return { label: `Por vencer (${days}d)`, color: 'text-orange-700 border-orange-200 bg-orange-50' };
    return { label: `Vigente (${days}d)`, color: 'text-green-700 border-green-200 bg-green-50' };
  };

  const handleExportExcel = () => {
    if (!selectedProduct) return;
    // Match the client's exact Excel format (KARDEX.xlsx).
    const aoa: any[][] = [
      ['KARDEX CONTROL DE STOCK DE PRODUCTOS AGRICOLAS'],
      [],
      ['PRODUCTO:', selectedProduct.name],
      [],
      ['FECHA', 'DESCRIPCION', 'INGRESO', 'SALIDA', 'SALDO', '', 'PRECIO', 'SUBTOTAL', 'ALMACEN'],
    ];
    const rows = [...displayMovements];
    for (const m of rows) {
      const ingreso = isEntry(m) ? m.quantity : '';
      const salida = !isEntry(m) ? m.quantity : '';
      const precio = typeof m.unitPrice === 'number' && m.unitPrice > 0 ? m.unitPrice : '';
      const subtotalXls = precio !== '' ? (m.unitPrice as number) * m.quantity : '';
      aoa.push([
        formatDate(m.date),
        descFor(m),
        ingreso,
        salida,
        m.newStock,
        '',
        precio,
        subtotalXls,
        getCompanyName(m.companyId),
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 12 }, { wch: 40 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 3 }, { wch: 10 }, { wch: 11 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    const sheetName = selectedProduct.name.substring(0, 31).replace(/[\\/?*[\]]/g, ' ');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `Kardex_${selectedProduct.name.replace(/\s+/g, '_')}.xlsx`);
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Selecciona o busca un producto..."
              value={productIdParam ? getProductName(productIdParam) : productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                if (productIdParam) setSelectedProductId('');
              }}
              onFocus={() => {
                if (productIdParam) {
                  setProductSearch('');
                  setSelectedProductId('');
                }
              }}
              className="w-full pl-8 pr-8 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
            {(productIdParam || productSearch) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedProductId('');
                  setProductSearch('');
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Limpiar"
              >
                <X size={14} />
              </button>
            )}
            {productSearch && !productIdParam && filteredProducts.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                <div className="px-3 py-1.5 text-xs text-gray-400 border-b bg-gray-50 sticky top-0">
                  {filteredProducts.length} resultado{filteredProducts.length === 1 ? '' : 's'}
                </div>
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProductId(p.id);
                      setProductSearch('');
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            {productSearch && !productIdParam && filteredProducts.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg p-3 text-sm text-gray-500">
                Sin resultados
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Almacén</label>
          <select
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
            }}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todos</option>
            {companyList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
              }}
              className="w-full px-2 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
              }}
              className="w-full px-2 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {productIdParam && (
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
            <input
              type="text"
              placeholder="Nombre del cliente..."
              value={clienteFilter}
              onChange={(e) => setClienteFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 w-52"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Precio Venta</label>
            <input
              type="number"
              placeholder="Ej: 25.00"
              value={precioVentaFilter}
              onChange={(e) => setPrecioVentaFilter(e.target.value)}
              min="0"
              step="0.01"
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 w-36"
            />
          </div>
          {(clienteFilter || precioVentaFilter) && (
            <div className="flex items-end gap-3 pb-0.5">
              <span className="text-xs text-gray-500">
                {displayMovements.length} de {movements.length} movimiento{movements.length !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={() => { setClienteFilter(''); setPrecioVentaFilter(''); }}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {!productIdParam ? (
        <ProductsListView
          products={products}
          companyList={companyList}
          companyId={companyId}
          productSearch={productSearch}
          onSelect={setSelectedProductId}
        />
      ) : (
        <>
          {/* Excel-style header banner that mirrors the client's KARDEX.xlsx layout */}
          <div className="border border-gray-300 bg-white print:border-black">
            <div className="text-center py-3 border-b border-gray-300 bg-gray-50 print:bg-white">
              <h2 className="text-base font-bold tracking-wide text-gray-800 uppercase">
                Kardex Control de Stock de Productos Agricolas
              </h2>
            </div>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-300 bg-white">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Producto:</span>
                <span className="text-sm font-bold text-gray-900">{selectedProduct?.name}</span>
                {selectedProduct?.unit && (
                  <span className="text-xs text-gray-500 ml-2">({selectedProduct.unit})</span>
                )}
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 border rounded hover:bg-gray-50"
                  title="Imprimir"
                >
                  <Printer size={14} /> Imprimir
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={movements.length === 0}
                  className="flex items-center gap-1 text-xs text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 rounded"
                  title="Exportar a Excel (formato cliente)"
                >
                  <Download size={14} /> Exportar Excel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 print:bg-white">
                    <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 uppercase text-xs">Fecha</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 uppercase text-xs">Descripción</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold text-gray-700 uppercase text-xs">Ingreso</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold text-gray-700 uppercase text-xs">Salida</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold text-gray-700 uppercase text-xs">Saldo</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold text-gray-700 uppercase text-xs">Precio</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold text-gray-700 uppercase text-xs">Subtotal</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 uppercase text-xs">Almacén</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="border border-gray-300 px-2 py-8 text-center text-gray-400">
                        Cargando...
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="border border-gray-300 px-2 py-8 text-center text-gray-400">
                        {hasStockWithoutMovements
                          ? `Este producto tiene stock actual (${selectedProductStock}), pero no tiene historial Kardex registrado con los filtros seleccionados. Puede ser data anterior al registro de movimientos.`
                          : 'Sin movimientos en el rango seleccionado.'}
                      </td>
                    </tr>
                  ) : displayMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="border border-gray-300 px-2 py-8 text-center text-gray-400">
                        Sin resultados con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    displayMovements.map((m) => {
                      const entry = isEntry(m);
                      const lot = m.movementType === 'PURCHASE' && m.referenceId
                        ? lotByPurchaseId.get(m.referenceId)
                        : undefined;
                      const priceColor = m.movementType === 'PURCHASE' ? 'text-red-600' :
                        m.movementType === 'SALE' ? 'text-green-600' : 'text-gray-700';
                      const hasPrice = typeof m.unitPrice === 'number' && m.unitPrice > 0;
                      const subtotal = hasPrice ? m.unitPrice! * m.quantity : undefined;
                      return (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-2 py-1 whitespace-nowrap text-gray-700">
                            {formatDate(m.date)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-gray-800">
                            <span className="block max-w-[320px] truncate" title={descFor(m)}>{descFor(m)}</span>
                            {lot && (
                              <span className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="font-mono text-[11px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                  Lote: {lot.lotNumber}
                                </span>
                                {lot.expirationDate && (
                                  <span className={`text-[11px] px-1.5 py-0.5 rounded border font-medium ${lotStatusKardex(lot.expirationDate).color}`}>
                                    F.V. {new Date(lot.expirationDate).toLocaleDateString('es-PE')}
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-center font-semibold text-primary-700">
                            {entry ? m.quantity : ''}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-center font-semibold text-red-600">
                            {!entry ? m.quantity : ''}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-center font-bold text-gray-900">
                            {m.newStock}
                          </td>
                          <td className={`border border-gray-300 px-2 py-1 text-right font-semibold ${priceColor}`}>
                            {hasPrice ? m.unitPrice!.toFixed(2) : ''}
                          </td>
                          <td className={`border border-gray-300 px-2 py-1 text-right font-semibold ${priceColor}`}>
                            {subtotal !== undefined ? subtotal.toFixed(2) : ''}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-gray-600 text-xs">
                            {getCompanyName(m.companyId)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {total > movements.length && (
            <div className="border border-amber-200 bg-amber-50 text-amber-800 text-xs px-3 py-2 mt-3 print:hidden">
              Se muestran {movements.length} de {total} movimientos. Conviene revisar este producto con una exportación o paginación dedicada.
            </div>
          )}

          {Array.isArray(productLots) && productLots.length > 0 && (
            <div className="mt-4 border border-gray-300 bg-white print:hidden">
              <div className="bg-gray-50 px-3 py-2 border-b border-gray-300 flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Lotes del producto</span>
                <span className="text-xs text-gray-400">({productLots.length} lote{productLots.length !== 1 ? 's' : ''})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 uppercase">N° Lote</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 uppercase">Almacén</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold text-gray-700 uppercase">Cant. inicial</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold text-gray-700 uppercase">Cant. actual</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold text-gray-700 uppercase">F. Vencimiento</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold text-gray-700 uppercase">F. Recepción</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold text-gray-700 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(productLots as any[]).map((lot) => {
                      const st = lotStatusKardex(lot.expirationDate);
                      return (
                        <tr key={lot.id} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-2 py-1.5 font-mono font-medium text-gray-800">{lot.lotNumber}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-gray-600">{lot.companyName || getCompanyName(lot.companyId)}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">{lot.initialQuantity}</td>
                          <td className={`border border-gray-300 px-2 py-1.5 text-center font-bold ${lot.currentQuantity === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                            {lot.currentQuantity}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">
                            {lot.expirationDate
                              ? new Date(lot.expirationDate).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                              : '—'}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-500">
                            {lot.receivedAt
                              ? new Date(lot.receivedAt).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                              : '—'}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-medium ${st.color}`}>{st.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface ProductsListViewProps {
  products: Product[];
  companyList: Company[];
  companyId: string;
  productSearch: string;
  onSelect: (id: string) => void;
}

function ProductsListView({ products, companyList, companyId, productSearch, onSelect }: ProductsListViewProps) {
  const { data: stockSummary, isLoading: stockLoading } = useStockByProductSummary();
  const { data: laboratories } = useLaboratories();
  // Fetch all active lots with stock to find earliest upcoming expiration per product.
  // The /expiring endpoint requires a days window; ~10 years covers any realistic case.
  const { data: lotsData } = useExpiringLots(undefined, 3650);
  const [sortBy, setSortBy] = useState<'name' | 'saldo' | 'saldo_desc' | 'lab'>('name');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [labFilter, setLabFilter] = useState<string>('');

  const labById = new Map<string, string>();
  if (Array.isArray(laboratories)) {
    for (const l of laboratories as any[]) labById.set(l.id, l.name);
  }

  const stockByProductCompany = new Map<string, Map<string, number>>();
  for (const s of stockSummary || []) {
    const m = new Map<string, number>();
    for (const b of s.byCompany) m.set(b.companyId, b.quantity);
    stockByProductCompany.set(s.productId, m);
  }

  const stockForProduct = (productId: string): number => {
    const byCompany = stockByProductCompany.get(productId);
    if (!byCompany) return 0;
    if (companyId) return byCompany.get(companyId) ?? 0;
    let total = 0;
    for (const qty of byCompany.values()) total += qty;
    return total;
  };

  // Earliest (closest) upcoming expiration date per product.
  const earliestExpiryByProduct = new Map<string, string>();
  if (Array.isArray(lotsData)) {
    for (const lot of lotsData as any[]) {
      if (!lot.expirationDate || !lot.productId) continue;
      if (companyId && lot.companyId !== companyId) continue;
      const prev = earliestExpiryByProduct.get(lot.productId);
      if (!prev || new Date(lot.expirationDate).getTime() < new Date(prev).getTime()) {
        earliestExpiryByProduct.set(lot.productId, lot.expirationDate);
      }
    }
  }

  // Reset page when search/filter/sort changes.
  React.useEffect(() => { setPage(1); }, [productSearch, sortBy, pageSize, labFilter, companyId]);

  const filtered = products
    .filter((p) => {
      if (labFilter && (p as any).laboratoryId !== labFilter) return false;
      if (companyId && stockForProduct(p.id) <= 0) return false;
      if (!productSearch) return true;
      const q = productSearch.toLowerCase();
      const labName = labById.get((p as any).laboratoryId || '') || '';
      return (
        p.name?.toLowerCase().includes(q) ||
        (p as any).activeIngredient?.toLowerCase().includes(q) ||
        (p as any).description?.toLowerCase().includes(q) ||
        labName.toLowerCase().includes(q)
      );
    })
    .slice()
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' });
      if (sortBy === 'lab') {
        const la = labById.get((a as any).laboratoryId || '') || '';
        const lb = labById.get((b as any).laboratoryId || '') || '';
        return la.localeCompare(lb, 'es', { sensitivity: 'base' }) || (a.name || '').localeCompare(b.name || '', 'es');
      }
      const sa = stockForProduct(a.id);
      const sb = stockForProduct(b.id);
      return sortBy === 'saldo_desc' ? sb - sa : sa - sb;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  const formatWarehouses = (productId: string): string => {
    const m = stockByProductCompany.get(productId);
    if (!m) return '';
    const parts: string[] = [];
    for (const [cid, qty] of m.entries()) {
      if (companyId && cid !== companyId) continue;
      if (qty <= 0) continue;
      const cname = companyList.find((c) => c.id === cid)?.name || cid;
      parts.push(`${cname} (${qty})`);
    }
    return parts.join(' · ');
  };

  const exportProducts = () => {
    const rows = filtered.map((p) => ({
      Producto: p.name,
      Saldo: stockForProduct(p.id),
      Laboratorio: labById.get((p as any).laboratoryId || '') || '',
      Almacenes: formatWarehouses(p.id),
      Unidad: p.unit || '',
      Vencimiento: earliestExpiryByProduct.get(p.id)
        ? new Date(earliestExpiryByProduct.get(p.id)!).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 36 }, { wch: 10 }, { wch: 24 }, { wch: 42 }, { wch: 12 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos Kardex');
    const warehouse = companyId ? companyList.find((c) => c.id === companyId)?.name || companyId : 'todos_almacenes';
    XLSX.writeFile(wb, `kardex_productos_${warehouse.replace(/[^\w.-]+/g, '_')}.xlsx`);
  };

  return (
    <div className="border border-gray-300 bg-white">
      <div className="text-center py-3 border-b border-gray-300 bg-gray-50">
        <h2 className="text-base font-bold tracking-wide text-gray-800 uppercase">Lista de Productos</h2>
        <p className="text-xs text-gray-500 mt-1">
          Click en un producto para ver su kardex completo
        </p>
      </div>

      {labFilter && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-primary-200 bg-primary-50">
          <div className="flex items-center gap-2 text-sm text-primary-800">
            <span className="text-xs uppercase tracking-wider text-primary-600 font-semibold">Filtrado por laboratorio:</span>
            <span className="font-bold">{labById.get(labFilter) || labFilter}</span>
          </div>
          <button
            type="button"
            onClick={() => setLabFilter('')}
            className="flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-white hover:bg-primary-600 border border-primary-300 px-3 py-1 rounded transition-colors"
            title="Ver todos los productos"
          >
            <X size={14} /> Quitar filtro · Ver todos
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 bg-white text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-gray-500">
            {stockLoading ? (
              'Cargando stock...'
            ) : filtered.length === 0 ? (
              '0 productos'
            ) : (
              <>
                Mostrando <span className="font-semibold">{start + 1}-{Math.min(start + pageSize, filtered.length)}</span> de{' '}
                <span className="font-semibold">{filtered.length}</span>
                {filtered.length !== products.length && (
                  <span className="text-gray-400"> (filtrado de {products.length})</span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <button
            type="button"
            onClick={exportProducts}
            disabled={stockLoading}
            className="flex items-center gap-1 px-2 py-1 border border-primary-200 bg-primary-50 text-primary-700 rounded text-xs font-medium hover:bg-primary-100 disabled:opacity-60"
          >
            <Download size={13} /> Excel
          </button>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Ordenar:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-2 py-1 border rounded text-xs focus:ring-2 focus:ring-primary-500"
            >
              <option value="name">Nombre A-Z</option>
              <option value="saldo_desc">Saldo (mayor)</option>
              <option value="saldo">Saldo (menor)</option>
              <option value="lab">Laboratorio</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1 border rounded text-xs focus:ring-2 focus:ring-primary-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 uppercase text-xs">Producto</th>
              <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold text-gray-700 uppercase text-xs w-20">Saldo</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 uppercase text-xs w-44">Laboratorio</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 uppercase text-xs">Almacenes</th>
              <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold text-gray-700 uppercase text-xs w-16">Unidad</th>
              <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold text-gray-700 uppercase text-xs w-28">Vencimiento</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="border border-gray-300 px-2 py-8 text-center text-gray-400">
                  {productSearch ? 'Sin resultados para tu búsqueda.' : 'No hay productos.'}
                </td>
              </tr>
            ) : (
              pageItems.map((p) => {
                const saldo = stockForProduct(p.id);
                const labName = labById.get((p as any).laboratoryId || '') || '';
                const expiry = earliestExpiryByProduct.get(p.id);
                const expiryDays = expiry
                  ? Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000)
                  : null;
                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelect(p.id)}
                    className="hover:bg-primary-50 cursor-pointer"
                  >
                    <td className="border border-gray-300 px-2 py-1.5 text-gray-800 font-medium">
                      {p.name}
                    </td>
                    <td className={`border border-gray-300 px-2 py-1.5 text-center font-bold ${
                      saldo === 0 ? 'text-gray-400' : saldo < 10 ? 'text-orange-600' : 'text-gray-900'
                    }`}>
                      {saldo}
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 text-xs text-gray-700">
                      {labName ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const labId = (p as any).laboratoryId || '';
                            setLabFilter((curr) => (curr === labId ? '' : labId));
                          }}
                          className={`inline-block px-2 py-0.5 rounded transition-colors ${
                            labFilter === ((p as any).laboratoryId || '')
                              ? 'bg-primary-600 text-white hover:bg-primary-700'
                              : 'bg-gray-100 hover:bg-primary-100 hover:text-primary-700'
                          }`}
                          title={
                            labFilter === ((p as any).laboratoryId || '')
                              ? `Quitar filtro de ${labName}`
                              : `Ver solo productos de ${labName}`
                          }
                        >
                          {labName}
                        </button>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 text-xs text-gray-600">
                      <span className="block max-w-[360px] truncate" title={formatWarehouses(p.id)}>
                        {formatWarehouses(p.id) || <span className="text-gray-300">—</span>}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 text-center text-xs text-gray-500">
                      {p.unit || '—'}
                    </td>
                    <td className={`border border-gray-300 px-2 py-1.5 text-center text-xs whitespace-nowrap ${
                      expiryDays === null
                        ? 'text-gray-300'
                        : expiryDays < 0
                          ? 'text-red-600 font-semibold'
                          : expiryDays <= 30
                            ? 'text-orange-600 font-semibold'
                            : 'text-gray-700'
                    }`}
                      title={
                        expiry
                          ? expiryDays! < 0
                            ? `Vencido hace ${-expiryDays!} día(s)`
                            : `Vence en ${expiryDays} día(s)`
                          : undefined
                      }
                    >
                      {expiry
                        ? new Date(expiry).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="border-t border-gray-200 py-2">
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

function MovementsTab({ products, companyList }: SubProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [companyId, setCompanyId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [movementType, setMovementType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const params: any = { page, limit: 25 };
  if (companyId) params.companyId = companyId;
  if (selectedProductId) params.productId = selectedProductId;
  if (movementType) params.movementType = movementType;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const { data, isLoading } = useKardex(params);
  const movements: StockMovement[] = data?.data || [];
  const total: number = data?.total || 0;

  const getProductName = (id: string) => products.find((p) => p.id === id)?.name || id;
  const getCompanyName = (id: string) => companyList.find((c) => c.id === id)?.name || id;

  const filteredProducts = (productSearch
    ? products.filter((p) => {
        const q = productSearch.toLowerCase();
        return (
          p.name?.toLowerCase().includes(q) ||
          (p as any).activeIngredient?.toLowerCase().includes(q) ||
          (p as any).description?.toLowerCase().includes(q)
        );
      })
    : products
  )
    .slice()
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }));

  const resetFilters = () => {
    setCompanyId('');
    setSelectedProductId('');
    setProductSearch('');
    setMovementType('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleExportAllKardex = async () => {
    setExporting(true);
    try {
      const exportParams: any = { ...params, page: 1, limit: 100000 };
      const result = await kardexService.getMovements(exportParams);
      const rows: StockMovement[] = result?.data || [];
      const exportRows = rows.map((item) => {
        const info = MOVEMENT_LABELS[item.movementType];
        const isEntry = info?.isEntry;
        const unitPrice = typeof item.unitPrice === 'number' && item.unitPrice > 0 ? item.unitPrice : undefined;
        return {
          Fecha: new Date(item.date).toLocaleString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          Producto: getProductName(item.productId),
          Almacen: getCompanyName(item.companyId),
          Tipo: info?.label || item.movementType,
          Entrada: isEntry ? item.quantity : '',
          Salida: !isEntry ? item.quantity : '',
          'Stock anterior': item.previousStock,
          'Stock nuevo': item.newStock,
          Precio: unitPrice ?? '',
          Subtotal: unitPrice ? unitPrice * item.quantity : '',
          Descripcion: item.displayDescription || item.description,
        };
      });
      const ws = XLSX.utils.json_to_sheet(exportRows);
      ws['!cols'] = [
        { wch: 18 }, { wch: 36 }, { wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 10 },
        { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 48 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Kardex');
      const suffix = [
        companyId ? getCompanyName(companyId) : 'todos_almacenes',
        selectedProductId ? getProductName(selectedProductId) : 'todos_productos',
        startDate || 'inicio',
        endDate || 'hoy',
      ].join('_').replace(/[^\w.-]+/g, '_');
      XLSX.writeFile(wb, `kardex_${suffix}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      key: 'date',
      header: 'Fecha',
      render: (item: StockMovement) =>
        new Date(item.date).toLocaleDateString('es-PE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      key: 'productId',
      header: 'Producto',
      render: (item: StockMovement) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/kardex?tab=kardex&productId=${item.productId}`);
          }}
          className="font-medium text-primary-700 hover:text-primary-900 hover:underline text-left"
          title="Ver kardex del producto"
        >
          {getProductName(item.productId)}
        </button>
      ),
    },
    { key: 'companyId', header: 'Almacén', render: (item: StockMovement) => getCompanyName(item.companyId) },
    {
      key: 'movementType',
      header: 'Tipo',
      render: (item: StockMovement) => {
        const info = MOVEMENT_LABELS[item.movementType] || { label: item.movementType, color: 'bg-gray-100 text-gray-800' };
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${info.color}`}>{info.label}</span>;
      },
    },
    {
      key: 'entrada',
      header: 'Entrada',
      render: (item: StockMovement) => {
        const info = MOVEMENT_LABELS[item.movementType];
        return info?.isEntry ? (
          <span className="text-primary-600 font-semibold flex items-center gap-1">
            <ArrowUpCircle size={14} /> +{item.quantity}
          </span>
        ) : (
          <span className="text-gray-300">-</span>
        );
      },
    },
    {
      key: 'salida',
      header: 'Salida',
      render: (item: StockMovement) => {
        const info = MOVEMENT_LABELS[item.movementType];
        return !info?.isEntry ? (
          <span className="text-red-600 font-semibold flex items-center gap-1">
            <ArrowDownCircle size={14} /> -{item.quantity}
          </span>
        ) : (
          <span className="text-gray-300">-</span>
        );
      },
    },
    {
      key: 'previousStock',
      header: 'Stock Ant.',
      render: (item: StockMovement) => <span className="text-gray-500">{item.previousStock}</span>,
    },
    {
      key: 'newStock',
      header: 'Stock Nuevo',
      render: (item: StockMovement) => <span className="font-semibold">{item.newStock}</span>,
    },
    {
      key: 'description',
      header: 'Descripcion',
      render: (item: StockMovement) => (
        <span className="text-sm text-gray-600 max-w-[200px] truncate block" title={item.description}>
          {item.description}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Almacén</label>
          <select
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todas</option>
            {companyList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
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
              onChange={(e) => {
                setProductSearch(e.target.value);
                setSelectedProductId('');
                setPage(1);
              }}
              onFocus={() => {
                if (selectedProductId) {
                  setProductSearch('');
                  setSelectedProductId('');
                  setPage(1);
                }
              }}
              className="w-full pl-8 pr-8 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
            {(selectedProductId || productSearch) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedProductId('');
                  setProductSearch('');
                  setPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Limpiar"
              >
                <X size={14} />
              </button>
            )}
            {productSearch && !selectedProductId && filteredProducts.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                <div className="px-3 py-1.5 text-xs text-gray-400 border-b bg-gray-50 sticky top-0">
                  {filteredProducts.length} resultado{filteredProducts.length === 1 ? '' : 's'}
                </div>
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProductId(p.id);
                      setProductSearch('');
                      setPage(1);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            {productSearch && !selectedProductId && filteredProducts.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg p-3 text-sm text-gray-500">
                Sin resultados
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tipo movimiento</label>
          <select
            value={movementType}
            onChange={(e) => {
              setMovementType(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todos</option>
            <option value="PURCHASE">Compra</option>
            <option value="SALE">Venta</option>
            <option value="ADJUSTMENT_IN">Ajuste +</option>
            <option value="ADJUSTMENT_OUT">Ajuste -</option>
            <option value="TRANSFER_IN">Transf. entrada</option>
            <option value="TRANSFER_OUT">Transf. salida</option>
            <option value="LOAN_OUT">Préstamo salida</option>
            <option value="LOAN_RETURN">Dev. préstamo</option>
            <option value="LOAN_IN">Préstamo recibido</option>
            <option value="LOAN_RETURN_OUT">Dev. préstamo salida</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mb-2">
        <button
          type="button"
          onClick={handleExportAllKardex}
          disabled={exporting}
          className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 disabled:opacity-60"
        >
          <Download size={14} /> {exporting ? 'Generando...' : 'Descargar Kardex Excel'}
        </button>
        <button onClick={resetFilters} className="text-sm text-gray-500 hover:text-gray-700 underline">
          Limpiar filtros
        </button>
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
