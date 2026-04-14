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
const CashRegisterPage = lazy(() => import('../../modules/cash-register/pages/CashRegisterPage').then(m => ({ default: m.CashRegisterPage })));
const CashRegisterHistoryPage = lazy(() => import('../../modules/cash-register/pages/CashRegisterHistoryPage').then(m => ({ default: m.CashRegisterHistoryPage })));
const CreditsPage = lazy(() => import('../../modules/credits/pages/CreditsPage').then(m => ({ default: m.CreditsPage })));
const ClientCreditDetailPage = lazy(() => import('../../modules/credits/pages/ClientCreditDetailPage').then(m => ({ default: m.ClientCreditDetailPage })));
const CategoriesPage = lazy(() => import('../../modules/categories/pages/CategoriesPage').then(m => ({ default: m.CategoriesPage })));
const DashboardPage = lazy(() => import('../../modules/dashboard/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const UsersPage = lazy(() => import('../../modules/users/pages/UsersPage').then(m => ({ default: m.UsersPage })));
const KardexPage = lazy(() => import('../../modules/kardex/pages/KardexPage').then(m => ({ default: m.KardexPage })));
const AccountsPayablePage = lazy(() => import('../../modules/accounts-payable/pages/AccountsPayablePage').then(m => ({ default: m.AccountsPayablePage })));

const Loading = () => <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Suspense fallback={<Loading />}><DashboardPage /></Suspense>} />
        <Route path="products" element={<Suspense fallback={<Loading />}><ProductsPage /></Suspense>} />
        <Route path="purchases" element={<Suspense fallback={<Loading />}><PurchasesPage /></Suspense>} />
        <Route path="sales" element={<Suspense fallback={<Loading />}><SalesPage /></Suspense>} />
        <Route path="stock" element={<Suspense fallback={<Loading />}><StockPage /></Suspense>} />
        <Route path="cash-register" element={<Suspense fallback={<Loading />}><CashRegisterPage /></Suspense>} />
        <Route path="cash-register/history" element={<Suspense fallback={<Loading />}><CashRegisterHistoryPage /></Suspense>} />
        <Route path="credits" element={<Suspense fallback={<Loading />}><CreditsPage /></Suspense>} />
        <Route path="credits/client/:clientId" element={<Suspense fallback={<Loading />}><ClientCreditDetailPage /></Suspense>} />
        <Route path="clients" element={<Suspense fallback={<Loading />}><ClientsPage /></Suspense>} />
        <Route path="categories" element={<Suspense fallback={<Loading />}><CategoriesPage /></Suspense>} />
        <Route path="companies" element={<Suspense fallback={<Loading />}><CompaniesPage /></Suspense>} />
        <Route path="price-tiers" element={<Suspense fallback={<Loading />}><PriceTiersPage /></Suspense>} />
        <Route path="users" element={<Suspense fallback={<Loading />}><UsersPage /></Suspense>} />
        <Route path="kardex" element={<Suspense fallback={<Loading />}><KardexPage /></Suspense>} />
        <Route path="accounts-payable" element={<Suspense fallback={<Loading />}><AccountsPayablePage /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
