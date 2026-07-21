import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ZatGoApi } from "@zatgo/erpnext";
import { DataTable, ErrorState, LoadingState, PageHeader } from "@zatgo/ui";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";

type Journal = {
  id: string;
  name: string;
  title?: string;
  date?: string;
  total_debit?: number;
  total_credit?: number;
  status?: string;
};

export function JournalsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Journal[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<Journal[]>(ZatGoApi.accounting.journalsList, {
        page: 1,
        page_size: 50,
      });
      setRows(Array.isArray(env.data) ? env.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load journals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const columns = useMemo<ColumnDef<Journal>[]>(
    () => [
      { header: "Journal", accessorKey: "name" },
      { header: "Title", accessorKey: "title" },
      { header: "Date", accessorKey: "date" },
      {
        header: "Debit",
        cell: ({ row }) => <span className="tabular-nums">{money(row.original.total_debit)}</span>,
      },
      {
        header: "Credit",
        cell: ({ row }) => <span className="tabular-nums">{money(row.original.total_credit)}</span>,
      },
      { header: "Status", accessorKey: "status" },
    ],
    [],
  );

  if (loading) return <LoadingState label="Loading journals…" />;
  if (error) return <ErrorState title="Journals unavailable" description={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Journals" description="Manual journal entries." />
      <DataTable data={rows} columns={columns} emptyMessage="No journals yet." />
    </div>
  );
}
