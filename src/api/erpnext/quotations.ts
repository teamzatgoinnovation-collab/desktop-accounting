import { ZatGoApi } from "@zatgo/erpnext";
import { callZatGoApi, unwrap } from "./client";

export type QuotationItem = {
  item_code?: string;
  item_name?: string;
  description?: string;
  qty?: number;
  rate?: number;
  amount?: number;
  billing_type?: string;
};

export type Quotation = {
  id: string;
  name: string;
  customer?: string;
  customer_id?: string;
  status?: string;
  amount?: number;
  date?: string;
  valid_till?: string;
  currency?: string;
  docstatus?: number;
  company?: string;
  terms?: string;
  items?: QuotationItem[];
};

export async function getQuotations(
  params: { page?: number; page_size?: number; customer?: string } = {},
): Promise<Quotation[]> {
  const env = await callZatGoApi<Quotation[]>(ZatGoApi.accounting.quotationsList, { page: 1, page_size: 50, ...params });
  return Array.isArray(env.data) ? env.data : [];
}

export async function getQuotation(name: string): Promise<Quotation> {
  const env = await callZatGoApi<Quotation>(ZatGoApi.accounting.quotationsGet, { name });
  return unwrap(env);
}

export async function createQuotation(input: {
  customer: string;
  items: Array<{ item_code: string; qty: number; rate: number; description?: string; billing_type?: string }>;
  validTill?: string;
  terms?: string;
  clientId: string;
}): Promise<Quotation> {
  const env = await callZatGoApi<Quotation>(ZatGoApi.accounting.quotationsCreate, {
    customer: input.customer,
    items: input.items,
    valid_till: input.validTill || undefined,
    terms: input.terms || undefined,
    client_id: input.clientId,
  });
  return unwrap(env);
}

/** Only succeeds while the quotation is still a Draft (docstatus 0) — the backend enforces this. */
export async function updateQuotation(
  name: string,
  values: {
    customer?: string;
    items?: Array<{ item_code: string; qty: number; rate: number; description?: string; billing_type?: string }>;
    validTill?: string;
    terms?: string;
  },
): Promise<Quotation> {
  const env = await callZatGoApi<Quotation>(ZatGoApi.accounting.quotationsUpdate, {
    name,
    customer: values.customer,
    items: values.items,
    valid_till: values.validTill,
    terms: values.terms,
  });
  return unwrap(env);
}

export async function deleteQuotation(name: string): Promise<void> {
  await callZatGoApi(ZatGoApi.accounting.quotationsDelete, { name });
}

export async function submitQuotation(name: string): Promise<void> {
  await callZatGoApi(ZatGoApi.accounting.quotationsSubmit, { name });
}

export async function cancelQuotation(name: string): Promise<void> {
  await callZatGoApi(ZatGoApi.accounting.quotationsCancel, { name });
}

export async function amendQuotation(name: string): Promise<Quotation> {
  const env = await callZatGoApi<Quotation>(ZatGoApi.accounting.quotationsAmend, { name });
  return unwrap(env);
}

export async function convertQuotationToInvoice(name: string): Promise<{ name?: string }> {
  const env = await callZatGoApi<{ name?: string }>(ZatGoApi.accounting.quotationsConvertToInvoice, { name });
  return unwrap(env);
}

export async function getQuotationPdf(name: string): Promise<{ pdf_base64?: string; filename?: string }> {
  const env = await callZatGoApi<{ pdf_base64?: string; filename?: string }>(ZatGoApi.accounting.quotationsGetPdf, {
    name,
  });
  return unwrap(env);
}
