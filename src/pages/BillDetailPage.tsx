import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import {
  amendPurchaseInvoice,
  cancelPurchaseInvoice,
  deletePurchaseInvoice,
  getPurchaseInvoice,
  getPurchaseInvoicePdf,
  submitPurchaseInvoice,
} from "@/api/erpnext/purchase";
import { toFriendlyMessage } from "@/lib/friendly-error";
import { money } from "@/lib/format";
import { downloadPdfBase64 } from "@/lib/download";
import type { PurchaseInvoice } from "@/types/accounting";

type Bill = PurchaseInvoice;

export function BillDetailPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName || "");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<Bill | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const doc = await getPurchaseInvoice(name);
      setRow(doc || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
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
      await submitPurchaseInvoice(name);
      toast.success("Bill submitted");
      await load();
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Submit failed"));
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    if (!window.confirm(`Cancel bill ${row?.name}? This reverses its GL impact.`)) return;
    setBusy(true);
    try {
      await cancelPurchaseInvoice(name);
      toast.success("Bill cancelled");
      await load();
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Cancel failed"));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm(`Delete bill ${row?.name}? This can't be undone.`)) return;
    setBusy(true);
    try {
      await deletePurchaseInvoice(name);
      toast.success("Bill deleted");
      navigate("/bills");
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Delete failed"));
    } finally {
      setBusy(false);
    }
  };

  const onAmend = async () => {
    setBusy(true);
    try {
      const amended = await amendPurchaseInvoice(name);
      toast.success(`Amended as ${amended.name}`);
      if (amended.name) navigate(`/bills/${encodeURIComponent(amended.name)}`);
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Amend failed"));
    } finally {
      setBusy(false);
    }
  };

  const onDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const pdf = await getPurchaseInvoicePdf(name);
      if (pdf.pdf_base64) downloadPdfBase64(pdf.pdf_base64, pdf.filename || `${name}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF download failed");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) return <LoadingState label="Loading bill…" />;
  if (error) return <ErrorState title="Bill unavailable" description={error} onRetry={() => void load()} />;
  if (!row) return <ErrorState title="Not found" description="Bill not found" />;

  const isDraft = (row.status || "").toLowerCase() === "draft";

  return (
    <div className="space-y-6">
      <PageHeader
        title={row.name}
        description={`${row.supplier || "—"} · ${row.status || "—"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/bills">Back</Link>
            </Button>
            <Button variant="outline" disabled={downloadingPdf} onClick={() => void onDownloadPdf()}>
              Download PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/bills/new?supplier=${encodeURIComponent(row.supplier || "")}`)}
            >
              Duplicate
            </Button>
            {row.docstatus === 0 ? (
              <Button variant="outline" asChild>
                <Link to={`/bills/${encodeURIComponent(row.name)}/edit`}>Edit</Link>
              </Button>
            ) : null}
            {row.docstatus === 0 ? (
              <Button variant="outline" disabled={busy} onClick={() => void onDelete()}>
                Delete
              </Button>
            ) : null}
            {isDraft ? (
              <Button disabled={busy} onClick={() => void onSubmit()}>
                Submit
              </Button>
            ) : null}
            {(row.outstanding || 0) > 0 && !isDraft ? (
              <Button
                onClick={() =>
                  navigate(`/payment?invoice=${encodeURIComponent(row.name)}&amount=${row.outstanding}`)
                }
              >
                Pay bill
              </Button>
            ) : null}
            {row.docstatus === 1 && !row.is_return ? (
              <Button variant="outline" onClick={() => navigate(`/bills/${encodeURIComponent(row.name)}/return`)}>
                Create return
              </Button>
            ) : null}
            {row.docstatus === 1 ? (
              <Button variant="outline" disabled={busy} onClick={() => void onCancel()}>
                Cancel bill
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
          <p className="text-xs text-[var(--color-muted-foreground)]">Amount</p>
          <p className="text-xl font-semibold tabular-nums">{money(row.amount)}</p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
          <p className="text-xs text-[var(--color-muted-foreground)]">Outstanding</p>
          <p className="text-xl font-semibold tabular-nums">{money(row.outstanding)}</p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
          <p className="text-xs text-[var(--color-muted-foreground)]">Date</p>
          <p className="text-xl font-semibold">{row.date || "—"}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-left">
            <tr>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Rate</th>
              <th className="px-4 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(row.items || []).map((item, i) => (
              <tr key={`${item.item_code}-${i}`} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2">{item.item_name || item.item_code}</td>
                <td className="px-4 py-2 tabular-nums">{item.qty}</td>
                <td className="px-4 py-2 tabular-nums">{money(item.rate)}</td>
                <td className="px-4 py-2 tabular-nums">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
