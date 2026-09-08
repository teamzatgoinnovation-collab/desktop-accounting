import { ZatGoApi } from "@zatgo/erpnext";
import type { PaymentEntry } from "@/types/accounting";
import { callZatGoApi, unwrap } from "./client";

/** Pays a Sales Invoice in full (or partially if amount given) — ERPNext computes the actual outstanding. */
export async function receivePayment(input: {
  salesInvoice: string;
  amount?: number;
  modeOfPayment?: string;
  costCenter?: string;
  clientId: string;
}): Promise<PaymentEntry> {
  const env = await callZatGoApi<PaymentEntry>(ZatGoApi.accounting.paymentsCreateReceive, {
    sales_invoice: input.salesInvoice,
    amount: input.amount,
    mode_of_payment: input.modeOfPayment || undefined,
    cost_center: input.costCenter || undefined,
    client_id: input.clientId,
  });
  return unwrap(env);
}

/** Pays a Purchase Invoice in full (or partially if amount given). */
export async function paySupplier(input: {
  purchaseInvoice: string;
  amount?: number;
  modeOfPayment?: string;
  costCenter?: string;
  clientId: string;
}): Promise<PaymentEntry> {
  const env = await callZatGoApi<PaymentEntry>(ZatGoApi.accounting.paymentsCreatePay, {
    purchase_invoice: input.purchaseInvoice,
    amount: input.amount,
    mode_of_payment: input.modeOfPayment || undefined,
    cost_center: input.costCenter || undefined,
    client_id: input.clientId,
  });
  return unwrap(env);
}

export async function receiveAdvance(input: {
  party: string;
  amount: number;
  modeOfPayment?: string;
  referenceNo?: string;
  invoices?: Array<{ name: string; amount?: number }>;
  costCenter?: string;
  clientId: string;
}): Promise<PaymentEntry> {
  const env = await callZatGoApi<PaymentEntry>(ZatGoApi.accounting.paymentsCreateReceiveAdvance, {
    party: input.party,
    amount: input.amount,
    mode_of_payment: input.modeOfPayment || undefined,
    reference_no: input.referenceNo || undefined,
    invoices: input.invoices?.length ? input.invoices : undefined,
    cost_center: input.costCenter || undefined,
    client_id: input.clientId,
  });
  return unwrap(env);
}

export async function payAdvance(input: {
  party: string;
  amount: number;
  modeOfPayment?: string;
  referenceNo?: string;
  invoices?: Array<{ name: string; amount?: number }>;
  costCenter?: string;
  clientId: string;
}): Promise<PaymentEntry> {
  const env = await callZatGoApi<PaymentEntry>(ZatGoApi.accounting.paymentsCreatePayAdvance, {
    party: input.party,
    amount: input.amount,
    mode_of_payment: input.modeOfPayment || undefined,
    reference_no: input.referenceNo || undefined,
    invoices: input.invoices?.length ? input.invoices : undefined,
    cost_center: input.costCenter || undefined,
    client_id: input.clientId,
  });
  return unwrap(env);
}

export async function cancelPayment(name: string): Promise<void> {
  await callZatGoApi(ZatGoApi.accounting.paymentsCancel, { name });
}

/** Scoped to non-amount fields only — changing the amount would require re-running the
 * party/invoice allocation logic, which the backend deliberately does not support editing. */
export async function updatePaymentEntry(
  name: string,
  values: { modeOfPayment?: string; postingDate?: string; referenceNo?: string; costCenter?: string; project?: string },
): Promise<PaymentEntry> {
  const env = await callZatGoApi<PaymentEntry>(ZatGoApi.accounting.paymentsUpdate, {
    name,
    mode_of_payment: values.modeOfPayment,
    posting_date: values.postingDate,
    reference_no: values.referenceNo,
    cost_center: values.costCenter,
    project: values.project,
  });
  return unwrap(env);
}

export async function deletePaymentEntry(name: string): Promise<void> {
  await callZatGoApi(ZatGoApi.accounting.paymentsDelete, { name });
}

export async function getPaymentEntries(params: {
  paymentType?: "Receive" | "Pay";
  partyType?: "Customer" | "Supplier";
  party?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<PaymentEntry[]> {
  const env = await callZatGoApi<PaymentEntry[]>(ZatGoApi.accounting.paymentsList, {
    page: 1,
    page_size: 100,
    party_type: params.partyType || undefined,
    party: params.party || undefined,
    ...params,
  });
  const rows = Array.isArray(env.data) ? env.data : [];
  // paymentsList's payment_type isn't filtered server-side (matches PaymentsListSection's existing client-side filter convention).
  return params.paymentType ? rows.filter((r) => r.payment_type === params.paymentType) : rows;
}
