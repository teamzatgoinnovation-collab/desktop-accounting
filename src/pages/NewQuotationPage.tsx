import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, Input, Label, PageHeader, Textarea } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { enqueueCreate, loadCachedList } from "@/lib/offline";

type Party = { id: string; name: string };
type Item = { id: string; name: string; item_code?: string; rate?: number };
type Line = { item_code: string; qty: number; rate: number; description: string; billing_type: string };

const BILLING_TYPES = ["One-time", "Annually", "Monthly"];

const emptyLine = (): Line => ({ item_code: "", qty: 1, rate: 0, description: "", billing_type: "One-time" });

type DuplicateState = { customer?: string };

export function NewQuotationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const duplicateFrom = (location.state as DuplicateState | null) || null;
  const [customers, setCustomers] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [customer, setCustomer] = useState(duplicateFrom?.customer || search.get("customer") || "");
  const [validTill, setValidTill] = useState("");
  const [terms, setTerms] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
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
        entityType: "quotation",
        method: ZatGoApi.accounting.quotationsCreate,
        args: {
          customer,
          items: valid.map((l) => ({
            item_code: l.item_code,
            qty: l.qty,
            rate: l.rate,
            description: l.description || undefined,
            billing_type: l.billing_type || undefined,
          })),
          valid_till: validTill || undefined,
          terms: terms || undefined,
        },
      });
      toast.success("Quotation queued — syncing");
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
        title="New quotation"
        description="Create a draft quotation, then submit and send it to the customer."
        actions={
          <Button variant="outline" asChild>
            <Link to="/quotations">Cancel</Link>
          </Button>
        }
      />

      <div className="grid max-w-xl gap-3 sm:grid-cols-2">
        <div className="space-y-2">
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
        <div className="space-y-2">
          <Label htmlFor="validTill">Valid until (optional)</Label>
          <Input id="validTill" type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)} />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Lines</h2>
        {lines.map((line, idx) => (
          <div key={idx} className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3">
            <div className="grid gap-2 sm:grid-cols-4">
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
                placeholder="Qty"
                value={line.qty}
                onChange={(e) =>
                  setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, qty: Number(e.target.value) } : l)))
                }
              />
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="Amount"
                value={line.rate}
                onChange={(e) =>
                  setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, rate: Number(e.target.value) } : l)))
                }
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <Input
                className="sm:col-span-3"
                placeholder="Description (optional)"
                value={line.description}
                onChange={(e) =>
                  setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, description: e.target.value } : l)))
                }
              />
              <select
                className="h-10 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-transparent px-3 text-sm"
                value={line.billing_type}
                onChange={(e) =>
                  setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, billing_type: e.target.value } : l)))
                }
              >
                {BILLING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
          Add line
        </Button>
      </div>

      <div className="max-w-xl space-y-2">
        <Label htmlFor="terms">Terms &amp; payment (optional)</Label>
        <Textarea
          id="terms"
          rows={4}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          placeholder="e.g. 50% advance before kick-off, 50% on completion. Prices exclude VAT."
        />
      </div>

      <Button disabled={busy} onClick={() => void onSave()}>
        Save draft
      </Button>
    </div>
  );
}
