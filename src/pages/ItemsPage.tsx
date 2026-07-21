import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ZatGoApi } from "@zatgo/erpnext";
import { DataTable, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { callZatGoApi } from "@/lib/call-zatgo-api";
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

export function ItemsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Item[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<Item[]>(ZatGoApi.warehouse.itemsList, {
        page: 1,
        page_size: 100,
      });
      setRows(Array.isArray(env.data) ? env.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const columns = useMemo<ColumnDef<Item>[]>(
    () => [
      { header: "Code", accessorKey: "item_code" },
      { header: "Name", accessorKey: "name" },
      { header: "Group", accessorKey: "category" },
      { header: "UOM", accessorKey: "uom" },
      {
        header: "Rate",
        cell: ({ row }) => <span className="tabular-nums">{money(row.original.rate ?? row.original.price)}</span>,
      },
    ],
    [],
  );

  if (loading) return <LoadingState label="Loading items…" />;
  if (error) return <ErrorState title="Items unavailable" description={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Items" description="Stock item catalog from ERPNext." />
      <DataTable data={rows} columns={columns} emptyMessage="No items yet." />
    </div>
  );
}
