import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { ZatGoApi } from "@zatgo/erpnext";
import {
  Button,
  DataTable,
  ErrorState,
  Input,
  Label,
  LoadingState,
  PageHeader,
} from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";
import { ListToolbar } from "@/components/ListToolbar";
import { downloadCsv } from "@/lib/download";

type AccountOption = { id: string; name: string; account_name?: string; is_group?: number };

type LedgerRow = {
  id: string;
  date?: string;
  voucher_type?: string;
  voucher_no?: string;
  party_type?: string;
  party?: string;
  debit: number;
  credit: number;
  remarks?: string;
  balance: number;
};

const selectClass =
  "h-10 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-transparent px-3 text-sm";

export function AccountLedgerPage() {
  const [search, setSearch] = useSearchParams();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [account, setAccount] = useState(search.get("account") || "");
  const [fromDate, setFromDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [meta, setMeta] = useState<{ opening_balance?: number; closing_balance?: number }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowSearch, setRowSearch] = useState("");
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    void callZatGoApi<AccountOption[]>(ZatGoApi.accounting.journalsListAccounts, {})
      .then((env) => setAccounts((Array.isArray(env.data) ? env.data : []).filter((a) => !a.is_group)))
      .catch(() => undefined);
  }, []);

  const loadLedger = async (acct: string) => {
    if (!acct) {
      toast.error("Select an account");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<LedgerRow[]>(ZatGoApi.accounting.reportsAccountLedger, {
        account: acct,
        from_date: fromDate,
        to_date: toDate,
        page_size: 200,
      });
      setRows(Array.isArray(env.data) ? env.data : []);
      setMeta((env.meta as typeof meta) || {});
      setLoadedOnce(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load account ledger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (search.get("account")) void loadLedger(search.get("account")!);
    // Only run on mount for a deep-linked account — subsequent runs use the Run button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAccountChange = (value: string) => {
    setAccount(value);
    setSearch(value ? { account: value } : {}, { replace: true });
  };

  const filteredRows = useMemo(() => {
    const q = rowSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.voucher_type ?? ""} ${r.voucher_no ?? ""} ${r.party ?? ""} ${r.remarks ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, rowSearch]);

  const columns = useMemo<ColumnDef<LedgerRow>[]>(
    () => [
      { header: "Date", accessorKey: "date" },
      {
        header: "Voucher",
        cell: ({ row }) => `${row.original.voucher_type || ""} ${row.original.voucher_no || ""}`,
      },
      { header: "Party", cell: ({ row }) => row.original.party || "—" },
      { header: "Debit", cell: ({ row }) => <span className="tabular-nums">{money(row.original.debit)}</span> },
      { header: "Credit", cell: ({ row }) => <span className="tabular-nums">{money(row.original.credit)}</span> },
      {
        header: "Balance",
        cell: ({ row }) => <span className="tabular-nums font-medium">{money(row.original.balance)}</span>,
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Ledger"
        description="Every transaction posted to one account, with a running balance — pulled directly from ERPNext's GL Entry."
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] space-y-1">
          <Label htmlFor="account">Account</Label>
          <select
            id="account"
            className={selectClass}
            value={account}
            onChange={(e) => onAccountChange(e.target.value)}
          >
            <option value="">Select an account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.account_name || a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <Button disabled={loading} onClick={() => void loadLedger(account)}>
          Run
        </Button>
      </div>

      {error ? <ErrorState title="Account ledger unavailable" description={error} onRetry={() => void loadLedger(account)} /> : null}

      {loading ? (
        <LoadingState label="Loading ledger…" />
      ) : loadedOnce ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 sm:max-w-md">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
              <p className="text-xs text-[var(--color-muted-foreground)]">Opening balance</p>
              <p className="text-lg font-semibold tabular-nums">{money(meta.opening_balance)}</p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
              <p className="text-xs text-[var(--color-muted-foreground)]">Closing balance</p>
              <p className="text-lg font-semibold tabular-nums">{money(meta.closing_balance)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ListToolbar search={rowSearch} onSearchChange={setRowSearch} searchPlaceholder="Search voucher or party…" />
            <Button
              variant="outline"
              size="sm"
              disabled={filteredRows.length === 0}
              onClick={() =>
                downloadCsv(
                  `account-ledger-${account}.csv`,
                  ["Date", "Voucher type", "Voucher no", "Party", "Debit", "Credit", "Balance"],
                  filteredRows.map((r) => [
                    r.date || "",
                    r.voucher_type || "",
                    r.voucher_no || "",
                    r.party || "",
                    r.debit,
                    r.credit,
                    r.balance,
                  ]),
                )
              }
            >
              Export CSV
            </Button>
          </div>
          <DataTable data={filteredRows} columns={columns} emptyMessage="No transactions in range." pageSize={20} />
        </>
      ) : (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Select an account and date range, then Run.
        </p>
      )}
    </div>
  );
}
