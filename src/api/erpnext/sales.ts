import { ZatGoApi } from "@zatgo/erpnext";
import type { SalesEntryInput, SalesInvoice } from "@/types/accounting";
import { erpnextApi } from "@/lib/client";
import { callZatGoApi, unwrap } from "./client";

/** Hidden non-stock service item used for accounting-only sales entries — see Item "Sales Amount" in ERPNext. */
export const SALES_SERVICE_ITEM_CODE = "SALES-AMOUNT";

export async function createSalesEntry(input: SalesEntryInput & { clientId: string }): Promise<SalesInvoice> {
  const env = await callZatGoApi<SalesInvoice>(ZatGoApi.accounting.invoicesCreate, {
    customer: input.customer,
    items: [{ item_code: SALES_SERVICE_ITEM_CODE, qty: 1, rate: input.amount }],
    posting_date: input.postingDate || undefined,
    cost_center: input.costCenter || undefined,
    remarks: input.remarks || undefined,
    client_id: input.clientId,
  });
  return unwrap(env);
}

export async function getSalesInvoices(
  params: { page?: number; page_size?: number; customer?: string } = {},
): Promise<SalesInvoice[]> {
  const env = await callZatGoApi<SalesInvoice[]>(ZatGoApi.accounting.invoicesList, { page: 1, page_size: 100, ...params });
  return Array.isArray(env.data) ? env.data : [];
}

export async function getSalesInvoice(name: string): Promise<SalesInvoice> {
  const env = await callZatGoApi<SalesInvoice>(ZatGoApi.accounting.invoicesGet, { name });
  return unwrap(env);
}

export async function submitSalesInvoice(name: string): Promise<void> {
  await callZatGoApi(ZatGoApi.accounting.invoicesSubmit, { name });
}

export async function cancelSalesInvoice(name: string): Promise<void> {
  await callZatGoApi(ZatGoApi.accounting.invoicesCancel, { name });
}

/** Only succeeds while the invoice is still a Draft (docstatus 0) — the backend enforces this,
 * a submitted invoice can only be corrected via Cancel + Amend. */
export async function updateSalesInvoice(
  name: string,
  values: {
    customer?: string;
    amount?: number;
    postingDate?: string;
    dueDate?: string;
    remarks?: string;
    costCenter?: string;
  },
): Promise<SalesInvoice> {
  const env = await callZatGoApi<SalesInvoice>(ZatGoApi.accounting.invoicesUpdate, {
    name,
    customer: values.customer,
    items:
      values.amount !== undefined
        ? [{ item_code: SALES_SERVICE_ITEM_CODE, qty: 1, rate: values.amount }]
        : undefined,
    posting_date: values.postingDate,
    due_date: values.dueDate,
    remarks: values.remarks,
    cost_center: values.costCenter,
  });
  return unwrap(env);
}

export async function deleteSalesInvoice(name: string): Promise<void> {
  await callZatGoApi(ZatGoApi.accounting.invoicesDelete, { name });
}

export async function amendSalesInvoice(name: string): Promise<SalesInvoice> {
  const env = await callZatGoApi<SalesInvoice>(ZatGoApi.accounting.invoicesAmend, { name });
  return unwrap(env);
}

export async function createSalesReturn(input: {
  returnAgainst: string;
  items: Array<{ item_code: string; qty: number }>;
  reason?: string;
  clientId: string;
}): Promise<SalesInvoice> {
  const env = await callZatGoApi<SalesInvoice>(ZatGoApi.accounting.invoicesCreateReturn, {
    return_against: input.returnAgainst,
    items: input.items,
    reason: input.reason || undefined,
    client_id: input.clientId,
  });
  return unwrap(env);
}

export async function getSalesInvoicePdf(name: string): Promise<{ pdf_base64?: string; filename?: string }> {
  const env = await callZatGoApi<{ pdf_base64?: string; filename?: string }>(ZatGoApi.accounting.invoicesGetPdf, {
    name,
  });
  return unwrap(env);
}

export async function getZatcaQr(
  name: string,
): Promise<{ qr_base64?: string; seller_name?: string; vat_number?: string; vat_amount?: number }> {
  const env = await callZatGoApi<{ qr_base64?: string; seller_name?: string; vat_number?: string; vat_amount?: number }>(
    ZatGoApi.accounting.invoicesGetZatcaQr,
    { name },
  );
  return unwrap(env);
}

/** Reads the configured default income account from the hidden Sales Amount item — informational display only.
 * Uses erpnextApi directly (not callZatGoApi) — frappe.client.get is a core Frappe method that returns the raw
 * document, not zatgo_core's {success, data, ...} envelope, so the standard unwrap would reject it. */
export async function getSalesServiceItemDefaults(): Promise<{ incomeAccount: string | null }> {
  const doc = await erpnextApi<{ item_defaults?: Array<{ income_account?: string | null }> }>(
    "frappe.client.get",
    { doctype: "Item", name: SALES_SERVICE_ITEM_CODE },
  );
  return { incomeAccount: doc?.item_defaults?.[0]?.income_account ?? null };
}
