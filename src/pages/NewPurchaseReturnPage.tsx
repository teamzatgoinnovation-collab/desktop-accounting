import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, ErrorState, Input, Label, LoadingState, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { enqueueCreate } from "@/lib/offline";
import { money } from "@/lib/format";

type BillItem = {
  item_code?: string;
  item_name?: string;
  qty?: number;
  rate?: number;
};

type Bill = {
  id: string;
  name: string;
  supplier?: string;
  docstatus?: number;
  is_return?: boolean;
  items?: BillItem[];
};

type ReturnLine = { item_code: string; item_name: string; bought_qty: number; rate: number; return_qty: number };

export function NewPurchaseReturnPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName || "");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bill, setBill] = useState<Bill | null>(null);
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const env = await callZatGoApi<Bill>(ZatGoApi.accounting.purchaseInvoicesGet, { name });
        const row = (env.data as Bill) || null;
        if (!row) throw new Error("Bill not found");
        setBill(row);
        setLines(
          (row.items || []).map((it) => ({
            item_code: it.item_code || "",
            item_name: it.item_name || it.item_code || "",
            bought_qty: Number(it.qty || 0),
            rate: Number(it.rate || 0),
            return_qty: 0,
          })),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load bill");
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
        entityType: "purchase_return",
        method: ZatGoApi.accounting.purchaseInvoicesCreateReturn,
        args: {
          return_against: name,
          items: valid.map((l) => ({ item_code: l.item_code, qty: l.return_qty })),
          reason: reason || undefined,
        },
      });
      toast.success("Debit note queued — syncing");
      navigate("/sync");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create return failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading bill…" />;
  if (error) return <ErrorState title="Bill unavailable" description={error} onRetry={() => window.location.reload()} />;
  if (!bill) return <ErrorState title="Not found" description="Bill not found" />;

  if (bill.docstatus !== 1) {
    return (
      <ErrorState
        title="Cannot return"
        description="Only a submitted bill can have a return created against it."
      />
    );
  }
  if (bill.is_return) {
    return <ErrorState title="Cannot return" description="This bill is itself a debit note." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Return against ${bill.name}`}
        description={bill.supplier || "Supplier"}
        actions={
          <Button variant="outline" asChild>
            <Link to={`/bills/${encodeURIComponent(bill.name)}`}>Cancel</Link>
          </Button>
        }
      />

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-left">
            <tr>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Bought qty</th>
              <th className="px-4 py-2">Rate</th>
              <th className="px-4 py-2">Return qty</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={`${line.item_code}-${idx}`} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2">{line.item_name}</td>
                <td className="px-4 py-2 tabular-nums">{line.bought_qty}</td>
                <td className="px-4 py-2 tabular-nums">{money(line.rate)}</td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    min={0}
                    max={line.bought_qty}
                    step="any"
                    value={line.return_qty || ""}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setLines((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, return_qty: Math.min(v, l.bought_qty) } : l)),
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
        Create debit note
      </Button>
    </div>
  );
}
