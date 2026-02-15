import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../../modules/auth/pages/LoginPage';
import { ProtectedRoute } from '../../modules/auth/components/ProtectedRoute';
import { Layout } from '../../shared/components/Layout';

const ProductsPage = lazy(() => import('../../modules/products/pages/ProductsPage').then(m => ({ default: m.ProductsPage })));
const PurchasesPage = lazy(() => import('../../modules/purchases/pages/PurchasesPage').then(m => ({ default: m.PurchasesPage })));
const SalesPage = lazy(() => import('../../modules/sales/pages/SalesPage').then(m => ({ default: m.SalesPage })));
const StockPage = lazy(() => import('../../modules/stock/pages/StockPage').then(m => ({ default: m.StockPage })));
const ClientsPage = lazy(() => import('../../modules/clients/pages/ClientsPage').then(m => ({ default: m.ClientsPage })));
const CompaniesPage = lazy(() => import('../../modules/companies/pages/CompaniesPage').then(m => ({ default: m.CompaniesPage })));
const PriceTiersPage = lazy(() => import('../../modules/price-tiers/pages/PriceTiersPage').then(m => ({ default: m.PriceTiersPage })));

const Loading = () => <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/products" replace />} />
        <Route path="products" element={<Suspense fallback={<Loading />}><ProductsPage /></Suspense>} />
        <Route path="purchases" element={<Suspense fallback={<Loading />}><PurchasesPage /></Suspense>} />
        <Route path="sales" element={<Suspense fallback={<Loading />}><SalesPage /></Suspense>} />
        <Route path="stock" element={<Suspense fallback={<Loading />}><StockPage /></Suspense>} />
        <Route path="clients" element={<Suspense fallback={<Loading />}><ClientsPage /></Suspense>} />
        <Route path="companies" element={<Suspense fallback={<Loading />}><CompaniesPage /></Suspense>} />
        <Route path="price-tiers" element={<Suspense fallback={<Loading />}><PriceTiersPage /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
