import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { ZatGoApi } from "@zatgo/erpnext";
import {
  Button,
  DataTable,
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
  Switch,
  Textarea,
} from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { enqueueCreate, loadCachedList } from "@/lib/offline";
import { money } from "@/lib/format";

type Item = {
  id: string;
  name: string;
  item_code?: string;
  item_name?: string;
  category?: string;
  uom?: string;
  price?: number;
  rate?: number;
};

type ItemGroupOption = { id: string; name: string; is_group: number };
type WarehouseOption = { id: string; name: string };

const selectClass =
  "h-10 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-transparent px-3 text-sm";

const emptyForm = {
  item_code: "",
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

export function ProductsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Item[]>([]);
  const [itemGroups, setItemGroups] = useState<ItemGroupOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadCachedList<Item>("products", async () => {
        const env = await callZatGoApi<Item[]>(ZatGoApi.warehouse.itemsList, { page: 1, page_size: 100 });
        return Array.isArray(env.data) ? env.data : [];
      });
      setRows(result.data);
      if (result.stale) toast.info("Showing last-known products — offline");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void callZatGoApi<ItemGroupOption[]>(ZatGoApi.warehouse.itemGroupsList, { page: 1, page_size: 100 })
      .then((env) => setItemGroups(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
    void callZatGoApi<WarehouseOption[]>(ZatGoApi.warehouse.warehousesList, { page: 1, page_size: 100 })
      .then((env) => setWarehouses(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
  }, []);

  const leafItemGroups = useMemo(() => itemGroups.filter((g) => !g.is_group), [itemGroups]);

  const columns = useMemo<ColumnDef<Item>[]>(
    () => [
      {
        header: "Code",
        accessorKey: "item_code",
        cell: ({ row }) => (
          <Link
            className="font-medium underline-offset-2 hover:underline"
            to={`/products/${encodeURIComponent(row.original.id || row.original.item_code || "")}`}
          >
            {row.original.item_code || row.original.id}
          </Link>
        ),
      },
      { header: "Name", accessorKey: "name" },
      { header: "Group", accessorKey: "category" },
      { header: "UOM", accessorKey: "uom" },
      {
        header: "Rate",
        cell: ({ row }) => (
          <span className="tabular-nums">{money(row.original.rate ?? row.original.price)}</span>
        ),
      },
    ],
    [],
  );

  const onCreate = async () => {
    if (!form.item_code.trim()) {
      toast.error("Item code is required");
      return;
    }
    setBusy(true);
    try {
      await enqueueCreate({
        entityType: "item",
        method: ZatGoApi.warehouse.itemsCreate,
        args: {
          item: {
            item_code: form.item_code.trim(),
            item_name: form.item_name.trim() || form.item_code.trim(),
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
            reorder_level: form.reorder_level ? Number(form.reorder_level) : undefined,
            weight: form.weight_per_unit ? Number(form.weight_per_unit) : undefined,
            weight_uom: form.weight_uom || undefined,
          },
        },
      });
      toast.success("Product queued — syncing");
      setOpen(false);
      setForm(emptyForm);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading products…" />;
  if (error) return <ErrorState title="Products unavailable" description={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Stock item catalog from ERPNext."
        actions={<Button onClick={() => setOpen(true)}>Add product</Button>}
      />
      <DataTable data={rows} columns={columns} emptyMessage="No products yet." />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add product</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="icode">Item code</Label>
                <Input
                  id="icode"
                  value={form.item_code}
                  onChange={(e) => setForm((f) => ({ ...f, item_code: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="iname">Name</Label>
                <Input
                  id="iname"
                  value={form.item_name}
                  onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="igroup">Item group</Label>
              <select
                id="igroup"
                className={selectClass}
                value={form.item_group}
                onChange={(e) => setForm((f) => ({ ...f, item_group: e.target.value }))}
              >
                <option value="">Default…</option>
                {leafItemGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
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
                  placeholder={form.stock_uom}
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ireorder">Reorder level (optional)</Label>
                <Input
                  id="ireorder"
                  type="number"
                  value={form.reorder_level}
                  onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="iweight">Weight (optional)</Label>
                  <Input
                    id="iweight"
                    type="number"
                    value={form.weight_per_unit}
                    onChange={(e) => setForm((f) => ({ ...f, weight_per_unit: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="iweightuom">Weight UOM</Label>
                  <Input
                    id="iweightuom"
                    value={form.weight_uom}
                    onChange={(e) => setForm((f) => ({ ...f, weight_uom: e.target.value }))}
                  />
                </div>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void onCreate()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
