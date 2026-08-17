import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, Input, Label, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { enqueueCreate } from "@/lib/offline";
import {
  AdvancedPaymentFields,
  InvoiceAllocationEditor,
  PaymentsListSection,
  emptyInvoiceLine,
  selectClass,
  type CostCenter,
  type InvoiceLine,
  type PartyOption,
} from "@/components/payment-form-parts";

export function ReceiptPage() {
  const [search] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [customers, setCustomers] = useState<PartyOption[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [invoice, setInvoice] = useState(search.get("invoice") || "");
  const [amount, setAmount] = useState(search.get("invoice") ? search.get("amount") || "" : "");
  const [mode, setMode] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [project, setProject] = useState("");

  const [advance, setAdvance] = useState({ party: "", amount: "", mode: "", reference_no: "", cost_center: "", project: "" });
  const [advanceInvoices, setAdvanceInvoices] = useState<InvoiceLine[]>([emptyInvoiceLine()]);

  useEffect(() => {
    void callZatGoApi<CostCenter[]>(ZatGoApi.accounting.journalsListCostCenters, { page: 1, page_size: 100 })
      .then((env) => setCostCenters(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
    void callZatGoApi<PartyOption[]>(ZatGoApi.accounting.customersList, { page: 1, page_size: 200 })
      .then((env) => setCustomers(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
  }, []);

  const onReceive = async () => {
    if (!invoice.trim()) {
      toast.error("Customer invoice is required");
      return;
    }
    setBusy(true);
    try {
      await enqueueCreate({
        entityType: "payment_receive",
        method: ZatGoApi.accounting.paymentsCreateReceive,
        args: {
          sales_invoice: invoice.trim(),
          amount: amount ? Number(amount) : undefined,
          mode_of_payment: mode || undefined,
          cost_center: costCenter || undefined,
          project: project || undefined,
        },
      });
      toast.success("Receipt queued — syncing");
      setInvoice("");
      setAmount("");
      setReloadToken((t) => t + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Receive failed");
    } finally {
      setBusy(false);
    }
  };

  const onAdvance = async () => {
    if (!advance.party) {
      toast.error("Customer is required");
      return;
    }
    if (!advance.amount || Number(advance.amount) <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }
    const invoices = advanceInvoices
      .filter((l) => l.name.trim())
      .map((l) => ({ name: l.name.trim(), amount: l.amount ? Number(l.amount) : undefined }));
    setBusy(true);
    try {
      await enqueueCreate({
        entityType: "payment_receive_advance",
        method: ZatGoApi.accounting.paymentsCreateReceiveAdvance,
        args: {
          party: advance.party,
          amount: Number(advance.amount),
          mode_of_payment: advance.mode || undefined,
          reference_no: advance.reference_no || undefined,
          invoices: invoices.length ? invoices : undefined,
          cost_center: advance.cost_center || undefined,
          project: advance.project || undefined,
        },
      });
      toast.success(invoices.length ? "Receipt queued — syncing" : "On-account receipt queued — syncing");
      setAdvance({ party: "", amount: "", mode: "", reference_no: "", cost_center: "", project: "" });
      setAdvanceInvoices([emptyInvoiceLine()]);
      setReloadToken((t) => t + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Receipt failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Receipt" description="Money in — from a customer." />

      <Tabs defaultValue="invoice">
        <TabsList>
          <TabsTrigger value="invoice">Against invoice</TabsTrigger>
          <TabsTrigger value="account">On account</TabsTrigger>
        </TabsList>

        <TabsContent value="invoice" className="space-y-3 pt-3">
          <div className="grid max-w-xl gap-3">
            <div className="space-y-1">
              <Label htmlFor="si">Customer invoice</Label>
              <Input id="si" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ramt">Amount (optional)</Label>
              <Input id="ramt" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mop">Mode of payment (optional)</Label>
              <Input id="mop" value={mode} onChange={(e) => setMode(e.target.value)} placeholder="Cash / Bank…" />
            </div>
            <AdvancedPaymentFields
              idPrefix="r"
              show={showAdvanced}
              onToggle={() => setShowAdvanced((v) => !v)}
              costCenters={costCenters}
              costCenter={costCenter}
              onCostCenterChange={setCostCenter}
              project={project}
              onProjectChange={setProject}
            />
            <Button disabled={busy} onClick={() => void onReceive()}>
              Create receipt
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="account" className="space-y-3 pt-3">
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
                value={advance.party}
                onChange={(e) => setAdvance((f) => ({ ...f, party: e.target.value }))}
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
                value={advance.amount}
                onChange={(e) => setAdvance((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="armop">Mode of payment (optional)</Label>
              <Input
                id="armop"
                value={advance.mode}
                onChange={(e) => setAdvance((f) => ({ ...f, mode: e.target.value }))}
                placeholder="Cash / Bank…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="arref">Reference (optional)</Label>
              <Input
                id="arref"
                value={advance.reference_no}
                onChange={(e) => setAdvance((f) => ({ ...f, reference_no: e.target.value }))}
              />
            </div>
            <InvoiceAllocationEditor
              label="Allocate to invoices (optional)"
              lines={advanceInvoices}
              onChange={setAdvanceInvoices}
            />
            <AdvancedPaymentFields
              idPrefix="ar"
              show={showAdvanced}
              onToggle={() => setShowAdvanced((v) => !v)}
              costCenters={costCenters}
              costCenter={advance.cost_center}
              onCostCenterChange={(v) => setAdvance((f) => ({ ...f, cost_center: v }))}
              project={advance.project}
              onProjectChange={(v) => setAdvance((f) => ({ ...f, project: v }))}
            />
            <Button disabled={busy} onClick={() => void onAdvance()}>
              Create receipt
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <PaymentsListSection paymentType="Receive" searchPlaceholder="Search receipt # or customer…" reloadToken={reloadToken} />
    </div>
  );
}
