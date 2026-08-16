import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";

type Journal = {
  id: string;
  name: string;
  title?: string;
  status?: string;
  date?: string;
  docstatus?: number;
  accounts?: { account: string; debit: number; credit: number }[];
};

export function JournalDetailPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName || "");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<Journal | null>(null);

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
            {row.docstatus === 0 ? (
              <Button disabled={busy} onClick={() => void onSubmit()}>
                Submit
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-left">
            <tr>
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2">Debit</th>
              <th className="px-4 py-2">Credit</th>
            </tr>
          </thead>
          <tbody>
            {(row.accounts || []).map((a, i) => (
              <tr key={`${a.account}-${i}`} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2">{a.account}</td>
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
