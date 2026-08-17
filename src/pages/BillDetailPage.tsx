import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";
import { downloadPdfBase64 } from "@/lib/download";

type Bill = {
  id: string;
  name: string;
  supplier?: string;
  status?: string;
  amount?: number;
  outstanding?: number;
  date?: string;
  docstatus?: number;
  is_return?: boolean;
  items?: { item_code: string; item_name?: string; qty: number; rate: number; amount: number }[];
};

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
      const env = await callZatGoApi<Bill>(ZatGoApi.accounting.purchaseInvoicesGet, { name });
      setRow((env.data as Bill) || null);
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
      await callZatGoApi(ZatGoApi.accounting.purchaseInvoicesSubmit, { name });
      toast.success("Bill submitted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    if (!window.confirm(`Cancel bill ${row?.name}? This reverses its GL and stock impact.`)) return;
    setBusy(true);
    try {
      await callZatGoApi(ZatGoApi.accounting.purchaseInvoicesCancel, { name });
      toast.success("Bill cancelled");
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
      const env = await callZatGoApi<{ name: string }>(ZatGoApi.accounting.purchaseInvoicesAmend, { name });
      const amended = env.data?.name;
      toast.success(`Amended as ${amended}`);
      if (amended) navigate(`/bills/${encodeURIComponent(amended)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Amend failed");
    } finally {
      setBusy(false);
    }
  };

  const onDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const env = await callZatGoApi<{ pdf_base64: string; filename: string }>(
        ZatGoApi.accounting.purchaseInvoicesGetPdf,
        { name },
      );
      if (env.data?.pdf_base64) downloadPdfBase64(env.data.pdf_base64, env.data.filename || `${name}.pdf`);
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
              onClick={() =>
                navigate("/bills/new", {
                  state: {
                    supplier: row.supplier,
                    lines: (row.items || []).map((l) => ({
                      item_code: l.item_code || "",
                      qty: l.qty || 1,
                      rate: l.rate || 0,
                    })),
                  },
                })
              }
            >
              Duplicate
            </Button>
            {isDraft ? (
              <Button disabled={busy} onClick={() => void onSubmit()}>
                Submit
              </Button>
            ) : null}
            {(row.outstanding || 0) > 0 && !isDraft ? (
              <Button
                onClick={() =>
                  navigate(`/payments?pay=${encodeURIComponent(row.name)}&amount=${row.outstanding}`)
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
