import { Button } from "@zatgo/ui";
import { Loader2 } from "@zatgo/icons";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { loginWithPassword, testConnection } from "@/lib/client";
import { useSessionStore } from "@/store/session";

const inputClass =
  "h-10 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-transparent px-3 text-sm outline-none focus:border-[var(--color-primary)]";

export function LoginPage() {
  const navigate = useNavigate();
  const connection = useSessionStore((s) => s.connection);

  const setAllowMockWithoutLogin = useSessionStore((s) => s.setAllowMockWithoutLogin);
  const connected = useSessionStore((s) => s.connected);
  const lastError = useSessionStore((s) => s.lastError);

  const [usr, setUsr] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  if (connected) {
    return <Navigate to="/" replace />;
  }

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await loginWithPassword({
        baseUrl: connection.baseUrl,
        usr,
        pwd,
      });
      if (result.ok) {
        toast.success(`Signed in as ${result.fullName || result.user}`);
        navigate("/", { replace: true });
      } else {
        toast.error(result.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const onPing = async () => {
    setBusy(true);
    try {
      const result = await testConnection();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4 text-[var(--color-foreground)]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            ZatGo
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Accounting</h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Sign in with your ERPNext / Frappe site account.
          </p>
        </div>

        <form
          onSubmit={(e) => void onLogin(e)}
          className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5"
        >
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Email / User</span>
            <input
              className={inputClass}
              value={usr}
              onChange={(e) => setUsr(e.target.value)}
              placeholder="user@example.com"
              autoComplete="username"
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Password</span>
            <input
              type="password"
              className={inputClass}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {lastError ? (
            <p className="text-sm text-[var(--color-destructive)]">{lastError}</p>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Sign in
          </Button>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => void onPing()}
              disabled={busy}
            >
              Test site
            </Button>
          </div>
        </form>

        <p className="text-center text-xs text-[var(--color-muted-foreground)]">
          Login runs in the Electron process and stores a Frappe session cookie (sid).
        </p>
      </div>
    </div>
  );
}
