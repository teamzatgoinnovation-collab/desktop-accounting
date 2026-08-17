# desktop-accounting

Electron back-office accounting client for `zatgo-core`. See `../CLAUDE.md` (Electron category) and `../../.claude/rules/` for everything not specific to this repo.

## Repo-specific pointers

- Site URL is fixed to `.env`'s `VITE_FRAPPE_BASE_URL` (currently `https://accounting.zatgo.online`) — the login screen has no editable Site URL field or Test Site button anymore (`ErpnextLoginCard` renders them only when `siteUrl`/`onSiteUrlChange`/`onTestSite` props are passed; `LoginPage.tsx` deliberately omits them). `connection.baseUrl` in the session store is **not persisted** (removed from `partialize`) specifically so a stale cached URL can never override a new `.env` value — change the site by editing `.env`, not in-app.
- What's actually built (despite the README's "Runnable scaffold" label): Customers, Invoices (incl. Receive Payment), Suppliers, Bills (incl. Pay Bill), Payments (receive/pay), Journals (create + submit), Sales Returns, Purchase Returns, Reports (AR/AP aging, GL, P&L), Stock (read), Warehouses, Products — all backend-wired and tested end-to-end, not mock data. Don't assume a page is a stub from old README copy.

## Known stale doc/dead code (not fixed)

`ConnectionPage.tsx`'s copy about "mock data until you connect" and the `allowMockWithoutLogin` store flag are vestigial — no page actually implements a mock-data fallback.
