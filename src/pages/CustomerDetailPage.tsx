import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";

type Customer = {
  id: string;
  name: string;
  customer_name?: string;
  customer_type?: string;
  territory?: string;
  email?: string;
  phone?: string;
  customer_group?: string;
  disabled?: number;
};

type LedgerRow = {
  id: string;
  date?: string;
  account: string;
  voucher_type?: string;
  voucher_no?: string;
  debit: number;
  credit: number;
  balance: number;
};

type InvoiceRow = { id: string; name: string; status?: string; amount?: number; outstanding?: number; date?: string };
type PaymentRow = { id: string; name: string; amount?: number; date?: string; status?: string; docstatus?: number };

export function CustomerDetailPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName || "");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_type: "Company",
    email: "",
    phone: "",
    territory: "",
    customer_group: "",
  });

  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerMeta, setLedgerMeta] = useState<{ opening_balance?: number; closing_balance?: number }>({});
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [sales, setSales] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<Customer>(ZatGoApi.accounting.customersGet, { name });
      const row = (env.data as Customer) || null;
      if (!row) throw new Error("Customer not found");
      setForm({
        customer_name: row.customer_name || row.name || "",
        customer_type: row.customer_type || "Company",
        email: row.email || "",
        phone: row.phone || "",
        territory: row.territory || "",
        customer_group: row.customer_group || "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const loadLedger = async () => {
    setLedgerLoading(true);
    try {
      const env = await callZatGoApi<LedgerRow[]>(ZatGoApi.accounting.reportsPartyLedger, {
        party_type: "Customer",
        party: name,
        page_size: 200,
      });
      setLedger(Array.isArray(env.data) ? env.data : []);
      setLedgerMeta((env.meta as typeof ledgerMeta) || {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load ledger");
    } finally {
      setLedgerLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const [invEnv, payEnv] = await Promise.all([
        callZatGoApi<InvoiceRow[]>(ZatGoApi.accounting.invoicesList, { customer: name, page_size: 100 }),
        callZatGoApi<PaymentRow[]>(ZatGoApi.accounting.paymentsList, {
          party_type: "Customer",
          party: name,
          page_size: 100,
        }),
      ]);
      setSales(Array.isArray(invEnv.data) ? invEnv.data : []);
      setPayments(Array.isArray(payEnv.data) ? payEnv.data : []);
    } catch {
      // Non-fatal — the tabs show their own empty state.
    }
  };

  useEffect(() => {
    void load();
    void loadLedger();
    void loadHistory();
  }, [name]);

  const onSave = async () => {
    setBusy(true);
    try {
      await callZatGoApi(ZatGoApi.accounting.customersUpdate, {
        name,
        values: {
          customer_name: form.customer_name,
          customer_type: form.customer_type,
          email: form.email || undefined,
          phone: form.phone || undefined,
          territory: form.territory || undefined,
          customer_group: form.customer_group || undefined,
        },
      });
      toast.success("Customer updated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const onDisable = async () => {
    setBusy(true);
    try {
      await callZatGoApi(ZatGoApi.accounting.customersUpdate, {
        name,
        values: { disabled: 1 },
      });
      toast.success("Customer disabled");
      navigate("/customers");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Disable failed");
    } finally {
      setBusy(false);
    }
  };

  const ledgerColumns = useMemo<ColumnDef<LedgerRow>[]>(
    () => [
      { header: "Date", accessorKey: "date" },
      { header: "Voucher", cell: ({ row }) => `${row.original.voucher_type || ""} ${row.original.voucher_no || ""}` },
      { header: "Debit", cell: ({ row }) => <span className="tabular-nums">{money(row.original.debit)}</span> },
      { header: "Credit", cell: ({ row }) => <span className="tabular-nums">{money(row.original.credit)}</span> },
      { header: "Balance", cell: ({ row }) => <span className="tabular-nums font-medium">{money(row.original.balance)}</span> },
    ],
    [],
  );

  const salesColumns = useMemo<ColumnDef<InvoiceRow>[]>(
    () => [
      {
        header: "Invoice",
        cell: ({ row }) => (
          <Link className="font-medium underline-offset-2 hover:underline" to={`/invoices/${encodeURIComponent(row.original.name)}`}>
            {row.original.name}
          </Link>
        ),
      },
      { header: "Date", accessorKey: "date" },
      { header: "Status", accessorKey: "status" },
      { header: "Amount", cell: ({ row }) => <span className="tabular-nums">{money(row.original.amount)}</span> },
      { header: "Outstanding", cell: ({ row }) => <span className="tabular-nums">{money(row.original.outstanding)}</span> },
    ],
    [],
  );

  const paymentColumns = useMemo<ColumnDef<PaymentRow>[]>(
    () => [
      { header: "Payment", accessorKey: "name" },
      { header: "Date", accessorKey: "date" },
      { header: "Amount", cell: ({ row }) => <span className="tabular-nums">{money(row.original.amount)}</span> },
      { header: "Status", cell: ({ row }) => (row.original.docstatus === 1 ? "Submitted" : row.original.status || "Draft") },
    ],
    [],
  );

  if (loading) return <LoadingState label="Loading customer…" />;
  if (error) return <ErrorState title="Customer unavailable" description={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={form.customer_name || name}
        description="Customer record, ledger, and history"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/customers">Back</Link>
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void onDisable()}>
              Disable
            </Button>
            <Button disabled={busy} onClick={() => void onSave()}>
              Save
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="sales">Sales history</TabsTrigger>
          <TabsTrigger value="payments">Payment history</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-4">
          <div className="grid max-w-xl gap-3">
            <div className="space-y-1">
              <Label htmlFor="cname">Name</Label>
              <Input id="cname" value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ctype">Type</Label>
              <Input id="ctype" value={form.customer_type} onChange={(e) => setForm((f) => ({ ...f, customer_type: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cemail">Email</Label>
              <Input id="cemail" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cphone">Phone</Label>
              <Input id="cphone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cterr">Territory</Label>
              <Input id="cterr" value={form.territory} onChange={(e) => setForm((f) => ({ ...f, territory: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cgroup">Group</Label>
              <Input id="cgroup" value={form.customer_group} onChange={(e) => setForm((f) => ({ ...f, customer_group: e.target.value }))} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ledger" className="space-y-3 pt-4">
          {ledgerLoading ? (
            <LoadingState label="Loading ledger…" />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 sm:max-w-md">
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                  <p className="text-xs text-[var(--color-muted-foreground)]">Opening balance</p>
                  <p className="text-lg font-semibold tabular-nums">{money(ledgerMeta.opening_balance)}</p>
                </div>
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                  <p className="text-xs text-[var(--color-muted-foreground)]">Closing balance</p>
                  <p className="text-lg font-semibold tabular-nums">{money(ledgerMeta.closing_balance)}</p>
                </div>
              </div>
              <DataTable data={ledger} columns={ledgerColumns} emptyMessage="No ledger entries in range." />
            </>
          )}
        </TabsContent>

        <TabsContent value="sales" className="pt-4">
          <DataTable data={sales} columns={salesColumns} emptyMessage="No sales invoices yet." />
        </TabsContent>

        <TabsContent value="payments" className="pt-4">
          <DataTable data={payments} columns={paymentColumns} emptyMessage="No payments yet." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
