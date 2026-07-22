import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, ErrorState, Input, Label, LoadingState, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";

type Customer = {
  id: string;
  name: string;
  customer_name?: string;
  customer_type?: string;
  territory?: string;
  email?: string;
  phone?: string;
  customer_group?: string;
  disabled?: number;
};

export function CustomerDetailPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName || "");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_type: "Company",
    email: "",
    phone: "",
    territory: "",
    customer_group: "",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<Customer>(ZatGoApi.accounting.customersGet, { name });
      const row = (env.data as Customer) || null;
      if (!row) throw new Error("Customer not found");
      setForm({
        customer_name: row.customer_name || row.name || "",
        customer_type: row.customer_type || "Company",
        email: row.email || "",
        phone: row.phone || "",
        territory: row.territory || "",
        customer_group: row.customer_group || "",
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

  const onSave = async () => {
    setBusy(true);
    try {
      await callZatGoApi(ZatGoApi.accounting.customersUpdate, {
        name,
        values: {
          customer_name: form.customer_name,
          customer_type: form.customer_type,
          email: form.email || undefined,
          phone: form.phone || undefined,
          territory: form.territory || undefined,
          customer_group: form.customer_group || undefined,
        },
      });
      toast.success("Customer updated");
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
      await callZatGoApi(ZatGoApi.accounting.customersUpdate, {
        name,
        values: { disabled: 1 },
      });
      toast.success("Customer disabled");
      navigate("/customers");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Disable failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading customer…" />;
  if (error) return <ErrorState title="Customer unavailable" description={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={form.customer_name || name}
        description="Edit customer details"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/customers">Back</Link>
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
      <div className="grid max-w-xl gap-3">
        <div className="space-y-1">
          <Label htmlFor="cname">Name</Label>
          <Input
            id="cname"
            value={form.customer_name}
            onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ctype">Type</Label>
          <Input
            id="ctype"
            value={form.customer_type}
            onChange={(e) => setForm((f) => ({ ...f, customer_type: e.target.value }))}
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
        <div className="space-y-1">
          <Label htmlFor="cterr">Territory</Label>
          <Input
            id="cterr"
            value={form.territory}
            onChange={(e) => setForm((f) => ({ ...f, territory: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cgroup">Group</Label>
          <Input
            id="cgroup"
            value={form.customer_group}
            onChange={(e) => setForm((f) => ({ ...f, customer_group: e.target.value }))}
          />
        </div>
      </div>
    </div>
  );
}
