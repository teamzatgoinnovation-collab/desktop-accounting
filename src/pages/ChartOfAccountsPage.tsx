import { useEffect, useMemo, useState } from "react";
import { ZatGoApi } from "@zatgo/erpnext";
import {
  Button,
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
import { ChevronDown, ChevronRight } from "@zatgo/icons";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { money } from "@/lib/format";

type Account = {
  id: string;
  name: string;
  account_name: string;
  account_number?: string;
  parent_account?: string | null;
  account_type?: string;
  root_type?: string;
  is_group: number;
  disabled: number;
  company?: string;
};

type Balance = { balance: number; debit: number; credit: number; as_of: string };

const selectClass =
  "h-10 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-transparent px-3 text-sm";

const ROOT_TYPES = ["Asset", "Liability", "Equity", "Income", "Expense"];

function AccountRow({
  account,
  depth,
  childrenByParent,
  expanded,
  onToggle,
  onSelect,
  matches,
}: {
  account: Account;
  depth: number;
  childrenByParent: Map<string, Account[]>;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (account: Account) => void;
  matches: Set<string> | null;
}) {
  const kids = childrenByParent.get(account.id) || [];
  const isOpen = expanded.has(account.id);
  if (matches && !matches.has(account.id)) return null;

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-[var(--color-muted)]"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => (account.is_group ? onToggle(account.id) : onSelect(account))}
      >
        {account.is_group ? (
          isOpen ? (
            <ChevronDown className="size-4 shrink-0 text-[var(--color-muted-foreground)]" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-[var(--color-muted-foreground)]" />
          )
        ) : (
          <span className="inline-block size-4 shrink-0" />
        )}
        <span className={account.is_group ? "font-medium" : ""}>{account.account_name}</span>
        {account.disabled ? (
          <span className="ml-2 rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-xs text-[var(--color-muted-foreground)]">
            Disabled
          </span>
        ) : null}
        {!account.is_group ? (
          <button
            type="button"
            className="ml-auto text-xs text-[var(--color-primary)] underline-offset-2 hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(account);
            }}
          >
            View
          </button>
        ) : null}
      </div>
      {account.is_group && isOpen
        ? kids.map((child) => (
            <AccountRow
              key={child.id}
              account={child}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              matches={matches}
            />
          ))
        : null}
    </div>
  );
}

