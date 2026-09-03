import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import {
  Button,
  Combobox,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
} from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";
import { isCashOrBankAccountType, type AccountOption, type CostCenter } from "@/components/payment-form-parts";

type VoucherType = "Receipt" | "Payment" | "Contra" | "Journal";

type Line = {
  account: string;
  debit: number;
  credit: number;
  cost_center: string;
  party_type: string;
  party: string;
};

const emptyLine = (): Line => ({ account: "", debit: 0, credit: 0, cost_center: "", party_type: "", party: "" });

const VOUCHER_TYPES: { value: VoucherType; label: string; hint: string }[] = [
  {
    value: "Receipt",
    label: "Receipt",
    hint: "Money in. Debit a Cash/Bank account; credit any other account (Customer, Income, Debtor…).",
  },
  {
    value: "Payment",
    label: "Payment",
    hint: "Money out. Debit any other account (Expense, Supplier, Asset…); credit a Cash/Bank account.",
  },
  {
    value: "Contra",
    label: "Contra",
    hint: "Transfer between your own Cash/Bank accounts only — every line must be Cash or Bank.",
  },
  {
    value: "Journal",
    label: "Journal",
    hint: "Adjustments that don't touch Cash or Bank directly — no line may be a Cash/Bank account.",
  },
];

// Maps our four voucher labels onto ERPNext's Journal Entry voucher_type field.
// Receipt and Payment both post as "Bank Entry" — the backend tells them apart
// by which side (debit/credit) the Cash/Bank lines land on, not by this label.
const BACKEND_VOUCHER_TYPE: Record<VoucherType, string> = {
  Receipt: "Bank Entry",
  Payment: "Bank Entry",
  Contra: "Contra Entry",
  Journal: "Journal Entry",
};

