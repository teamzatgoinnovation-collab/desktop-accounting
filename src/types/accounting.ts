/** Shared accounting domain types — consolidates what was previously redeclared per-page. */

export type Party = { id: string; name: string; customer_name?: string; supplier_name?: string };

export type CostCenter = { id: string; name: string; cost_center_name?: string };

export type AccountOption = { id: string; name: string; account_name?: string; account_type?: string };

export type SalesEntryInput = {
  customer: string;
  amount: number;
  postingDate?: string;
  costCenter?: string;
  remarks?: string;
};

export type PurchaseEntryInput = {
  supplier: string;
  amount: number;
  postingDate?: string;
  costCenter?: string;
  remarks?: string;
};

export type SalesInvoice = {
  id: string;
  name: string;
  customer?: string;
  status?: string;
  docstatus?: number;
  date?: string;
  due_date?: string;
  amount?: number;
  outstanding?: number;
  company?: string;
  remarks?: string;
  is_return?: boolean;
  return_against?: string;
  total_taxes_and_charges?: number;
  zatca_qr_base64?: string;
  items?: Array<{ item_code?: string; item_name?: string; qty?: number; rate?: number; amount?: number }>;
};

export type PurchaseInvoice = {
  id: string;
  name: string;
  supplier?: string;
  status?: string;
  docstatus?: number;
  date?: string;
  due_date?: string;
  amount?: number;
  outstanding?: number;
  company?: string;
  remarks?: string;
  is_return?: boolean;
  return_against?: string;
  items?: Array<{ item_code?: string; item_name?: string; qty?: number; rate?: number; amount?: number }>;
};

export type PaymentEntry = {
  id: string;
  name: string;
  payment_type?: string;
  party_type?: string;
  party?: string;
  amount?: number;
  date?: string;
  mode_of_payment?: string;
  docstatus?: number;
  status?: string;
};
