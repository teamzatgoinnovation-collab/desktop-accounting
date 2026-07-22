import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";

type InvoiceItem = {
  item_code?: string;
  item_name?: string;
  qty?: number;
  rate?: number;
  amount?: number;
};

type Invoice = {
  id: string;
  name: string;
  customer?: string;
  status?: string;
  amount?: number;
  outstanding?: number;
  date?: string;
  due_date?: string;
  company?: string;
  remarks?: string;
  docstatus?: number;
  total_taxes_and_charges?: number;
  items?: InvoiceItem[];
  zatca_qr_base64?: string;
};

type ZatcaPayload = {
  qr_base64?: string;
  seller_name?: string;
  vat_number?: string;
  timestamp?: string;
  invoice_total?: number;
  vat_amount?: number;
};

export function InvoiceDetailPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [zatca, setZatca] = useState<ZatcaPayload | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<Invoice>(ZatGoApi.accounting.invoicesGet, { name });
      const row = (env.data as Invoice) || null;
      if (!row) throw new Error("Invoice not found");
      setInvoice(row);
      try {
        const qrEnv = await callZatGoApi<ZatcaPayload>(ZatGoApi.accounting.invoicesGetZatcaQr, { name });
        setZatca((qrEnv.data as ZatcaPayload) || null);
      } catch {
        setZatca(row.zatca_qr_base64 ? { qr_base64: row.zatca_qr_base64 } : null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [name]);

  const onSubmit = async () => {
    setBusy(true);
    try {
      await callZatGoApi(ZatGoApi.accounting.invoicesSubmit, { name });
      toast.success("Invoice submitted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading invoice…" />;
  if (error) return <ErrorState title="Invoice unavailable" description={error} onRetry={() => void load()} />;
  if (!invoice) return <ErrorState title="Not found" description="Invoice not found" />;

  const qrValue = zatca?.qr_base64 || invoice.zatca_qr_base64 || "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={invoice.name}
        description={`${invoice.customer || "Customer"} · ${invoice.status || "—"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/invoices">Back</Link>
            </Button>
            {invoice.docstatus === 0 ? (
              <Button disabled={busy} onClick={() => void onSubmit()}>
                Submit
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ["Date", invoice.date],
              ["Due", invoice.due_date],
              ["Amount", money(invoice.amount)],
              ["VAT", money(invoice.total_taxes_and_charges ?? zatca?.vat_amount)],
              ["Outstanding", money(invoice.outstanding)],
              ["Company", invoice.company],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3"
              >
                <dt className="text-xs text-[var(--color-muted-foreground)]">{label}</dt>
                <dd className="font-medium tabular-nums">{value || "—"}</dd>
              </div>
            ))}
          </dl>

          <section className="space-y-2">
            <h2 className="text-lg font-medium">Lines</h2>
            <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              {(invoice.items || []).length === 0 ? (
                <li className="px-4 py-6 text-sm text-[var(--color-muted-foreground)]">No lines.</li>
              ) : (
                (invoice.items || []).map((line, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{line.item_name || line.item_code}</p>
                      <p className="text-[var(--color-muted-foreground)]">
                        {line.qty} × {money(line.rate)}
                      </p>
                    </div>
                    <p className="tabular-nums">{money(line.amount)}</p>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        <section className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 print:border-0">
          <h2 className="text-sm font-medium">ZATCA Phase 2 QR</h2>
          {qrValue ? (
            <>
              <div className="rounded bg-white p-3">
                <QRCodeSVG value={qrValue} size={180} level="M" />
              </div>
              <p className="max-w-[220px] text-center text-xs text-[var(--color-muted-foreground)]">
                {zatca?.seller_name || "Seller"}
                {zatca?.vat_number ? ` · VAT ${zatca.vat_number}` : ""}
              </p>
            </>
          ) : (
            <p className="max-w-[220px] text-center text-sm text-[var(--color-muted-foreground)]">
              QR will appear after submit (or when totals are available).
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
