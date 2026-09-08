import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Combobox, Input, Label, LoadingState, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { getSuppliers } from "@/api/erpnext/supplier";
import {
  createPurchaseEntry,
  getPurchaseInvoice,
  getPurchaseServiceItemDefaults,
  submitPurchaseInvoice,
  updatePurchaseInvoice,
} from "@/api/erpnext/purchase";
import { toFriendlyMessage } from "@/lib/friendly-error";
import { money } from "@/lib/format";
import type { CostCenter, Party, PurchaseInvoice } from "@/types/accounting";
import { ZatGoApi } from "@zatgo/erpnext";
import { callZatGoApi } from "@/lib/call-zatgo-api";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewBillPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { name: rawName } = useParams<{ name: string }>();
  const editingName = rawName ? decodeURIComponent(rawName) : null;
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [expenseAccount, setExpenseAccount] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(Boolean(editingName));

  const [supplier, setSupplier] = useState(search.get("supplier") || "");
  const [postingDate, setPostingDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [remarks, setRemarks] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<PurchaseInvoice | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [supplierRows, costCenterEnv, itemDefaults] = await Promise.all([
          getSuppliers(),
          callZatGoApi<CostCenter[]>(ZatGoApi.accounting.journalsListCostCenters, { page: 1, page_size: 100 }),
          getPurchaseServiceItemDefaults(),
        ]);
        setSuppliers(supplierRows);
        setCostCenters(Array.isArray(costCenterEnv.data) ? costCenterEnv.data : []);
        setExpenseAccount(itemDefaults.expenseAccount);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load form data");
      }
    })();
  }, []);

  useEffect(() => {
    if (!editingName) return;
    void (async () => {
      setLoadingExisting(true);
      try {
        const existing = await getPurchaseInvoice(editingName);
        if (existing.docstatus !== 0) {
          toast.error("This bill has already been submitted — edit it via Cancel + Amend instead.");
          navigate(`/bills/${encodeURIComponent(editingName)}`, { replace: true });
          return;
        }
        setSupplier(existing.supplier || "");
        setPostingDate(existing.date || today());
        setAmount(String(existing.amount ?? ""));
        setCostCenter("");
        setRemarks(existing.remarks || "");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load bill");
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [editingName]);

  const onSave = async () => {
    if (!supplier) {
      toast.error("Pick a supplier");
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
      if (editingName) {
        await updatePurchaseInvoice(editingName, {
          supplier,
          amount: numericAmount,
          postingDate,
          costCenter: costCenter || undefined,
          remarks: remarks || undefined,
        });
        toast.success("Bill updated");
        navigate(`/bills/${encodeURIComponent(editingName)}`);
        return;
      }
      const invoice = await createPurchaseEntry({
        supplier,
        amount: numericAmount,
        postingDate,
        costCenter: costCenter || undefined,
        remarks: remarks || undefined,
        clientId: crypto.randomUUID(),
      });
      setCreated(invoice);
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Save failed"));
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setCreated(null);
    setSupplier("");
    setPostingDate(today());
    setAmount("");
    setCostCenter("");
    setRemarks("");
  };

  if (created) {
    const supplierLabel = suppliers.find((s) => s.id === created.supplier)?.name || created.supplier || supplier;
    const outstanding = created.outstanding ?? Number(amount);
    const isSubmitted = created.docstatus === 1;
    const onSubmitDraft = async () => {
      setBusy(true);
      try {
        await submitPurchaseInvoice(created.name);
        toast.success("Bill submitted");
        setCreated({ ...created, docstatus: 1 });
      } catch (e) {
        toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Submit failed"));
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="space-y-6">
        <PageHeader title="Purchase created" description="ERPNext posted the accounting entry." />
        <div className="max-w-md space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6">
          <div className="space-y-1">
            <p className="text-sm text-[var(--color-muted-foreground)]">Supplier</p>
            <p className="text-lg font-medium">{supplierLabel}</p>
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
              <p className="font-medium">{!isSubmitted ? "Draft" : outstanding > 0 ? "Unpaid" : "Paid"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-[var(--color-muted-foreground)]">Outstanding</p>
              <p className="font-medium tabular-nums">{money(outstanding)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {!isSubmitted ? (
              <Button disabled={busy} onClick={() => void onSubmitDraft()}>
                Submit
              </Button>
            ) : null}
            {isSubmitted && outstanding > 0 ? (
              <Button
                onClick={() =>
                  navigate(
                    `/payment?invoice=${encodeURIComponent(created.name)}&amount=${encodeURIComponent(String(outstanding))}`,
                  )
                }
              >
                Pay supplier
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link to={`/bills/${encodeURIComponent(created.name)}`}>View bill</Link>
            </Button>
            <Button variant="outline" onClick={resetForm}>
              New purchase
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingExisting) return <LoadingState label="Loading bill…" />;

  const cancelHref = editingName ? `/bills/${encodeURIComponent(editingName)}` : "/bills";

  return (
    <div className="space-y-6">
      <PageHeader
        title={editingName ? `Edit ${editingName}` : "New purchase"}
        description={
          editingName
            ? "This bill is still a draft — edit it freely until it's submitted."
            : "Record a purchase — ERPNext generates the bill and accounting entries."
        }
        actions={
          <Button variant="outline" asChild>
            <Link to={cancelHref}>Cancel</Link>
          </Button>
        }
      />

      <div className="max-w-xl space-y-4">
        <div className="space-y-2">
          <Label htmlFor="supplier">Supplier</Label>
          <Combobox
            value={supplier}
            onValueChange={setSupplier}
            placeholder="Select…"
            searchPlaceholder="Search suppliers…"
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
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
          <Label>Expense account</Label>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {expenseAccount || "Configured default (loading…)"}
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
        {editingName ? "Save changes" : "Save purchase"}
      </Button>
    </div>
  );
}
