import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, Input, Label, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { enqueueCreate } from "@/lib/offline";
import {
  AdvancedPaymentFields,
  InvoiceAllocationEditor,
  PaymentsListSection,
  SplitAccountLinesEditor,
  emptyInvoiceLine,
  emptySplitLine,
  selectClass,
  type AccountOption,
  type CostCenter,
  type InvoiceLine,
  type PartyOption,
  type SplitLine,
} from "@/components/payment-form-parts";

export function PaymentPage() {
  const [search] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [suppliers, setSuppliers] = useState<PartyOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [invoice, setInvoice] = useState(search.get("invoice") || "");
  const [amount, setAmount] = useState(search.get("invoice") ? search.get("amount") || "" : "");
  const [mode, setMode] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [project, setProject] = useState("");

  const [advance, setAdvance] = useState({ party: "", amount: "", mode: "", reference_no: "", cost_center: "", project: "" });
  const [advanceInvoices, setAdvanceInvoices] = useState<InvoiceLine[]>([emptyInvoiceLine()]);

  const [split, setSplit] = useState({ party: "", reference_no: "", remarks: "", cost_center: "" });
  const [splitLines, setSplitLines] = useState<SplitLine[]>([emptySplitLine(), emptySplitLine()]);

  useEffect(() => {
    void callZatGoApi<CostCenter[]>(ZatGoApi.accounting.journalsListCostCenters, { page: 1, page_size: 100 })
      .then((env) => setCostCenters(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
    void callZatGoApi<PartyOption[]>(ZatGoApi.accounting.suppliersList, { page: 1, page_size: 200 })
      .then((env) => setSuppliers(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
    void callZatGoApi<AccountOption[]>(ZatGoApi.accounting.journalsListAccounts, { page: 1, page_size: 100 })
      .then((env) => setAccounts(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
  }, []);

  const onPay = async () => {
    if (!invoice.trim()) {
      toast.error("Bill is required");
      return;
    }
    setBusy(true);
    try {
      await enqueueCreate({
        entityType: "payment_pay",
        method: ZatGoApi.accounting.paymentsCreatePay,
        args: {
          purchase_invoice: invoice.trim(),
          amount: amount ? Number(amount) : undefined,
          mode_of_payment: mode || undefined,
          cost_center: costCenter || undefined,
          project: project || undefined,
        },
      });
      toast.success("Payment queued — syncing");
      setInvoice("");
      setAmount("");
      setReloadToken((t) => t + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pay failed");
    } finally {
      setBusy(false);
    }
  };

  const onAdvance = async () => {
    if (!advance.party) {
      toast.error("Supplier is required");
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
        entityType: "payment_pay_advance",
        method: ZatGoApi.accounting.paymentsCreatePayAdvance,
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
      toast.success(invoices.length ? "Payment queued — syncing" : "On-account payment queued — syncing");
      setAdvance({ party: "", amount: "", mode: "", reference_no: "", cost_center: "", project: "" });
      setAdvanceInvoices([emptyInvoiceLine()]);
      setReloadToken((t) => t + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  const onSplit = async () => {
    if (!split.party) {
      toast.error("Supplier is required");
      return;
    }
    const lines = splitLines
      .filter((l) => l.account && Number(l.amount) > 0)
      .map((l) => ({ account: l.account, amount: Number(l.amount) }));
    if (lines.length < 1) {
      toast.error("Add at least one account with an amount");
      return;
    }
    setBusy(true);
    try {
      await enqueueCreate({
        entityType: "payment_split",
        method: ZatGoApi.accounting.journalsCreateSplitPay,
        args: {
          party: split.party,
          lines,
          reference_no: split.reference_no || undefined,
          remarks: split.remarks || undefined,
          cost_center: split.cost_center || undefined,
        },
      });
      toast.success("Split payment queued — syncing");
      setSplit({ party: "", reference_no: "", remarks: "", cost_center: "" });
      setSplitLines([emptySplitLine(), emptySplitLine()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Split payment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Payment" description="Money out — to a supplier." />

      <Tabs defaultValue="invoice">
        <TabsList>
          <TabsTrigger value="invoice">Against bill</TabsTrigger>
          <TabsTrigger value="account">On account</TabsTrigger>
          <TabsTrigger value="split">Split across accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="invoice" className="space-y-3 pt-3">
          <div className="grid max-w-xl gap-3">
            <div className="space-y-1">
              <Label htmlFor="pi">Bill</Label>
              <Input id="pi" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pamt">Amount (optional)</Label>
              <Input id="pamt" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pmop">Mode of payment (optional)</Label>
              <Input id="pmop" value={mode} onChange={(e) => setMode(e.target.value)} placeholder="Cash / Bank…" />
            </div>
            <AdvancedPaymentFields
              idPrefix="p"
              show={showAdvanced}
              onToggle={() => setShowAdvanced((v) => !v)}
              costCenters={costCenters}
              costCenter={costCenter}
              onCostCenterChange={setCostCenter}
              project={project}
              onProjectChange={setProject}
            />
            <Button disabled={busy} onClick={() => void onPay()}>
              Create payment
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="account" className="space-y-3 pt-3">
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
                value={advance.party}
                onChange={(e) => setAdvance((f) => ({ ...f, party: e.target.value }))}
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
                value={advance.amount}
                onChange={(e) => setAdvance((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="apmop">Mode of payment (optional)</Label>
              <Input
                id="apmop"
                value={advance.mode}
                onChange={(e) => setAdvance((f) => ({ ...f, mode: e.target.value }))}
                placeholder="Cash / Bank…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="apref">Reference (optional)</Label>
              <Input
                id="apref"
                value={advance.reference_no}
                onChange={(e) => setAdvance((f) => ({ ...f, reference_no: e.target.value }))}
              />
            </div>
            <InvoiceAllocationEditor
              label="Allocate to bills (optional)"
              lines={advanceInvoices}
              onChange={setAdvanceInvoices}
            />
            <AdvancedPaymentFields
              idPrefix="ap"
              show={showAdvanced}
              onToggle={() => setShowAdvanced((v) => !v)}
              costCenters={costCenters}
              costCenter={advance.cost_center}
              onCostCenterChange={(v) => setAdvance((f) => ({ ...f, cost_center: v }))}
              project={advance.project}
              onProjectChange={(v) => setAdvance((f) => ({ ...f, project: v }))}
            />
            <Button disabled={busy} onClick={() => void onAdvance()}>
              Create payment
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="split" className="space-y-3 pt-3">
          <div className="grid max-w-xl gap-3">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Pay one supplier split across more than one cash/bank account — e.g. part cash, part card. Posts as a
              Journal Entry against the supplier's payable account (visible in Journals, not this list).
            </p>
            <div className="space-y-1">
              <Label htmlFor="spparty">Supplier</Label>
              <select
                id="spparty"
                className={selectClass}
                value={split.party}
                onChange={(e) => setSplit((f) => ({ ...f, party: e.target.value }))}
              >
                <option value="">Select…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.supplier_name || s.name}
                  </option>
                ))}
              </select>
            </div>
            <SplitAccountLinesEditor accounts={accounts} lines={splitLines} onChange={setSplitLines} />
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="spref">Reference (optional)</Label>
                <Input
                  id="spref"
                  value={split.reference_no}
                  onChange={(e) => setSplit((f) => ({ ...f, reference_no: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sprem">Remarks (optional)</Label>
                <Input
                  id="sprem"
                  value={split.remarks}
                  onChange={(e) => setSplit((f) => ({ ...f, remarks: e.target.value }))}
                />
              </div>
            </div>
            <AdvancedPaymentFields
              idPrefix="sp"
              show={showAdvanced}
              onToggle={() => setShowAdvanced((v) => !v)}
              costCenters={costCenters}
              costCenter={split.cost_center}
              onCostCenterChange={(v) => setSplit((f) => ({ ...f, cost_center: v }))}
              project=""
              onProjectChange={() => undefined}
            />
            <Button disabled={busy} onClick={() => void onSplit()}>
              Create split payment
            </Button>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              <Link className="underline-offset-2 hover:underline" to="/journals">
                View split payments in Journals →
              </Link>
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <PaymentsListSection paymentType="Pay" searchPlaceholder="Search payment # or supplier…" reloadToken={reloadToken} />
    </div>
  );
}
