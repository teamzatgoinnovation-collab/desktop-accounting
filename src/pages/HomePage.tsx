import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ZatGoApi } from "@zatgo/erpnext";
import {
  Button,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
} from "@zatgo/ui";
import { FileText, Package, Receipt, Wallet } from "@zatgo/icons";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";

type Aging = {
  bucket_0_30?: number;
  bucket_31_60?: number;
  bucket_61_90?: number;
  bucket_90_plus?: number;
};

type OpenRow = {
  id: string;
  name: string;
  party: string;
  outstanding: number;
  due_date?: string | null;
};

type RecentInvoice = {
  id: string;
  name: string;
  party: string;
  status: string;
  amount: number;
  date?: string | null;
};

type DashboardData = {
  ar_open?: number;
  ap_open?: number;
  ar_overdue?: number;
  ap_overdue?: number;
  sales_invoice_count?: number;
  purchase_invoice_count?: number;
  ar_aging?: Aging;
  ap_aging?: Aging;
  open_receivables?: OpenRow[];
  open_payables?: OpenRow[];
  recent_sales_invoices?: RecentInvoice[];
};

const chartStroke = "var(--color-border)";
const chartMuted = "var(--color-muted-foreground)";
const colorPrimary = "var(--color-primary)";
const colorAccent = "var(--color-chart-2, var(--color-secondary, #64748b))";
const colorOverdue = "var(--color-destructive, #b45309)";

function agingBars(aging: Aging | undefined, label: string) {
  const a = aging || {};
  return [
    { bucket: "0–30", [label]: Number(a.bucket_0_30 || 0) },
    { bucket: "31–60", [label]: Number(a.bucket_31_60 || 0) },
    { bucket: "61–90", [label]: Number(a.bucket_61_90 || 0) },
    { bucket: "90+", [label]: Number(a.bucket_90_plus || 0) },
  ];
}

export function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [warehouseCount, setWarehouseCount] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      await callZatGoApi(ZatGoApi.accounting.ping).catch(() => undefined);
      const env = await callZatGoApi<DashboardData>(ZatGoApi.accounting.dashboardSummary);
      setData((env.data as DashboardData) || {});
      try {
        const wh = await callZatGoApi<{ count?: number }>(ZatGoApi.warehouse.status);
        setWarehouseCount(typeof wh.data?.count === "number" ? wh.data.count : null);
      } catch {
        setWarehouseCount(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const arApChart = useMemo(
    () => [
      {
        name: "Receivable",
        Open: Number(data?.ar_open || 0),
        Overdue: Number(data?.ar_overdue || 0),
      },
      {
        name: "Payable",
        Open: Number(data?.ap_open || 0),
        Overdue: Number(data?.ap_overdue || 0),
      },
    ],
    [data],
  );

  const agingChart = useMemo(() => {
    const ar = agingBars(data?.ar_aging, "AR");
    const ap = agingBars(data?.ap_aging, "AP");
    return ar.map((row, i) => ({
      bucket: row.bucket,
      AR: row.AR as number,
      AP: (ap[i]?.AP as number) || 0,
    }));
  }, [data]);

  const topReceivables = useMemo(
    () =>
      (data?.open_receivables || []).slice(0, 8).map((r) => ({
        name: r.party || r.name,
        outstanding: Number(r.outstanding || 0),
      })),
    [data],
  );

  if (loading) return <LoadingState label="Loading dashboard…" />;
  if (error) {
    return <ErrorState title="Dashboard unavailable" description={error} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Money in, money out — with aging and inventory at a glance."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard title="AR open" value={money(data?.ar_open)} icon={FileText} />
        <StatCard title="AP open" value={money(data?.ap_open)} icon={Receipt} />
        <StatCard title="AR overdue" value={money(data?.ar_overdue)} icon={Wallet} />
        <StatCard title="AP overdue" value={money(data?.ap_overdue)} icon={Wallet} />
        <StatCard title="Sales invoices" value={String(data?.sales_invoice_count ?? 0)} icon={FileText} />
        <StatCard title="Purchase invoices" value={String(data?.purchase_invoice_count ?? 0)} icon={Receipt} />
      </div>

      {warehouseCount != null ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard title="Warehouses" value={String(warehouseCount)} icon={Package} />
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 xl:col-span-1">
          <h2 className="mb-3 text-sm font-medium">AR vs AP</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={arApChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={chartStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: chartMuted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: chartMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Legend />
                <Bar dataKey="Open" fill={colorPrimary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Overdue" fill={colorOverdue} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 xl:col-span-1">
          <h2 className="mb-3 text-sm font-medium">Aging (days past due)</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={chartStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fill: chartMuted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: chartMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Legend />
                <Bar dataKey="AR" fill={colorPrimary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="AP" fill={colorAccent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 xl:col-span-1">
          <h2 className="mb-3 text-sm font-medium">Top open receivables</h2>
          <div className="h-56">
            {topReceivables.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-[var(--color-muted-foreground)]">
                Nothing outstanding.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={topReceivables}
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid stroke={chartStroke} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: chartMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={88}
                    tick={{ fill: chartMuted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Bar dataKey="outstanding" fill={colorPrimary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Open receivables</h2>
          <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
            {(data?.open_receivables || []).length === 0 ? (
              <li className="px-4 py-6 text-sm text-[var(--color-muted-foreground)]">Nothing outstanding.</li>
            ) : (
              (data?.open_receivables || []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <Link className="font-medium underline-offset-2 hover:underline" to="/invoices">
                      {r.name}
                    </Link>
                    <p className="text-[var(--color-muted-foreground)]">{r.party}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p>{money(r.outstanding)}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">{r.due_date || "—"}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Open payables</h2>
          <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
            {(data?.open_payables || []).length === 0 ? (
              <li className="px-4 py-6 text-sm text-[var(--color-muted-foreground)]">Nothing outstanding.</li>
            ) : (
              (data?.open_payables || []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-[var(--color-muted-foreground)]">{r.party}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p>{money(r.outstanding)}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">{r.due_date || "—"}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Recent sales invoices</h2>
        <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          {(data?.recent_sales_invoices || []).length === 0 ? (
            <li className="px-4 py-6 text-sm text-[var(--color-muted-foreground)]">No recent invoices.</li>
          ) : (
            (data?.recent_sales_invoices || []).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <Link className="font-medium underline-offset-2 hover:underline" to="/invoices">
                    {r.name}
                  </Link>
                  <p className="text-[var(--color-muted-foreground)]">
                    {r.party} · {r.status}
                    {r.date ? ` · ${r.date}` : ""}
                  </p>
                </div>
                <p className="tabular-nums">{money(r.amount)}</p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
