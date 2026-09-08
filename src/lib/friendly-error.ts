/** Maps common raw ERPNext exception text to a friendlier message for the accounting-only Sales/Purchase flows. */
export function toFriendlyMessage(raw: string): string {
  const message = raw.replace(/<[^>]*>/g, "").trim();

  if (/PermissionError|not permitted/i.test(message)) {
    return "You don't have permission to do this — check with your administrator.";
  }
  if (/credit limit/i.test(message)) {
    return `This exceeds the customer's credit limit. ${message}`;
  }
  if (/(fiscal year|period is closed|closed accounting period)/i.test(message)) {
    return "This posting date falls in a closed accounting period. Choose a different date or ask your administrator to reopen it.";
  }
  if (/could not find/i.test(message)) {
    return `Unable to save — ${message.charAt(0).toLowerCase()}${message.slice(1)}`;
  }
  if (/mandatory/i.test(message)) {
    return `A required field is missing. ${message}`;
  }
  if (/you can disable this|is linked with|LinkExistsError/i.test(message)) {
    return "This record can't be deleted because it's referenced by other transactions.";
  }
  if (/submitted documents can only be corrected|is not a draft/i.test(message)) {
    return "This document has already been submitted — cancel and amend it instead of editing or deleting it directly.";
  }

  return message || "Something went wrong. Please try again.";
}
