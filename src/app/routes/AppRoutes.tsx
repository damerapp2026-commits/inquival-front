import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../../modules/auth/pages/LoginPage';
import { ProtectedRoute } from '../../modules/auth/components/ProtectedRoute';
import { RoleGate, defaultHomeForRole } from '../../modules/auth/components/RoleGate';
import { Layout } from '../../shared/components/Layout';
import { useAuth } from '../providers/AuthProvider';

function IndexRedirect() {
  const { user } = useAuth();
  return <Navigate to={defaultHomeForRole(user?.role || 'VENDEDOR')} replace />;
}

function ExpensesIndexRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'ADMIN' ? 'cash' : 'workers'} replace />;
}

const AdminOnly = ({ children }: { children: React.ReactNode }) => (
  <RoleGate allowedRoles={['ADMIN']}>{children}</RoleGate>
);

const ProductsPage = lazy(() => import('../../modules/products/pages/ProductsPage').then(m => ({ default: m.ProductsPage })));
const PurchasesPage = lazy(() => import('../../modules/purchases/pages/PurchasesPage').then(m => ({ default: m.PurchasesPage })));
const NewPurchasePage = lazy(() => import('../../modules/purchases/pages/NewPurchasePage').then(m => ({ default: m.NewPurchasePage })));
const PurchaseDetailPage = lazy(() => import('../../modules/purchases/pages/PurchaseDetailPage').then(m => ({ default: m.PurchaseDetailPage })));
const EditPurchasePage = lazy(() => import('../../modules/purchases/pages/EditPurchasePage').then(m => ({ default: m.EditPurchasePage })));
const NewPurchaseOrderPage = lazy(() => import('../../modules/purchases/pages/NewPurchaseOrderPage').then(m => ({ default: m.NewPurchaseOrderPage })));
const ConvertPurchaseOrderPage = lazy(() => import('../../modules/purchases/pages/ConvertPurchaseOrderPage').then(m => ({ default: m.ConvertPurchaseOrderPage })));
const SalesPage = lazy(() => import('../../modules/sales/pages/SalesPage').then(m => ({ default: m.SalesPage })));
const StockPage = lazy(() => import('../../modules/stock/pages/StockPage').then(m => ({ default: m.StockPage })));
const ClientsPage = lazy(() => import('../../modules/clients/pages/ClientsPage').then(m => ({ default: m.ClientsPage })));
const CompaniesPage = lazy(() => import('../../modules/companies/pages/CompaniesPage').then(m => ({ default: m.CompaniesPage })));
const PriceTiersPage = lazy(() => import('../../modules/price-tiers/pages/PriceTiersPage').then(m => ({ default: m.PriceTiersPage })));
const CashRegisterPage = lazy(() => import('../../modules/cash-register/pages/CashRegisterPage').then(m => ({ default: m.CashRegisterPage })));
const CashRegisterHistoryPage = lazy(() => import('../../modules/cash-register/pages/CashRegisterHistoryPage').then(m => ({ default: m.CashRegisterHistoryPage })));
const MigrateMisplacedPage = lazy(() => import('../../modules/cash-register/pages/MigrateMisplacedPage').then(m => ({ default: m.MigrateMisplacedPage })));
const ExpensesLayout = lazy(() => import('../../modules/expenses/components/ExpensesLayout').then(m => ({ default: m.ExpensesLayout })));
const CashExpensesPage = lazy(() => import('../../modules/expenses/pages/CashExpensesPage').then(m => ({ default: m.CashExpensesPage })));
const WorkerExpensesPage = lazy(() => import('../../modules/expenses/pages/WorkerExpensesPage').then(m => ({ default: m.WorkerExpensesPage })));
const ExpensesAnalyticsPage = lazy(() => import('../../modules/expenses/pages/ExpensesAnalyticsPage').then(m => ({ default: m.ExpensesAnalyticsPage })));
const CreditsPage = lazy(() => import('../../modules/credits/pages/CreditsPage').then(m => ({ default: m.CreditsPage })));
const ClientCreditDetailPage = lazy(() => import('../../modules/credits/pages/ClientCreditDetailPage').then(m => ({ default: m.ClientCreditDetailPage })));
const MigrateMisdatedCreditsPage = lazy(() => import('../../modules/credits/pages/MigrateMisdatedCreditsPage').then(m => ({ default: m.MigrateMisdatedCreditsPage })));
const CategoriesPage = lazy(() => import('../../modules/categories/pages/CategoriesPage').then(m => ({ default: m.CategoriesPage })));
const LaboratoriesPage = lazy(() => import('../../modules/laboratories/pages/LaboratoriesPage').then(m => ({ default: m.LaboratoriesPage })));
const UnitsPage = lazy(() => import('../../modules/units/pages/UnitsPage').then(m => ({ default: m.UnitsPage })));
const DashboardPage = lazy(() => import('../../modules/dashboard/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ProfitabilityDetailPage = lazy(() => import('../../modules/dashboard/pages/ProfitabilityDetailPage').then(m => ({ default: m.ProfitabilityDetailPage })));
const SettingsPage = lazy(() => import('../../modules/settings/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const KardexPage = lazy(() => import('../../modules/kardex/pages/KardexPage').then(m => ({ default: m.KardexPage })));
const KardexProductDetailPage = lazy(() => import('../../modules/kardex/pages/KardexProductDetailPage').then(m => ({ default: m.KardexProductDetailPage })));
const AccountsPayablePage = lazy(() => import('../../modules/accounts-payable/pages/AccountsPayablePage').then(m => ({ default: m.AccountsPayablePage })));
const InvoicesPage = lazy(() => import('../../modules/invoices/pages/InvoicesPage').then(m => ({ default: m.InvoicesPage })));
const POSPage = lazy(() => import('../../modules/pos/pages/POSPage').then(m => ({ default: m.POSPage })));
const QuotesPage = lazy(() => import('../../modules/quotes/pages/QuotesPage').then(m => ({ default: m.QuotesPage })));
const NewQuotePage = lazy(() => import('../../modules/quotes/pages/NewQuotePage').then(m => ({ default: m.NewQuotePage })));
const MyCommissionsPage = lazy(() => import('../../modules/commissions/pages/MyCommissionsPage').then(m => ({ default: m.MyCommissionsPage })));
const CommissionsReportPage = lazy(() => import('../../modules/commissions/pages/CommissionsReportPage').then(m => ({ default: m.CommissionsReportPage })));
const PublicProductsPage = lazy(() => import('../../modules/products/pages/PublicProductsPage').then(m => ({ default: m.PublicProductsPage })));

const Loading = () => <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/lista-productos" element={<Suspense fallback={<Loading />}><PublicProductsPage /></Suspense>} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<IndexRedirect />} />
        <Route path="dashboard" element={<AdminOnly><Suspense fallback={<Loading />}><DashboardPage /></Suspense></AdminOnly>} />
        <Route path="dashboard/profitability" element={<AdminOnly><Suspense fallback={<Loading />}><ProfitabilityDetailPage /></Suspense></AdminOnly>} />
        <Route path="products" element={<Suspense fallback={<Loading />}><ProductsPage /></Suspense>} />
        <Route path="purchases" element={<AdminOnly><Suspense fallback={<Loading />}><PurchasesPage /></Suspense></AdminOnly>} />
        <Route path="purchases/new" element={<AdminOnly><Suspense fallback={<Loading />}><NewPurchasePage /></Suspense></AdminOnly>} />
        <Route path="purchases/orders/new" element={<AdminOnly><Suspense fallback={<Loading />}><NewPurchaseOrderPage /></Suspense></AdminOnly>} />
        <Route path="purchases/orders/:id/convert" element={<AdminOnly><Suspense fallback={<Loading />}><ConvertPurchaseOrderPage /></Suspense></AdminOnly>} />
        <Route path="purchases/:id" element={<AdminOnly><Suspense fallback={<Loading />}><PurchaseDetailPage /></Suspense></AdminOnly>} />
        <Route path="purchases/:id/edit" element={<AdminOnly><Suspense fallback={<Loading />}><EditPurchasePage /></Suspense></AdminOnly>} />
        <Route path="pos" element={<Suspense fallback={<Loading />}><POSPage /></Suspense>} />
        <Route path="quotes" element={<Suspense fallback={<Loading />}><QuotesPage /></Suspense>} />
        <Route path="quotes/new" element={<Suspense fallback={<Loading />}><NewQuotePage /></Suspense>} />
        <Route path="quotes/:id/edit" element={<Suspense fallback={<Loading />}><NewQuotePage /></Suspense>} />
        <Route path="sales" element={<Suspense fallback={<Loading />}><SalesPage /></Suspense>} />
        <Route path="stock" element={<AdminOnly><Suspense fallback={<Loading />}><StockPage /></Suspense></AdminOnly>} />
        <Route path="cash-register" element={<AdminOnly><Suspense fallback={<Loading />}><CashRegisterPage /></Suspense></AdminOnly>} />
        <Route path="cash-register/history" element={<AdminOnly><Suspense fallback={<Loading />}><CashRegisterHistoryPage /></Suspense></AdminOnly>} />
        <Route path="cash-register/migrate" element={<AdminOnly><Suspense fallback={<Loading />}><MigrateMisplacedPage /></Suspense></AdminOnly>} />
        <Route path="expenses" element={<RoleGate allowedRoles={['ADMIN', 'VENDEDOR', 'VENDEDOR_CAMPO']}><Suspense fallback={<Loading />}><ExpensesLayout /></Suspense></RoleGate>}>
          <Route index element={<ExpensesIndexRedirect />} />
          <Route path="cash" element={<AdminOnly><Suspense fallback={<Loading />}><CashExpensesPage /></Suspense></AdminOnly>} />
          <Route path="workers" element={<RoleGate allowedRoles={['ADMIN', 'VENDEDOR', 'VENDEDOR_CAMPO']}><Suspense fallback={<Loading />}><WorkerExpensesPage /></Suspense></RoleGate>} />
          <Route path="analytics" element={<AdminOnly><Suspense fallback={<Loading />}><ExpensesAnalyticsPage /></Suspense></AdminOnly>} />
        </Route>
        <Route path="credits" element={<Suspense fallback={<Loading />}><CreditsPage /></Suspense>} />
        <Route path="credits/client/:clientId" element={<Suspense fallback={<Loading />}><ClientCreditDetailPage /></Suspense>} />
        <Route path="credits/migrate" element={<AdminOnly><Suspense fallback={<Loading />}><MigrateMisdatedCreditsPage /></Suspense></AdminOnly>} />
        <Route path="clients" element={<Suspense fallback={<Loading />}><ClientsPage /></Suspense>} />
        <Route path="categories" element={<AdminOnly><Suspense fallback={<Loading />}><CategoriesPage /></Suspense></AdminOnly>} />
        <Route path="laboratories" element={<AdminOnly><Suspense fallback={<Loading />}><LaboratoriesPage /></Suspense></AdminOnly>} />
        <Route path="units" element={<AdminOnly><Suspense fallback={<Loading />}><UnitsPage /></Suspense></AdminOnly>} />
        <Route path="companies" element={<AdminOnly><Suspense fallback={<Loading />}><CompaniesPage /></Suspense></AdminOnly>} />
        <Route path="price-tiers" element={<AdminOnly><Suspense fallback={<Loading />}><PriceTiersPage /></Suspense></AdminOnly>} />
        <Route path="settings" element={<AdminOnly><Suspense fallback={<Loading />}><SettingsPage /></Suspense></AdminOnly>} />
        <Route path="users" element={<Navigate to="/settings" replace />} />
        <Route path="kardex" element={<AdminOnly><Suspense fallback={<Loading />}><KardexPage /></Suspense></AdminOnly>} />
        <Route path="kardex/product/:productId" element={<AdminOnly><Suspense fallback={<Loading />}><KardexProductDetailPage /></Suspense></AdminOnly>} />
        <Route path="accounts-payable" element={<AdminOnly><Suspense fallback={<Loading />}><AccountsPayablePage /></Suspense></AdminOnly>} />
        <Route path="invoices" element={<AdminOnly><Suspense fallback={<Loading />}><InvoicesPage /></Suspense></AdminOnly>} />
        <Route path="my-commissions" element={<RoleGate allowedRoles={['VENDEDOR', 'VENDEDOR_CAMPO', 'ADMIN']}><Suspense fallback={<Loading />}><MyCommissionsPage /></Suspense></RoleGate>} />
        <Route path="commissions-report" element={<AdminOnly><Suspense fallback={<Loading />}><CommissionsReportPage /></Suspense></AdminOnly>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
