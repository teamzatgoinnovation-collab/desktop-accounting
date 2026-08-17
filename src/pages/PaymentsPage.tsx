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
