import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ZatGoApi } from "@zatgo/erpnext";
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Input,
  Label,
  LoadingState,
  PageHeader,
  Switch,
} from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { loadCachedList } from "@/lib/offline";

type ItemGroup = {
  id: string;
  name: string;
  parent_item_group?: string | null;
  is_group: number;
};

export function ItemGroupsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ItemGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ item_group_name: "", parent_item_group: "", is_group: false });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadCachedList<ItemGroup>("item-groups", async () => {
        const env = await callZatGoApi<ItemGroup[]>(ZatGoApi.warehouse.itemGroupsList, {
          page: 1,
          page_size: 100,
        });
        return Array.isArray(env.data) ? env.data : [];
      });
      setRows(result.data);
      if (result.stale) toast.info("Showing last-known item groups — offline");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load item groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const columns = useMemo<ColumnDef<ItemGroup>[]>(
    () => [
      { header: "Name", accessorKey: "name" },
      { header: "Parent", accessorKey: "parent_item_group" },
      {
        header: "Type",
        cell: ({ row }) => (row.original.is_group ? "Group" : "Leaf"),
      },
    ],
    [],
  );

  const onCreate = async () => {
    if (!form.item_group_name.trim()) {
      toast.error("Item group name is required");
      return;
    }
    setBusy(true);
    try {
      await callZatGoApi(ZatGoApi.warehouse.itemGroupsCreate, {
        item_group_name: form.item_group_name.trim(),
        parent_item_group: form.parent_item_group.trim() || undefined,
        is_group: form.is_group ? 1 : 0,
      });
      toast.success("Item group created");
      setOpen(false);
      setForm({ item_group_name: "", parent_item_group: "", is_group: false });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading item groups…" />;
  if (error) {
    return <ErrorState title="Item groups unavailable" description={error} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Item Groups"
        description="Category tree for products — pick a parent group to nest, or leave blank for a top-level group."
        actions={<Button onClick={() => setOpen(true)}>Add item group</Button>}
      />
      <DataTable data={rows} columns={columns} emptyMessage="No item groups yet." />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add item group</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="igname">Name</Label>
              <Input
                id="igname"
                value={form.item_group_name}
                onChange={(e) => setForm((f) => ({ ...f, item_group_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="igparent">Parent group (optional — defaults to root)</Label>
              <Input
                id="igparent"
                value={form.parent_item_group}
                onChange={(e) => setForm((f) => ({ ...f, parent_item_group: e.target.value }))}
                list="item-group-names"
                placeholder="All Item Groups"
              />
              <datalist id="item-group-names">
                {rows.map((r) => (
                  <option key={r.id} value={r.id} />
                ))}
              </datalist>
            </div>
            <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2">
              <div>
                <Label htmlFor="igisgroup">Group node (folder)</Label>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  On = a parent folder other groups nest under. Off = a leaf group items can be assigned to.
                </p>
              </div>
              <Switch
                id="igisgroup"
                checked={form.is_group}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_group: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void onCreate()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
