import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { enqueueCreate } from "@/lib/offline";
import { money } from "@/lib/format";
import { ListToolbar } from "@/components/ListToolbar";

type Payment = {
  id: string;
  name: string;
  payment_type?: string;
  party?: string;
  amount?: number;
  date?: string;
  status?: string;
  docstatus?: number;
};

type AccountOption = { id: string; name: string; account_name?: string };
type PartyOption = { id: string; name: string; customer_name?: string; supplier_name?: string };
type InvoiceLine = { name: string; amount: string };

const emptyInvoiceLine = (): InvoiceLine => ({ name: "", amount: "" });

const selectClass =
  "h-10 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-transparent px-3 text-sm";

export function PaymentsPage() {
  const [search] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Payment[]>([]);
  const [busy, setBusy] = useState(false);
  const [receiveInvoice, setReceiveInvoice] = useState(search.get("receive") || "");
  const [payInvoice, setPayInvoice] = useState(search.get("pay") || "");
  const [receiveAmount, setReceiveAmount] = useState(search.get("receive") ? search.get("amount") || "" : "");
  const [payAmount, setPayAmount] = useState(search.get("pay") ? search.get("amount") || "" : "");
  const [mode, setMode] = useState("");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [contra, setContra] = useState({ from_account: "", to_account: "", amount: "", reference_no: "", remarks: "" });
  const [customers, setCustomers] = useState<PartyOption[]>([]);
  const [suppliers, setSuppliers] = useState<PartyOption[]>([]);
  const [advanceReceive, setAdvanceReceive] = useState({ party: "", amount: "", mode: "", reference_no: "" });
  const [advanceReceiveInvoices, setAdvanceReceiveInvoices] = useState<InvoiceLine[]>([emptyInvoiceLine()]);
  const [advancePay, setAdvancePay] = useState({ party: "", amount: "", mode: "", reference_no: "" });
  const [advancePayInvoices, setAdvancePayInvoices] = useState<InvoiceLine[]>([emptyInvoiceLine()]);
  const [listSearch, setListSearch] = useState("");
  const [listFromDate, setListFromDate] = useState("");
  const [listToDate, setListToDate] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<Payment[]>(ZatGoApi.accounting.paymentsList, {
        page: 1,
        page_size: 100,
      });
      setRows(Array.isArray(env.data) ? env.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void callZatGoApi<AccountOption[]>(ZatGoApi.accounting.journalsListAccounts, { page: 1, page_size: 100 })
      .then((env) => setAccounts(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
    void callZatGoApi<PartyOption[]>(ZatGoApi.accounting.customersList, { page: 1, page_size: 200 })
      .then((env) => setCustomers(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
    void callZatGoApi<PartyOption[]>(ZatGoApi.accounting.suppliersList, { page: 1, page_size: 200 })
      .then((env) => setSuppliers(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
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

  const columns = useMemo<ColumnDef<Payment>[]>(
    () => [
      { header: "Payment", accessorKey: "name" },
      { header: "Type", accessorKey: "payment_type" },
      { header: "Party", accessorKey: "party" },
      {
        header: "Amount",
        cell: ({ row }) => <span className="tabular-nums">{money(row.original.amount)}</span>,
      },
      { header: "Date", accessorKey: "date" },
      {
        header: "Status",
        cell: ({ row }) =>
          row.original.docstatus === 1 ? "Submitted" : row.original.status || "Draft",
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

  const onReceive = async () => {
    if (!receiveInvoice.trim()) {
      toast.error("Customer invoice is required");
      return;
    }
    setBusy(true);
    try {
      await enqueueCreate({
        entityType: "payment_receive",
        method: ZatGoApi.accounting.paymentsCreateReceive,
        args: {
          sales_invoice: receiveInvoice.trim(),
          amount: receiveAmount ? Number(receiveAmount) : undefined,
          mode_of_payment: mode || undefined,
        },
      });
      toast.success("Payment queued — syncing");
      setReceiveInvoice("");
      setReceiveAmount("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Receive failed");
    } finally {
      setBusy(false);
    }
  };

  const onPay = async () => {
    if (!payInvoice.trim()) {
      toast.error("Bill is required");
      return;
    }
    setBusy(true);
    try {
      await enqueueCreate({
        entityType: "payment_pay",
        method: ZatGoApi.accounting.paymentsCreatePay,
        args: {
          purchase_invoice: payInvoice.trim(),
          amount: payAmount ? Number(payAmount) : undefined,
          mode_of_payment: mode || undefined,
        },
      });
      toast.success("Payment queued — syncing");
      setPayInvoice("");
      setPayAmount("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pay failed");
    } finally {
      setBusy(false);
    }
  };

  const onAdvanceReceive = async () => {
    if (!advanceReceive.party) {
      toast.error("Customer is required");
      return;
    }
    if (!advanceReceive.amount || Number(advanceReceive.amount) <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }
    const invoices = advanceReceiveInvoices
      .filter((l) => l.name.trim())
      .map((l) => ({ name: l.name.trim(), amount: l.amount ? Number(l.amount) : undefined }));
    setBusy(true);
    try {
      await enqueueCreate({
        entityType: "payment_receive_advance",
        method: ZatGoApi.accounting.paymentsCreateReceiveAdvance,
        args: {
          party: advanceReceive.party,
          amount: Number(advanceReceive.amount),
          mode_of_payment: advanceReceive.mode || undefined,
          reference_no: advanceReceive.reference_no || undefined,
          invoices: invoices.length ? invoices : undefined,
        },
      });
      toast.success(invoices.length ? "Receipt queued — syncing" : "On-account receipt queued — syncing");
      setAdvanceReceive({ party: "", amount: "", mode: "", reference_no: "" });
      setAdvanceReceiveInvoices([emptyInvoiceLine()]);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Receipt failed");
    } finally {
      setBusy(false);
    }
  };

  const onAdvancePay = async () => {
    if (!advancePay.party) {
      toast.error("Supplier is required");
      return;
    }
    if (!advancePay.amount || Number(advancePay.amount) <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }
    const invoices = advancePayInvoices
      .filter((l) => l.name.trim())
      .map((l) => ({ name: l.name.trim(), amount: l.amount ? Number(l.amount) : undefined }));
    setBusy(true);
    try {
      await enqueueCreate({
        entityType: "payment_pay_advance",
        method: ZatGoApi.accounting.paymentsCreatePayAdvance,
        args: {
          party: advancePay.party,
          amount: Number(advancePay.amount),
          mode_of_payment: advancePay.mode || undefined,
          reference_no: advancePay.reference_no || undefined,
          invoices: invoices.length ? invoices : undefined,
        },
      });
      toast.success(invoices.length ? "Payment queued — syncing" : "On-account payment queued — syncing");
      setAdvancePay({ party: "", amount: "", mode: "", reference_no: "" });
      setAdvancePayInvoices([emptyInvoiceLine()]);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  const onContra = async () => {
    if (!contra.from_account || !contra.to_account) {
      toast.error("From and To accounts are required");
      return;
    }
    if (contra.from_account === contra.to_account) {
      toast.error("From and To accounts cannot be the same");
      return;
    }
    if (!contra.amount || Number(contra.amount) <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }
    setBusy(true);
    try {
      await enqueueCreate({
        entityType: "payment_contra",
        method: ZatGoApi.accounting.paymentsCreateContra,
        args: {
          from_account: contra.from_account,
          to_account: contra.to_account,
          amount: Number(contra.amount),
          reference_no: contra.reference_no || undefined,
          remarks: contra.remarks || undefined,
        },
      });
      toast.success("Contra entry queued — syncing");
      setContra({ from_account: "", to_account: "", amount: "", reference_no: "", remarks: "" });
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
      if (q) {
        const haystack = `${r.name} ${r.party ?? ""} ${r.payment_type ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (listFromDate && (!r.date || r.date < listFromDate)) return false;
      if (listToDate && (!r.date || r.date > listToDate)) return false;
      return true;
    });
  }, [rows, listSearch, listFromDate, listToDate]);

  if (loading) return <LoadingState label="Loading payments…" />;
  if (error) return <ErrorState title="Payments unavailable" description={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Receive from customers or pay suppliers."
        actions={
          <Button variant="outline" asChild>
            <Link to="/reports">View outstanding</Link>
          </Button>
        }
      />

      <Tabs defaultValue={search.get("pay") ? "pay" : "receive"}>
        <TabsList>
          <TabsTrigger value="receive">Receive payment</TabsTrigger>
          <TabsTrigger value="pay">Pay bill</TabsTrigger>
          <TabsTrigger value="receive-advance">Receipt (on account)</TabsTrigger>
          <TabsTrigger value="pay-advance">Payment (on account)</TabsTrigger>
          <TabsTrigger value="contra">Contra (transfer)</TabsTrigger>
        </TabsList>
        <TabsContent value="receive" className="space-y-3 pt-3">
          <div className="grid max-w-xl gap-3">
            <div className="space-y-1">
              <Label htmlFor="si">Customer invoice</Label>
              <Input id="si" value={receiveInvoice} onChange={(e) => setReceiveInvoice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ramt">Amount (optional)</Label>
              <Input
                id="ramt"
                type="number"
                value={receiveAmount}
                onChange={(e) => setReceiveAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mop">Mode of payment (optional)</Label>
              <Input id="mop" value={mode} onChange={(e) => setMode(e.target.value)} placeholder="Cash / Bank…" />
            </div>
            <Button disabled={busy} onClick={() => void onReceive()}>
              Create receive payment
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="pay" className="space-y-3 pt-3">
          <div className="grid max-w-xl gap-3">
            <div className="space-y-1">
              <Label htmlFor="pi">Bill</Label>
              <Input id="pi" value={payInvoice} onChange={(e) => setPayInvoice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pamt">Amount (optional)</Label>
              <Input id="pamt" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <Button disabled={busy} onClick={() => void onPay()}>
              Create pay payment
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="receive-advance" className="space-y-3 pt-3">
          <div className="grid max-w-xl gap-3">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Receive from a customer without one specific invoice — leave the allocation rows empty for a pure
              on-account/advance receipt, or fill them in to split this receipt across several invoices.
            </p>
            <div className="space-y-1">
              <Label htmlFor="arparty">Customer</Label>
              <select
                id="arparty"
                className={selectClass}
                value={advanceReceive.party}
                onChange={(e) => setAdvanceReceive((f) => ({ ...f, party: e.target.value }))}
              >
                <option value="">Select…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_name || c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="aramt">Amount</Label>
              <Input
                id="aramt"
                type="number"
                value={advanceReceive.amount}
                onChange={(e) => setAdvanceReceive((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="armop">Mode of payment (optional)</Label>
              <Input
                id="armop"
                value={advanceReceive.mode}
                onChange={(e) => setAdvanceReceive((f) => ({ ...f, mode: e.target.value }))}
                placeholder="Cash / Bank…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="arref">Reference (optional)</Label>
              <Input
                id="arref"
                value={advanceReceive.reference_no}
                onChange={(e) => setAdvanceReceive((f) => ({ ...f, reference_no: e.target.value }))}
              />
            </div>
            <InvoiceAllocationEditor
              label="Allocate to invoices (optional)"
              lines={advanceReceiveInvoices}
              onChange={setAdvanceReceiveInvoices}
            />
            <Button disabled={busy} onClick={() => void onAdvanceReceive()}>
              Create receipt
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="pay-advance" className="space-y-3 pt-3">
          <div className="grid max-w-xl gap-3">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Pay a supplier without one specific bill — leave the allocation rows empty for a pure on-account/advance
              payment, or fill them in to split this payment across several bills.
            </p>
            <div className="space-y-1">
              <Label htmlFor="apparty">Supplier</Label>
              <select
                id="apparty"
                className={selectClass}
                value={advancePay.party}
                onChange={(e) => setAdvancePay((f) => ({ ...f, party: e.target.value }))}
              >
                <option value="">Select…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.supplier_name || s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="apamt">Amount</Label>
              <Input
                id="apamt"
                type="number"
                value={advancePay.amount}
                onChange={(e) => setAdvancePay((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="apmop">Mode of payment (optional)</Label>
              <Input
                id="apmop"
                value={advancePay.mode}
                onChange={(e) => setAdvancePay((f) => ({ ...f, mode: e.target.value }))}
                placeholder="Cash / Bank…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="apref">Reference (optional)</Label>
              <Input
                id="apref"
                value={advancePay.reference_no}
                onChange={(e) => setAdvancePay((f) => ({ ...f, reference_no: e.target.value }))}
              />
            </div>
            <InvoiceAllocationEditor
              label="Allocate to bills (optional)"
              lines={advancePayInvoices}
              onChange={setAdvancePayInvoices}
            />
            <Button disabled={busy} onClick={() => void onAdvancePay()}>
              Create payment
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="contra" className="space-y-3 pt-3">
          <div className="grid max-w-xl gap-3">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Move funds between your own cash/bank accounts — e.g. depositing cash into a bank account.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="cfrom">From account</Label>
                <select
                  id="cfrom"
                  className={selectClass}
                  value={contra.from_account}
                  onChange={(e) => setContra((c) => ({ ...c, from_account: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_name || a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cto">To account</Label>
                <select
                  id="cto"
                  className={selectClass}
                  value={contra.to_account}
                  onChange={(e) => setContra((c) => ({ ...c, to_account: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_name || a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="camt">Amount</Label>
              <Input id="camt" type="number" value={contra.amount} onChange={(e) => setContra((c) => ({ ...c, amount: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cref">Reference (optional)</Label>
              <Input id="cref" value={contra.reference_no} onChange={(e) => setContra((c) => ({ ...c, reference_no: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="crem">Remarks (optional)</Label>
              <Input id="crem" value={contra.remarks} onChange={(e) => setContra((c) => ({ ...c, remarks: e.target.value }))} />
            </div>
            <Button disabled={busy} onClick={() => void onContra()}>
              Create contra entry
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <ListToolbar
        search={listSearch}
        onSearchChange={setListSearch}
        searchPlaceholder="Search payment # or party…"
        fromDate={listFromDate}
        onFromDateChange={setListFromDate}
        toDate={listToDate}
        onToDateChange={setListToDate}
      />
      <DataTable data={filteredRows} columns={columns} emptyMessage="No payments match." pageSize={15} />
    </div>
  );
}

function InvoiceAllocationEditor({
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
            onChange={(e) =>
              onChange(lines.map((l, i) => (i === idx ? { ...l, name: e.target.value } : l)))
            }
          />
          <Input
            type="number"
            placeholder="Amount (optional)"
            value={line.amount}
            onChange={(e) =>
              onChange(lines.map((l, i) => (i === idx ? { ...l, amount: e.target.value } : l)))
            }
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
