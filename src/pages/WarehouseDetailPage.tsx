import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, ErrorState, Input, Label, LoadingState, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";

type Warehouse = {
  id: string;
  name: string;
  company?: string;
  parent_warehouse?: string;
  disabled?: number;
};

export function WarehouseDetailPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName || "");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      const env = await callZatGoApi<Warehouse>(ZatGoApi.warehouse.warehousesGet, { name });
      const row = (env.data as Warehouse) || null;
      if (!row) throw new Error("Warehouse not found");
      setForm({
        warehouse_name: row.name || "",
        company: row.company || "",
        parent_warehouse: row.parent_warehouse || "",
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
      await callZatGoApi(ZatGoApi.warehouse.warehousesUpdate, {
        name,
        values: {
          warehouse_name: form.warehouse_name,
          company: form.company || undefined,
          parent_warehouse: form.parent_warehouse || undefined,
        },
      });
      toast.success("Warehouse updated");
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
      await callZatGoApi(ZatGoApi.warehouse.warehousesUpdate, {
        name,
        values: { disabled: 1 },
      });
      toast.success("Warehouse disabled");
      navigate("/warehouses");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Disable failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading warehouse…" />;
  if (error) {
    return <ErrorState title="Warehouse unavailable" description={error} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={form.warehouse_name || name}
        description={`Warehouse ${name}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/warehouses">Back</Link>
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
          <Label htmlFor="wname">Name</Label>
          <Input
            id="wname"
            value={form.warehouse_name}
            onChange={(e) => setForm((f) => ({ ...f, warehouse_name: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="wcompany">Company</Label>
          <Input
            id="wcompany"
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="wparent">Parent warehouse</Label>
          <Input
            id="wparent"
            value={form.parent_warehouse}
            onChange={(e) => setForm((f) => ({ ...f, parent_warehouse: e.target.value }))}
          />
        </div>
      </div>
    </div>
  );
}
