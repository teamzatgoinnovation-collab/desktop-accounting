import { Check, TriangleAlert } from "@zatgo/icons";
import { money } from "@/lib/format";

export function BalanceSummary({
  debitTotal,
  creditTotal,
  balanced,
  entryCount,
}: {
  debitTotal: number;
  creditTotal: number;
  balanced: boolean;
  entryCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <span className="text-[var(--color-muted-foreground)]">
        {entryCount} {entryCount === 1 ? "line" : "lines"}
      </span>
      <span className="tabular-nums">
        Debit <span className="font-medium">{money(debitTotal)}</span>
      </span>
      <span className="tabular-nums">
        Credit <span className="font-medium">{money(creditTotal)}</span>
      </span>
      {balanced ? (
        <span className="flex items-center gap-1.5 font-medium text-[var(--color-success)]">
          <Check className="size-4" />
          Balanced
        </span>
      ) : (
        <span className="flex items-center gap-1.5 font-medium text-[var(--color-destructive)]">
          <TriangleAlert className="size-4" />
          Off by {money(Math.abs(debitTotal - creditTotal))}
        </span>
      )}
    </div>
  );
}
