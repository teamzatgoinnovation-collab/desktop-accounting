import { useEffect, useState } from "react";
import { Badge, Button, LoadingState, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";

const ENTITY_LABELS: Record<string, string> = {
  customer: "Customer",
  supplier: "Supplier",
  sales_invoice: "Invoice",
  purchase_invoice: "Bill",
  sales_return: "Credit note",
  purchase_return: "Debit note",
  payment_receive: "Payment received",
  payment_pay: "Payment sent",
  journal_entry: "Journal entry",
};

function statusBadge(status: OutboxStatus) {
  switch (status) {
    case "synced":
      return <Badge variant="outline">Synced</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "uploading":
      return <Badge>Syncing…</Badge>;
    default:
      return <Badge variant="secondary">Pending</Badge>;
  }
}

export function SyncCenterPage() {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!window.zatgoDesktop?.outboxList) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await window.zatgoDesktop.outboxList();
    setItems(rows);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const unsubscribe = window.zatgoDesktop?.onOutboxChanged?.(() => void load());
    return () => unsubscribe?.();
  }, []);

  const onSyncNow = async () => {
    if (!window.zatgoDesktop?.outboxFlush) return;
    setBusy(true);
    try {
      const result = await window.zatgoDesktop.outboxFlush();
      if (result.skipped === "not-signed-in") {
        toast.error("Sign in to sync");
      } else if (result.skipped === "already-running") {
        toast.info("Sync already in progress");
      } else {
        toast.success(`Synced ${result.uploaded} · ${result.failed} failed`);
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onRetryAll = async () => {
    if (!window.zatgoDesktop?.outboxRequeueAllFailed) return;
    setBusy(true);
    try {
      const n = await window.zatgoDesktop.outboxRequeueAllFailed();
      toast.success(n ? `Requeued ${n} item(s)` : "Nothing to retry");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onRetryOne = async (id: string) => {
    if (!window.zatgoDesktop?.outboxRequeue) return;
    await window.zatgoDesktop.outboxRequeue(id);
    await load();
  };

  if (loading) return <LoadingState label="Loading sync queue…" />;

  const failed = items.filter((i) => i.status === "failed");
  const pending = items.filter((i) => i.status === "pending" || i.status === "uploading");
  const synced = items.filter((i) => i.status === "synced");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sync Center"
        description="Everything created on this device — synced to ERPNext or waiting to be."
        actions={
          <div className="flex flex-wrap gap-2">
            {failed.length ? (
              <Button variant="outline" disabled={busy} onClick={() => void onRetryAll()}>
                Retry all failed
              </Button>
            ) : null}
            <Button disabled={busy} onClick={() => void onSyncNow()}>
              Sync now
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
          <p className="text-xs text-[var(--color-muted-foreground)]">Pending</p>
          <p className="text-xl font-semibold tabular-nums">{pending.length}</p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
          <p className="text-xs text-[var(--color-muted-foreground)]">Failed</p>
          <p className="text-xl font-semibold tabular-nums text-[var(--color-destructive)]">{failed.length}</p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
          <p className="text-xs text-[var(--color-muted-foreground)]">Synced</p>
          <p className="text-xl font-semibold tabular-nums">{synced.length}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-left">
            <tr>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Result</th>
              <th className="px-4 py-2">Updated</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-[var(--color-muted-foreground)]" colSpan={5}>
                  Nothing queued yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-2">{ENTITY_LABELS[item.entityType] || item.entityType}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-1">
                      {statusBadge(item.status)}
                      {item.status === "failed" && item.lastError ? (
                        <span className="text-xs text-[var(--color-destructive)]">{item.lastError}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-2">{item.resultName || "—"}</td>
                  <td className="px-4 py-2 text-[var(--color-muted-foreground)]">
                    {new Date(item.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {item.status === "failed" ? (
                      <Button size="sm" variant="outline" onClick={() => void onRetryOne(item.id)}>
                        Retry
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
