import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ZatGoApi } from "@zatgo/erpnext";
import { DataTable, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { callZatGoApi } from "@/lib/call-zatgo-api";

type Warehouse = {
  id: string;
  name: string;
  company?: string;
};

export function WarehousesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Warehouse[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<Warehouse[]>(ZatGoApi.warehouse.warehousesList, {
        page: 1,
        page_size: 100,
      });
      setRows(Array.isArray(env.data) ? env.data : []);
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
      { header: "Warehouse", accessorKey: "name" },
      { header: "ID", accessorKey: "id" },
      { header: "Company", accessorKey: "company" },
    ],
    [],
  );

  if (loading) return <LoadingState label="Loading warehouses…" />;
  if (error) {
    return <ErrorState title="Warehouses unavailable" description={error} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Warehouses" description="Non-group warehouse locations." />
      <DataTable data={rows} columns={columns} emptyMessage="No warehouses yet." />
    </div>
  );
}
