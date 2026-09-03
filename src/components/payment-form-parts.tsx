import { useEffect, useMemo, useState } from "react";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, Combobox, DataTable, ErrorState, Input, Label, LoadingState } from "@zatgo/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";
import { ListToolbar } from "@/components/ListToolbar";

export type PaymentRow = {
  id: string;
  name: string;
  payment_type?: string;
  party?: string;
  amount?: number;
  date?: string;
  status?: string;
  docstatus?: number;
};

export type AccountOption = { id: string; name: string; account_name?: string; account_type?: string };
export const isCashOrBankAccountType = (type?: string) => type === "Cash" || type === "Bank";
export type PartyOption = { id: string; name: string; customer_name?: string; supplier_name?: string };
export type CostCenter = { id: string; name: string; cost_center_name?: string };
export type InvoiceLine = { name: string; amount: string };

export const emptyInvoiceLine = (): InvoiceLine => ({ name: "", amount: "" });

export const selectClass =
  "h-10 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-transparent px-3 text-sm";

export function AdvancedPaymentFields({
  idPrefix,
  show,
  onToggle,
  costCenters,
  costCenter,
  onCostCenterChange,
  project,
  onProjectChange,
}: {
  idPrefix: string;
  show: boolean;
  onToggle: () => void;
  costCenters: CostCenter[];
  costCenter: string;
  onCostCenterChange: (value: string) => void;
  project: string;
  onProjectChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      {show ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-cc`}>Cost center (optional)</Label>
            <Combobox
              value={costCenter}
              onValueChange={onCostCenterChange}
              placeholder="Select…"
              searchPlaceholder="Search cost centers…"
              options={costCenters.map((c) => ({ value: c.id, label: c.cost_center_name || c.name, keywords: c.name }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-proj`}>Project (optional)</Label>
            <Input id={`${idPrefix}-proj`} value={project} onChange={(e) => onProjectChange(e.target.value)} />
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="text-sm text-[var(--color-primary)] underline-offset-2 hover:underline"
        onClick={onToggle}
      >
        {show ? "Show less details" : "Show more details"}
      </button>
    </div>
  );
}

export function InvoiceAllocationEditor({
  label,
  lines,
  onChange,
}: {
  label: string;
  lines: InvoiceLine[];
  onChange: (lines: InvoiceLine[]) => void;
}) {
  return (
    <div className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3">
      <Label>{label}</Label>
      {lines.map((line, idx) => (
        <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
          <Input
            placeholder="Invoice #"
            value={line.name}
            onChange={(e) => onChange(lines.map((l, i) => (i === idx ? { ...l, name: e.target.value } : l)))}
          />
          <Input
            type="number"
            placeholder="Amount (optional)"
            value={line.amount}
            onChange={(e) => onChange(lines.map((l, i) => (i === idx ? { ...l, amount: e.target.value } : l)))}
          />
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => onChange(lines.length > 1 ? lines.filter((_, i) => i !== idx) : [emptyInvoiceLine()])}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" type="button" onClick={() => onChange([...lines, emptyInvoiceLine()])}>
        Add invoice
      </Button>
    </div>
  );
}

export type SplitLine = { account: string; amount: string };
export const emptySplitLine = (): SplitLine => ({ account: "", amount: "" });

/** Split a receipt/payment across several cash/bank accounts (e.g. part cash, part card). */
export function SplitAccountLinesEditor({
  accounts,
  lines,
  onChange,
}: {
  accounts: AccountOption[];
  lines: SplitLine[];
  onChange: (lines: SplitLine[]) => void;
}) {
  return (
    <div className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3">
      <Label>Split across accounts</Label>
      {lines.map((line, idx) => (
        <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
          <Combobox
            value={line.account}
            onValueChange={(v) => onChange(lines.map((l, i) => (i === idx ? { ...l, account: v } : l)))}
            placeholder="Account…"
            searchPlaceholder="Search accounts…"
            options={accounts.map((a) => ({ value: a.id, label: a.account_name || a.name, keywords: a.name }))}
          />
          <Input
            type="number"
            placeholder="Amount"
            value={line.amount}
            onChange={(e) => onChange(lines.map((l, i) => (i === idx ? { ...l, amount: e.target.value } : l)))}
          />
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => onChange(lines.length > 1 ? lines.filter((_, i) => i !== idx) : [emptySplitLine()])}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" type="button" onClick={() => onChange([...lines, emptySplitLine()])}>
        Add account
      </Button>
    </div>
  );
}

/**
 * Self-contained list + submit/cancel section, filtered to one payment_type
 * (Receive / Pay / Internal Transfer) — each dedicated page owns its own
 * slice of the shared Payment Entry list rather than showing everything.
 */
export function PaymentsListSection({
  paymentType,
  searchPlaceholder,
  reloadToken,
}: {
  paymentType: "Receive" | "Pay" | "Internal Transfer";
  searchPlaceholder: string;
  reloadToken?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [listSearch, setListSearch] = useState("");
  const [listFromDate, setListFromDate] = useState("");
  const [listToDate, setListToDate] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<PaymentRow[]>(ZatGoApi.accounting.paymentsList, { page: 1, page_size: 100 });
      setRows(Array.isArray(env.data) ? env.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  const onSubmit = async (name: string) => {
    try {
      await callZatGoApi(ZatGoApi.accounting.paymentsSubmit, { name });
      toast.success("Payment submitted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    }
  };

  const onCancel = async (name: string) => {
    if (!window.confirm(`Cancel payment ${name}? This reverses its GL impact.`)) return;
    try {
      await callZatGoApi(ZatGoApi.accounting.paymentsCancel, { name });
      toast.success("Payment cancelled");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    }
  };

  const filteredRows = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.payment_type !== paymentType) return false;
      if (q) {
        const haystack = `${r.name} ${r.party ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (listFromDate && (!r.date || r.date < listFromDate)) return false;
      if (listToDate && (!r.date || r.date > listToDate)) return false;
      return true;
    });
  }, [rows, paymentType, listSearch, listFromDate, listToDate]);

  const columns = useMemo<ColumnDef<PaymentRow>[]>(
    () => [
      { header: "Payment", accessorKey: "name" },
      { header: "Party", accessorKey: "party" },
      {
        header: "Amount",
        cell: ({ row }) => <span className="tabular-nums">{money(row.original.amount)}</span>,
      },
      { header: "Date", accessorKey: "date" },
      {
        header: "Status",
        cell: ({ row }) => (row.original.docstatus === 1 ? "Submitted" : row.original.status || "Draft"),
      },
      {
        header: "",
        id: "actions",
        cell: ({ row }) =>
          row.original.docstatus === 0 ? (
            <Button size="sm" variant="outline" onClick={() => void onSubmit(row.original.name)}>
              Submit
            </Button>
          ) : row.original.docstatus === 1 ? (
            <Button size="sm" variant="outline" onClick={() => void onCancel(row.original.name)}>
              Cancel
            </Button>
          ) : null,
      },
    ],
    [],
  );

  if (loading) return <LoadingState label="Loading…" />;
  if (error) return <ErrorState title="Unavailable" description={error} onRetry={() => void load()} />;

  return (
    <>
      <ListToolbar
        search={listSearch}
        onSearchChange={setListSearch}
        searchPlaceholder={searchPlaceholder}
        fromDate={listFromDate}
        onFromDateChange={setListFromDate}
        toDate={listToDate}
        onToDateChange={setListToDate}
      />
      <DataTable data={filteredRows} columns={columns} emptyMessage="No entries match." pageSize={15} />
    </>
  );
}
