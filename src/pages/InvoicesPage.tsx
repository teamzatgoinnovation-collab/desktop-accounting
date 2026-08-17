import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, DataTable, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";
import { ListToolbar } from "@/components/ListToolbar";

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
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const haystack = `${r.name} ${r.customer ?? ""} ${r.status ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (fromDate && (!r.date || r.date < fromDate)) return false;
      if (toDate && (!r.date || r.date > toDate)) return false;
      return true;
    });
  }, [rows, search, fromDate, toDate]);

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
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search invoice # or customer…"
        fromDate={fromDate}
        onFromDateChange={setFromDate}
        toDate={toDate}
        onToDateChange={setToDate}
      />
      <DataTable data={filteredRows} columns={columns} emptyMessage="No invoices match." pageSize={15} />
    </div>
  );
}
