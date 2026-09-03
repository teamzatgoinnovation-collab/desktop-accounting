import { Button, Combobox, Input, Tooltip, TooltipContent, TooltipTrigger } from "@zatgo/ui";
import { Copy, Trash2 } from "@zatgo/icons";
import type { AccountOption, CostCenter, PartyOption } from "@/components/payment-form-parts";
import { PartyField } from "./PartyField";
import { toAccountOptions, toCostCenterOptions, type Line } from "./voucher-domain";

export function JournalEntryRow({
  line,
  index,
  accounts,
  costCenters,
  customers,
  suppliers,
  employees,
  isCashBank,
  canDelete,
  onChange,
  onDuplicate,
  onDelete,
}: {
  line: Line;
  index: number;
  accounts: AccountOption[];
  costCenters: CostCenter[];
  customers: PartyOption[];
  suppliers: PartyOption[];
  employees: PartyOption[];
  isCashBank: (accountId: string) => boolean;
  canDelete: boolean;
  onChange: (line: Line) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const cashBank = line.account ? isCashBank(line.account) : null;

  return (
    <div
      role="row"
      className="grid grid-cols-1 gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_112px_112px_minmax(0,1.2fr)_auto] md:items-start md:gap-3 md:rounded-none md:border-x-0 md:border-b md:border-t-0 md:p-0 md:py-3"
    >
      <div role="cell" className="space-y-1">
        <span className="text-xs text-[var(--color-muted-foreground)] md:hidden">Account</span>
        <Combobox
          value={line.account}
          onValueChange={(v) => onChange({ ...line, account: v })}
          placeholder="Account…"
          searchPlaceholder="Search accounts…"
          options={toAccountOptions(accounts)}
          aria-label={`Account for line ${index + 1}`}
        />
        {cashBank !== null ? (
          <p className="text-xs text-[var(--color-muted-foreground)]">{cashBank ? "Cash/Bank account" : "Not Cash/Bank"}</p>
        ) : null}
      </div>

      <div role="cell">
        <span className="text-xs text-[var(--color-muted-foreground)] md:hidden">Party</span>
        <PartyField
          rowIndex={index}
          partyType={line.party_type}
          party={line.party}
          customers={customers}
          suppliers={suppliers}
          employees={employees}
          onPartyTypeChange={(value) => onChange({ ...line, party_type: value, party: "" })}
          onPartyChange={(value) => onChange({ ...line, party: value })}
        />
      </div>

      <div role="cell" className="space-y-1">
        <span className="text-xs text-[var(--color-muted-foreground)] md:hidden">Debit</span>
        <Input
          type="number"
          min={0}
          step="any"
          placeholder="Debit"
          aria-label={`Debit for line ${index + 1}`}
          value={line.debit || ""}
          onChange={(e) => onChange({ ...line, debit: Number(e.target.value), credit: 0 })}
          className="text-right tabular-nums"
        />
      </div>

      <div role="cell" className="space-y-1">
        <span className="text-xs text-[var(--color-muted-foreground)] md:hidden">Credit</span>
        <Input
          type="number"
          min={0}
          step="any"
          placeholder="Credit"
          aria-label={`Credit for line ${index + 1}`}
          value={line.credit || ""}
          onChange={(e) => onChange({ ...line, credit: Number(e.target.value), debit: 0 })}
          className="text-right tabular-nums"
        />
      </div>

      <div role="cell" className="space-y-1">
        <span className="text-xs text-[var(--color-muted-foreground)] md:hidden">Cost center</span>
        <Combobox
          value={line.cost_center}
          onValueChange={(v) => onChange({ ...line, cost_center: v })}
          placeholder="Cost center…"
          searchPlaceholder="Search cost centers…"
          options={toCostCenterOptions(costCenters)}
          aria-label={`Cost center for line ${index + 1}`}
        />
      </div>

      <div role="cell" className="flex items-center gap-1 md:justify-end md:pt-1">
        <Button variant="ghost" size="icon" type="button" aria-label={`Duplicate line ${index + 1}`} onClick={onDuplicate}>
          <Copy />
        </Button>
        {canDelete ? (
          <Button variant="ghost" size="icon" type="button" aria-label={`Delete line ${index + 1}`} onClick={onDelete}>
            <Trash2 />
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="ghost" size="icon" type="button" disabled aria-label={`Delete line ${index + 1}`}>
                  <Trash2 />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>At least two lines are required</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
