import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { callZatGoApi } from "@/lib/call-zatgo-api";

type Supplier = {
  id: string;
  name: string;
  supplier_type?: string;
  supplier_group?: string;
  email?: string;
  phone?: string;
};

export function SupplierDetailPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<Supplier | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<Supplier>(ZatGoApi.accounting.suppliersGet, { name });
      setRow((env.data as Supplier) || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [name]);

  if (loading) return <LoadingState label="Loading supplier…" />;
  if (error) return <ErrorState title="Supplier unavailable" description={error} onRetry={() => void load()} />;
  if (!row) return <ErrorState title="Not found" description="Supplier not found" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={row.name}
        description={row.supplier_type || "Supplier"}
        actions={
          <Button variant="outline" asChild>
            <Link to="/suppliers">Back</Link>
          </Button>
        }
      />
      <dl className="grid gap-3 sm:grid-cols-2">
        {[
          ["Group", row.supplier_group],
          ["Email", row.email],
          ["Phone", row.phone],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
            <dt className="text-xs text-[var(--color-muted-foreground)]">{label}</dt>
            <dd className="font-medium">{value || "—"}</dd>
          </div>
        ))}
      </dl>
      <Button asChild>
        <Link to={`/bills/new?supplier=${encodeURIComponent(row.id)}`}>New bill</Link>
      </Button>
    </div>
  );
}
