import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppShellLayout,
  Button,
  CommandPalette,
  type AppShellNavItem,
  type CommandPaletteItem,
} from "@zatgo/ui";
import { LayoutDashboard, Moon, Settings, Sun } from "@zatgo/icons";
import { useMemo, useEffect, useState } from "react";
import { toast } from "sonner";
import { useThemeStore } from "@/store/theme";
import { useSessionStore } from "@/store/session";
import { logoutFromErpnext } from "@/lib/client";

const nav: AppShellNavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard, end: true },
  { href: "/connection", label: "Connection", icon: Settings },
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
        group: "Navigate",
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
