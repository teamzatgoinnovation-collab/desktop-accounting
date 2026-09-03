import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppShellLayout,
  Button,
  CommandPalette,
  type AppShellNavItem,
  type CommandPaletteItem,
} from "@zatgo/ui";
import {
  ArrowLeftRight,
  Banknote,
  BookOpen,
  ClipboardList,
  CreditCard,
  FileText,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  Moon,
  Plus,
  Receipt,
  ScrollText,
  Settings,
  Sun,
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

  { href: "/chart-of-accounts", label: "Chart of Accounts", icon: GitBranch, section: "Masters" },
  { href: "/customers", label: "Customers", icon: Users, section: "Masters" },
  { href: "/suppliers", label: "Suppliers", icon: Truck, section: "Masters" },

  { href: "/vouchers/new", label: "New Voucher", icon: Plus, section: "Transactions" },
  { href: "/quotations", label: "Quotation", icon: ClipboardList, section: "Transactions" },
  { href: "/invoices", label: "Sales", icon: FileText, section: "Transactions" },
  { href: "/bills", label: "Purchase", icon: Receipt, section: "Transactions" },
  { href: "/receipt", label: "Receipt", icon: Wallet, section: "Transactions" },
  { href: "/payment", label: "Payment", icon: Banknote, section: "Transactions" },
  { href: "/contra", label: "Contra", icon: ArrowLeftRight, section: "Transactions" },
  { href: "/journals", label: "Journal", icon: BookOpen, section: "Transactions" },

  { href: "/account-ledger", label: "Account Ledger", icon: ScrollText, section: "Ledgers & Reports" },
  { href: "/reports", label: "Reports", icon: CreditCard, section: "Ledgers & Reports" },

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
      >
        <Outlet />
      </AppShellLayout>
    </>
  );
}
