import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, DataTable, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";

type Bill = {
  id: string;
  name: string;
  supplier?: string;
  status?: string;
  amount?: number;
  outstanding?: number;
  date?: string;
};

export function BillsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Bill[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<Bill[]>(ZatGoApi.accounting.purchaseInvoicesList, {
        page: 1,
        page_size: 100,
      });
      setRows(Array.isArray(env.data) ? env.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const columns = useMemo<ColumnDef<Bill>[]>(
    () => [
      {
        header: "Bill",
        accessorKey: "name",
        cell: ({ row }) => (
          <Link
            className="font-medium underline-offset-2 hover:underline"
            to={`/bills/${encodeURIComponent(row.original.name)}`}
          >
            {row.original.name}
          </Link>
        ),
      },
      { header: "Supplier", accessorKey: "supplier" },
      { header: "Status", accessorKey: "status" },
      {
        header: "Amount",
        cell: ({ row }) => <span className="tabular-nums">{money(row.original.amount)}</span>,
      },
      {
        header: "Outstanding",
        cell: ({ row }) => <span className="tabular-nums">{money(row.original.outstanding)}</span>,
      },
      { header: "Date", accessorKey: "date" },
    ],
    [],
  );

  if (loading) return <LoadingState label="Loading bills…" />;
  if (error) return <ErrorState title="Bills unavailable" description={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bills"
        description="What you owe suppliers."
        actions={
          <Button asChild>
            <Link to="/bills/new">New bill</Link>
          </Button>
        }
      />
      <DataTable data={rows} columns={columns} emptyMessage="No bills yet." />
    </div>
  );
}
