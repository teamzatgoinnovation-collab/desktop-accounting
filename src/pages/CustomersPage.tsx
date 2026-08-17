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
import { ListToolbar } from "@/components/ListToolbar";

type Customer = {
  id: string;
  name: string;
  customer_name?: string;
  customer_type?: string;
  territory?: string;
  email?: string;
  phone?: string;
};

export function CustomersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    customer_name: "",
    email: "",
    phone: "",
    customer_type: "Company",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadCachedList<Customer>("customers", async () => {
        const env = await callZatGoApi<Customer[]>(ZatGoApi.accounting.customersList, { page: 1, page_size: 100 });
        return Array.isArray(env.data) ? env.data : [];
      });
      setRows(result.data);
      if (result.stale) toast.info("Showing last-known customers — offline");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <Link
            className="font-medium underline-offset-2 hover:underline"
            to={`/customers/${encodeURIComponent(row.original.id)}`}
          >
            {row.original.name}
          </Link>
        ),
      },
      { header: "Type", accessorKey: "customer_type" },
      { header: "Territory", accessorKey: "territory" },
      { header: "Email", accessorKey: "email" },
      { header: "Phone", accessorKey: "phone" },
    ],
    [],
  );

  const onCreate = async () => {
    if (!form.customer_name.trim()) {
      toast.error("Name is required");
      return;
    }
    setBusy(true);
    try {
      await enqueueCreate({
        entityType: "customer",
        method: ZatGoApi.accounting.customersCreate,
        args: {
          customer_name: form.customer_name.trim(),
          customer_type: form.customer_type,
          email: form.email || undefined,
          phone: form.phone || undefined,
        },
      });
      toast.success("Customer queued — syncing");
      setOpen(false);
      setForm({ customer_name: "", email: "", phone: "", customer_type: "Company" });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.name} ${r.customer_type ?? ""} ${r.territory ?? ""} ${r.email ?? ""} ${r.phone ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, search]);

  if (loading) return <LoadingState label="Loading customers…" />;
  if (error) return <ErrorState title="Customers unavailable" description={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="People and companies who buy from you."
        actions={<Button onClick={() => setOpen(true)}>Add customer</Button>}
      />
      <ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search customers…" />
      <DataTable data={filteredRows} columns={columns} emptyMessage="No customers match." pageSize={15} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="cname">Name</Label>
              <Input
                id="cname"
                value={form.customer_name}
                onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cemail">Email</Label>
              <Input
                id="cemail"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cphone">Phone</Label>
              <Input
                id="cphone"
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
