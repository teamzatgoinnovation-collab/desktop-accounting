import { ZatGoApi } from "@zatgo/erpnext";
import { callZatGoApi, unwrap } from "./client";

export async function getOutstandingReceivable(): Promise<unknown[]> {
  const env = await callZatGoApi<unknown[]>(ZatGoApi.accounting.reportsOutstandingReceivable, {});
  return Array.isArray(env.data) ? env.data : [];
}

export async function getOutstandingPayable(): Promise<unknown[]> {
  const env = await callZatGoApi<unknown[]>(ZatGoApi.accounting.reportsOutstandingPayable, {});
  return Array.isArray(env.data) ? env.data : [];
}

export async function getGeneralLedger(params: {
  fromDate: string;
  toDate: string;
  account?: string;
  voucherType?: string;
}): Promise<unknown[]> {
  const env = await callZatGoApi<unknown[]>(ZatGoApi.accounting.reportsGeneralLedger, {
    from_date: params.fromDate,
    to_date: params.toDate,
    account: params.account || undefined,
    voucher_type: params.voucherType || undefined,
  });
  return Array.isArray(env.data) ? env.data : [];
}

export async function getPartyLedger(params: {
  partyType: "Customer" | "Supplier";
  party: string;
  fromDate?: string;
  toDate?: string;
  pageSize?: number;
}): Promise<{ rows: unknown[]; openingBalance?: number; closingBalance?: number }> {
  const env = await callZatGoApi<unknown[]>(ZatGoApi.accounting.reportsPartyLedger, {
    party_type: params.partyType,
    party: params.party,
    from_date: params.fromDate || undefined,
    to_date: params.toDate || undefined,
    page_size: params.pageSize || undefined,
  });
  const meta = env.meta as { opening_balance?: number; closing_balance?: number } | undefined;
  return {
    rows: Array.isArray(env.data) ? env.data : [],
    openingBalance: meta?.opening_balance,
    closingBalance: meta?.closing_balance,
  };
}

export async function getAccountLedger(params: {
  account: string;
  fromDate?: string;
  toDate?: string;
}): Promise<{ rows: unknown[]; openingBalance?: number; closingBalance?: number }> {
  const env = await callZatGoApi<unknown[]>(ZatGoApi.accounting.reportsAccountLedger, {
    account: params.account,
    from_date: params.fromDate || undefined,
    to_date: params.toDate || undefined,
  });
  const meta = env.meta as { opening_balance?: number; closing_balance?: number } | undefined;
  return {
    rows: Array.isArray(env.data) ? env.data : [],
    openingBalance: meta?.opening_balance,
    closingBalance: meta?.closing_balance,
  };
}

export async function getTrialBalance(params: { fromDate: string; toDate: string }): Promise<unknown[]> {
  const env = await callZatGoApi<unknown[]>(ZatGoApi.accounting.reportsTrialBalance, {
    from_date: params.fromDate,
    to_date: params.toDate,
  });
  return Array.isArray(env.data) ? env.data : [];
}

export async function getProfitAndLoss(params: {
  fromDate: string;
  toDate: string;
}): Promise<{ income: unknown[]; expense: unknown[]; incomeTotal: number; expenseTotal: number; netProfit: number }> {
  const env = await callZatGoApi<{
    income?: unknown[];
    expense?: unknown[];
    income_total?: number;
    expense_total?: number;
    net_profit?: number;
  }>(ZatGoApi.accounting.reportsProfitAndLoss, { from_date: params.fromDate, to_date: params.toDate });
  const data = unwrap(env);
  return {
    income: data?.income ?? [],
    expense: data?.expense ?? [],
    incomeTotal: data?.income_total ?? 0,
    expenseTotal: data?.expense_total ?? 0,
    netProfit: data?.net_profit ?? 0,
  };
}
