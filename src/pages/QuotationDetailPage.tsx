import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";
import { downloadPdfBase64 } from "@/lib/download";

type QuotationItem = {
  item_code?: string;
  item_name?: string;
  description?: string;
  qty?: number;
  rate?: number;
  amount?: number;
  billing_type?: string;
};

type Quotation = {
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

export function QuotationDetailPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName || "");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [row, setRow] = useState<Quotation | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<Quotation>(ZatGoApi.accounting.quotationsGet, { name });
      const data = (env.data as Quotation) || null;
      if (!data) throw new Error("Quotation not found");
      setRow(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load quotation");
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
      await callZatGoApi(ZatGoApi.accounting.quotationsSubmit, { name });
      toast.success("Quotation submitted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    if (!window.confirm(`Cancel quotation ${row?.name}?`)) return;
    setBusy(true);
    try {
      await callZatGoApi(ZatGoApi.accounting.quotationsCancel, { name });
      toast.success("Quotation cancelled");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  };

  const onAmend = async () => {
    setBusy(true);
    try {
      const env = await callZatGoApi<{ name: string }>(ZatGoApi.accounting.quotationsAmend, { name });
      const amended = env.data?.name;
      toast.success(`Amended as ${amended}`);
      if (amended) navigate(`/quotations/${encodeURIComponent(amended)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Amend failed");
    } finally {
      setBusy(false);
    }
  };

  const onConvert = async () => {
    setBusy(true);
    try {
      const env = await callZatGoApi<{ name: string }>(ZatGoApi.accounting.quotationsConvertToInvoice, { name });
      const invoiceName = env.data?.name;
      toast.success(`Created invoice ${invoiceName}`);
      if (invoiceName) navigate(`/invoices/${encodeURIComponent(invoiceName)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Convert failed");
    } finally {
      setBusy(false);
    }
  };

  const onDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const env = await callZatGoApi<{ pdf_base64: string; filename: string }>(ZatGoApi.accounting.quotationsGetPdf, {
        name,
      });
      if (env.data?.pdf_base64) downloadPdfBase64(env.data.pdf_base64, env.data.filename || `${name}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF download failed");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) return <LoadingState label="Loading quotation…" />;
  if (error) return <ErrorState title="Quotation unavailable" description={error} onRetry={() => void load()} />;
  if (!row) return <ErrorState title="Not found" description="Quotation not found" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={row.name}
        description={`${row.customer || "Customer"} · ${row.status || "—"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/quotations">Back</Link>
            </Button>
            <Button variant="outline" disabled={downloadingPdf} onClick={() => void onDownloadPdf()}>
              Download PDF
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigate("/quotations/new", {
                  state: { customer: row.customer_id },
                })
              }
            >
              Duplicate
            </Button>
            {row.docstatus === 0 ? (
              <Button disabled={busy} onClick={() => void onSubmit()}>
                Submit
              </Button>
            ) : null}
            {row.docstatus === 1 ? (
              <Button disabled={busy} onClick={() => void onConvert()}>
                Convert to invoice
              </Button>
            ) : null}
            {row.docstatus === 1 ? (
              <Button variant="outline" disabled={busy} onClick={() => void onCancel()}>
                Cancel
              </Button>
            ) : null}
            {row.docstatus === 2 ? (
              <Button disabled={busy} onClick={() => void onAmend()}>
                Amend
              </Button>
            ) : null}
          </div>
        }
      />

      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ["Date", row.date],
          ["Valid till", row.valid_till || "—"],
          ["Amount", money(row.amount)],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
            <dt className="text-xs text-[var(--color-muted-foreground)]">{label}</dt>
            <dd className="font-medium tabular-nums">{value || "—"}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Lines</h2>
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-muted)] text-left">
              <tr>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Qty</th>
                <th className="px-4 py-2">Rate</th>
                <th className="px-4 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(row.items || []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-[var(--color-muted-foreground)]" colSpan={5}>
                    No lines.
                  </td>
                </tr>
              ) : (
                (row.items || []).map((item, i) => (
                  <tr key={i} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-2">
                      <div className="font-medium">{item.item_name || item.item_code}</div>
                      {item.description ? (
                        <div className="text-xs text-[var(--color-muted-foreground)]">{item.description}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-[var(--color-muted-foreground)]">{item.billing_type || "—"}</td>
                    <td className="px-4 py-2 tabular-nums">{item.qty}</td>
                    <td className="px-4 py-2 tabular-nums">{money(item.rate)}</td>
                    <td className="px-4 py-2 tabular-nums">{money(item.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {row.terms ? (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Terms &amp; payment</h2>
          <p className="whitespace-pre-wrap rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 text-sm text-[var(--color-muted-foreground)]">
            {row.terms}
          </p>
        </section>
      ) : null}
    </div>
  );
}
