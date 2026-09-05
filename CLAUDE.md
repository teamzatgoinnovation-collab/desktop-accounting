# desktop-accounting

Electron back-office accounting client for `zatgo-core`. See `../CLAUDE.md` (Electron category) and `../../.claude/rules/` for everything not specific to this repo.

## Repo-specific pointers

- Site URL is fixed to `.env`'s `VITE_FRAPPE_BASE_URL` (currently `https://accounting.zatgo.online`) — the login screen has no editable Site URL field or Test Site button anymore (`ErpnextLoginCard` renders them only when `siteUrl`/`onSiteUrlChange`/`onTestSite` props are passed; `LoginPage.tsx` deliberately omits them). `connection.baseUrl` in the session store is **not persisted** (removed from `partialize`) specifically so a stale cached URL can never override a new `.env` value — change the site by editing `.env`, not in-app.
- What's actually built: Customers, Invoices (incl. Receive Payment), Suppliers, Bills (incl. Pay Bill), Payments (receive/pay), Journals (create + submit), Sales Returns, Purchase Returns, Quotations, Reports (AR/AP aging, GL, P&L, Trial Balance), Chart of Accounts, Stock (read), Warehouses, Products — all backend-wired and tested end-to-end, not mock data.
- Sidebar is scoped to the always-online core (Dashboard, Chart of Accounts, Customers, Suppliers, New Voucher, Sales, Purchase, Reports, Settings). Quotations/Receipt/Payment/Contra/Journal/Account Ledger/Connection have no nav entry but their routes and pages are intact — reached via in-app links (New Voucher → "View journals", account rows → "View ledger") rather than the sidebar.
- `zatgo_core.api.v1.accounting.accounts.list` now defaults to `_default_company()` when no `company` arg is passed (fixed 2026-09-03) — previously an unscoped call merged every company's account tree into one list with duplicate-looking root nodes. The desktop app calls it unscoped, so this default is what keeps its Chart of Accounts page correct.

## Known issue (not fixed)

The local dev bench's `zg-accounting-test.localhost` site had a host-routing mismatch during 2026-09-03 testing: HTTP requests to that hostname resolved to a different site's data than `bench --site zg-accounting-test.localhost console/mariadb` on the same site name, even with an explicit `Host` header from inside the container. Not root-caused — worth investigating before relying on that site for fresh seed data again.
