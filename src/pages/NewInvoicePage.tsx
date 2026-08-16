import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, Input, Label, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { enqueueCreate, loadCachedList } from "@/lib/offline";

type Party = { id: string; name: string };
type Item = { id: string; name: string; item_code?: string; rate?: number };
type Line = { item_code: string; qty: number; rate: number };

export function NewInvoicePage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [customers, setCustomers] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [customer, setCustomer] = useState(search.get("customer") || "");
  const [lines, setLines] = useState<Line[]>([{ item_code: "", qty: 1, rate: 0 }]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [c, i] = await Promise.all([
          loadCachedList<Party>("customers", async () => {
            const env = await callZatGoApi<Party[]>(ZatGoApi.accounting.customersList, { page: 1, page_size: 100 });
            return Array.isArray(env.data) ? env.data : [];
          }),
          loadCachedList<Item>("items", async () => {
            const env = await callZatGoApi<Item[]>(ZatGoApi.accounting.invoicesListItems, {
              page: 1,
              page_size: 100,
            });
            return Array.isArray(env.data) ? env.data : [];
          }),
        ]);
        setCustomers(c.data);
        setItems(i.data);
        if (c.stale || i.stale) toast.info("Showing last-known data — offline");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load form data");
      }
    })();
  }, []);

  const onSave = async () => {
    if (!customer) {
      toast.error("Pick a customer");
      return;
    }
    const valid = lines.filter((l) => l.item_code && l.qty > 0);
    if (!valid.length) {
      toast.error("Add at least one item");
      return;
    }
    setBusy(true);
    try {
      await enqueueCreate({
        entityType: "sales_invoice",
        method: ZatGoApi.accounting.invoicesCreate,
        args: { customer, items: valid },
      });
      toast.success("Invoice queued — syncing");
      navigate("/sync", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New invoice"
        description="Create a draft sales invoice, then submit when ready."
        actions={
          <Button variant="outline" asChild>
            <Link to="/invoices">Cancel</Link>
          </Button>
        }
      />

      <div className="max-w-xl space-y-2">
        <Label htmlFor="customer">Customer</Label>
        <select
          id="customer"
          className="h-10 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-transparent px-3 text-sm"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
        >
          <option value="">Select…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Lines</h2>
        {lines.map((line, idx) => (
          <div key={idx} className="grid gap-2 sm:grid-cols-4">
            <select
              className="h-10 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-transparent px-3 text-sm sm:col-span-2"
              value={line.item_code}
              onChange={(e) => {
                const code = e.target.value;
                const item = items.find((i) => (i.item_code || i.id) === code);
                setLines((prev) =>
                  prev.map((l, i) =>
                    i === idx ? { ...l, item_code: code, rate: Number(item?.rate || l.rate || 0) } : l,
                  ),
                );
              }}
            >
              <option value="">Item…</option>
              {items.map((it) => (
                <option key={it.id} value={it.item_code || it.id}>
                  {it.name}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={0}
              step="any"
              value={line.qty}
              onChange={(e) =>
                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, qty: Number(e.target.value) } : l)))
              }
            />
            <Input
              type="number"
              min={0}
              step="any"
              value={line.rate}
              onChange={(e) =>
                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, rate: Number(e.target.value) } : l)))
              }
            />
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() => setLines((prev) => [...prev, { item_code: "", qty: 1, rate: 0 }])}
        >
          Add line
        </Button>
      </div>

      <Button disabled={busy} onClick={() => void onSave()}>
        Save draft
      </Button>
    </div>
  );
}
