import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppShellLayout,
  Badge,
  Button,
  CommandPalette,
  type AppShellNavItem,
  type CommandPaletteItem,
} from "@zatgo/ui";
import {
  ArrowLeftRight,
  Banknote,
  BookOpen,
  Building2,
  CreditCard,
  FileText,
  GitBranch,
  KeyRound,
  Layers,
  LayoutDashboard,
  Moon,
  Package,
  Receipt,
  RotateCcw,
  ScrollText,
  Settings,
  Sun,
  Tags,
  Truck,
  Users,
  Wallet,
} from "@zatgo/icons";
import { useMemo, useEffect, useState } from "react";
import { toast } from "sonner";
import { useThemeStore } from "@/store/theme";
import { useSessionStore } from "@/store/session";
import { logoutFromErpnext } from "@/lib/client";

const nav: AppShellNavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { href: "/chart-of-accounts", label: "Chart of Accounts", icon: GitBranch, section: "Accounting" },
  { href: "/account-ledger", label: "Account Ledger", icon: ScrollText, section: "Accounting" },
  { href: "/customers", label: "Customers", icon: Users, section: "Accounting" },
  { href: "/invoices", label: "Sales", icon: FileText, section: "Accounting" },
  { href: "/suppliers", label: "Suppliers", icon: Truck, section: "Accounting" },
  { href: "/bills", label: "Purchase", icon: Receipt, section: "Accounting" },
  { href: "/payments?tab=receive", label: "Receipt", icon: Wallet, section: "Accounting" },
  { href: "/payments?tab=pay", label: "Payment", icon: Banknote, section: "Accounting" },
  { href: "/payments?tab=contra", label: "Contra", icon: ArrowLeftRight, section: "Accounting" },
  { href: "/journals", label: "Journal", icon: BookOpen, section: "Accounting" },
  { href: "/reports", label: "Reports", icon: CreditCard, section: "Accounting" },
  { href: "/products", label: "Products", icon: Package, section: "Inventory" },
  { href: "/item-groups", label: "Item Groups", icon: Tags, section: "Inventory" },
  { href: "/stock", label: "Stock", icon: Layers, section: "Inventory" },
  { href: "/warehouses", label: "Warehouses", icon: Building2, section: "Inventory" },
  { href: "/sync", label: "Sync Center", icon: RotateCcw },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/connection", label: "Connection", icon: KeyRound },
];

export function AppShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mode = useThemeStore((s) => s.mode);
  const cycleMode = useThemeStore((s) => s.cycleMode);
  const connected = useSessionStore((s) => s.connected);
  const user = useSessionStore((s) => s.user);
  const fullName = useSessionStore((s) => s.fullName);
  const [version, setVersion] = useState("dev");
  const [signingOut, setSigningOut] = useState(false);
  const [outboxCounts, setOutboxCounts] = useState<OutboxCounts | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    void window.zatgoDesktop?.getAppVersion().then(setVersion).catch(() => undefined);
  }, []);

  useEffect(() => {
    void window.zatgoDesktop?.outboxCounts().then(setOutboxCounts).catch(() => undefined);
    const unsubscribe = window.zatgoDesktop?.onOutboxChanged?.(setOutboxCounts);
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const pendingCount = (outboxCounts?.pending ?? 0) + (outboxCounts?.uploading ?? 0);
  const failedCount = outboxCounts?.failed ?? 0;

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await logoutFromErpnext();
      toast.success("Signed out");
      navigate("/login", { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  const commandItems = useMemo<CommandPaletteItem[]>(
    () => [
      ...nav.map((item) => ({
        id: `nav-${item.href}`,
        label: item.label,
        group: item.section ? `Navigate · ${item.section}` : "Navigate",
        onSelect: () => navigate(item.href),
      })),
      {
        id: "theme",
        label: `Cycle theme (now: ${mode})`,
        group: "Actions",
        shortcut: "T",
        onSelect: () => cycleMode(),
      },
      {
        id: "sign-out",
        label: "Sign out",
        group: "Actions",
        onSelect: () => void onSignOut(),
      },
    ],
    [cycleMode, mode, navigate],
  );

  return (
    <>
      <CommandPalette items={commandItems} />
      <AppShellLayout
        productTitle="Accounting"
        nav={nav}
        pathname={pathname}
        renderLink={({ href, className, children, end }) => (
          <NavLink to={href} end={end} className={className}>
            {children}
          </NavLink>
        )}
        sidebarFooter={
          <>
            <p
              className="truncate font-medium text-[var(--color-foreground)]"
              title={fullName ?? user ?? undefined}
            >
              {connected ? fullName || user : "Not signed in"}
            </p>
            <p className="truncate">{connected ? "Connected" : "Not connected"}</p>
            <p>v{version}</p>
          </>
        }
        headerTitle={<span className="text-[var(--color-muted-foreground)]">⌘K for commands</span>}
        headerActions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => navigate("/sync")}
              title={online ? "Online" : "Offline — working locally"}
            >
              <span
                className={`size-2 rounded-full ${online ? "bg-[var(--color-primary)]" : "bg-[var(--color-muted-foreground)]"}`}
              />
              {online ? "Online" : "Offline"}
              {pendingCount > 0 ? <Badge variant="secondary">{pendingCount} pending</Badge> : null}
              {failedCount > 0 ? <Badge variant="destructive">{failedCount} failed</Badge> : null}
            </Button>
            <Button variant="outline" size="sm" disabled={signingOut} onClick={() => void onSignOut()}>
              Sign out
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => cycleMode()}>
              {mode === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
              {mode}
            </Button>
          </>
        }
      >
        <Outlet />
      </AppShellLayout>
    </>
  );
}
