import { useCallback } from "react";
import { Button } from "@zatgo/ui";
import type { AccountOption, CostCenter, PartyOption } from "@/components/payment-form-parts";
import { JournalEntryRow } from "./JournalEntryRow";
import { emptyLine, type Line } from "./voucher-domain";

export function JournalEntryTable({
  lines,
  accounts,
  costCenters,
  customers,
  suppliers,
  employees,
  isCashBank,
  onChange,
}: {
  lines: Line[];
  accounts: AccountOption[];
  costCenters: CostCenter[];
  customers: PartyOption[];
  suppliers: PartyOption[];
  employees: PartyOption[];
  isCashBank: (accountId: string) => boolean;
  onChange: (lines: Line[]) => void;
}) {
  const addLine = useCallback(() => onChange([...lines, emptyLine()]), [lines, onChange]);

  const onKeyDownCapture = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      addLine();
    }
  };

  return (
    <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4" onKeyDownCapture={onKeyDownCapture}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Journal Entries</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">{lines.length} accounts</p>
        </div>
      </div>

      <div role="table" aria-label="Journal entry accounts" className="space-y-2 md:space-y-0">
        <div
          role="row"
          className="hidden text-xs font-medium text-[var(--color-muted-foreground)] md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_112px_112px_minmax(0,1.2fr)_auto] md:items-center md:gap-3 md:border-b md:border-[var(--color-border)] md:pb-2"
        >
          <span role="columnheader">Account</span>
          <span role="columnheader">Party</span>
          <span role="columnheader" className="text-right">
            Debit
          </span>
          <span role="columnheader" className="text-right">
            Credit
          </span>
          <span role="columnheader">Cost center</span>
          <span role="columnheader" className="sr-only">
            Actions
          </span>
        </div>

        {lines.map((line, idx) => (
          <JournalEntryRow
            key={idx}
            line={line}
            index={idx}
            accounts={accounts}
            costCenters={costCenters}
            customers={customers}
            suppliers={suppliers}
            employees={employees}
            isCashBank={isCashBank}
            canDelete={lines.length > 2}
            onChange={(next) => onChange(lines.map((l, i) => (i === idx ? next : l)))}
            onDuplicate={() =>
              onChange([
                ...lines.slice(0, idx + 1),
                { ...line, debit: 0, credit: 0 },
                ...lines.slice(idx + 1),
              ])
            }
            onDelete={() => onChange(lines.filter((_, i) => i !== idx))}
          />
        ))}
      </div>

      <Button variant="outline" type="button" onClick={addLine}>
        Add account
      </Button>
    </section>
  );
}
