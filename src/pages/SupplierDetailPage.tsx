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

type Supplier = {
  id: string;
  name: string;
  supplier_name?: string;
  supplier_type?: string;
  supplier_group?: string;
  email?: string;
  phone?: string;
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

type BillRow = { id: string; name: string; status?: string; amount?: number; outstanding?: number; date?: string };
type PaymentRow = { id: string; name: string; amount?: number; date?: string; status?: string; docstatus?: number };

export function SupplierDetailPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName || "");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    supplier_name: "",
    supplier_type: "Company",
    email: "",
    phone: "",
    supplier_group: "",
  });

  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerMeta, setLedgerMeta] = useState<{ opening_balance?: number; closing_balance?: number }>({});
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [purchases, setPurchases] = useState<BillRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<Supplier>(ZatGoApi.accounting.suppliersGet, { name });
      const row = (env.data as Supplier) || null;
      if (!row) throw new Error("Supplier not found");
      setForm({
        supplier_name: row.supplier_name || row.name || "",
        supplier_type: row.supplier_type || "Company",
        email: row.email || "",
        phone: row.phone || "",
        supplier_group: row.supplier_group || "",
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
        party_type: "Supplier",
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
      const [purEnv, payEnv] = await Promise.all([
        callZatGoApi<BillRow[]>(ZatGoApi.accounting.purchaseInvoicesList, { supplier: name, page_size: 100 }),
        callZatGoApi<PaymentRow[]>(ZatGoApi.accounting.paymentsList, {
          party_type: "Supplier",
          party: name,
          page_size: 100,
        }),
      ]);
      setPurchases(Array.isArray(purEnv.data) ? purEnv.data : []);
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
      await callZatGoApi(ZatGoApi.accounting.suppliersUpdate, {
        name,
        values: {
          supplier_name: form.supplier_name,
          supplier_type: form.supplier_type,
          email: form.email || undefined,
          phone: form.phone || undefined,
          supplier_group: form.supplier_group || undefined,
        },
      });
      toast.success("Supplier updated");
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
      await callZatGoApi(ZatGoApi.accounting.suppliersUpdate, {
        name,
        values: { disabled: 1 },
      });
      toast.success("Supplier disabled");
      navigate("/suppliers");
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

  const purchaseColumns = useMemo<ColumnDef<BillRow>[]>(
    () => [
      {
        header: "Bill",
        cell: ({ row }) => (
          <Link className="font-medium underline-offset-2 hover:underline" to={`/bills/${encodeURIComponent(row.original.name)}`}>
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

  if (loading) return <LoadingState label="Loading supplier…" />;
  if (error) return <ErrorState title="Supplier unavailable" description={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={form.supplier_name || name}
        description="Supplier record, ledger, and history"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/suppliers">Back</Link>
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void onDisable()}>
              Disable
            </Button>
            <Button asChild variant="outline">
              <Link to={`/bills/new?supplier=${encodeURIComponent(name)}`}>New bill</Link>
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
          <TabsTrigger value="purchases">Purchase history</TabsTrigger>
          <TabsTrigger value="payments">Payment history</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-4">
          <div className="grid max-w-xl gap-3">
            <div className="space-y-1">
              <Label htmlFor="sname">Name</Label>
              <Input id="sname" value={form.supplier_name} onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stype">Type</Label>
              <Input id="stype" value={form.supplier_type} onChange={(e) => setForm((f) => ({ ...f, supplier_type: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="semail">Email</Label>
              <Input id="semail" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sphone">Phone</Label>
              <Input id="sphone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sgroup">Group</Label>
              <Input id="sgroup" value={form.supplier_group} onChange={(e) => setForm((f) => ({ ...f, supplier_group: e.target.value }))} />
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

        <TabsContent value="purchases" className="pt-4">
          <DataTable data={purchases} columns={purchaseColumns} emptyMessage="No purchase invoices yet." />
        </TabsContent>

        <TabsContent value="payments" className="pt-4">
          <DataTable data={payments} columns={paymentColumns} emptyMessage="No payments yet." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
