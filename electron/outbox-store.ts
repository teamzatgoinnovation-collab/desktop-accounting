/**
 * Durable local-first write queue for the accounting desktop app, mirroring
 * flutter-van-sale's proven outbox pattern: local-first commit, client-
 * generated idempotency key, staged exponential backoff, never delete a
 * failed item. Backed by a JSON file rather than a native SQLite module —
 * this app's write volume (a back-office accounting user, not a high-
 * frequency mobile sales queue) doesn't need it, and it avoids another
 * native-module Electron rebuild dependency on top of the one Electron
 * itself already needed in this environment.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type OutboxStatus = "pending" | "uploading" | "synced" | "failed";

export type OutboxItem = {
  id: string;
  clientId: string;
  entityType: string;
  method: string;
  argsJson: string;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  nextRetryAt: string | null;
  resultName: string | null;
  resultDataJson: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OutboxCounts = Record<OutboxStatus, number>;

// 1m, 5m, 30m, then capped at 2h — same schedule as flutter-van-sale.
const BACKOFF_SCHEDULE_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

function backoffDelayFor(attempts: number): number {
  const index = attempts - 1;
  if (index < 0) return BACKOFF_SCHEDULE_MS[0];
  if (index >= BACKOFF_SCHEDULE_MS.length) return BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1];
  return BACKOFF_SCHEDULE_MS[index];
}

// Keep the outbox from growing unbounded — cap how many terminal (synced)
// rows we retain for the Sync Center's recent-activity view.
const MAX_SYNCED_HISTORY = 300;

export class OutboxStore {
  private readonly filePath: string;
  private items: OutboxItem[] = [];

  constructor(userDataDir: string) {
    const dir = path.join(userDataDir, "zatgo-local");
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, "outbox.json");
    this.load();
  }

  private load(): void {
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw);
      this.items = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.items = [];
    }
  }

  /** Atomic write: temp file + rename, so a crash mid-write can't corrupt the outbox. */
  private save(): void {
    const tmpPath = `${this.filePath}.${randomUUID()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.items, null, 2), "utf-8");
    fs.renameSync(tmpPath, this.filePath);
  }

  /**
   * Enqueue (or idempotently re-enqueue) a local write. Stable id keyed on
   * entityType+clientId, so re-enqueuing the same logical operation never
   * creates a duplicate outbox row — matches the mobile app's
   * `sq_${entityType}_${entityId}_${op}` pattern.
   */
  enqueue(input: { entityType: string; clientId: string; method: string; args: Record<string, unknown> }): OutboxItem {
    const id = `ob_${input.entityType}_${input.clientId}`;
    const now = new Date().toISOString();
    const existing = this.items.find((i) => i.id === id);
    if (existing && existing.status !== "synced") {
      existing.argsJson = JSON.stringify(input.args);
      existing.method = input.method;
      existing.status = "pending";
      existing.nextRetryAt = null;
      existing.updatedAt = now;
      this.save();
      return existing;
    }
    if (existing && existing.status === "synced") {
      // Already synced under this exact client_id — nothing to do.
      return existing;
    }
    const item: OutboxItem = {
      id,
      clientId: input.clientId,
      entityType: input.entityType,
      method: input.method,
      argsJson: JSON.stringify(input.args),
      status: "pending",
      attempts: 0,
      lastError: null,
      nextRetryAt: null,
      resultName: null,
      resultDataJson: null,
      createdAt: now,
      updatedAt: now,
    };
    this.items.push(item);
    this.save();
    return item;
  }

  /** Claim the next eligible item (pending, or failed whose backoff window has elapsed). */
  claimNext(): OutboxItem | null {
    const now = new Date();
    const eligible = this.items
      .filter((i) => {
        if (i.status === "pending") return true;
        if (i.status === "failed") {
          if (!i.nextRetryAt) return true;
          return new Date(i.nextRetryAt) <= now;
        }
        return false;
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const item = eligible[0];
    if (!item) return null;
    item.status = "uploading";
    item.attempts += 1;
    item.updatedAt = now.toISOString();
    this.save();
    return item;
  }

  markSynced(id: string, resultName: string | null, resultData: unknown): void {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    item.status = "synced";
    item.resultName = resultName;
    item.resultDataJson = resultData === undefined ? null : JSON.stringify(resultData);
    item.lastError = null;
    item.nextRetryAt = null;
    item.updatedAt = new Date().toISOString();
    this.pruneSyncedHistory();
    this.save();
  }

  /** Never deletes the item — stays visible as failed, retried automatically per backoff. */
  markFailed(id: string, error: string): void {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    item.status = "failed";
    item.lastError = error;
    item.nextRetryAt = new Date(Date.now() + backoffDelayFor(item.attempts)).toISOString();
    item.updatedAt = new Date().toISOString();
    this.save();
  }

  requeue(id: string): void {
    const item = this.items.find((i) => i.id === id);
    if (!item || item.status !== "failed") return;
    item.status = "pending";
    item.nextRetryAt = null;
    item.lastError = null;
    item.updatedAt = new Date().toISOString();
    this.save();
  }

  requeueAllFailed(): number {
    const now = new Date().toISOString();
    let n = 0;
    for (const item of this.items) {
      if (item.status === "failed") {
        item.status = "pending";
        item.nextRetryAt = null;
        item.lastError = null;
        item.updatedAt = now;
        n += 1;
      }
    }
    if (n > 0) this.save();
    return n;
  }

  /** Any item stuck 'uploading' from a crash/kill gets reset to pending on next app boot. */
  requeueStuckUploads(): void {
    const now = new Date().toISOString();
    let changed = false;
    for (const item of this.items) {
      if (item.status === "uploading") {
        item.status = "pending";
        item.updatedAt = now;
        changed = true;
      }
    }
    if (changed) this.save();
  }

  list(status?: OutboxStatus): OutboxItem[] {
    const rows = status ? this.items.filter((i) => i.status === status) : this.items;
    return [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  get(id: string): OutboxItem | null {
    return this.items.find((i) => i.id === id) ?? null;
  }

  counts(): OutboxCounts {
    const counts: OutboxCounts = { pending: 0, uploading: 0, synced: 0, failed: 0 };
    for (const item of this.items) counts[item.status] += 1;
    return counts;
  }

  private pruneSyncedHistory(): void {
    const synced = this.items.filter((i) => i.status === "synced");
    if (synced.length <= MAX_SYNCED_HISTORY) return;
    const toDrop = synced
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .slice(0, synced.length - MAX_SYNCED_HISTORY);
    const dropIds = new Set(toDrop.map((i) => i.id));
    this.items = this.items.filter((i) => !dropIds.has(i.id));
  }
}
