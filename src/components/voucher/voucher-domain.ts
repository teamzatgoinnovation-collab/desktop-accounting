import type { ComboboxOption } from "@zatgo/ui";
import { isCashOrBankAccountType, type AccountOption, type CostCenter, type PartyOption } from "@/components/payment-form-parts";

export type VoucherType = "Receipt" | "Payment" | "Contra" | "Journal";

export type Line = {
  account: string;
  debit: number;
  credit: number;
  cost_center: string;
  party_type: string;
  party: string;
};

export const emptyLine = (): Line => ({ account: "", debit: 0, credit: 0, cost_center: "", party_type: "", party: "" });

export const VOUCHER_TYPES: { value: VoucherType; label: string; hint: string }[] = [
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
export const BACKEND_VOUCHER_TYPE: Record<VoucherType, string> = {
  Receipt: "Bank Entry",
  Payment: "Bank Entry",
  Contra: "Contra Entry",
  Journal: "Journal Entry",
};

export const isBalanced = (debitTotal: number, creditTotal: number) => Math.abs(debitTotal - creditTotal) <= 0.005;

// Client-side mirror of the server's per-voucher-type rule — same logic as
// zatgo_core's _validate_voucher_type_accounts, so mistakes surface here
// instead of round-tripping to the server first.
export function validateLines(voucherType: VoucherType, valid: Line[], isCashBank: (accountId: string) => boolean): string | null {
  if (voucherType === "Contra") {
    const bad = valid.find((l) => !isCashBank(l.account));
    if (bad) return "Contra entries can only use Cash or Bank accounts — that line isn't one.";
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
}

export { isCashOrBankAccountType };

/** No fabricated "account code" — the backend has no such field. Primary label
 * stays the account's real name; root_type/account_type become a secondary
 * line so the picker still communicates category, honestly. */
export function toAccountOptions(accounts: AccountOption[]): ComboboxOption[] {
  return accounts.map((a) => {
    const description = [a.root_type, a.account_type].filter(Boolean).join(" · ") || undefined;
    return {
      value: a.id,
      label: a.account_name || a.name,
      description,
      keywords: a.name,
    };
  });
}

export function toCostCenterOptions(costCenters: CostCenter[]): ComboboxOption[] {
  return costCenters.map((c) => ({ value: c.id, label: c.cost_center_name || c.name, keywords: c.name }));
}

export function toPartyOptions(parties: PartyOption[], partyType: string): ComboboxOption[] {
  return parties.map((p) => ({
    value: p.id,
    label: (partyType === "Customer" ? p.customer_name : partyType === "Supplier" ? p.supplier_name : p.name) || p.name,
    keywords: p.name,
  }));
}
