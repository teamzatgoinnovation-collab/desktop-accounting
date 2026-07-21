import { useState } from "react";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, Input, Label, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";

type OutstandingRow = {
  name: string;
  party: string;
  date?: string;
  due_date?: string;
  amount: number;
  outstanding: number;
};

type GlRow = {
  date?: string;
  account: string;
  debit: number;
  credit: number;
  voucher_type?: string;
  voucher_no?: string;
};

type PlData = {
  from_date?: string;
  to_date?: string;
  income?: { account: string; account_name?: string; amount: number }[];
  expense?: { account: string; account_name?: string; amount: number }[];
  income_total?: number;
  expense_total?: number;
  net_profit?: number;
};

export function ReportsPage() {
  const [fromDate, setFromDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [ar, setAr] = useState<OutstandingRow[]>([]);
  const [ap, setAp] = useState<OutstandingRow[]>([]);
  const [gl, setGl] = useState<GlRow[]>([]);
  const [pl, setPl] = useState<PlData | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAr = async () => {
    setBusy(true);
    try {
      const env = await callZatGoApi<OutstandingRow[]>(ZatGoApi.accounting.reportsOutstandingReceivable, {
        page: 1,
        page_size: 100,
      });
      setAr(Array.isArray(env.data) ? env.data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AR report failed");
    } finally {
      setBusy(false);
    }
  };

  const loadAp = async () => {
    setBusy(true);
    try {
      const env = await callZatGoApi<OutstandingRow[]>(ZatGoApi.accounting.reportsOutstandingPayable, {
        page: 1,
        page_size: 100,
      });
      setAp(Array.isArray(env.data) ? env.data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AP report failed");
    } finally {
      setBusy(false);
    }
  };

  const loadGl = async () => {
    setBusy(true);
    try {
      const env = await callZatGoApi<GlRow[]>(ZatGoApi.accounting.reportsGeneralLedger, {
        from_date: fromDate,
        to_date: toDate,
        page: 1,
        page_size: 200,
      });
      setGl(Array.isArray(env.data) ? env.data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "GL report failed");
    } finally {
      setBusy(false);
    }
  };

  const loadPl = async () => {
    setBusy(true);
    try {
      const env = await callZatGoApi<PlData>(ZatGoApi.accounting.reportsProfitAndLoss, {
        from_date: fromDate,
        to_date: toDate,
      });
      setPl((env.data as PlData) || null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "P&L report failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Outstanding balances, ledger, and profit & loss." />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      <Tabs defaultValue="ar">
        <TabsList>
          <TabsTrigger value="ar">Customers owe</TabsTrigger>
          <TabsTrigger value="ap">You owe</TabsTrigger>
          <TabsTrigger value="gl">General ledger</TabsTrigger>
          <TabsTrigger value="pl">Profit & loss</TabsTrigger>
        </TabsList>

        <TabsContent value="ar" className="space-y-3 pt-3">
          <Button disabled={busy} onClick={() => void loadAr()}>
            Run
          </Button>
          <ReportTable
            rows={ar.map((r) => [r.name, r.party, r.due_date || "—", money(r.outstanding)])}
            headers={["Invoice", "Customer", "Due", "Outstanding"]}
          />
        </TabsContent>

        <TabsContent value="ap" className="space-y-3 pt-3">
          <Button disabled={busy} onClick={() => void loadAp()}>
            Run
          </Button>
          <ReportTable
            rows={ap.map((r) => [r.name, r.party, r.due_date || "—", money(r.outstanding)])}
            headers={["Bill", "Supplier", "Due", "Outstanding"]}
          />
        </TabsContent>

        <TabsContent value="gl" className="space-y-3 pt-3">
          <Button disabled={busy} onClick={() => void loadGl()}>
            Run
          </Button>
          <ReportTable
            rows={gl.map((r) => [
              r.date || "—",
              r.account,
              r.voucher_no || "—",
              money(r.debit),
              money(r.credit),
            ])}
            headers={["Date", "Account", "Voucher", "Debit", "Credit"]}
          />
        </TabsContent>

        <TabsContent value="pl" className="space-y-3 pt-3">
          <Button disabled={busy} onClick={() => void loadPl()}>
            Run
          </Button>
          {pl ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 font-medium">Income · {money(pl.income_total)}</h3>
                <ReportTable
                  rows={(pl.income || []).map((r) => [r.account_name || r.account, money(r.amount)])}
                  headers={["Account", "Amount"]}
                />
              </div>
              <div>
                <h3 className="mb-2 font-medium">Expense · {money(pl.expense_total)}</h3>
                <ReportTable
                  rows={(pl.expense || []).map((r) => [r.account_name || r.account, money(r.amount)])}
                  headers={["Account", "Amount"]}
                />
              </div>
              <p className="text-lg font-semibold lg:col-span-2">
                Net profit: <span className="tabular-nums">{money(pl.net_profit)}</span>
              </p>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-muted)] text-left">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-[var(--color-muted-foreground)]" colSpan={headers.length}>
                Run the report to see rows.
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
