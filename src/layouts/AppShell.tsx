import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppShellLayout,
  Button,
  CommandPalette,
  type AppShellNavItem,
  type CommandPaletteItem,
} from "@zatgo/ui";
import {
  CreditCard,
  FileText,
  GitBranch,
  LayoutDashboard,
  Moon,
  Plus,
  Receipt,
  Settings,
  Sun,
  Truck,
  Users,
} from "@zatgo/icons";
import { useMemo, useEffect, useState } from "react";
import { toast } from "sonner";
import { useThemeStore } from "@/store/theme";
import { useSessionStore } from "@/store/session";
import { logoutFromErpnext } from "@/lib/client";

const nav: AppShellNavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, end: true },

  { href: "/chart-of-accounts", label: "Chart of Accounts", icon: GitBranch, section: "Masters" },
  { href: "/customers", label: "Customers", icon: Users, section: "Masters" },
  { href: "/suppliers", label: "Suppliers", icon: Truck, section: "Masters" },

  { href: "/vouchers/new", label: "New Voucher", icon: Plus, section: "Transactions" },
  { href: "/invoices", label: "Sales", icon: FileText, section: "Transactions" },
  { href: "/bills", label: "Purchase", icon: Receipt, section: "Transactions" },

  { href: "/reports", label: "Reports", icon: CreditCard, section: "Ledgers & Reports" },

  { href: "/settings", label: "Settings", icon: Settings },
];

// AppShellLayout wraps its default main content in a framer-motion fade-in
// (see app-shell-layout.tsx) whose transform breaks `position: sticky`
// containment. The New Voucher page needs a reliably sticky footer action
// bar, so it opts into the layout's existing `workspace` escape hatch
// (already used for POS-style full-bleed pages) instead — the only cost is
// this one route skipping the page fade-in every other route gets.
const FULL_BLEED_ROUTES = new Set(["/vouchers/new"]);

export function AppShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isFullBleed = FULL_BLEED_ROUTES.has(pathname);
  const mode = useThemeStore((s) => s.mode);
  const cycleMode = useThemeStore((s) => s.cycleMode);
  const connected = useSessionStore((s) => s.connected);
  const user = useSessionStore((s) => s.user);
  const fullName = useSessionStore((s) => s.fullName);
  const [version, setVersion] = useState("dev");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void window.zatgoDesktop?.getAppVersion().then(setVersion).catch(() => undefined);
  }, []);

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
            <Button variant="outline" size="sm" disabled={signingOut} onClick={() => void onSignOut()}>
              Sign out
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => cycleMode()}>
              {mode === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
              {mode}
            </Button>
          </>
        }
        workspace={
          isFullBleed ? (
            <main className="flex-1 overflow-auto p-6">
              <Outlet />
            </main>
          ) : undefined
        }
      >
        {isFullBleed ? null : <Outlet />}
      </AppShellLayout>
    </>
  );
}
