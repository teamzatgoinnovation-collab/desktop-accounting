import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, ErrorState, Input, Label, LoadingState, PageHeader, Switch, Textarea } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";

type Item = {
  id: string;
  name: string;
  item_code?: string;
  item_name?: string;
  category?: string;
  uom?: string;
  rate?: number;
  price?: number;
  available?: number;
  brand?: string;
  description?: string;
  sales_uom?: string;
  has_batch_no?: number;
  has_serial_no?: number;
  is_sales_item?: number;
  is_purchase_item?: number;
  default_warehouse?: string;
  reorder_level?: number;
  reorder_qty?: number;
  weight_per_unit?: number;
  weight_uom?: string;
};

type ItemGroupOption = { id: string; name: string; is_group: number };
type WarehouseOption = { id: string; name: string };

const selectClass =
  "h-10 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-transparent px-3 text-sm";

const emptyForm = {
  item_name: "",
  item_group: "",
  stock_uom: "Nos",
  sales_uom: "",
  standard_rate: "",
  brand: "",
  description: "",
  has_batch_no: false,
  has_serial_no: false,
  is_sales_item: true,
  is_purchase_item: true,
  default_warehouse: "",
  reorder_level: "",
  reorder_qty: "",
  weight_per_unit: "",
  weight_uom: "",
};

export function ProductDetailPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName || "");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [itemGroups, setItemGroups] = useState<ItemGroupOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<Item>(ZatGoApi.warehouse.itemsGet, { name });
      const row = (env.data as Item) || null;
      if (!row) throw new Error("Product not found");
      setForm({
        item_name: row.item_name || row.name || "",
        item_group: row.category || "",
        stock_uom: row.uom || "Nos",
        sales_uom: row.sales_uom || "",
        standard_rate: String(row.rate ?? row.price ?? ""),
        brand: row.brand || "",
        description: row.description || "",
        has_batch_no: !!row.has_batch_no,
        has_serial_no: !!row.has_serial_no,
        is_sales_item: row.is_sales_item !== 0,
        is_purchase_item: row.is_purchase_item !== 0,
        default_warehouse: row.default_warehouse || "",
        reorder_level: row.reorder_level ? String(row.reorder_level) : "",
        reorder_qty: row.reorder_qty ? String(row.reorder_qty) : "",
        weight_per_unit: row.weight_per_unit ? String(row.weight_per_unit) : "",
        weight_uom: row.weight_uom || "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [name]);

  useEffect(() => {
    void callZatGoApi<ItemGroupOption[]>(ZatGoApi.warehouse.itemGroupsList, { page: 1, page_size: 100 })
      .then((env) => setItemGroups(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
    void callZatGoApi<WarehouseOption[]>(ZatGoApi.warehouse.warehousesList, { page: 1, page_size: 100 })
      .then((env) => setWarehouses(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
  }, []);

  const leafItemGroups = useMemo(() => itemGroups.filter((g) => !g.is_group), [itemGroups]);

  const onSave = async () => {
    setBusy(true);
    try {
      await callZatGoApi(ZatGoApi.warehouse.itemsUpdate, {
        name,
        values: {
          item_name: form.item_name,
          item_group: form.item_group || undefined,
          stock_uom: form.stock_uom || undefined,
          sales_uom: form.sales_uom || undefined,
          standard_rate: form.standard_rate ? Number(form.standard_rate) : 0,
          brand: form.brand.trim() || undefined,
          description: form.description.trim() || undefined,
          has_batch_no: form.has_batch_no ? 1 : 0,
          has_serial_no: form.has_serial_no ? 1 : 0,
          is_sales_item: form.is_sales_item ? 1 : 0,
          is_purchase_item: form.is_purchase_item ? 1 : 0,
          default_warehouse: form.default_warehouse || undefined,
          reorder_level: form.reorder_level ? Number(form.reorder_level) : 0,
          reorder_qty: form.reorder_qty ? Number(form.reorder_qty) : undefined,
          weight_per_unit: form.weight_per_unit ? Number(form.weight_per_unit) : 0,
          weight_uom: form.weight_uom || undefined,
        },
      });
      toast.success("Product updated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const onDisable = async () => {
    setBusy(true);
    try {
      await callZatGoApi(ZatGoApi.warehouse.itemsUpdate, {
        name,
        values: { disabled: 1 },
      });
      toast.success("Product disabled");
      navigate("/products");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Disable failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading product…" />;
  if (error) return <ErrorState title="Product unavailable" description={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={form.item_name || name}
        description={`Item ${name}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/products">Back</Link>
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void onDisable()}>
              Disable
            </Button>
            <Button disabled={busy} onClick={() => void onSave()}>
              Save
            </Button>
          </div>
        }
      />
      <div className="grid max-w-2xl gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="iname">Name</Label>
            <Input
              id="iname"
              value={form.item_name}
              onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="igroup">Group</Label>
            <select
              id="igroup"
              className={selectClass}
              value={form.item_group}
              onChange={(e) => setForm((f) => ({ ...f, item_group: e.target.value }))}
            >
              <option value="">—</option>
              {leafItemGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="iuom">Stock UOM</Label>
            <Input
              id="iuom"
              value={form.stock_uom}
              onChange={(e) => setForm((f) => ({ ...f, stock_uom: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="isuom">Sales UOM</Label>
            <Input
              id="isuom"
              value={form.sales_uom}
              onChange={(e) => setForm((f) => ({ ...f, sales_uom: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="irate">Rate</Label>
            <Input
              id="irate"
              type="number"
              value={form.standard_rate}
              onChange={(e) => setForm((f) => ({ ...f, standard_rate: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ibrand">Brand (optional)</Label>
            <Input
              id="ibrand"
              value={form.brand}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="idefwh">Default warehouse (optional)</Label>
            <select
              id="idefwh"
              className={selectClass}
              value={form.default_warehouse}
              onChange={(e) => setForm((f) => ({ ...f, default_warehouse: e.target.value }))}
            >
              <option value="">None…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="idesc">Description (optional)</Label>
          <Textarea
            id="idesc"
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="ireorder">Reorder level (optional)</Label>
            <Input
              id="ireorder"
              type="number"
              value={form.reorder_level}
              onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ireorderqty">Reorder qty (optional)</Label>
            <Input
              id="ireorderqty"
              type="number"
              value={form.reorder_qty}
              onChange={(e) => setForm((f) => ({ ...f, reorder_qty: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="iweight">Weight (optional)</Label>
            <Input
              id="iweight"
              type="number"
              value={form.weight_per_unit}
              onChange={(e) => setForm((f) => ({ ...f, weight_per_unit: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["Sold to customers", form.is_sales_item, (v: boolean) => setForm((f) => ({ ...f, is_sales_item: v }))],
            ["Bought from suppliers", form.is_purchase_item, (v: boolean) => setForm((f) => ({ ...f, is_purchase_item: v }))],
            ["Tracks batch numbers", form.has_batch_no, (v: boolean) => setForm((f) => ({ ...f, has_batch_no: v }))],
            ["Tracks serial numbers", form.has_serial_no, (v: boolean) => setForm((f) => ({ ...f, has_serial_no: v }))],
          ].map(([label, checked, onChange]) => (
            <div
              key={label as string}
              className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2"
            >
              <Label className="text-sm font-normal">{label as string}</Label>
              <Switch checked={checked as boolean} onCheckedChange={onChange as (v: boolean) => void} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
