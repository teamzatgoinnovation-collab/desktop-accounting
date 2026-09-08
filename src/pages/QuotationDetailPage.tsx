import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Input,
  Label,
  LoadingState,
  PageHeader,
  Textarea,
} from "@zatgo/ui";
import { toast } from "sonner";
import {
  amendQuotation,
  cancelQuotation,
  convertQuotationToInvoice,
  deleteQuotation,
  getQuotation,
  getQuotationPdf,
  submitQuotation,
  updateQuotation,
  type Quotation,
} from "@/api/erpnext/quotations";
import { toFriendlyMessage } from "@/lib/friendly-error";
import { money } from "@/lib/format";
import { downloadPdfBase64 } from "@/lib/download";

export function QuotationDetailPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName || "");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [row, setRow] = useState<Quotation | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ validTill: "", terms: "" });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQuotation(name);
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
      await submitQuotation(name);
      toast.success("Quotation submitted");
      await load();
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Submit failed"));
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    if (!window.confirm(`Cancel quotation ${row?.name}?`)) return;
    setBusy(true);
    try {
      await cancelQuotation(name);
      toast.success("Quotation cancelled");
      await load();
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Cancel failed"));
    } finally {
      setBusy(false);
    }
  };

  const onAmend = async () => {
    setBusy(true);
    try {
      const amended = await amendQuotation(name);
      toast.success(`Amended as ${amended.name}`);
      if (amended.name) navigate(`/quotations/${encodeURIComponent(amended.name)}`);
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Amend failed"));
    } finally {
      setBusy(false);
    }
  };

  const onConvert = async () => {
    setBusy(true);
    try {
      const converted = await convertQuotationToInvoice(name);
      toast.success(`Created invoice ${converted.name}`);
      if (converted.name) navigate(`/invoices/${encodeURIComponent(converted.name)}`);
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Convert failed"));
    } finally {
      setBusy(false);
    }
  };

  const onDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const pdf = await getQuotationPdf(name);
      if (pdf.pdf_base64) downloadPdfBase64(pdf.pdf_base64, pdf.filename || `${name}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF download failed");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const openEdit = () => {
    if (!row) return;
    setEditForm({ validTill: row.valid_till || "", terms: row.terms || "" });
    setEditOpen(true);
  };

  const onSaveEdit = async () => {
    setBusy(true);
    try {
      await updateQuotation(name, { validTill: editForm.validTill || undefined, terms: editForm.terms || undefined });
      toast.success("Quotation updated");
      setEditOpen(false);
      await load();
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Update failed"));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm(`Delete quotation ${row?.name}? This can't be undone.`)) return;
    setBusy(true);
    try {
      await deleteQuotation(name);
      toast.success("Quotation deleted");
      navigate("/quotations");
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Delete failed"));
    } finally {
      setBusy(false);
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
              <Button variant="outline" onClick={openEdit}>
                Edit
              </Button>
            ) : null}
            {row.docstatus === 0 ? (
              <Button variant="outline" disabled={busy} onClick={() => void onDelete()}>
                Delete
              </Button>
            ) : null}
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {row.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="qvalidtill">Valid until</Label>
              <Input
                id="qvalidtill"
                type="date"
                value={editForm.validTill}
                onChange={(e) => setEditForm((f) => ({ ...f, validTill: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qterms">Terms &amp; payment</Label>
              <Textarea
                id="qterms"
                rows={4}
                value={editForm.terms}
                onChange={(e) => setEditForm((f) => ({ ...f, terms: e.target.value }))}
              />
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Line items can't be edited here — delete this draft and create a new one to change items.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void onSaveEdit()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
