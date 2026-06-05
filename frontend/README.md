# MediLedger Nigeria — Frontend

Next.js 16 application for patients, healthcare providers, HMOs, and NHIA regulators. Dark forest aesthetic built on shadcn/ui with mint accent colors, full Hedera wallet integration via browser-injected extension APIs, Supabase Realtime subscriptions, and an offline-capable USSD fallback path.

---

## Directory Structure

```
frontend/
├── app/
│   ├── layout.tsx              Root layout — AuthProvider, WalletProvider, Toaster
│   ├── page.tsx                Entry point — client-side routing between Landing and Dashboard
│   ├── globals.css             CSS custom properties, base resets
│   └── auth/
│       └── callback/route.ts   Supabase OAuth code exchange
│
├── components/
│   ├── mediledger/
│   │   ├── landing-page.tsx    Marketing / entry screen
│   │   ├── dashboard.tsx       Authenticated shell (sidebar + page router)
│   │   ├── sidebar.tsx         Collapsible nav (desktop) + drawer (mobile)
│   │   ├── wallet-button.tsx   Header wallet status chip
│   │   ├── wallet-modal.tsx    Wallet selection modal (HashPack / Blade / WalletConnect / Mock)
│   │   ├── icon.tsx            Custom icon set (vault, consent, AI, emergency …)
│   │   └── pages/
│   │       ├── overview.tsx    Patient dashboard overview
│   │       ├── vault.tsx       Health Vault — FHIR records browser
│   │       ├── tokens.tsx      $HEAL token balance & transaction history
│   │       ├── settings.tsx    Profile, wallet, notification preferences
│   │       └── placeholder.tsx Consent Hub · AI Guardian · Emergency (scaffolded)
│   └── ui/                     shadcn/ui primitives (70+ components)
│
├── contexts/
│   ├── AuthContext.tsx          Supabase Auth state (user, session, role)
│   └── WalletContext.tsx        Hedera wallet state (accountId, balances, connector)
│
├── hooks/
│   ├── useWallet.ts             connect / disconnect / refreshBalances
│   └── useRealtimeSubscriptions.ts  Patient, HMO, NHIA, Provider realtime channels
│
├── lib/
│   ├── supabase.ts             Typed Supabase client (singleton)
│   ├── mediledger.ts           NAV_ITEMS, liveConnect(), mockConnect(), WalletAccount type
│   ├── database.types.ts       Auto-generated Supabase TypeScript types
│   ├── utils.ts                cn() merge helper
│   ├── api/
│   │   ├── claims.ts           claimsApi (list, get, submit, sign, reject)
│   │   ├── consents.ts         consentApi (list, get, create, grant, revoke)
│   │   ├── patients.ts         patientsApi
│   │   ├── records.ts          healthRecordsApi
│   │   └── tokens.ts           tokenApi
│   └── wallet/
│       ├── hashpack.ts         window.hashpack extension API (no npm SDK)
│       ├── blade.ts            window.bladeConnect extension API
│       ├── walletconnect.ts    window.WalletConnectProvider injection (Hedera chain IDs 295/296)
│       └── mock-wallet.ts      Dev/demo mock (no extension required)
│
├── public/                     Logos, favicons (SVG, PNG, Apple touch)
├── next.config.mjs             API proxy rewrites, image config
├── .env.local.example          All required environment variables
├── package.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 20 LTS
- A running Supabase project (see `.env.local.example`)
- The NestJS API Gateway running on port 3000

### Install & run

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

npm run dev   # → http://localhost:3001
```

For a fully local demo without a Hedera wallet extension:

```env
NEXT_PUBLIC_WALLET_MODE=mock
```

The mock wallet simulates account creation, HBAR/HEAL balances, and transaction signing — no browser extension, no testnet required.

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# NestJS API Gateway (proxied by Next.js — see next.config.mjs)
NEXT_PUBLIC_API_URL=http://localhost:3000

# Python AI Service
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:3008

# Hedera
NEXT_PUBLIC_HEDERA_NETWORK=testnet     # testnet | mainnet
NEXT_PUBLIC_HEAL_TOKEN_ID=0.0.XXXXXX

