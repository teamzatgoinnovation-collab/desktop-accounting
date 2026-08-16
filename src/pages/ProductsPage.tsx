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

export function ProductsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    item_code: "",
    item_name: "",
    item_group: "All Item Groups",
    stock_uom: "Nos",
    standard_rate: "",
  });

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
  }, []);

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
          item_code: form.item_code.trim(),
          item_name: form.item_name.trim() || form.item_code.trim(),
          item_group: form.item_group || undefined,
          stock_uom: form.stock_uom || undefined,
          standard_rate: form.standard_rate ? Number(form.standard_rate) : 0,
          is_stock_item: 1,
        },
      });
      toast.success("Product queued — syncing");
      setOpen(false);
      setForm({
        item_code: "",
        item_name: "",
        item_group: "All Item Groups",
        stock_uom: "Nos",
        standard_rate: "",
      });
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add product</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
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
            <div className="space-y-1">
              <Label htmlFor="igroup">Group</Label>
              <Input
                id="igroup"
                value={form.item_group}
                onChange={(e) => setForm((f) => ({ ...f, item_group: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="iuom">UOM</Label>
              <Input
                id="iuom"
                value={form.stock_uom}
                onChange={(e) => setForm((f) => ({ ...f, stock_uom: e.target.value }))}
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
