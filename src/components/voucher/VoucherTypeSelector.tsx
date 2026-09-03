import { ToggleGroup, ToggleGroupItem } from "@zatgo/ui";
import { VOUCHER_TYPES, type VoucherType } from "./voucher-domain";

export function VoucherTypeSelector({ value, onChange }: { value: VoucherType; onChange: (value: VoucherType) => void }) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      onValueChange={(v) => v && onChange(v as VoucherType)}
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      aria-label="Voucher type"
    >
      {VOUCHER_TYPES.map((t) => (
        <ToggleGroupItem
          key={t.value}
          value={t.value}
          className="flex h-auto flex-col items-start gap-1 whitespace-normal border-[var(--color-border)] px-3 py-2.5 text-left data-[state=on]:border-[var(--color-primary)] data-[state=on]:bg-[var(--color-primary)] data-[state=on]:text-[var(--color-primary-foreground)]"
        >
          <span className="text-sm font-semibold">{t.label}</span>
          <span
            className={
              "text-xs font-normal leading-snug " +
              (value === t.value ? "text-[var(--color-primary-foreground)]/80" : "text-[var(--color-muted-foreground)]")
            }
          >
            {t.hint}
          </span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
