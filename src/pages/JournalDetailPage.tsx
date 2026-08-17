import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";
import { downloadPdfBase64 } from "@/lib/download";

type Journal = {
  id: string;
  name: string;
  title?: string;
  status?: string;
  date?: string;
  docstatus?: number;
  company?: string;
  user_remark?: string;
  reference_no?: string;
  reference_date?: string;
  accounts?: {
    account: string;
    debit: number;
    credit: number;
    cost_center?: string;
    party_type?: string;
    party?: string;
  }[];
};

export function JournalDetailPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName || "");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<Journal | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<Journal>(ZatGoApi.accounting.journalsGet, { name });
      setRow((env.data as Journal) || null);
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
      await callZatGoApi(ZatGoApi.accounting.journalsSubmit, { name });
      toast.success("Journal submitted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    if (!window.confirm(`Cancel journal ${row?.name}? This reverses its GL impact.`)) return;
    setBusy(true);
    try {
      await callZatGoApi(ZatGoApi.accounting.journalsCancel, { name });
      toast.success("Journal cancelled");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  };

  const onDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const env = await callZatGoApi<{ pdf_base64: string; filename: string }>(ZatGoApi.accounting.journalsGetPdf, {
        name,
      });
      if (env.data?.pdf_base64) downloadPdfBase64(env.data.pdf_base64, env.data.filename || `${name}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF download failed");
    } finally {
      setDownloadingPdf(false);
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
    </div>
  );
}
