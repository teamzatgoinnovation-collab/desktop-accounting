/** Shared formatting helpers for accounting UI. */

export function money(value: number | string | null | undefined, currency = ""): string {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  const formatted = Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";
  return currency ? `${currency} ${formatted}` : formatted;
}
