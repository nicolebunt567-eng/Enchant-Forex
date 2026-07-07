# Enchant Forex

Premium investment community platform build for Enchant Forex.

## What is included

- Public landing page with plans, live-style stats, contact links, and accepted payment methods
- Registration and login flow with member/operator roles
- User dashboard with deposit requests, realtime balance growth, status cards, transaction history, and gated withdrawal steps
- Operator panel for deposits, active investments, maturity routing, balance records, clearance claims, completion, users, plans, and crypto addresses
- Supabase-backed users, plans, investments, addresses, and account records

## Initial Operator Setup

After registering your first user in the app, open Supabase Table Editor, go to `profiles`, and set that user's `role` to `admin`. Sign in with that account to access User Management; administrators can promote subsequent members with the **Make Admin** action.

If Auth users were created before the profile trigger was installed, run `supabase/sync-auth-users.sql` once in the Supabase SQL Editor to create their missing profile rows.

## Run Locally

This project is set up for Vite + React.

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Hosting

## Live Pool Wallet

The public pool value monitors the configured USDT TRC-20 wallet through the read-only TRON Grid API and refreshes every 60 seconds.

```bash
POOL_WALLET_ADDRESS=your-public-tron-wallet-address
TRONGRID_API_KEY=optional-server-side-key
```

Only the public wallet address is required. Never add a private key or recovery phrase.

## Gold Trade Ledger

Client balances can be backed by recorded XAU/USD trades. Operators record the side, quantity, entry and exit prices, and optional broker trade ID. Realized profit is calculated in the database; open-trade estimates use the current market quote.

Configure the server-side market data key:

```bash
TWELVE_DATA_API_KEY=your-twelve-data-api-key
```

Apply the latest `supabase/schema.sql` before using the ledger. Market targets are benchmarks only: the application does not manufacture trades or guarantee that a target will be reached.

## Bot Console Deposits

The Bot Console includes a three-step USDT, BTC, and ETH deposit request flow with a $150 minimum, locally rendered address QR codes, 40-minute payment windows, and per-user deposit history. Payment requests use the wallet addresses configured by an operator in the admin panel. Apply the latest `supabase/schema.sql` to create `public.bot_deposits` before using this flow.

## Bot Console Withdrawals

Bot users can request withdrawals to a USDT, BTC, or ETH wallet. In the current testing mode, the available balance includes scripted demo profits as well as confirmed, unreserved funding. Administrators can approve, reject, and mark requests paid with a transaction reference. Existing projects can enable this flow by running `supabase/enable-bot-withdrawals.sql` once in the Supabase SQL Editor.

## Bot Passkeys

The initial testing rollout uses one universal reusable passkey issued manually from the admin panel. It works for every active client and bot package until it expires or an administrator revokes/replaces it. The plaintext code is displayed once, only its SHA-256 hash is stored, and the admin inventory records its usage count. A valid passkey makes the session ready immediately.

## Scripted Bot Demo

Bot sessions are explicitly presented as a scripted paper-trading demonstration. A complete run contains 100 timed rounds with a programmed 79 demo profits and 21 demo losses. Users can pause, resume, or stop a run. During workflow testing, simulated P&L contributes to the labelled Demo Equity and available bot withdrawal balance.

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

