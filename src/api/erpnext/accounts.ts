import { ZatGoApi } from "@zatgo/erpnext";
import type { AccountOption } from "@/types/accounting";
import { callZatGoApi, unwrap } from "./client";

export async function getAccounts(company?: string): Promise<AccountOption[]> {
  const env = await callZatGoApi<AccountOption[]>(ZatGoApi.accounting.accountsList, company ? { company } : {});
  return Array.isArray(env.data) ? env.data : [];
}

export async function getAccountBalance(account: string): Promise<{ debit?: number; credit?: number }> {
  const env = await callZatGoApi<{ debit?: number; credit?: number }>(ZatGoApi.accounting.accountsBalance, {
    account,
  });
  return unwrap(env);
}

export async function createAccount(input: {
  accountName: string;
  parentAccount: string;
  isGroup?: boolean;
  accountType?: string;
}): Promise<AccountOption> {
  const env = await callZatGoApi<AccountOption>(ZatGoApi.accounting.accountsCreate, {
    account_name: input.accountName,
    parent_account: input.parentAccount,
    is_group: input.isGroup ? 1 : 0,
    account_type: input.accountType || undefined,
  });
  return unwrap(env);
}

export async function updateAccount(name: string, values: Record<string, unknown>): Promise<AccountOption> {
  const env = await callZatGoApi<AccountOption>(ZatGoApi.accounting.accountsUpdate, { name, values });
  return unwrap(env);
}
