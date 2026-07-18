import { Button } from "@zatgo/ui";
import { Loader2 } from "@zatgo/icons";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { logoutFromErpnext, testConnection } from "@/lib/client";
import { useSessionStore } from "@/store/session";


export function ConnectionPage() {
  const navigate = useNavigate();
const connected = useSessionStore((s) => s.connected);
  const user = useSessionStore((s) => s.user);
  const fullName = useSessionStore((s) => s.fullName);
  const lastError = useSessionStore((s) => s.lastError);
  const [busy, setBusy] = useState(false);

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

  const onLogout = async () => {
    setBusy(true);
    try {
      await logoutFromErpnext();
      toast.success("Signed out");
      navigate("/login", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Connection"
        description="ERPNext session status. Sign in with site email and password. API keys are for server integrations, not app login."
      />

      <div className="max-w-xl space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        {connected ? (
          <div className="rounded-[var(--radius-lg)] bg-[var(--app-sidebar-active)] px-3 py-2 text-sm">
            Signed in as <strong>{fullName || user}</strong>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Not signed in. Feature pages use mock data until you connect.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {connected ? (
            <Button type="button" variant="outline" onClick={() => void onLogout()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Sign out
            </Button>
          ) : (
            <Button type="button" onClick={() => navigate("/login")}>
              Sign in
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => void onPing()} disabled={busy}>
            Test site
          </Button>
        </div>

        <p className="text-sm text-[var(--color-muted-foreground)]">
          Status:{" "}
          <span className={connected ? "text-[var(--color-primary)]" : ""}>
            {connected ? `Connected as ${user}` : "Not signed in"}
          </span>
          {lastError ? ` — ${lastError}` : null}
        </p>
      </div>
    </div>
  );
}
