/**
 * Cache-then-network read cache for list/picker data (Customers, Suppliers,
 * Items, Warehouses) so those pages — and the pickers inside create forms —
 * still show the last-known data while offline. Not a full offline data
 * store: it's a last-fetched snapshot per collection, refreshed whenever a
 * network call to list that collection succeeds.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

type CacheEntry = { data: unknown[]; updatedAt: string };
type CacheFile = Record<string, CacheEntry>;

export class ReadCache {
  private readonly filePath: string;
  private cache: CacheFile = {};

  constructor(userDataDir: string) {
    const dir = path.join(userDataDir, "zatgo-local");
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, "read-cache.json");
    this.load();
  }

  private load(): void {
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw);
      this.cache = parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      this.cache = {};
    }
  }

  private save(): void {
    const tmpPath = `${this.filePath}.${randomUUID()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.cache, null, 2), "utf-8");
    fs.renameSync(tmpPath, this.filePath);
  }

  set(key: string, data: unknown[]): void {
    this.cache[key] = { data, updatedAt: new Date().toISOString() };
    this.save();
  }

  get(key: string): CacheEntry | null {
    return this.cache[key] ?? null;
  }
}
