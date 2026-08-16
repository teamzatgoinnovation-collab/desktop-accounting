import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppShell } from "@/layouts/AppShell";
import { hydrateErpnextSession } from "@/lib/client";
import { ConnectionPage } from "@/pages/ConnectionPage";
import { HomePage } from "@/pages/HomePage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { NewInvoicePage } from "@/pages/NewInvoicePage";
import { InvoiceDetailPage } from "@/pages/InvoiceDetailPage";
import { NewSalesReturnPage } from "@/pages/NewSalesReturnPage";
import { NewPurchaseReturnPage } from "@/pages/NewPurchaseReturnPage";
import { PaymentsPage } from "@/pages/PaymentsPage";
import { JournalsPage } from "@/pages/JournalsPage";
import { JournalDetailPage } from "@/pages/JournalDetailPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProductDetailPage } from "@/pages/ProductDetailPage";
import { ItemGroupsPage } from "@/pages/ItemGroupsPage";
import { ChartOfAccountsPage } from "@/pages/ChartOfAccountsPage";
import { StockPage } from "@/pages/StockPage";
import { WarehousesPage } from "@/pages/WarehousesPage";
import { WarehouseDetailPage } from "@/pages/WarehouseDetailPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { CustomerDetailPage } from "@/pages/CustomerDetailPage";
import { SuppliersPage } from "@/pages/SuppliersPage";
import { SupplierDetailPage } from "@/pages/SupplierDetailPage";
import { BillsPage } from "@/pages/BillsPage";
import { NewBillPage } from "@/pages/NewBillPage";
import { BillDetailPage } from "@/pages/BillDetailPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SyncCenterPage } from "@/pages/SyncCenterPage";
import { LoginPage } from "@/pages/LoginPage";
import { useSessionStore } from "@/store/session";

const Router = window.zatgoDesktop ? HashRouter : BrowserRouter;

function RequireAuth({ children }: { children: React.ReactNode }) {
  const connected = useSessionStore((s) => s.connected);
  if (!connected) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="chart-of-accounts" element={<ChartOfAccountsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:name" element={<CustomerDetailPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/new" element={<NewInvoicePage />} />
        <Route path="invoices/:name" element={<InvoiceDetailPage />} />
        <Route path="invoices/:name/return" element={<NewSalesReturnPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="suppliers/:name" element={<SupplierDetailPage />} />
        <Route path="bills" element={<BillsPage />} />
        <Route path="bills/new" element={<NewBillPage />} />
        <Route path="bills/:name" element={<BillDetailPage />} />
        <Route path="bills/:name/return" element={<NewPurchaseReturnPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="journals" element={<JournalsPage />} />
        <Route path="journals/:name" element={<JournalDetailPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:name" element={<ProductDetailPage />} />
        <Route path="items" element={<Navigate to="/products" replace />} />
        <Route path="item-groups" element={<ItemGroupsPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="warehouses" element={<WarehousesPage />} />
        <Route path="warehouses/:name" element={<WarehouseDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="sync" element={<SyncCenterPage />} />
        <Route path="connection" element={<ConnectionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void hydrateErpnextSession().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--color-muted-foreground)]">
        Loading…
      </div>
    );
  }

  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
