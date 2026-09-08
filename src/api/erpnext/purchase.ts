import { ZatGoApi } from "@zatgo/erpnext";
import type { PurchaseEntryInput, PurchaseInvoice } from "@/types/accounting";
import { callZatGoApi, unwrap } from "./client";

/** Hidden non-stock service item used for accounting-only purchase entries — see Item "Purchase Amount" in ERPNext. */
export const PURCHASE_SERVICE_ITEM_CODE = "PURCHASE-AMOUNT";

export async function createPurchaseEntry(
  input: PurchaseEntryInput & { clientId: string },
): Promise<PurchaseInvoice> {
  const env = await callZatGoApi<PurchaseInvoice>(ZatGoApi.accounting.purchaseInvoicesCreate, {
    supplier: input.supplier,
    items: [{ item_code: PURCHASE_SERVICE_ITEM_CODE, qty: 1, rate: input.amount }],
    posting_date: input.postingDate || undefined,
    cost_center: input.costCenter || undefined,
    remarks: input.remarks || undefined,
    client_id: input.clientId,
  });
  const invoice = unwrap(env);
  // Submit immediately so the entry is usable right away (e.g. Pay Supplier), matching the
  // one-step "Save Purchase" flow — ERPNext still performs the actual submit/GL posting, not us.
  await submitPurchaseInvoice(invoice.name);
  return getPurchaseInvoice(invoice.name);
}

export async function getPurchaseInvoices(
  params: { page?: number; page_size?: number; supplier?: string } = {},
): Promise<PurchaseInvoice[]> {
  const env = await callZatGoApi<PurchaseInvoice[]>(ZatGoApi.accounting.purchaseInvoicesList, {
    page: 1,
    page_size: 100,
    ...params,
  });
  return Array.isArray(env.data) ? env.data : [];
}

export async function getPurchaseInvoice(name: string): Promise<PurchaseInvoice> {
  const env = await callZatGoApi<PurchaseInvoice>(ZatGoApi.accounting.purchaseInvoicesGet, { name });
  return unwrap(env);
}

export async function submitPurchaseInvoice(name: string): Promise<void> {
  await callZatGoApi(ZatGoApi.accounting.purchaseInvoicesSubmit, { name });
}

export async function cancelPurchaseInvoice(name: string): Promise<void> {
  await callZatGoApi(ZatGoApi.accounting.purchaseInvoicesCancel, { name });
}

export async function amendPurchaseInvoice(name: string): Promise<PurchaseInvoice> {
  const env = await callZatGoApi<PurchaseInvoice>(ZatGoApi.accounting.purchaseInvoicesAmend, { name });
  return unwrap(env);
}

export async function createPurchaseReturn(input: {
  returnAgainst: string;
  items: Array<{ item_code: string; qty: number }>;
  reason?: string;
  clientId: string;
}): Promise<PurchaseInvoice> {
  const env = await callZatGoApi<PurchaseInvoice>(ZatGoApi.accounting.purchaseInvoicesCreateReturn, {
    return_against: input.returnAgainst,
    items: input.items,
    reason: input.reason || undefined,
    client_id: input.clientId,
  });
  return unwrap(env);
}

export async function getPurchaseInvoicePdf(name: string): Promise<{ pdf_base64?: string; filename?: string }> {
  const env = await callZatGoApi<{ pdf_base64?: string; filename?: string }>(
    ZatGoApi.accounting.purchaseInvoicesGetPdf,
    { name },
  );
  return unwrap(env);
}

/** Reads the configured default expense account from the hidden Purchase Amount item — informational display only. */
export async function getPurchaseServiceItemDefaults(): Promise<{ expenseAccount: string | null }> {
  const env = await callZatGoApi<{ item_defaults?: Array<{ expense_account?: string | null }> }>(
    "frappe.client.get",
    { doctype: "Item", name: PURCHASE_SERVICE_ITEM_CODE },
  );
  const doc = unwrap(env);
  return { expenseAccount: doc?.item_defaults?.[0]?.expense_account ?? null };
}
