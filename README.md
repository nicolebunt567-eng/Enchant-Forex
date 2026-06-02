# Enchant Forex

Premium investment community platform build for Enchant Forex.

## What is included

- Public landing page with plans, live-style stats, contact links, and accepted payment methods
- Registration and login flow with member/operator roles
- User dashboard with deposit requests, realtime balance growth, status cards, transaction history, and gated withdrawal steps
- Operator panel for deposits, active investments, maturity routing, balance records, clearance claims, completion, users, plans, and crypto addresses
- Supabase-backed users, plans, investments, addresses, and account records

## Initial Operator Setup

After creating your first user in the app, open Supabase Table Editor, go to `profiles`, and set that user's `role` to `admin`.

## Run Locally

This project is set up for Vite + React.

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Hosting

### Supabase Setup

1. Create a Supabase project.
2. Open the SQL Editor.
3. Paste and run `supabase/schema.sql`.
4. In Authentication settings, decide whether email confirmation should be enabled. For fastest launch/testing, disable email confirmation.

### Frontend on Vercel

Set this frontend environment variable:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Use these settings:

- Framework: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

The included `vercel.json` is already configured for the Vite build.

## Notes

The frontend is configured to use Supabase through `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Before accepting real users, review compliance, payment, accounting, security, and operational requirements for your jurisdiction.

