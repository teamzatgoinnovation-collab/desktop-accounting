import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, Combobox, Input, Label, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";

type Party = { id: string; name: string };
type Item = { id: string; name: string; item_code?: string; rate?: number };
type Line = { item_code: string; qty: number; rate: number };
type CostCenter = { id: string; name: string; cost_center_name?: string };

type DuplicateState = { supplier?: string; lines?: Line[] };

export function NewBillPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const duplicateFrom = (location.state as DuplicateState | null) || null;
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [supplier, setSupplier] = useState(duplicateFrom?.supplier || search.get("supplier") || "");
  const [lines, setLines] = useState<Line[]>(
    duplicateFrom?.lines?.length ? duplicateFrom.lines : [{ item_code: "", qty: 1, rate: 0 }],
  );
  const [costCenter, setCostCenter] = useState("");
  const [project, setProject] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [s, i, cc] = await Promise.all([
          callZatGoApi<Party[]>(ZatGoApi.accounting.suppliersList, { page: 1, page_size: 100 }),
          callZatGoApi<Item[]>(ZatGoApi.accounting.invoicesListItems, { page: 1, page_size: 100 }),
          callZatGoApi<CostCenter[]>(ZatGoApi.accounting.journalsListCostCenters, { page: 1, page_size: 100 }),
        ]);
        setSuppliers(Array.isArray(s.data) ? s.data : []);
        setItems(Array.isArray(i.data) ? i.data : []);
        setCostCenters(Array.isArray(cc.data) ? cc.data : []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load form data");
      }
    })();
  }, []);

  const onSave = async () => {
    if (!supplier) {
      toast.error("Pick a supplier");
      return;
    }
    const valid = lines.filter((l) => l.item_code && l.qty > 0);
    if (!valid.length) {
      toast.error("Add at least one item");
      return;
    }
    setBusy(true);
    try {
      const env = await callZatGoApi<{ name: string }>(ZatGoApi.accounting.purchaseInvoicesCreate, {
        supplier,
        items: valid,
        cost_center: costCenter || undefined,
        project: project || undefined,
        client_id: crypto.randomUUID(),
      });
      const createdName = env.data?.name;
      toast.success(createdName ? `Bill ${createdName} created` : "Bill created");
      navigate(createdName ? `/bills/${encodeURIComponent(createdName)}` : "/bills", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New bill"
        description="Create a draft purchase bill, then submit when ready."
        actions={
          <Button variant="outline" asChild>
            <Link to="/bills">Cancel</Link>
          </Button>
        }
      />

      <div className="max-w-xl space-y-2">
        <Label htmlFor="supplier">Supplier</Label>
        <Combobox
          value={supplier}
          onValueChange={setSupplier}
          placeholder="Select…"
          searchPlaceholder="Search suppliers…"
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Lines</h2>
        {lines.map((line, idx) => (
          <div key={idx} className="grid gap-2 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Combobox
                value={line.item_code}
                onValueChange={(code) => {
                  const item = items.find((i) => (i.item_code || i.id) === code);
                  setLines((prev) =>
                    prev.map((l, i) =>
                      i === idx ? { ...l, item_code: code, rate: Number(item?.rate || l.rate || 0) } : l,
                    ),
                  );
                }}
                placeholder="Item…"
                searchPlaceholder="Search items…"
                options={items.map((it) => ({ value: it.item_code || it.id, label: it.name }))}
              />
            </div>
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

      <div className="max-w-xl space-y-3">
        {showMore ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="cc">Cost center (optional)</Label>
              <Combobox
                value={costCenter}
                onValueChange={setCostCenter}
                placeholder="Select…"
                searchPlaceholder="Search cost centers…"
                options={costCenters.map((c) => ({ value: c.id, label: c.cost_center_name || c.name }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="proj">Project (optional)</Label>
              <Input id="proj" value={project} onChange={(e) => setProject(e.target.value)} />
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="text-sm text-[var(--color-primary)] underline-offset-2 hover:underline"
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "Show less details" : "Show more details"}
        </button>
      </div>

      <Button disabled={busy} onClick={() => void onSave()}>
        Save draft
      </Button>
    </div>
  );
}
