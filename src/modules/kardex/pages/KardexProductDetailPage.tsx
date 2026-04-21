import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useKardex } from '../hooks/useKardex';
import { useSales } from '../../sales/hooks/useSales';
import { useCompanies } from '../../companies/hooks/useCompanies';
import { useClients } from '../../clients/hooks/useClients';
import { productService } from '../../products/services/productService';
import { DataTable } from '../../../shared/components/DataTable';
import { Pagination } from '../../../shared/components/Pagination';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { ArrowLeft, ClipboardList, ArrowUpCircle, ArrowDownCircle, Users, Package } from 'lucide-react';
import type { Company, Client, Sale, SaleItem } from '../../../shared/types';

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
  date: string;
}

interface ClientSaleRow {
  id: string;
  saleId: string;
  date: string;
  companyId: string;
  voucherType: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

type Tab = 'movements' | 'byClient';

export function KardexProductDetailPage() {
  const { productId = '' } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('movements');

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productService.getById(productId),
    enabled: !!productId,
    staleTime: 60_000,
  });

  const { data: companies } = useCompanies();
  const companyList: Company[] = Array.isArray(companies) ? companies : [];
  const getCompanyName = (id: string) => companyList.find((c) => c.id === id)?.name || id;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <ClipboardList size={16} /> <span>Kardex</span> <span>/</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Package size={22} />
          {productLoading ? 'Cargando...' : product?.name || 'Producto'}
        </h1>
        {product?.unit && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
            Unidad: {product.unit}
          </span>
        )}
      </div>

      <div className="bg-white rounded-lg shadow mb-4">
        <div className="flex border-b">
          <button
            onClick={() => setTab('movements')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tab === 'movements'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ClipboardList size={16} /> Movimientos
          </button>
          <button
            onClick={() => setTab('byClient')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tab === 'byClient'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={16} /> Ventas por cliente
          </button>
        </div>

        <div className="p-4">
          {tab === 'movements' ? (
            <MovementsTab
              productId={productId}
              companyList={companyList}
              getCompanyName={getCompanyName}
            />
          ) : (
            <ByClientTab
              productId={productId}
              companyList={companyList}
              getCompanyName={getCompanyName}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface TabProps {
  productId: string;
  companyList: Company[];
  getCompanyName: (id: string) => string;
}

function MovementsTab({ productId, companyList, getCompanyName }: TabProps) {
  const [page, setPage] = useState(1);
  const [companyId, setCompanyId] = useState('');
  const [movementType, setMovementType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const params: Record<string, any> = { page, limit: 25, productId };
  if (companyId) params.companyId = companyId;
  if (movementType) params.movementType = movementType;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const { data, isLoading } = useKardex(params);
  const movements: StockMovement[] = data?.data || [];
  const total: number = data?.total || 0;

  const resetFilters = () => {
    setCompanyId('');
    setMovementType('');
    setStartDate('');
    setEndDate('');
    setPage(1);
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
      key: 'companyId',
      header: 'Empresa',
      render: (item: StockMovement) => getCompanyName(item.companyId),
    },
    {
      key: 'movementType',
      header: 'Tipo',
      render: (item: StockMovement) => {
        const info = MOVEMENT_LABELS[item.movementType] || {
          label: item.movementType,
          color: 'bg-gray-100 text-gray-800',
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${info.color}`}>
            {info.label}
          </span>
        );
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
      render: (item: StockMovement) => (
        <span className="text-gray-500">{item.previousStock}</span>
      ),
    },
    {
      key: 'newStock',
      header: 'Stock Nuevo',
      render: (item: StockMovement) => <span className="font-semibold">{item.newStock}</span>,
    },
    {
      key: 'description',
      header: 'Descripción',
      render: (item: StockMovement) => (
        <span className="text-sm text-gray-600 max-w-[240px] truncate block" title={item.description}>
          {item.description}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Empresa</label>
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
            <option value="LOAN_OUT">Préstamo</option>
            <option value="LOAN_RETURN">Dev. préstamo</option>
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
        <div className="flex items-end">
          <button
            onClick={resetFilters}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={movements} isLoading={isLoading} />
      <Pagination page={page} totalPages={Math.ceil(total / 25)} onPageChange={setPage} />

      {!isLoading && movements.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <ClipboardList size={48} className="mx-auto mb-3 text-gray-300" />
          <p>No hay movimientos para este producto con los filtros seleccionados.</p>
        </div>
      )}
    </div>
  );
}

function ByClientTab({ productId, companyList, getCompanyName }: TabProps) {
  const [page, setPage] = useState(1);
  const [clientId, setClientId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: clientsData } = useClients({ limit: 500 });
  const clients: Client[] = clientsData?.data || [];
  const selectedClient = clients.find((c) => c.id === clientId);

  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        value: c.id,
        label: c.name,
        sublabel: c.documentNumber || c.phone || undefined,
      })),
    [clients],
  );

  const params: Record<string, any> = { page, limit: 20 };
  if (clientId) params.clientId = clientId;
  if (companyId) params.companyId = companyId;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const { data, isLoading } = useSales(clientId ? params : undefined);
  const sales: Sale[] = clientId ? data?.data || [] : [];
  const total: number = clientId ? data?.total || 0 : 0;

  const rows: ClientSaleRow[] = useMemo(() => {
    if (!clientId) return [];
    const out: ClientSaleRow[] = [];
    for (const sale of sales) {
      if (sale.clientId !== clientId) continue;
      for (const item of sale.items as SaleItem[]) {
        if (item.productId !== productId) continue;
        out.push({
          id: `${sale.id}-${out.length}`,
          saleId: sale.id,
          date: sale.date,
          companyId: item.companyId,
          voucherType: sale.voucherType,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        });
      }
    }
    return out;
  }, [sales, clientId, productId]);

  const pageTotals = useMemo(() => {
    let qty = 0;
    let amount = 0;
    for (const r of rows) {
      qty += r.quantity;
      amount += r.subtotal;
    }
    return { qty, amount };
  }, [rows]);

  const columns = [
    {
      key: 'date',
      header: 'Fecha',
      render: (r: ClientSaleRow) =>
        new Date(r.date).toLocaleDateString('es-PE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      key: 'companyId',
      header: 'Empresa',
      render: (r: ClientSaleRow) => getCompanyName(r.companyId),
    },
    {
      key: 'voucherType',
      header: 'Comprobante',
      render: (r: ClientSaleRow) => (
        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
          {r.voucherType === 'NONE' ? 'Sin comprobante' : r.voucherType}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      render: (r: ClientSaleRow) => (
        <span className="text-red-600 font-semibold flex items-center gap-1">
          <ArrowDownCircle size={14} /> {r.quantity}
        </span>
      ),
    },
    {
      key: 'unitPrice',
      header: 'P. Unit.',
      render: (r: ClientSaleRow) => <span>S/ {r.unitPrice.toFixed(2)}</span>,
    },
    {
      key: 'subtotal',
      header: 'Subtotal',
      render: (r: ClientSaleRow) => (
        <span className="font-semibold">S/ {r.subtotal.toFixed(2)}</span>
      ),
    },
  ];

  const resetFilters = () => {
    setCompanyId('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Cliente *</label>
          <SearchableSelect
            options={clientOptions}
            value={clientId}
            onChange={(val) => {
              setClientId(val);
              setPage(1);
            }}
            placeholder="Buscar cliente..."
            minChars={1}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Empresa</label>
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
        <div className="flex items-end">
          <button
            onClick={resetFilters}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {!clientId ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
          <Users size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Selecciona un cliente para ver las ventas de este producto.</p>
        </div>
      ) : (
        <>
          {selectedClient && rows.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-500">Cliente</div>
                <div className="text-sm font-semibold">{selectedClient.name}</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="text-xs text-red-600">Cantidad (página)</div>
                <div className="text-lg font-bold text-red-700">{pageTotals.qty}</div>
              </div>
              <div className="bg-primary-50 p-3 rounded-lg">
                <div className="text-xs text-primary-600">Total vendido (página)</div>
                <div className="text-lg font-bold text-primary-700">
                  S/ {pageTotals.amount.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          <DataTable columns={columns} data={rows} isLoading={isLoading} />
          <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />

          {!isLoading && rows.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Users size={40} className="mx-auto mb-3 text-gray-300" />
              <p>No se encontraron ventas de este producto para el cliente seleccionado.</p>
              {total > 0 && (
                <p className="text-xs mt-1 text-gray-400">
                  Hay ventas del cliente en este rango, pero ninguna con este producto en esta página.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
