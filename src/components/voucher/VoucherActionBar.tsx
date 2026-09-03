import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@zatgo/ui";
import { BalanceSummary } from "./BalanceSummary";

// Renders inside a <TooltipProvider> supplied once by NewVoucherPage — this
// component doesn't own a provider itself so it doesn't nest one per row.
export function VoucherActionBar({
  entryCount,
  debitTotal,
  creditTotal,
  balanced,
  busy,
  disabledReason,
  onCancel,
  onSubmit,
}: {
  entryCount: number;
  debitTotal: number;
  creditTotal: number;
  balanced: boolean;
  busy: boolean;
  disabledReason: string | null;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const disabled = busy || disabledReason !== null;

  const postButton = (
    <Button disabled={disabled} onClick={onSubmit}>
      {busy ? "Posting…" : "Post Entry"}
    </Button>
  );

  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-background)]/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/80">
      <BalanceSummary entryCount={entryCount} debitTotal={debitTotal} creditTotal={creditTotal} balanced={balanced} />
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {disabledReason && !busy ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{postButton}</span>
            </TooltipTrigger>
            <TooltipContent>{disabledReason}</TooltipContent>
          </Tooltip>
        ) : (
          postButton
        )}
      </div>
    </div>
  );
}
