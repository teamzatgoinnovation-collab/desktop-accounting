import { Combobox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@zatgo/ui";
import type { PartyOption } from "@/components/payment-form-parts";
import { toPartyOptions } from "./voucher-domain";

export function PartyField({
  rowIndex,
  partyType,
  party,
  customers,
  suppliers,
  employees,
  onPartyTypeChange,
  onPartyChange,
}: {
  rowIndex: number;
  partyType: string;
  party: string;
  customers: PartyOption[];
  suppliers: PartyOption[];
  employees: PartyOption[];
  onPartyTypeChange: (value: string) => void;
  onPartyChange: (value: string) => void;
}) {
  const parties = partyType === "Customer" ? customers : partyType === "Supplier" ? suppliers : partyType === "Employee" ? employees : [];

  return (
    <div className="space-y-1.5">
      <Select value={partyType} onValueChange={onPartyTypeChange}>
        <SelectTrigger aria-label={`Party type for line ${rowIndex + 1}`}>
          <SelectValue placeholder="Party (optional)…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Customer">Customer</SelectItem>
          <SelectItem value="Supplier">Supplier</SelectItem>
          <SelectItem value="Employee">Employee</SelectItem>
        </SelectContent>
      </Select>
      {partyType ? (
        <Combobox
          value={party}
          onValueChange={onPartyChange}
          placeholder={`Select ${partyType.toLowerCase()}…`}
          searchPlaceholder={`Search ${partyType.toLowerCase()}s…`}
          options={toPartyOptions(parties, partyType)}
          aria-label={`${partyType} for line ${rowIndex + 1}`}
        />
      ) : null}
    </div>
  );
}
