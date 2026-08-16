import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, DataTable, ErrorState, Input, Label, LoadingState, PageHeader } from "@zatgo/ui";

const selectClass =
  "h-10 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-transparent px-3 text-sm";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { enqueueCreate, loadCachedList } from "@/lib/offline";
import { money } from "@/lib/format";

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

export function JournalsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [remark, setRemark] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    // Two independent cache-then-network loads: a network failure (offline)
    // must never block the create form behind a full-page error — accounts
    // (needed for the picker) and the journal list degrade independently.
    const [journalsResult, accountsResult, costCentersResult] = await Promise.allSettled([
      loadCachedList<Journal>("journals", async () => {
        const env = await callZatGoApi<Journal[]>(ZatGoApi.accounting.journalsList, { page: 1, page_size: 50 });
        return Array.isArray(env.data) ? env.data : [];
      }),
      loadCachedList<Account>("accounts", async () => {
        const env = await callZatGoApi<Account[]>(ZatGoApi.accounting.journalsListAccounts, {
          page: 1,
          page_size: 100,
        });
        return Array.isArray(env.data) ? env.data : [];
      }),
      loadCachedList<CostCenter>("cost-centers", async () => {
        const env = await callZatGoApi<CostCenter[]>(ZatGoApi.accounting.journalsListCostCenters, {
          page: 1,
          page_size: 100,
        });
        return Array.isArray(env.data) ? env.data : [];
      }),
    ]);

    if (journalsResult.status === "fulfilled") {
      setRows(journalsResult.value.data);
    } else if (rows.length === 0) {
      setError(
        journalsResult.reason instanceof Error ? journalsResult.reason.message : "Failed to load journals",
      );
    }
    if (accountsResult.status === "fulfilled") {
      setAccounts(accountsResult.value.data);
      if (accountsResult.value.stale) toast.info("Showing last-known accounts — offline");
    }
    if (costCentersResult.status === "fulfilled") {
      setCostCenters(costCentersResult.value.data);
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
      await enqueueCreate({
        entityType: "journal_entry",
        method: ZatGoApi.accounting.journalsCreate,
        args: {
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
        },
      });
      toast.success("Journal queued — syncing");
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
            {showMore ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className={selectClass}
                  value={line.party_type}
                  onChange={(e) =>
                    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, party_type: e.target.value, party: "" } : l)))
                  }
                >
                  <option value="">Party type (optional)…</option>
                  <option value="Customer">Customer</option>
                  <option value="Supplier">Supplier</option>
                  <option value="Employee">Employee</option>
                </select>
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
        <button
          type="button"
          className="text-sm text-[var(--color-primary)] underline-offset-2 hover:underline"
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "Show less details" : "Show more details"}
        </button>
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
        <DataTable data={rows} columns={columns} emptyMessage="No journals yet." />
      )}
    </div>
  );
}
