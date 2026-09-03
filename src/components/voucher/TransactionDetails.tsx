import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Input, Label } from "@zatgo/ui";

// Company/Branch are deliberately not fields here: no client-facing API sets
// either (company is resolved server-side, and no Branch dimension exists on
// Journal Entry in zatgo_core) — showing a dropdown with nowhere to send its
// value would be worse than not showing it.
export function TransactionDetails({
  remark,
  onRemarkChange,
  postingDate,
  onPostingDateChange,
  referenceNo,
  onReferenceNoChange,
  referenceDate,
  onReferenceDateChange,
}: {
  remark: string;
  onRemarkChange: (value: string) => void;
  postingDate: string;
  onPostingDateChange: (value: string) => void;
  referenceNo: string;
  onReferenceNoChange: (value: string) => void;
  referenceDate: string;
  onReferenceDateChange: (value: string) => void;
}) {
  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
      <h2 className="text-sm font-semibold">Transaction Details</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="postingDate">Posting date</Label>
          <Input id="postingDate" type="date" value={postingDate} onChange={(e) => onPostingDateChange(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="remark">Note</Label>
          <Input id="remark" value={remark} onChange={(e) => onRemarkChange(e.target.value)} placeholder="Optional" />
        </div>
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="advanced" className="border-b-0">
          <AccordionTrigger className="py-2 text-sm text-[var(--color-muted-foreground)] hover:no-underline">
            Advanced details
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 pt-1 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="vref">Reference no.</Label>
                <Input id="vref" value={referenceNo} onChange={(e) => onReferenceNoChange(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vrefdate">Reference date</Label>
                <Input id="vrefdate" type="date" value={referenceDate} onChange={(e) => onReferenceDateChange(e.target.value)} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
