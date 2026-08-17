import { Input, Label } from "@zatgo/ui";
import type { ReactNode } from "react";

export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  fromDate?: string;
  onFromDateChange?: (value: string) => void;
  toDate?: string;
  onToDateChange?: (value: string) => void;
  children?: ReactNode;
}) {
  const hasDateRange = onFromDateChange && onToDateChange;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[220px] flex-1 space-y-1">
        <Label htmlFor="list-search">Search</Label>
        <Input
          id="list-search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      {hasDateRange ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="list-from">From</Label>
            <Input id="list-from" type="date" value={fromDate} onChange={(e) => onFromDateChange(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="list-to">To</Label>
            <Input id="list-to" type="date" value={toDate} onChange={(e) => onToDateChange(e.target.value)} />
          </div>
        </>
      ) : null}
      {children}
    </div>
  );
}
