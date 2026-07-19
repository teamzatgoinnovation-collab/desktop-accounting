"use client";

import { useEffect, useState } from "react";
import { ZatGoApi } from "@zatgo/erpnext";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
} from "@zatgo/ui";
import { LayoutDashboard } from "@zatgo/icons";
import { callZatGoApi } from "@/lib/call-zatgo-api";

export function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hubOk, setHubOk] = useState(false);
  const [count, setCount] = useState(0);
  const [stub, setStub] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      await callZatGoApi(ZatGoApi.accounting.ping);
      setHubOk(true);
      const env = await callZatGoApi<unknown[]>(ZatGoApi.accounting.invoicesList, {
        page: 1,
        page_size: 20,
      });
      const rows = Array.isArray(env.data) ? env.data.length : 0;
      setCount(typeof env.meta?.total === "number" ? Number(env.meta.total) : rows);
      setStub(Boolean(env.meta?.stub));
    } catch (e) {
      setError(e instanceof Error ? e.message : "API error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <LoadingState label="Loading accounting…" />;
  if (error) {
    return <ErrorState title="Accounting unavailable" description={error} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting"
        description={hubOk ? (stub ? "Connected · API stub" : "Connected · hub ok") : "Connected"}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Invoices" value={count} icon={LayoutDashboard} />
      </div>

      {stub ? (
        <EmptyState
          title="API stub"
          description="Accounting DocTypes are not wired yet. Hub ping succeeded; list endpoints return stub data."
        />
      ) : null}
    </div>
  );
}