export function ChartOfAccountsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [rootTypeFilter, setRootTypeFilter] = useState("");
  const [selected, setSelected] = useState<Account | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    account_name: "",
    parent_account: "",
    account_type: "",
    is_group: false,
    account_number: "",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<Account[]>(ZatGoApi.accounting.accountsList, {});
      setAccounts(Array.isArray(env.data) ? env.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chart of accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Account[]>();
    for (const a of accounts) {
      const key = a.parent_account || "__root__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    for (const list of map.values()) list.sort((a, b) => a.account_name.localeCompare(b.account_name));
    return map;
  }, [accounts]);

  const roots = useMemo(() => {
    let list = childrenByParent.get("__root__") || [];
    if (rootTypeFilter) list = list.filter((a) => a.root_type === rootTypeFilter);
    return list;
  }, [childrenByParent, rootTypeFilter]);

  const groupAccounts = useMemo(() => accounts.filter((a) => a.is_group), [accounts]);

  // Search: match accounts by name, and keep their ancestor chain visible/expanded.
  const matches = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.trim().toLowerCase();
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const keep = new Set<string>();
    for (const a of accounts) {
      if (a.account_name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)) {
        let cur: Account | undefined = a;
        while (cur) {
          keep.add(cur.id);
          cur = cur.parent_account ? byId.get(cur.parent_account) : undefined;
        }
      }
    }
    return keep;
  }, [accounts, search]);

  useEffect(() => {
    if (matches) setExpanded(new Set(matches));
  }, [matches]);

  const onToggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSelect = async (account: Account) => {
    setSelected(account);
    setBalance(null);
    setBalanceLoading(true);
    try {
      const env = await callZatGoApi<Balance>(ZatGoApi.accounting.accountsBalance, { account: account.id });
      setBalance((env.data as Balance) || null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load balance");
    } finally {
      setBalanceLoading(false);
    }
  };

  const onToggleDisabled = async (account: Account) => {
    try {
      await callZatGoApi(ZatGoApi.accounting.accountsUpdate, {
        name: account.id,
        values: { disabled: account.disabled ? 0 : 1 },
      });
      toast.success(account.disabled ? "Account enabled" : "Account disabled");
      setSelected(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const onCreate = async () => {
    if (!form.account_name.trim() || !form.parent_account) {
      toast.error("Account name and parent account are required");
      return;
    }
    setBusy(true);
    try {
      await callZatGoApi(ZatGoApi.accounting.accountsCreate, {
        account_name: form.account_name.trim(),
        parent_account: form.parent_account,
        account_type: form.account_type || undefined,
        is_group: form.is_group ? 1 : 0,
        account_number: form.account_number || undefined,
      });
      toast.success("Account created");
      setOpen(false);
      setForm({ account_name: "", parent_account: "", account_type: "", is_group: false, account_number: "" });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading chart of accounts…" />;
  if (error) return <ErrorState title="Chart of accounts unavailable" description={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        description="Account tree — balances come directly from ERPNext, never computed locally."
        actions={<Button onClick={() => setOpen(true)}>+ New account</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search accounts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select className={selectClass} value={rootTypeFilter} onChange={(e) => setRootTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {ROOT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-2">
          {roots.length === 0 ? (
            <p className="px-2 py-6 text-sm text-[var(--color-muted-foreground)]">No accounts match.</p>
          ) : (
            roots.map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                depth={0}
                childrenByParent={childrenByParent}
                expanded={expanded}
                onToggle={onToggle}
                onSelect={(acc) => void onSelect(acc)}
                matches={matches}
              />
            ))
          )}
        </div>

        <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
          {!selected ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">Select an account to view its balance.</p>
          ) : (
            <>
              <div>
                <p className="font-medium">{selected.account_name}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">{selected.id}</p>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-[var(--color-muted-foreground)]">Type</dt>
                  <dd>{selected.account_type || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--color-muted-foreground)]">Root type</dt>
                  <dd>{selected.root_type || "—"}</dd>
                </div>
              </dl>
              {balanceLoading ? (
                <LoadingState label="Loading balance…" />
              ) : balance ? (
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                  <p className="text-xs text-[var(--color-muted-foreground)]">Balance as of {balance.as_of}</p>
                  <p className="text-lg font-semibold tabular-nums">{money(balance.balance)}</p>
                  <p className="text-xs text-[var(--color-muted-foreground)] tabular-nums">
                    Dr {money(balance.debit)} · Cr {money(balance.credit)}
                  </p>
                </div>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => void onToggleDisabled(selected)}>
                {selected.disabled ? "Enable account" : "Disable account"}
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="acname">Account name</Label>
              <Input id="acname" value={form.account_name} onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="acparent">Parent account (group)</Label>
              <select
                id="acparent"
                className={selectClass}
                value={form.parent_account}
                onChange={(e) => setForm((f) => ({ ...f, parent_account: e.target.value }))}
              >
                <option value="">Select…</option>
                {groupAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name} ({a.root_type})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="actype">Account type (optional)</Label>
                <Input id="actype" value={form.account_type} onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value }))} placeholder="Cash, Bank, Receivable…" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="acnum">Account number (optional)</Label>
                <Input id="acnum" value={form.account_number} onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2">
              <div>
                <Label htmlFor="acisgroup">Group account</Label>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  On = a parent other accounts nest under. Off = a postable ledger account.
                </p>
              </div>
              <Switch id="acisgroup" checked={form.is_group} onCheckedChange={(v) => setForm((f) => ({ ...f, is_group: v }))} />
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
