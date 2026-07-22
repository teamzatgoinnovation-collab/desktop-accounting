import { useEffect, useState } from "react";
import { ZatGoApi } from "@zatgo/erpnext";
import { Button, ErrorState, Label, LoadingState, PageHeader, Switch } from "@zatgo/ui";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";

type CompanySettings = {
  name?: string;
  company?: string;
  enable_negative_stock?: number | boolean;
  tax_id?: string;
};

export function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [allowNegative, setAllowNegative] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await callZatGoApi<CompanySettings>(ZatGoApi.settings.getCompanySettings, {});
      const data = (env.data as CompanySettings) || null;
      if (!data) throw new Error("No company settings found");
      setSettings(data);
      setAllowNegative(Boolean(data.enable_negative_stock));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSave = async () => {
    if (!settings?.name && !settings?.company) {
      toast.error("Company settings document missing");
      return;
    }
    setBusy(true);
    try {
      await callZatGoApi(ZatGoApi.settings.saveSettings, {
        doctype: "ZG Company Settings",
        name: settings.name,
        values: {
          enable_negative_stock: allowNegative ? 1 : 0,
        },
        category: "company",
      });
      toast.success("Settings saved — ERPNext Stock Settings synced");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading settings…" />;
  if (error) return <ErrorState title="Settings unavailable" description={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description={settings?.company ? `Company · ${settings.company}` : "Company stock settings"}
        actions={
          <Button disabled={busy} onClick={() => void onSave()}>
            Save
          </Button>
        }
      />

      <section className="max-w-xl space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="neg-stock">Allow negative stock</Label>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Syncs to ERPNext Stock Settings → Allow Negative Stock.
            </p>
          </div>
          <Switch id="neg-stock" checked={allowNegative} onCheckedChange={setAllowNegative} />
        </div>
        {settings?.tax_id ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">Tax ID: {settings.tax_id}</p>
        ) : (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Set Tax ID on ZG Company Settings (or Company) for ZATCA QR seller VAT.
          </p>
        )}
      </section>
    </div>
  );
}
