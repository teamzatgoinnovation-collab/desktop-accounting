import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ZatGoApi } from "@zatgo/erpnext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  PageHeader,
  TooltipProvider,
} from "@zatgo/ui";
import { ArrowLeft, MoreHorizontal } from "@zatgo/icons";
import { toast } from "sonner";
import { callZatGoApi } from "@/lib/call-zatgo-api";
import { isCashOrBankAccountType, type AccountOption, type CostCenter, type PartyOption } from "@/components/payment-form-parts";
import { VoucherTypeSelector } from "@/components/voucher/VoucherTypeSelector";
import { TransactionDetails } from "@/components/voucher/TransactionDetails";
import { JournalEntryTable } from "@/components/voucher/JournalEntryTable";
import { VoucherActionBar } from "@/components/voucher/VoucherActionBar";
import { useUnsavedChangesGuard } from "@/components/voucher/use-unsaved-changes-guard";
import {
  BACKEND_VOUCHER_TYPE,
  emptyLine,
  isBalanced,
  validateLines,
  type Line,
  type VoucherType,
} from "@/components/voucher/voucher-domain";

type JournalEntryData = { name: string; docstatus?: number; status?: string };
type CreateMeta = { submitted?: boolean; submit_error?: string };

const todayIso = () => new Date().toISOString().slice(0, 10);
const isLineEmpty = (l: Line) => !l.account && !l.debit && !l.credit && !l.cost_center && !l.party_type && !l.party;

export function NewVoucherPage() {
  const navigate = useNavigate();
  const [voucherType, setVoucherType] = useState<VoucherType>("Receipt");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [customers, setCustomers] = useState<PartyOption[]>([]);
  const [suppliers, setSuppliers] = useState<PartyOption[]>([]);
  const [employees, setEmployees] = useState<PartyOption[]>([]);
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [remark, setRemark] = useState("");
  const [postingDate, setPostingDate] = useState(todayIso);
  const [referenceNo, setReferenceNo] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void callZatGoApi<AccountOption[]>(ZatGoApi.accounting.journalsListAccounts, {})
      .then((env) => setAccounts(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
    void callZatGoApi<CostCenter[]>(ZatGoApi.accounting.journalsListCostCenters, { page: 1, page_size: 100 })
      .then((env) => setCostCenters(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
    void callZatGoApi<PartyOption[]>(ZatGoApi.accounting.customersList, { page: 1, page_size: 200 })
      .then((env) => setCustomers(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
    void callZatGoApi<PartyOption[]>(ZatGoApi.accounting.suppliersList, { page: 1, page_size: 200 })
      .then((env) => setSuppliers(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
    void callZatGoApi<PartyOption[]>(ZatGoApi.hr.employeesList, { page: 1, page_size: 200 })
      .then((env) => setEmployees(Array.isArray(env.data) ? env.data : []))
      .catch(() => undefined);
  }, []);

  const accountTypeById = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const a of accounts) map.set(a.id, a.account_type);
    return map;
  }, [accounts]);

  const isCashBank = (accountId: string) => isCashOrBankAccountType(accountTypeById.get(accountId));

  const debitTotal = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const creditTotal = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const balanced = isBalanced(debitTotal, creditTotal);

  const validLines = useMemo(() => lines.filter((l) => l.account && (l.debit > 0 || l.credit > 0)), [lines]);

  const disabledReason = useMemo(() => {
    if (validLines.length < 2) return "Need at least two account lines";
    if (!balanced) return "Debit and credit must match";
    return validateLines(voucherType, validLines, isCashBank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validLines, balanced, voucherType, accountTypeById]);

  const dirty = lines.some((l) => !isLineEmpty(l)) || lines.length !== 2 || Boolean(remark) || Boolean(referenceNo) || Boolean(referenceDate);
  const { confirmNavigation, isConfirmOpen, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(dirty);

  const resetForm = () => {
    setLines([emptyLine(), emptyLine()]);
    setRemark("");
    setPostingDate(todayIso());
    setReferenceNo("");
    setReferenceDate("");
  };

  const onCreate = async () => {
    const valid = lines.filter((l) => l.account && (l.debit > 0 || l.credit > 0));
    if (valid.length < 2) {
      toast.error("Need at least two account lines");
      return;
    }
    if (!balanced) {
      toast.error("Debit and credit must match");
      return;
    }
    const lineError = validateLines(voucherType, valid, isCashBank);
    if (lineError) {
      toast.error(lineError);
      return;
    }
    setBusy(true);
    try {
      const env = await callZatGoApi<JournalEntryData>(ZatGoApi.accounting.journalsCreate, {
        accounts: valid.map((l) => ({
          account: l.account,
          debit: l.debit,
          credit: l.credit,
          cost_center: l.cost_center || undefined,
          party_type: l.party_type || undefined,
          party: l.party || undefined,
        })),
        voucher_type: BACKEND_VOUCHER_TYPE[voucherType],
        posting_date: postingDate || undefined,
        user_remark: remark || undefined,
        reference_no: referenceNo || undefined,
        reference_date: referenceDate || undefined,
        client_id: crypto.randomUUID(),
      });
      const meta = env.meta as CreateMeta;
      if (meta.submitted === false) {
        toast.warning(`Saved as Draft — posting failed: ${meta.submit_error ?? "unknown error"}`);
      } else {
        toast.success(`${voucherType} entry posted`);
      }
      resetForm();
      navigate(`/journals/${encodeURIComponent(env.data.name)}`, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 pb-4">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" aria-label="Back" onClick={() => confirmNavigation(() => navigate(-1))}>
            <ArrowLeft />
          </Button>
          <div className="flex-1">
            <PageHeader
              title="New voucher"
              description="Create and post a Receipt, Payment, Contra, or Journal entry."
              actions={
                <>
                  <Button variant="outline" onClick={() => confirmNavigation(() => navigate("/journals"))}>
                    View journals
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="More actions">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => confirmNavigation(resetForm)}>Reset form</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              }
            />
          </div>
        </div>

        <VoucherTypeSelector value={voucherType} onChange={setVoucherType} />

        <TransactionDetails
          remark={remark}
          onRemarkChange={setRemark}
          postingDate={postingDate}
          onPostingDateChange={setPostingDate}
          referenceNo={referenceNo}
          onReferenceNoChange={setReferenceNo}
          referenceDate={referenceDate}
          onReferenceDateChange={setReferenceDate}
        />

        <JournalEntryTable
          lines={lines}
          accounts={accounts}
          costCenters={costCenters}
          customers={customers}
          suppliers={suppliers}
          employees={employees}
          isCashBank={isCashBank}
          onChange={setLines}
        />

        <VoucherActionBar
          entryCount={lines.length}
          debitTotal={debitTotal}
          creditTotal={creditTotal}
          balanced={balanced}
          busy={busy}
          disabledReason={disabledReason}
          onCancel={() => confirmNavigation(() => navigate("/journals"))}
          onSubmit={() => void onCreate()}
        />
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={(open) => !open && cancelDiscard()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in this voucher. Leaving now will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDiscard}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscard}>Discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
