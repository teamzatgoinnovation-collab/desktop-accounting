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
} from "@zatgo/ui";
import { toast } from "sonner";
import {
  amendJournalEntry,
  cancelJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  getJournalEntryPdf,
  submitJournalEntry,
  updateJournalEntry,
  type Journal,
} from "@/api/erpnext/journals";
import { toFriendlyMessage } from "@/lib/friendly-error";
import { money } from "@/lib/format";
import { downloadPdfBase64 } from "@/lib/download";

export function JournalDetailPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName || "");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<Journal | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ userRemark: "", referenceNo: "" });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJournalEntry(name);
      setRow(data || null);
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
      await submitJournalEntry(name);
      toast.success("Journal submitted");
      await load();
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Submit failed"));
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    if (!window.confirm(`Cancel journal ${row?.name}? This reverses its GL impact.`)) return;
    setBusy(true);
    try {
      await cancelJournalEntry(name);
      toast.success("Journal cancelled");
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
      const amended = await amendJournalEntry(name);
      toast.success(`Amended as ${amended.name}`);
      if (amended.name) navigate(`/journals/${encodeURIComponent(amended.name)}`);
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Amend failed"));
    } finally {
      setBusy(false);
    }
  };

  const onDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const pdf = await getJournalEntryPdf(name);
      if (pdf.pdf_base64) downloadPdfBase64(pdf.pdf_base64, pdf.filename || `${name}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF download failed");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const openEdit = () => {
    if (!row) return;
    setEditForm({ userRemark: row.user_remark || "", referenceNo: row.reference_no || "" });
    setEditOpen(true);
  };

  const onSaveEdit = async () => {
    setBusy(true);
    try {
      await updateJournalEntry(name, {
        userRemark: editForm.userRemark || undefined,
        referenceNo: editForm.referenceNo || undefined,
      });
      toast.success("Journal updated");
      setEditOpen(false);
      await load();
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Update failed"));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm(`Delete journal ${row?.name}? This can't be undone.`)) return;
    setBusy(true);
    try {
      await deleteJournalEntry(name);
      toast.success("Journal deleted");
      navigate("/journals");
    } catch (e) {
      toast.error(toFriendlyMessage(e instanceof Error ? e.message : "Delete failed"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading journal…" />;
  if (error) return <ErrorState title="Journal unavailable" description={error} onRetry={() => void load()} />;
  if (!row) return <ErrorState title="Not found" description="Journal not found" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={row.name}
        description={`${row.title || "Journal"} · ${row.status || "—"}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/journals">Back</Link>
            </Button>
            <Button variant="outline" disabled={downloadingPdf} onClick={() => void onDownloadPdf()}>
              Download PDF
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigate("/journals", {
                  state: {
                    lines: (row.accounts || []).map((a) => ({
                      account: a.account,
                      debit: a.debit,
                      credit: a.credit,
                      cost_center: a.cost_center || "",
                      party_type: a.party_type || "",
                      party: a.party || "",
                    })),
                  },
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
              <Button variant="outline" disabled={busy} onClick={() => void onCancel()}>
                Cancel journal
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

      {row.user_remark || row.reference_no ? (
        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            ["Note", row.user_remark],
            ["Reference", row.reference_no],
            ["Reference date", row.reference_date],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={String(label)} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                <dt className="text-xs text-[var(--color-muted-foreground)]">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
        </dl>
      ) : null}

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-left">
            <tr>
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2">Party</th>
              <th className="px-4 py-2">Cost center</th>
              <th className="px-4 py-2">Debit</th>
              <th className="px-4 py-2">Credit</th>
            </tr>
          </thead>
          <tbody>
            {(row.accounts || []).map((a, i) => (
              <tr key={`${a.account}-${i}`} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2">{a.account}</td>
                <td className="px-4 py-2 text-[var(--color-muted-foreground)]">
                  {a.party ? `${a.party_type}: ${a.party}` : "—"}
                </td>
                <td className="px-4 py-2 text-[var(--color-muted-foreground)]">{a.cost_center || "—"}</td>
                <td className="px-4 py-2 tabular-nums">{money(a.debit)}</td>
                <td className="px-4 py-2 tabular-nums">{money(a.credit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {row.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="jremark">Note</Label>
              <Input
                id="jremark"
                value={editForm.userRemark}
                onChange={(e) => setEditForm((f) => ({ ...f, userRemark: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="jref">Reference no.</Label>
              <Input
                id="jref"
                value={editForm.referenceNo}
                onChange={(e) => setEditForm((f) => ({ ...f, referenceNo: e.target.value }))}
              />
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Account lines can't be edited here — delete this draft and create a new one to change them.
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
