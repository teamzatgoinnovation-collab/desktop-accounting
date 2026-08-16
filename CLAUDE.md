# desktop-accounting

Electron back-office accounting client for `zatgo-core`. See `../CLAUDE.md` (Electron category) and `../../.claude/rules/` for everything not specific to this repo.

## Repo-specific pointers

- Site URL is editable on the **login screen** (`ErpnextLoginCard`'s `siteUrl`/`onSiteUrlChange` props, added this session), not just `.env`'s `VITE_FRAPPE_BASE_URL`. The login-screen value persists via `zustand/persist` to Electron local storage and **silently overrides** the `.env` default on every subsequent launch. If login fails with "fetch failed" after an env change, check/change this field first — don't assume the backend is down.
- What's actually built (despite the README's "Runnable scaffold" label): Customers, Invoices (incl. Receive Payment), Suppliers, Bills (incl. Pay Bill), Payments (receive/pay), Journals (create + submit), Sales Returns, Purchase Returns, Reports (AR/AP aging, GL, P&L), Stock (read), Warehouses, Products — all backend-wired and tested end-to-end, not mock data. Don't assume a page is a stub from old README copy.

## Known stale doc/dead code (not fixed)

`ConnectionPage.tsx`'s copy about "mock data until you connect" and the `allowMockWithoutLogin` store flag are vestigial — no page actually implements a mock-data fallback.
