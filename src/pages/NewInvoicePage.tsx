import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Combobox, Input, Label, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { getCustomers } from "@/api/erpnext/customer";
import { createSalesEntry, getSalesServiceItemDefaults } from "@/api/erpnext/sales";
import { toFriendlyMessage } from "@/lib/friendly-error";
import { money } from "@/lib/format";
import type { CostCenter, Party, SalesInvoice } from "@/types/accounting";
import { ZatGoApi } from "@zatgo/erpnext";
import { callZatGoApi } from "@/lib/call-zatgo-api";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewInvoicePage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [customers, setCustomers] = useState<Party[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [incomeAccount, setIncomeAccount] = useState<string | null>(null);

  const [customer, setCustomer] = useState(search.get("customer") || "");
  const [postingDate, setPostingDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [remarks, setRemarks] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<SalesInvoice | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [customerRows, costCenterEnv, itemDefaults] = await Promise.all([
          getCustomers(),
          callZatGoApi<CostCenter[]>(ZatGoApi.accounting.journalsListCostCenters, { page: 1, page_size: 100 }),
          getSalesServiceItemDefaults(),
        ]);
        setCustomers(customerRows);
        setCostCenters(Array.isArray(costCenterEnv.data) ? costCenterEnv.data : []);
        setIncomeAccount(itemDefaults.incomeAccount);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load form data");
      }
    })();
  }, []);

  const onSave = async () => {
    if (!customer) {
      toast.error("Pick a customer");
      return;
    }
    const numericAmount = Number(amount);
    if (!amount || !(numericAmount > 0)) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    if (!postingDate) {
      toast.error("Pick a date");
      return;
    }
    setBusy(true);
    try {
      const invoice = await createSalesEntry({
        customer,
        amount: numericAmount,
        postingDate,
        costCenter: costCenter || undefined,
        remarks: remarks || undefined,
        clientId: crypto.randomUUID(),
      });
      setCreated(invoice);
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Create failed"));
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setCreated(null);
    setCustomer("");
    setPostingDate(today());
    setAmount("");
    setCostCenter("");
    setRemarks("");
  };

  if (created) {
    const customerLabel = customers.find((c) => c.id === created.customer)?.name || created.customer || customer;
    const outstanding = created.outstanding ?? Number(amount);
    return (
      <div className="space-y-6">
        <PageHeader title="Sale created" description="ERPNext posted the accounting entry." />
        <div className="max-w-md space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6">
          <div className="space-y-1">
            <p className="text-sm text-[var(--color-muted-foreground)]">Customer</p>
            <p className="text-lg font-medium">{customerLabel}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-[var(--color-muted-foreground)]">Amount</p>
            <p className="text-lg font-medium tabular-nums">{money(created.amount ?? Number(amount))}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-[var(--color-muted-foreground)]">Invoice</p>
            <p className="text-lg font-medium">{created.name}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-[var(--color-muted-foreground)]">Status</p>
              <p className="font-medium">{outstanding > 0 ? "Unpaid" : "Paid"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-[var(--color-muted-foreground)]">Outstanding</p>
              <p className="font-medium tabular-nums">{money(outstanding)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {outstanding > 0 ? (
              <Button
                onClick={() =>
                  navigate(
                    `/receipt?invoice=${encodeURIComponent(created.name)}&amount=${encodeURIComponent(String(outstanding))}`,
                  )
                }
              >
                Receive payment
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link to={`/invoices/${encodeURIComponent(created.name)}`}>View invoice</Link>
            </Button>
            <Button variant="outline" onClick={resetForm}>
              New sale
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New sale"
        description="Record a sale — ERPNext generates the invoice and accounting entries."
        actions={
          <Button variant="outline" asChild>
            <Link to="/invoices">Cancel</Link>
          </Button>
        }
      />

      <div className="max-w-xl space-y-4">
        <div className="space-y-2">
          <Label htmlFor="customer">Customer</Label>
          <Combobox
            value={customer}
            onValueChange={setCustomer}
            placeholder="Select…"
            searchPlaceholder="Search customers…"
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              min={0}
              step="any"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Income account</Label>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {incomeAccount || "Configured default (loading…)"}
          </p>
        </div>

        {showMore ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cc">Cost center (optional)</Label>
              <Combobox
                value={costCenter}
                onValueChange={setCostCenter}
                placeholder="Select…"
                searchPlaceholder="Search cost centers…"
                options={costCenters.map((c) => ({ value: c.id, label: c.cost_center_name || c.name }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks (optional)</Label>
              <Input id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="text-sm text-[var(--color-primary)] underline-offset-2 hover:underline"
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "Show less details" : "Show more details"}
        </button>

        <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4">
          <span className="text-sm text-[var(--color-muted-foreground)]">Total</span>
          <span className="text-lg font-semibold tabular-nums">{money(Number(amount) || 0)}</span>
        </div>
      </div>

      <Button disabled={busy} onClick={() => void onSave()}>
        Save sale
      </Button>
    </div>
  );
}