export function NewVoucherPage() {
  const navigate = useNavigate();
  const [voucherType, setVoucherType] = useState<VoucherType>("Receipt");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [remark, setRemark] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void callZatGoApi<AccountOption[]>(ZatGoApi.accounting.journalsListAccounts, {})
      .then((env) => setAccounts(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
    void callZatGoApi<CostCenter[]>(ZatGoApi.accounting.journalsListCostCenters, { page: 1, page_size: 100 })
      .then((env) => setCostCenters(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
  }, []);

  const accountTypeById = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const a of accounts) map.set(a.id, a.account_type);
    return map;
  }, [accounts]);

  const isCashBank = (accountId: string) => isCashOrBankAccountType(accountTypeById.get(accountId));

  const debitTotal = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const creditTotal = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const balanced = Math.abs(debitTotal - creditTotal) <= 0.005;

  const activeHint = VOUCHER_TYPES.find((t) => t.value === voucherType)!.hint;

  // Client-side mirror of the server's per-voucher-type rule — same logic as
  // zatgo_core's _validate_voucher_type_accounts, so mistakes surface here
  // instead of round-tripping to the server first.
  const validateLines = (valid: Line[]): string | null => {
    if (voucherType === "Contra") {
      const bad = valid.find((l) => !isCashBank(l.account));
      if (bad) return `Contra entries can only use Cash or Bank accounts — that line isn't one.`;
    } else if (voucherType === "Journal") {
      const bad = valid.find((l) => isCashBank(l.account));
      if (bad) return "A Journal entry can't use a Cash/Bank account — use Receipt, Payment, or Contra instead.";
    } else {
      const cashSides = new Set<string>();
      const otherSides = new Set<string>();
      for (const l of valid) {
        const side = l.debit > 0 ? "debit" : "credit";
        (isCashBank(l.account) ? cashSides : otherSides).add(side);
      }
      if (cashSides.size === 0) return "At least one line must be a Cash or Bank account.";
      if (cashSides.size > 1) {
        return "Cash/Bank accounts must all be on the same side — all debit for a Receipt, all credit for a Payment.";
      }
      if (cashSides.size && otherSides.size && [...cashSides][0] === [...otherSides][0]) {
        return "Cash/Bank and non-Cash/Bank accounts must be on opposite sides.";
      }
    }
    return null;
  };

  const onCreate = async () => {
    const valid = lines.filter((l) => l.account && (l.debit > 0 || l.credit > 0));
    if (valid.length < 2) {
      toast.error("Need at least two account lines");
      return;
    }
    if (!balanced) {
      toast.error("Debit and credit must match");
      return;
    }
    const lineError = validateLines(valid);
    if (lineError) {
      toast.error(lineError);
      return;
    }
    setBusy(true);
    try {
      await callZatGoApi(ZatGoApi.accounting.journalsCreate, {
        accounts: valid.map((l) => ({
          account: l.account,
          debit: l.debit,
          credit: l.credit,
          cost_center: l.cost_center || undefined,
          party_type: l.party_type || undefined,
          party: l.party || undefined,
        })),
        voucher_type: BACKEND_VOUCHER_TYPE[voucherType],
        user_remark: remark || undefined,
        reference_no: referenceNo || undefined,
        reference_date: referenceDate || undefined,
        client_id: crypto.randomUUID(),
      });
      toast.success(`${voucherType} entry created`);
      setLines([emptyLine(), emptyLine()]);
      setRemark("");
      setReferenceNo("");
      setReferenceDate("");
      navigate("/journals", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New voucher"
        description="One general entry point for Receipt, Payment, Contra, and Journal vouchers."
        actions={
          <Button variant="outline" asChild>
            <Link to="/journals">View journals</Link>
          </Button>
        }
      />

      <div className="max-w-xl space-y-2">
        <Label htmlFor="voucherType">Voucher type</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={voucherType}
          onValueChange={(value) => value && setVoucherType(value as VoucherType)}
          className="grid grid-cols-4 gap-2"
          id="voucherType"
        >
          {VOUCHER_TYPES.map((t) => (
            <ToggleGroupItem
              key={t.value}
              value={t.value}
              className="border-[var(--color-border)] px-3 py-2 text-sm font-medium data-[state=on]:border-[var(--color-primary)] data-[state=on]:bg-[var(--color-primary)] data-[state=on]:text-[var(--color-primary-foreground)]"
            >
              {t.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-sm text-[var(--color-muted-foreground)]">{activeHint}</p>
      </div>

      <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        <div className="space-y-1 max-w-xl">
          <Label htmlFor="remark">Note</Label>
          <Input id="remark" value={remark} onChange={(e) => setRemark(e.target.value)} />
        </div>

        {lines.map((line, idx) => {
          const cashBank = line.account ? isCashBank(line.account) : null;
          return (
            <div key={idx} className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-2">
              <div className="grid gap-2 sm:grid-cols-5">
                <div className="sm:col-span-2 space-y-1">
                  <Combobox
                    value={line.account}
                    onValueChange={(v) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, account: v } : l)))}
                    placeholder="Account…"
                    searchPlaceholder="Search accounts…"
                    options={accounts.map((a) => ({
                      value: a.id,
                      label: `${a.account_name || a.name}${a.account_type ? ` (${a.account_type})` : ""}`,
                      keywords: a.name,
                    }))}
                  />
                  {cashBank !== null ? (
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {cashBank ? "Cash/Bank account" : "Not Cash/Bank"}
                    </p>
                  ) : null}
                </div>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Debit"
                  value={line.debit || ""}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, debit: Number(e.target.value), credit: 0 } : l)),
                    )
                  }
                />
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Credit"
                  value={line.credit || ""}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, credit: Number(e.target.value), debit: 0 } : l)),
                    )
                  }
                />
                <Combobox
                  value={line.cost_center}
                  onValueChange={(v) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, cost_center: v } : l)))}
                  placeholder="Cost center…"
                  searchPlaceholder="Search cost centers…"
                  options={costCenters.map((c) => ({ value: c.id, label: c.cost_center_name || c.name, keywords: c.name }))}
                />
              </div>
              {showMore ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select
                    value={line.party_type}
                    onValueChange={(value) =>
                      setLines((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, party_type: value, party: "" } : l)),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Party type (optional)…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Customer">Customer</SelectItem>
                      <SelectItem value="Supplier">Supplier</SelectItem>
                      <SelectItem value="Employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Party (customer/supplier name)"
                    value={line.party}
                    disabled={!line.party_type}
                    onChange={(e) =>
                      setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, party: e.target.value } : l)))
                    }
                  />
                </div>
              ) : null}
              {lines.length > 2 ? (
                <button
                  type="button"
                  className="text-xs text-[var(--color-destructive)] underline-offset-2 hover:underline"
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Remove line
                </button>
              ) : null}
            </div>
          );
        })}

        {showMore ? (
          <div className="grid gap-2 sm:grid-cols-2 sm:max-w-md">
            <div className="space-y-1">
              <Label htmlFor="vref">Reference (optional)</Label>
              <Input id="vref" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vrefdate">Reference date (optional)</Label>
              <Input id="vrefdate" type="date" value={referenceDate} onChange={(e) => setReferenceDate(e.target.value)} />
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

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Button variant="outline" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
            Add line
          </Button>
          <span className={`tabular-nums ${balanced ? "text-[var(--color-muted-foreground)]" : "text-[var(--color-destructive)]"}`}>
            Debit {money(debitTotal)} · Credit {money(creditTotal)}
          </span>
          <Button disabled={busy} onClick={() => void onCreate()}>
            Save {voucherType.toLowerCase()}
          </Button>
        </div>
      </section>
    </div>
  );
}