# Wallet
NEXT_PUBLIC_WALLET_MODE=mock           # mock | live
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<from cloud.walletconnect.com>
```

The frontend proxies all `/api/v1/*` requests to the API Gateway via Next.js rewrites — no CORS issues, no credentials exposed in the browser.

---

## Authentication

Three sign-in paths are supported, all converging on a Supabase session:

### Google OAuth

```tsx
const { signInWithGoogle } = useAuth()
await signInWithGoogle()  // redirects → /auth/callback → app
```

### Magic Link (email)

```tsx
const { signInWithMagicLink } = useAuth()
await signInWithMagicLink('patient@example.com')
```

### Hedera Wallet (challenge-response)

```
1. useWallet.connect(provider)
2. Fetch random challenge from /api/v1/auth/wallet-challenge
3. Sign challenge bytes with wallet (HashPack / Blade / WalletConnect)
4. POST accountId + challenge + signature to /api/v1/auth/wallet-verify
5. NestJS verifies signature via Hedera SDK
6. NestJS calls supabase.auth.admin.generateLink() → returns JWT
7. supabase.auth.setSession({ access_token: token }) → Supabase session established
```

The `AuthContext` listens on `supabase.auth.onAuthStateChange` and automatically fetches the user's role from `user_roles` on every session change.

### Role-based access

| Role | Access |
|---|---|
| `patient` | Own health vault, consent management, HEAL balance, emergency config |
| `provider` | Patient data (with active consent), claim submission, consent requests |
| `hmo` | Claims review and approval, enrollment verification |
| `nhia` | Full regulatory view, analytics, SLA monitoring, AI model metadata |
| `researcher` | Aggregate insights only (differential privacy enforced) |

---

## Wallet Integration

### How wallet connectors work

All three wallet connectors use **browser-injected extension APIs** — no npm wallet SDKs are bundled. This avoids the peer-dependency conflicts that affect packages like `hashconnect` and `@walletconnect/web3-provider`, and is actually the correct approach because HashPack and Blade work by injecting APIs into the page at runtime.

| Provider | API used | Detection |
|---|---|---|
| **HashPack** | `window.hashpack` (injected by extension) | `Boolean(window.hashpack)` |
| **Blade** | `window.bladeConnect` (injected by extension) | `Boolean(window.bladeConnect)` |
| **WalletConnect** | `window.WalletConnectProvider` (injected by dApp environment) | `Boolean(window.WalletConnectProvider)` |
| **Mock** | In-app simulation | `NEXT_PUBLIC_WALLET_MODE=mock` |

### Connect flow

```tsx
import { useWallet } from '@/hooks/useWallet'

const { connect, disconnect, isConnected, accountId, healBalance, hbarBalance } = useWallet()

await connect('hashpack')   // or 'blade' | 'walletconnect' | 'mock'
```

`useWallet` calls `liveConnect(provider)` from `lib/mediledger.ts` which **dynamically imports** the connector file — wallet code is never in the main bundle.

### Balance fetching

```
Hedera Mirror Node:
  GET /api/v1/accounts/{accountId}            → HBAR balance (÷ 100,000,000)
  GET /api/v1/accounts/{accountId}/tokens     → HEAL balance (÷ 10,000 for 4 decimals)
```

Balances are cached in `WalletContext` and refreshed with `refreshBalances()`.

---

## Realtime Subscriptions

The `useRealtimeSubscriptions` hook manages four Supabase Realtime WebSocket channels:

| Hook | Table | Events | UX effect |
|---|---|---|---|
| `usePatientRealtimeSubscriptions` | `insurance_claims` | `UPDATE` | Toast: "Claim approved — ₦450,000" |
| `usePatientRealtimeSubscriptions` | `consent_agreements` | `INSERT` | Toast: "New consent request received" |
| `usePatientRealtimeSubscriptions` | `token_transactions` | `INSERT` | Toast: "Earned 50 HEAL tokens!" |
| `useHMORealtimeSubscriptions` | `insurance_claims` | `*` | React Query cache invalidation |
| `useNHIARealtimeMonitoring` | `insurance_claims` | `UPDATE` | SLA breach alert toast |
| `useProviderConsentSubscriptions` | `consent_agreements` | `UPDATE` | "Patient granted/revoked consent" |

All channels call `queryClient.invalidateQueries()` — UI data re-fetches automatically.

---

## API Clients

Typed `supabase-js` clients in `lib/api/`:

```ts
// Claims
await claimsApi.submit({ patient_id, provider_id, amount_ngn: 45000, diagnosis_codes: ['A15'] })
await claimsApi.sign(claimId, 'patient', sigHash)
await claimsApi.reject(claimId, 'Duplicate submission')

// Consents
await consentApi.create({ patient_id, requester_user_id, purpose: 'treatment', expires_at })
await consentApi.grant(consentId)
await consentApi.revoke(consentId)
```

All queries respect Supabase RLS — the backend enforces access control.

---

## Fonts & Theming

Three Google Fonts loaded via `next/font` (zero layout shift):

| Variable | Font | Use |
|---|---|---|
| `--font-dm-sans` | DM Sans 300/400/500 | Body text, navigation |
| `--font-cormorant` | Cormorant Garamond 400/600/700 | Headings, hero text |
| `--font-space-mono` | Space Mono 400 | Wallet addresses, transaction IDs |

Theme: **dark forest** base (`#0D2B1F`) with mint accent (`#C8F5E0`, `#4ADE80`). Toast notifications inherit theme colours via the Toaster config in `layout.tsx`.

---

## API Proxy

Next.js rewrites in `next.config.mjs` prevent CORS issues and hide backend URLs:

```
/api/v1/ai/*  →  http://ai-service:3008/api/v1/ai/*
/api/v1/*     →  http://api-gateway:3000/api/v1/*
```

In local dev these resolve to `localhost:3000` / `localhost:3008`. In Docker, they resolve to container hostnames on the `mediledger-network` bridge.

---

## Build & Deploy

```bash
npx tsc --noEmit     # Type check
npm run build        # Production build
npm start            # Start production server
```

### Vercel

Push to `main` — Vercel auto-deploys. Set all `NEXT_PUBLIC_*` environment variables in the Vercel project settings. The Supabase instance must be publicly reachable from Vercel's edge network.

---

## Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.1.6 | App Router, server components, API proxy rewrites |
| `react` + `react-dom` | 19.2.4 | UI rendering |
| `@supabase/supabase-js` | ^2.0.0 | Database, auth, realtime, storage |
| `@supabase/auth-helpers-nextjs` | ^0.10.0 | OAuth callback route handler |
| `@tanstack/react-query` | ^5.0.0 | Server state, cache invalidation |
| `react-hot-toast` | ^2.4.0 | Toast notifications |
| `recharts` | 2.15.0 | Analytics charts |
| `react-hook-form` + `zod` | ^7 / ^3 | Form validation |
| `lucide-react` | ^0.564.0 | Icon set |
| `tailwindcss` | ^4.2.0 | Utility-first CSS |
| `next-themes` | ^0.4.6 | Dark/light mode switching |
