import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { ZatGoApi } from "@zatgo/erpnext";
import {
  Button,
  Combobox,
  DataTable,
  ErrorState,
  Input,
  Label,
  LoadingState,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";
import { ListToolbar } from "@/components/ListToolbar";

type Journal = {
  id: string;
  name: string;
  title?: string;
  date?: string;
  total_debit?: number;
  total_credit?: number;
  docstatus?: number;
  status?: string;
};

type Account = { id: string; name: string; account_name?: string };
type CostCenter = { id: string; name: string; cost_center_name?: string };
type Line = { account: string; debit: number; credit: number; cost_center: string; party_type: string; party: string };

const emptyLine = (): Line => ({ account: "", debit: 0, credit: 0, cost_center: "", party_type: "", party: "" });

type DuplicateState = { lines?: Line[] };

export function JournalsPage() {
  const location = useLocation();
  const duplicateFrom = (location.state as DuplicateState | null) || null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [lines, setLines] = useState<Line[]>(
    duplicateFrom?.lines?.length ? duplicateFrom.lines : [emptyLine(), emptyLine()],
  );
  const [remark, setRemark] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [listFromDate, setListFromDate] = useState("");
  const [listToDate, setListToDate] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    // Three independent loads: one failing must never block the create form
    // behind a full-page error — accounts/cost-centers (needed for the
    // picker) and the journal list degrade independently.
    const [journalsResult, accountsResult, costCentersResult] = await Promise.allSettled([
      callZatGoApi<Journal[]>(ZatGoApi.accounting.journalsList, { page: 1, page_size: 50 }),
      callZatGoApi<Account[]>(ZatGoApi.accounting.journalsListAccounts, {}),
      callZatGoApi<CostCenter[]>(ZatGoApi.accounting.journalsListCostCenters, { page: 1, page_size: 100 }),
    ]);

    if (journalsResult.status === "fulfilled") {
      setRows(Array.isArray(journalsResult.value.data) ? journalsResult.value.data : []);
    } else if (rows.length === 0) {
      setError(
        journalsResult.reason instanceof Error ? journalsResult.reason.message : "Failed to load journals",
      );
    }
    if (accountsResult.status === "fulfilled") {
      setAccounts(Array.isArray(accountsResult.value.data) ? accountsResult.value.data : []);
    }
    if (costCentersResult.status === "fulfilled") {
      setCostCenters(Array.isArray(costCentersResult.value.data) ? costCentersResult.value.data : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const columns = useMemo<ColumnDef<Journal>[]>(
    () => [
      {
        header: "Journal",
        cell: ({ row }) => (
          <Link
            className="font-medium underline-offset-2 hover:underline"
            to={`/journals/${encodeURIComponent(row.original.name)}`}
          >
            {row.original.name}
          </Link>
        ),
      },
      { header: "Title", accessorKey: "title" },
      { header: "Date", accessorKey: "date" },
      {
        header: "Debit",
        cell: ({ row }) => <span className="tabular-nums">{money(row.original.total_debit)}</span>,
      },
      {
        header: "Credit",
        cell: ({ row }) => <span className="tabular-nums">{money(row.original.total_credit)}</span>,
      },
      { header: "Status", accessorKey: "status" },
    ],
    [],
  );

  const debitTotal = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const creditTotal = lines.reduce((s, l) => s + Number(l.credit || 0), 0);

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
      await callZatGoApi(ZatGoApi.accounting.journalsCreate, {
        accounts: valid.map((l) => ({
          account: l.account,
          debit: l.debit,
          credit: l.credit,
          cost_center: l.cost_center || undefined,
          party_type: l.party_type || undefined,
          party: l.party || undefined,
        })),
        user_remark: remark || undefined,
        reference_no: referenceNo || undefined,
        reference_date: referenceDate || undefined,
        client_id: crypto.randomUUID(),
      });
      toast.success("Journal created");
      setLines([emptyLine(), emptyLine()]);
      setRemark("");
      setReferenceNo("");
      setReferenceDate("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const filteredRows = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const haystack = `${r.name} ${r.title ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (listFromDate && (!r.date || r.date < listFromDate)) return false;
      if (listToDate && (!r.date || r.date > listToDate)) return false;
      return true;
    });
  }, [rows, listSearch, listFromDate, listToDate]);

  if (loading) return <LoadingState label="Loading journals…" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Journals" description="Simple double-entry adjustments." />

      <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        <h2 className="text-lg font-medium">New journal</h2>
        <div className="space-y-1">
          <Label htmlFor="remark">Note</Label>
          <Input id="remark" value={remark} onChange={(e) => setRemark(e.target.value)} />
        </div>
        {lines.map((line, idx) => (
          <div key={idx} className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-2">
            <div className="grid gap-2 sm:grid-cols-4">
              <Combobox
                value={line.account}
                onValueChange={(v) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, account: v } : l)))}
                placeholder="Account…"
                searchPlaceholder="Search accounts…"
                options={accounts.map((a) => ({ value: a.id, label: a.account_name || a.name, keywords: a.name }))}
              />
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="Debit"
                value={line.debit || ""}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l, i) => (i === idx ? { ...l, debit: Number(e.target.value), credit: 0 } : l)),
                  )
                }
              />
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="Credit"
                value={line.credit || ""}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l, i) => (i === idx ? { ...l, credit: Number(e.target.value), debit: 0 } : l)),
                  )
                }
              />
              <Combobox
                value={line.cost_center}
                onValueChange={(v) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, cost_center: v } : l)))}
                placeholder="Cost center…"
                searchPlaceholder="Search cost centers…"
                options={costCenters.map((c) => ({ value: c.id, label: c.cost_center_name || c.name, keywords: c.name }))}
              />
            </div>
            {showMore ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Select
                  value={line.party_type}
                  onValueChange={(value) =>
                    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, party_type: value, party: "" } : l)))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Party type (optional)…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Customer">Customer</SelectItem>
                    <SelectItem value="Supplier">Supplier</SelectItem>
                    <SelectItem value="Employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Party (customer/supplier name)"
                  value={line.party}
                  disabled={!line.party_type}
                  onChange={(e) =>
                    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, party: e.target.value } : l)))
                  }
                />
              </div>
            ) : null}
          </div>
        ))}
        {showMore ? (
          <div className="grid gap-2 sm:grid-cols-2 sm:max-w-md">
            <div className="space-y-1">
              <Label htmlFor="jref">Reference (optional)</Label>
              <Input id="jref" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="jrefdate">Reference date (optional)</Label>
              <Input id="jrefdate" type="date" value={referenceDate} onChange={(e) => setReferenceDate(e.target.value)} />
            </div>
          </div>
        ) : null}
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm"
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "Show less details" : "Show more details"}
        </Button>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Button
            variant="outline"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
          >
            Add line
          </Button>
          <span className="tabular-nums text-[var(--color-muted-foreground)]">
            Debit {money(debitTotal)} · Credit {money(creditTotal)}
          </span>
          <Button disabled={busy} onClick={() => void onCreate()}>
            Save draft
          </Button>
        </div>
      </section>

      {error ? (
        <ErrorState title="Journal list unavailable" description={error} onRetry={() => void load()} />
      ) : (
        <>
          <ListToolbar
            search={listSearch}
            onSearchChange={setListSearch}
            searchPlaceholder="Search journal # or title…"
            fromDate={listFromDate}
            onFromDateChange={setListFromDate}
            toDate={listToDate}
            onToDateChange={setListToDate}
          />
          <DataTable data={filteredRows} columns={columns} emptyMessage="No journals match." pageSize={15} />
        </>
      )}
    </div>
  );
}
