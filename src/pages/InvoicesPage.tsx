import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, DataTable, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";

type Invoice = {
  id: string;
  name: string;
  customer?: string;
  status?: string;
  amount?: number;
  outstanding?: number;
  date?: string;
};

export function InvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Invoice[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<Invoice[]>(ZatGoApi.accounting.invoicesList, {
        page: 1,
        page_size: 100,
      });
      setRows(Array.isArray(env.data) ? env.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const columns = useMemo<ColumnDef<Invoice>[]>(
    () => [
      {
        header: "Invoice",
        accessorKey: "name",
        cell: ({ row }) => (
          <Link
            className="font-medium underline-offset-2 hover:underline"
            to={`/invoices/${encodeURIComponent(row.original.name)}`}
          >
            {row.original.name}
          </Link>
        ),
      },
      { header: "Customer", accessorKey: "customer" },
      { header: "Status", accessorKey: "status" },
      {
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => <span className="tabular-nums">{money(row.original.amount)}</span>,
      },
      {
        header: "Outstanding",
        accessorKey: "outstanding",
        cell: ({ row }) => <span className="tabular-nums">{money(row.original.outstanding)}</span>,
      },
      { header: "Date", accessorKey: "date" },
    ],
    [],
  );

  if (loading) return <LoadingState label="Loading invoices…" />;
  if (error) return <ErrorState title="Invoices unavailable" description={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer invoices"
        description="What customers owe you."
        actions={
          <Button asChild>
            <Link to="/invoices/new">New invoice</Link>
          </Button>
        }
      />
      <DataTable data={rows} columns={columns} emptyMessage="No invoices yet." />
    </div>
  );
}
