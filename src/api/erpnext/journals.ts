import { ZatGoApi } from "@zatgo/erpnext";
import { callZatGoApi, unwrap } from "./client";

export type JournalAccountLine = {
  account: string;
  debit: number;
  credit: number;
  cost_center?: string;
  party_type?: string;
  party?: string;
};

export type Journal = {
  id: string;
  name: string;
  title?: string;
  status?: string;
  date?: string;
  docstatus?: number;
  company?: string;
  user_remark?: string;
  reference_no?: string;
  reference_date?: string;
  accounts?: JournalAccountLine[];
};

export async function getJournalEntries(params: { page?: number; page_size?: number } = {}): Promise<Journal[]> {
  const env = await callZatGoApi<Journal[]>(ZatGoApi.accounting.journalsList, { page: 1, page_size: 50, ...params });
  return Array.isArray(env.data) ? env.data : [];
}

export async function getJournalEntry(name: string): Promise<Journal> {
  const env = await callZatGoApi<Journal>(ZatGoApi.accounting.journalsGet, { name });
  return unwrap(env);
}

/** Only succeeds while the journal is still a Draft (docstatus 0) — the backend enforces this,
 * and re-validates the same balance/voucher-type rules `create` does. */
export async function updateJournalEntry(
  name: string,
  values: {
    accounts?: Array<{ account: string; debit?: number; credit?: number; cost_center?: string; party_type?: string; party?: string }>;
    postingDate?: string;
    userRemark?: string;
    voucherType?: string;
    referenceNo?: string;
    referenceDate?: string;
  },
): Promise<Journal> {
  const env = await callZatGoApi<Journal>(ZatGoApi.accounting.journalsUpdate, {
    name,
    accounts: values.accounts,
    posting_date: values.postingDate,
    user_remark: values.userRemark,
    voucher_type: values.voucherType,
    reference_no: values.referenceNo,
    reference_date: values.referenceDate,
  });
  return unwrap(env);
}

export async function deleteJournalEntry(name: string): Promise<void> {
  await callZatGoApi(ZatGoApi.accounting.journalsDelete, { name });
}

export async function submitJournalEntry(name: string): Promise<void> {
  await callZatGoApi(ZatGoApi.accounting.journalsSubmit, { name });
}

export async function cancelJournalEntry(name: string): Promise<void> {
  await callZatGoApi(ZatGoApi.accounting.journalsCancel, { name });
}

export async function amendJournalEntry(name: string): Promise<Journal> {
  const env = await callZatGoApi<Journal>(ZatGoApi.accounting.journalsAmend, { name });
  return unwrap(env);
}

export async function getJournalEntryPdf(name: string): Promise<{ pdf_base64?: string; filename?: string }> {
  const env = await callZatGoApi<{ pdf_base64?: string; filename?: string }>(ZatGoApi.accounting.journalsGetPdf, {
    name,
  });
  return unwrap(env);
}
