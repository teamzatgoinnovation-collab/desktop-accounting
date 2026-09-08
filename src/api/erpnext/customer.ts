import { ZatGoApi } from "@zatgo/erpnext";
import type { Party } from "@/types/accounting";
import { callZatGoApi, unwrap } from "./client";

export async function getCustomers(params: { page?: number; page_size?: number } = {}): Promise<Party[]> {
  const env = await callZatGoApi<Party[]>(ZatGoApi.accounting.customersList, { page: 1, page_size: 100, ...params });
  return Array.isArray(env.data) ? env.data : [];
}

export async function getCustomer(name: string): Promise<Party> {
  const env = await callZatGoApi<Party>(ZatGoApi.accounting.customersGet, { name });
  return unwrap(env);
}

export async function createCustomer(input: {
  customerName: string;
  customerType?: string;
  email?: string;
  phone?: string;
  clientId: string;
}): Promise<Party> {
  const env = await callZatGoApi<Party>(ZatGoApi.accounting.customersCreate, {
    customer_name: input.customerName,
    customer_type: input.customerType || "Company",
    email: input.email || undefined,
    phone: input.phone || undefined,
    client_id: input.clientId,
  });
  return unwrap(env);
}

export async function updateCustomer(name: string, values: Record<string, unknown>): Promise<Party> {
  const env = await callZatGoApi<Party>(ZatGoApi.accounting.customersUpdate, { name, values });
  return unwrap(env);
}

export async function deleteCustomer(name: string): Promise<void> {
  await callZatGoApi(ZatGoApi.accounting.customersDelete, { name });
}

/** Outstanding balance from the customer's real ERPNext ledger — not independently calculated. */
export async function getCustomerOutstanding(customerId: string): Promise<number> {
  const env = await callZatGoApi<{ closing_balance?: number }>(ZatGoApi.accounting.reportsPartyLedger, {
    party_type: "Customer",
    party: customerId,
  });
  return unwrap(env)?.closing_balance ?? 0;
}
