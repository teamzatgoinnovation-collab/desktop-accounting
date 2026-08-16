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
      </Tabs>

      <DataTable data={rows} columns={columns} emptyMessage="No payments yet." />
    </div>
  );
}
