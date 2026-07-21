import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ZatGoApi } from "@zatgo/erpnext";
import { DataTable, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { callZatGoApi } from "@/lib/call-zatgo-api";

type StockRow = {
  id: string;
  name: string;
  item_code?: string;
  warehouse?: string;
  qty?: number;
  uom?: string;
  company?: string;
};

export function StockPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<StockRow[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<StockRow[]>(ZatGoApi.warehouse.stockList, {
        page: 1,
        page_size: 100,
      });
      setRows(Array.isArray(env.data) ? env.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stock");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const columns = useMemo<ColumnDef<StockRow>[]>(
    () => [
      { header: "Item", accessorKey: "item_code" },
      { header: "Warehouse", accessorKey: "warehouse" },
      {
        header: "Qty",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.qty != null ? row.original.qty : "—"}
            {row.original.uom ? ` ${row.original.uom}` : ""}
          </span>
        ),
      },
      { header: "Name", accessorKey: "name" },
    ],
    [],
  );

  if (loading) return <LoadingState label="Loading stock…" />;
  if (error) return <ErrorState title="Stock unavailable" description={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Stock" description="Bin balances by item and warehouse." />
      <DataTable data={rows} columns={columns} emptyMessage="No stock balances yet." />
    </div>
  );
}
