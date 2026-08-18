import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, DataTable, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";
import { ListToolbar } from "@/components/ListToolbar";

type Quotation = {
  id: string;
  name: string;
  customer?: string;
  status?: string;
  amount?: number;
  date?: string;
  valid_till?: string;
};

export function QuotationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Quotation[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<Quotation[]>(ZatGoApi.accounting.quotationsList, {
        page: 1,
        page_size: 100,
      });
      setRows(Array.isArray(env.data) ? env.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load quotations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const columns = useMemo<ColumnDef<Quotation>[]>(
    () => [
      {
        header: "Quotation",
        accessorKey: "name",
        cell: ({ row }) => (
          <Link
            className="font-medium underline-offset-2 hover:underline"
            to={`/quotations/${encodeURIComponent(row.original.name)}`}
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
      { header: "Date", accessorKey: "date" },
      { header: "Valid till", accessorKey: "valid_till" },
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

  if (loading) return <LoadingState label="Loading quotations…" />;
  if (error) return <ErrorState title="Quotations unavailable" description={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        description="Proposals and quotes sent to customers, before they become invoices."
        actions={
          <Button asChild>
            <Link to="/quotations/new">New quotation</Link>
          </Button>
        }
      />
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search quotation # or customer…"
        fromDate={fromDate}
        onFromDateChange={setFromDate}
        toDate={toDate}
        onToDateChange={setToDate}
      />
      <DataTable data={filteredRows} columns={columns} emptyMessage="No quotations match." pageSize={15} />
    </div>
  );
}
