import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Button, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import {
  amendSalesInvoice,
  cancelSalesInvoice,
  deleteSalesInvoice,
  getSalesInvoice,
  getSalesInvoicePdf,
  getZatcaQr,
  submitSalesInvoice,
} from "@/api/erpnext/sales";
import { toFriendlyMessage } from "@/lib/friendly-error";
import { money } from "@/lib/format";
import { downloadPdfBase64 } from "@/lib/download";
import type { SalesInvoice } from "@/types/accounting";

type Invoice = SalesInvoice;

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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [zatca, setZatca] = useState<ZatcaPayload | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await getSalesInvoice(name);
      if (!row) throw new Error("Invoice not found");
      setInvoice(row);
      try {
        const qr = await getZatcaQr(name);
        setZatca(qr || null);
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
      await submitSalesInvoice(name);
      toast.success("Invoice submitted");
      await load();
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Submit failed"));
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    if (!window.confirm(`Cancel invoice ${invoice?.name}? This reverses its GL impact.`)) return;
    setBusy(true);
    try {
      await cancelSalesInvoice(name);
      toast.success("Invoice cancelled");
      await load();
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Cancel failed"));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm(`Delete invoice ${invoice?.name}? This can't be undone.`)) return;
    setBusy(true);
    try {
      await deleteSalesInvoice(name);
      toast.success("Invoice deleted");
      navigate("/invoices");
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Delete failed"));
    } finally {
      setBusy(false);
    }
  };

  const onAmend = async () => {
    setBusy(true);
    try {
      const amended = await amendSalesInvoice(name);
      toast.success(`Amended as ${amended.name}`);
      if (amended.name) navigate(`/invoices/${encodeURIComponent(amended.name)}`);
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Amend failed"));
    } finally {
      setBusy(false);
    }
  };

  const onDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const pdf = await getSalesInvoicePdf(name);
      if (pdf.pdf_base64) downloadPdfBase64(pdf.pdf_base64, pdf.filename || `${name}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF download failed");
    } finally {
      setDownloadingPdf(false);
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
            <Button variant="outline" disabled={downloadingPdf} onClick={() => void onDownloadPdf()}>
              Download PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/invoices/new?customer=${encodeURIComponent(invoice.customer || "")}`)}
            >
              Duplicate
            </Button>
            {invoice.docstatus === 0 ? (
              <Button variant="outline" asChild>
                <Link to={`/invoices/${encodeURIComponent(invoice.name)}/edit`}>Edit</Link>
              </Button>
            ) : null}
            {invoice.docstatus === 0 ? (
              <Button variant="outline" disabled={busy} onClick={() => void onDelete()}>
                Delete
              </Button>
            ) : null}
            {invoice.docstatus === 0 ? (
              <Button disabled={busy} onClick={() => void onSubmit()}>
                Submit
              </Button>
            ) : null}
            {(invoice.outstanding || 0) > 0 && invoice.docstatus === 1 ? (
              <Button
                onClick={() =>
                  navigate(`/receipt?invoice=${encodeURIComponent(invoice.name)}&amount=${invoice.outstanding}`)
                }
              >
                Receive payment
              </Button>
            ) : null}
            {invoice.docstatus === 1 && !invoice.is_return ? (
              <Button variant="outline" onClick={() => navigate(`/invoices/${encodeURIComponent(invoice.name)}/return`)}>
                Create return
              </Button>
            ) : null}
            {invoice.docstatus === 1 ? (
              <Button variant="outline" disabled={busy} onClick={() => void onCancel()}>
                Cancel invoice
              </Button>
            ) : null}
            {invoice.docstatus === 2 ? (
              <Button disabled={busy} onClick={() => void onAmend()}>
                Amend
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
          <h2 className="text-sm font-medium">ZATCA QR (Phase 1)</h2>
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
