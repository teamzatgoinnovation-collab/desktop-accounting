import { useEffect, useMemo, useState } from "react";
import { ZatGoApi } from "@zatgo/erpnext";
import {
  Button,
  Combobox,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Input,
  Label,
  LoadingState,
} from "@zatgo/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { deletePaymentEntry, updatePaymentEntry } from "@/api/erpnext/payments";
import { toFriendlyMessage } from "@/lib/friendly-error";
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

export type AccountOption = {
  id: string;
  name: string;
  account_name?: string;
  account_type?: string;
  root_type?: string;
};
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
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);

  const [editing, setEditing] = useState<PaymentRow | null>(null);
  const [editForm, setEditForm] = useState({ modeOfPayment: "", referenceNo: "", costCenter: "", project: "" });
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    void (async () => {
      try {
        const env = await callZatGoApi<CostCenter[]>(ZatGoApi.accounting.journalsListCostCenters, {
          page: 1,
          page_size: 100,
        });
        setCostCenters(Array.isArray(env.data) ? env.data : []);
      } catch {
        // Non-fatal — the edit dialog's cost center field just stays empty.
      }
    })();
  }, []);

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

  const openEdit = (row: PaymentRow) => {
    setEditing(row);
    setEditForm({ modeOfPayment: "", referenceNo: "", costCenter: "", project: "" });
  };

  const onSaveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await updatePaymentEntry(editing.name, {
        modeOfPayment: editForm.modeOfPayment || undefined,
        referenceNo: editForm.referenceNo || undefined,
        costCenter: editForm.costCenter || undefined,
        project: editForm.project || undefined,
      });
      toast.success("Payment updated");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Update failed"));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (name: string) => {
    if (!window.confirm(`Delete payment ${name}? This can't be undone.`)) return;
    try {
      await deletePaymentEntry(name);
      toast.success("Payment deleted");
      await load();
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Delete failed"));
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
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" onClick={() => openEdit(row.original)}>
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => void onDelete(row.original.name)}>
                Delete
              </Button>
              <Button size="sm" variant="outline" onClick={() => void onSubmit(row.original.name)}>
                Submit
              </Button>
            </div>
          ) : row.original.docstatus === 1 ? (
            <Button size="sm" variant="outline" onClick={() => void onCancel(row.original.name)}>
              Cancel
            </Button>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="pemop">Mode of payment (optional)</Label>
              <Input
                id="pemop"
                value={editForm.modeOfPayment}
                onChange={(e) => setEditForm((f) => ({ ...f, modeOfPayment: e.target.value }))}
                placeholder="Cash / Bank…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="peref">Reference no. (optional)</Label>
              <Input
                id="peref"
                value={editForm.referenceNo}
                onChange={(e) => setEditForm((f) => ({ ...f, referenceNo: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pecc">Cost center (optional)</Label>
              <Combobox
                value={editForm.costCenter}
                onValueChange={(v) => setEditForm((f) => ({ ...f, costCenter: v }))}
                placeholder="Select…"
                searchPlaceholder="Search cost centers…"
                options={costCenters.map((c) => ({ value: c.id, label: c.cost_center_name || c.name }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="peproj">Project (optional)</Label>
              <Input
                id="peproj"
                value={editForm.project}
                onChange={(e) => setEditForm((f) => ({ ...f, project: e.target.value }))}
              />
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Amount and party can't be edited here — delete this draft and create a new one to change those.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void onSaveEdit()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
