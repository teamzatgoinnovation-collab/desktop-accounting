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

type Warehouse = {
  id: string;
  name: string;
  company?: string;
  parent_warehouse?: string;
};

export function WarehousesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Warehouse[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    warehouse_name: "",
    company: "",
    parent_warehouse: "",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadCachedList<Warehouse>("warehouses", async () => {
        const env = await callZatGoApi<Warehouse[]>(ZatGoApi.warehouse.warehousesList, {
          page: 1,
          page_size: 100,
        });
        return Array.isArray(env.data) ? env.data : [];
      });
      setRows(result.data);
      if (result.stale) toast.info("Showing last-known warehouses — offline");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load warehouses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const columns = useMemo<ColumnDef<Warehouse>[]>(
    () => [
      {
        header: "Warehouse",
        accessorKey: "name",
        cell: ({ row }) => (
          <Link
            className="font-medium underline-offset-2 hover:underline"
            to={`/warehouses/${encodeURIComponent(row.original.id)}`}
          >
            {row.original.name}
          </Link>
        ),
      },
      { header: "ID", accessorKey: "id" },
      { header: "Company", accessorKey: "company" },
    ],
    [],
  );

  const onCreate = async () => {
    if (!form.warehouse_name.trim()) {
      toast.error("Warehouse name is required");
      return;
    }
    setBusy(true);
    try {
      await enqueueCreate({
        entityType: "warehouse",
        method: ZatGoApi.warehouse.warehousesCreate,
        args: {
          warehouse_name: form.warehouse_name.trim(),
          company: form.company.trim() || undefined,
          parent_warehouse: form.parent_warehouse.trim() || undefined,
        },
      });
      toast.success("Warehouse queued — syncing");
      setOpen(false);
      setForm({ warehouse_name: "", company: "", parent_warehouse: "" });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading warehouses…" />;
  if (error) {
    return <ErrorState title="Warehouses unavailable" description={error} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        description="Non-group warehouse locations."
        actions={<Button onClick={() => setOpen(true)}>Add warehouse</Button>}
      />
      <DataTable data={rows} columns={columns} emptyMessage="No warehouses yet." />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add warehouse</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="wname">Name</Label>
              <Input
                id="wname"
                value={form.warehouse_name}
                onChange={(e) => setForm((f) => ({ ...f, warehouse_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wcompany">Company (optional)</Label>
              <Input
                id="wcompany"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wparent">Parent warehouse (optional)</Label>
              <Input
                id="wparent"
                value={form.parent_warehouse}
                onChange={(e) => setForm((f) => ({ ...f, parent_warehouse: e.target.value }))}
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
