import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, DataTable, ErrorState, Input, Label, LoadingState, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { enqueueCreate } from "@/lib/offline";
import { money } from "@/lib/format";
import { ListToolbar } from "@/components/ListToolbar";
import { type AccountOption, type CostCenter, selectClass } from "@/components/payment-form-parts";

type ContraLine = { account: string; debit: number; credit: number; cost_center: string };
const emptyLine = (): ContraLine => ({ account: "", debit: 0, credit: 0, cost_center: "" });

type JournalRow = {
  id: string;
  name: string;
  title?: string;
  voucher_type?: string;
  date?: string;
  total_debit?: number;
  total_credit?: number;
  docstatus?: number;
  status?: string;
};

export function ContraPage() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [lines, setLines] = useState<ContraLine[]>([emptyLine(), emptyLine()]);
  const [referenceNo, setReferenceNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const [rows, setRows] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState("");
  const [listFromDate, setListFromDate] = useState("");
  const [listToDate, setListToDate] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<JournalRow[]>(ZatGoApi.accounting.journalsList, { page: 1, page_size: 100 });
      setRows(Array.isArray(env.data) ? env.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contra entries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void callZatGoApi<AccountOption[]>(ZatGoApi.accounting.journalsListAccounts, {})
      .then((env) => setAccounts(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
    void callZatGoApi<CostCenter[]>(ZatGoApi.accounting.journalsListCostCenters, { page: 1, page_size: 100 })
      .then((env) => setCostCenters(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
  }, []);

  const debitTotal = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const creditTotal = lines.reduce((s, l) => s + Number(l.credit || 0), 0);

  const onSubmit = async (name: string) => {
    try {
      await callZatGoApi(ZatGoApi.accounting.journalsSubmit, { name });
      toast.success("Contra entry submitted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    }
  };

  const onCancel = async (name: string) => {
    if (!window.confirm(`Cancel contra entry ${name}? This reverses its GL impact.`)) return;
    try {
      await callZatGoApi(ZatGoApi.accounting.journalsCancel, { name });
      toast.success("Contra entry cancelled");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    }
  };

  const onCreate = async () => {
    const valid = lines.filter((l) => l.account && (l.debit > 0 || l.credit > 0));
    if (valid.length < 2) {
      toast.error("Need at least two account lines");
      return;
    }
    if (Math.abs(debitTotal - creditTotal) > 0.005) {
      toast.error("Debit and credit must match");
      return;
    }
    setBusy(true);
    try {
      await enqueueCreate({
        entityType: "contra_entry",
        method: ZatGoApi.accounting.journalsCreate,
        args: {
          accounts: valid.map((l) => ({
            account: l.account,
            debit: l.debit,
            credit: l.credit,
            cost_center: l.cost_center || undefined,
          })),
          voucher_type: "Contra Entry",
          reference_no: referenceNo || undefined,
          user_remark: remarks || undefined,
        },
      });
      toast.success("Contra entry queued — syncing");
      setLines([emptyLine(), emptyLine()]);
      setReferenceNo("");
      setRemarks("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Contra failed");
    } finally {
      setBusy(false);
    }
  };

  const filteredRows = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.voucher_type !== "Contra Entry") return false;
      if (q) {
        const haystack = `${r.name} ${r.title ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (listFromDate && (!r.date || r.date < listFromDate)) return false;
      if (listToDate && (!r.date || r.date > listToDate)) return false;
      return true;
    });
  }, [rows, listSearch, listFromDate, listToDate]);

  const columns = useMemo<ColumnDef<JournalRow>[]>(
    () => [
      {
        header: "Contra",
        cell: ({ row }) => (
          <Link
            className="font-medium underline-offset-2 hover:underline"
            to={`/journals/${encodeURIComponent(row.original.name)}`}
          >
            {row.original.name}
          </Link>
        ),
      },
      { header: "Date", accessorKey: "date" },
      { header: "Amount", cell: ({ row }) => <span className="tabular-nums">{money(row.original.total_debit)}</span> },
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

  return (
    <div className="space-y-6">
      <PageHeader title="Contra" description="Move funds between your own cash/bank accounts." />

      <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        <h2 className="text-lg font-medium">New contra entry</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Two lines covers a simple transfer (e.g. cash deposited into bank). Add more lines if the transfer
          touches more than two accounts.
        </p>
        {lines.map((line, idx) => (
          <div key={idx} className="grid gap-2 sm:grid-cols-4">
            <select
              className={selectClass}
              value={line.account}
              onChange={(e) =>
                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, account: e.target.value } : l)))
              }
            >
              <option value="">Account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_name || a.name}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="Debit"
              value={line.debit || ""}
              onChange={(e) =>
                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, debit: Number(e.target.value), credit: 0 } : l)))
              }
            />
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="Credit"
              value={line.credit || ""}
              onChange={(e) =>
                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, credit: Number(e.target.value), debit: 0 } : l)))
              }
            />
            <select
              className={selectClass}
              value={line.cost_center}
              onChange={(e) =>
                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, cost_center: e.target.value } : l)))
              }
            >
              <option value="">Cost center…</option>
              {costCenters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cost_center_name || c.name}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="grid gap-2 sm:grid-cols-2 sm:max-w-md">
          <div className="space-y-1">
            <Label htmlFor="cref">Reference (optional)</Label>
            <Input id="cref" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="crem">Remarks (optional)</Label>
            <Input id="crem" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Button variant="outline" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
            Add line
          </Button>
          <span className="tabular-nums text-[var(--color-muted-foreground)]">
            Debit {money(debitTotal)} · Credit {money(creditTotal)}
          </span>
          <Button disabled={busy} onClick={() => void onCreate()}>
            Create contra entry
          </Button>
        </div>
      </section>

      {error ? (
        <ErrorState title="Contra entries unavailable" description={error} onRetry={() => void load()} />
      ) : loading ? (
        <LoadingState label="Loading contra entries…" />
      ) : (
        <>
          <ListToolbar
            search={listSearch}
            onSearchChange={setListSearch}
            searchPlaceholder="Search contra entry…"
            fromDate={listFromDate}
            onFromDateChange={setListFromDate}
            toDate={listToDate}
            onToDateChange={setListToDate}
          />
          <DataTable data={filteredRows} columns={columns} emptyMessage="No contra entries match." pageSize={15} />
        </>
      )}
    </div>
  );
}
