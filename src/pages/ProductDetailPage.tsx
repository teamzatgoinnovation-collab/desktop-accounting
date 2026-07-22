import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, ErrorState, Input, Label, LoadingState, PageHeader } from "@zatgo/ui";
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
};

export function ProductDetailPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName || "");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    item_name: "",
    item_group: "",
    stock_uom: "Nos",
    standard_rate: "",
  });

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
        standard_rate: String(row.rate ?? row.price ?? ""),
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
      await callZatGoApi(ZatGoApi.warehouse.itemsUpdate, {
        name,
        values: {
          item_name: form.item_name,
          item_group: form.item_group || undefined,
          stock_uom: form.stock_uom || undefined,
          standard_rate: form.standard_rate ? Number(form.standard_rate) : 0,
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
      <div className="grid max-w-xl gap-3">
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
    </div>
  );
}
