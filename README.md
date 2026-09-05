# accounting-desktop

**Status:** Built and backend-wired — Customers, Invoices, Suppliers, Bills,
Payments, Journals, Sales/Purchase Returns, Quotations, Reports (AR/AP aging,
GL, P&L, Trial Balance), Chart of Accounts, Stock, Warehouses, Products.  
**Kind:** Electron + Vite + React  
**Backend:** `zatgo-core` (ERPNext extension app)  
**Package:** `@zatgo/accounting-desktop`

## Auth

Sign in with ERPNext / Frappe **email + password**. Login runs in the
Electron main process via `@zatgo/erpnext`; the renderer never sees the
session cookie directly, only `window.zatgoDesktop.*` IPC results.

The site URL is fixed to `.env`'s `VITE_FRAPPE_BASE_URL` — there's no
in-app site-URL field. Change the site by editing `.env`, not the UI.

## Run

```bash
pnpm install
pnpm --filter @zatgo/accounting-desktop dev
```

Vite port: **5178**. Default site URL (`.env.example`):
`https://accounting.zatgo.online`.

## Build installers

```bash
pnpm dist:win     # portable .exe (electron-builder)
pnpm dist:linux   # AppImage + .deb
```

Output lands in `release/`.
