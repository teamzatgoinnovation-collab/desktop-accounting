/**
 * Background sync engine for the accounting desktop outbox. Claims one
 * queued write at a time, pushes it to ERPNext through the existing
 * session/HTTP path, and marks it synced or failed (with backoff) based
 * on the result — mirrors flutter-van-sale's claim/flush loop.
 */
import type { ErpnextSessionStore } from "@zatgo/erpnext";
import type { OutboxStore } from "./outbox-store";

type ApiEnvelope = {
  success?: boolean;
  data?: unknown;
  meta?: { submitted?: boolean; submit_error?: string | null } | null;
  error?: { message?: string } | null;
};

export type SyncFlushResult = { uploaded: number; failed: number; skipped?: string };

export class SyncEngine {
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly outbox: OutboxStore,
    private readonly erpnext: ErpnextSessionStore,
    private readonly onChange: () => void,
  ) {}

  start(intervalMs = 45_000): void {
    this.stop();
    this.timer = setInterval(() => {
      void this.flush();
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async flush(): Promise<SyncFlushResult> {
    if (this.running) return { uploaded: 0, failed: 0, skipped: "already-running" };
    if (!this.erpnext.get()) return { uploaded: 0, failed: 0, skipped: "not-signed-in" };

    this.running = true;
    let uploaded = 0;
    let failed = 0;
    try {
      // Bounded loop, not `while (true)`, so a persistently-broken item
      // (e.g. every retry hits the same not-yet-due backoff window) can
      // never spin the sync loop forever within one flush() call.
      for (let i = 0; i < 200; i += 1) {
        const item = this.outbox.claimNext();
        if (!item) break;

        try {
          const args = JSON.parse(item.argsJson) as Record<string, unknown>;
          const res = await this.erpnext.request({
            path: `/api/method/${item.method}`,
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(args),
          });

          const parsed = res.bodyText ? (JSON.parse(res.bodyText) as { message?: unknown }) : {};
          if (!res.ok) {
            const msg =
              typeof parsed.message === "string" ? parsed.message : `HTTP ${res.status}`;
            throw new Error(msg);
          }

          const envelope = (parsed.message ?? parsed) as ApiEnvelope;
          if (envelope && envelope.success === false) {
            throw new Error(envelope.error?.message || "Request failed");
          }
          if (envelope?.meta && envelope.meta.submitted === false) {
            // Voucher endpoints auto-submit right after insert so they post to
            // GL immediately; a doc was created but couldn't be submitted
            // (e.g. an ERPNext validation error). Treat as retryable rather
            // than "synced" — retrying re-runs the same create call, which
            // finds the existing draft via zatgo_client_id and retries just
            // the submit step (see _try_auto_submit's idempotent branch).
            throw new Error(
              envelope.meta.submit_error || "Created but could not post to ledger — will retry.",
            );
          }

          const data = envelope?.data;
          const resultName =
            data && typeof data === "object" && "name" in (data as Record<string, unknown>)
              ? String((data as Record<string, unknown>).name)
              : null;
          this.outbox.markSynced(item.id, resultName, data ?? null);
          uploaded += 1;
        } catch (e) {
          this.outbox.markFailed(item.id, e instanceof Error ? e.message : String(e));
          failed += 1;
        }
        this.onChange();
      }
    } finally {
      this.running = false;
    }
    return { uploaded, failed };
  }
}
