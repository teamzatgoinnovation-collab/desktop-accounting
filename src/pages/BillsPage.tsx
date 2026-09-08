import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Button, Combobox, DataTable, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { getPurchaseInvoices } from "@/api/erpnext/purchase";
import { getSuppliers } from "@/api/erpnext/supplier";
import { money } from "@/lib/format";
import { ListToolbar } from "@/components/ListToolbar";
import type { Party, PurchaseInvoice } from "@/types/accounting";

type Bill = PurchaseInvoice;

export function BillsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Bill[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [party, setParty] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [billRows, supplierRows] = await Promise.all([getPurchaseInvoices(), getSuppliers()]);
      setRows(billRows);
      setSuppliers(supplierRows);
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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const haystack = `${r.name} ${r.supplier ?? ""} ${r.status ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (party && r.supplier !== party) return false;
      if (fromDate && (!r.date || r.date < fromDate)) return false;
      if (toDate && (!r.date || r.date > toDate)) return false;
      return true;
    });
  }, [rows, search, fromDate, toDate, party]);

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
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search bill # or supplier…"
        fromDate={fromDate}
        onFromDateChange={setFromDate}
        toDate={toDate}
        onToDateChange={setToDate}
      >
        <div className="min-w-[200px] space-y-1">
          <label className="text-sm font-medium text-[var(--color-foreground)]">Supplier</label>
          <Combobox
            value={party}
            onValueChange={setParty}
            placeholder="All suppliers"
            searchPlaceholder="Search suppliers…"
            options={[{ value: "", label: "All suppliers" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
          />
        </div>
      </ListToolbar>
      <DataTable data={filteredRows} columns={columns} emptyMessage="No bills match." pageSize={15} />
    </div>
  );
}
