import { ZatGoApi } from "@zatgo/erpnext";
import type { Party } from "@/types/accounting";
import { callZatGoApi, unwrap } from "./client";

export async function getSuppliers(params: { page?: number; page_size?: number } = {}): Promise<Party[]> {
  const env = await callZatGoApi<Party[]>(ZatGoApi.accounting.suppliersList, { page: 1, page_size: 100, ...params });
  return Array.isArray(env.data) ? env.data : [];
}

export async function getSupplier(name: string): Promise<Party> {
  const env = await callZatGoApi<Party>(ZatGoApi.accounting.suppliersGet, { name });
  return unwrap(env);
}

export async function createSupplier(input: {
  supplierName: string;
  email?: string;
  phone?: string;
  clientId: string;
}): Promise<Party> {
  const env = await callZatGoApi<Party>(ZatGoApi.accounting.suppliersCreate, {
    supplier_name: input.supplierName,
    email: input.email || undefined,
    phone: input.phone || undefined,
    client_id: input.clientId,
  });
  return unwrap(env);
}

export async function updateSupplier(name: string, values: Record<string, unknown>): Promise<Party> {
  const env = await callZatGoApi<Party>(ZatGoApi.accounting.suppliersUpdate, { name, values });
  return unwrap(env);
}

export async function deleteSupplier(name: string): Promise<void> {
  await callZatGoApi(ZatGoApi.accounting.suppliersDelete, { name });
}

/** Outstanding balance from the supplier's real ERPNext ledger — not independently calculated. */
export async function getSupplierOutstanding(supplierId: string): Promise<number> {
  const env = await callZatGoApi<{ closing_balance?: number }>(ZatGoApi.accounting.reportsPartyLedger, {
    party_type: "Supplier",
    party: supplierId,
  });
  return unwrap(env)?.closing_balance ?? 0;
}
