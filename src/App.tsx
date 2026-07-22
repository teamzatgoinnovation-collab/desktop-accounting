import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppShell } from "@/layouts/AppShell";
import { hydrateErpnextSession } from "@/lib/client";
import { ConnectionPage } from "@/pages/ConnectionPage";
import { HomePage } from "@/pages/HomePage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { InvoiceDetailPage } from "@/pages/InvoiceDetailPage";
import { PaymentsPage } from "@/pages/PaymentsPage";
import { JournalsPage } from "@/pages/JournalsPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProductDetailPage } from "@/pages/ProductDetailPage";
import { StockPage } from "@/pages/StockPage";
import { WarehousesPage } from "@/pages/WarehousesPage";
import { WarehouseDetailPage } from "@/pages/WarehouseDetailPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { CustomerDetailPage } from "@/pages/CustomerDetailPage";
import { SettingsPage } from "@/pages/SettingsPage";
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
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:name" element={<CustomerDetailPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/:name" element={<InvoiceDetailPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="journals" element={<JournalsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:name" element={<ProductDetailPage />} />
        <Route path="items" element={<Navigate to="/products" replace />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="warehouses" element={<WarehousesPage />} />
        <Route path="warehouses/:name" element={<WarehouseDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
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
