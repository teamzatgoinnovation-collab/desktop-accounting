import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, ErrorState, Input, Label, LoadingState, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { enqueueCreate } from "@/lib/offline";
import { money } from "@/lib/format";

type InvoiceItem = {
  item_code?: string;
  item_name?: string;
  qty?: number;
  rate?: number;
};

type Invoice = {
  id: string;
  name: string;
  customer?: string;
  docstatus?: number;
  is_return?: boolean;
  items?: InvoiceItem[];
};

type ReturnLine = { item_code: string; item_name: string; sold_qty: number; rate: number; return_qty: number };

export function NewSalesReturnPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName || "");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const env = await callZatGoApi<Invoice>(ZatGoApi.accounting.invoicesGet, { name });
        const row = (env.data as Invoice) || null;
        if (!row) throw new Error("Invoice not found");
        setInvoice(row);
        setLines(
          (row.items || []).map((it) => ({
            item_code: it.item_code || "",
            item_name: it.item_name || it.item_code || "",
            sold_qty: Number(it.qty || 0),
            rate: Number(it.rate || 0),
            return_qty: 0,
          })),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    })();
  }, [name]);

  const onCreate = async () => {
    const valid = lines.filter((l) => l.return_qty > 0);
    if (!valid.length) {
      toast.error("Enter a return quantity for at least one item");
      return;
    }
    setBusy(true);
    try {
      await enqueueCreate({
        entityType: "sales_return",
        method: ZatGoApi.accounting.invoicesCreateReturn,
        args: {
          return_against: name,
          items: valid.map((l) => ({ item_code: l.item_code, qty: l.return_qty })),
          reason: reason || undefined,
        },
      });
      toast.success("Credit note queued — syncing");
      navigate("/sync");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create return failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading invoice…" />;
  if (error) return <ErrorState title="Invoice unavailable" description={error} onRetry={() => window.location.reload()} />;
  if (!invoice) return <ErrorState title="Not found" description="Invoice not found" />;

  if (invoice.docstatus !== 1) {
    return (
      <ErrorState
        title="Cannot return"
        description="Only a submitted invoice can have a return created against it."
      />
    );
  }
  if (invoice.is_return) {
    return <ErrorState title="Cannot return" description="This invoice is itself a credit note." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Return against ${invoice.name}`}
        description={invoice.customer || "Customer"}
        actions={
          <Button variant="outline" asChild>
            <Link to={`/invoices/${encodeURIComponent(invoice.name)}`}>Cancel</Link>
          </Button>
        }
      />

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-left">
            <tr>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Sold qty</th>
              <th className="px-4 py-2">Rate</th>
              <th className="px-4 py-2">Return qty</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={`${line.item_code}-${idx}`} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2">{line.item_name}</td>
                <td className="px-4 py-2 tabular-nums">{line.sold_qty}</td>
                <td className="px-4 py-2 tabular-nums">{money(line.rate)}</td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    min={0}
                    max={line.sold_qty}
                    step="any"
                    value={line.return_qty || ""}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setLines((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, return_qty: Math.min(v, l.sold_qty) } : l)),
                      );
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="max-w-xl space-y-2">
        <Label htmlFor="reason">Reason (optional)</Label>
        <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      <Button disabled={busy} onClick={() => void onCreate()}>
        Create credit note
      </Button>
    </div>
  );
}
