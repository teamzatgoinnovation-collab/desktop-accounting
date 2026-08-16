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

type Supplier = {
  id: string;
  name: string;
  supplier_name?: string;
  supplier_type?: string;
  supplier_group?: string;
};

export function SuppliersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ supplier_name: "", email: "", phone: "" });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadCachedList<Supplier>("suppliers", async () => {
        const env = await callZatGoApi<Supplier[]>(ZatGoApi.accounting.suppliersList, { page: 1, page_size: 100 });
        return Array.isArray(env.data) ? env.data : [];
      });
      setRows(result.data);
      if (result.stale) toast.info("Showing last-known suppliers — offline");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const columns = useMemo<ColumnDef<Supplier>[]>(
    () => [
      {
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <Link
            className="font-medium underline-offset-2 hover:underline"
            to={`/suppliers/${encodeURIComponent(row.original.id)}`}
          >
            {row.original.name}
          </Link>
        ),
      },
      { header: "Type", accessorKey: "supplier_type" },
      { header: "Group", accessorKey: "supplier_group" },
    ],
    [],
  );

  const onCreate = async () => {
    if (!form.supplier_name.trim()) {
      toast.error("Name is required");
      return;
    }
    setBusy(true);
    try {
      await enqueueCreate({
        entityType: "supplier",
        method: ZatGoApi.accounting.suppliersCreate,
        args: {
          supplier_name: form.supplier_name.trim(),
          email: form.email || undefined,
          phone: form.phone || undefined,
        },
      });
      toast.success("Supplier queued — syncing");
      setOpen(false);
      setForm({ supplier_name: "", email: "", phone: "" });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading suppliers…" />;
  if (error) return <ErrorState title="Suppliers unavailable" description={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="People and companies you buy from."
        actions={<Button onClick={() => setOpen(true)}>Add supplier</Button>}
      />
      <DataTable data={rows} columns={columns} emptyMessage="No suppliers yet." />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="sname">Name</Label>
              <Input
                id="sname"
                value={form.supplier_name}
                onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="semail">Email</Label>
              <Input
                id="semail"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sphone">Phone</Label>
              <Input
                id="sphone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
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
