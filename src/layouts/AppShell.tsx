import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button, cn } from "@zatgo/ui";
import { LayoutDashboard, Moon, Settings, Sun } from "@zatgo/icons";
import { useThemeStore } from "@/store/theme";
import { useSessionStore } from "@/store/session";
import { logoutFromErpnext } from "@/lib/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const nav = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/connection", label: "Connection", icon: Settings },
];

export function AppShell() {
  const navigate = useNavigate();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const connected = useSessionStore((s) => s.connected);
  const user = useSessionStore((s) => s.user);
  const fullName = useSessionStore((s) => s.fullName);
  const baseUrl = useSessionStore((s) => s.connection.baseUrl);
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

  return (
    <div className="flex min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--app-sidebar)]">
        <div className="border-b border-[var(--color-border)] px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            ZatGo
          </p>
          <p className="text-lg font-semibold">Accounting</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-[var(--radius-lg)] px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-[var(--app-sidebar-active)] font-medium"
                      : "text-[var(--color-muted-foreground)] hover:bg-[var(--app-sidebar-active)]",
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-[var(--color-border)] p-3 text-xs text-[var(--color-muted-foreground)]">
          <p className="truncate font-medium text-[var(--color-foreground)]" title={fullName ?? user ?? undefined}>
            {connected ? fullName || user : "Not signed in"}
          </p>
          <p className="truncate">{connected ? "Connected" : "Not connected"}</p>
          <p>v{version}</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-2 border-b border-[var(--color-border)] px-4">
          <Button variant="outline" disabled={signingOut} onClick={() => void onSignOut()}>
            Sign out
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              setMode(mode === "light" ? "dark" : mode === "dark" ? "system" : "light")
            }
          >
            {mode === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            Theme: {mode}
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
