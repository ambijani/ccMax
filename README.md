# Ledger · Optimizer

Tells you which credit card to use for a purchase — based on *your* actual cards' bonus categories, spending caps, and how their points/miles really redeem, not generic "best card" advice.

Live: [cc-max.vercel.app](https://cc-max.vercel.app)

## What it does

- **Card lookup** — type what you're buying (and optionally where), and it ranks your cards by actual dollar value for that purchase.
- **AI-assisted card setup** — paste a card name and it researches the issuer's official terms (via Claude with web search) to pull bonus categories, caps, and base rate automatically. You can edit anything afterward.
- **Rotating categories** — cards like Discover it / Chase Freedom that change their 5% category quarterly get a reminder banner and an automatic cap reset each period.
- **Points valuation, not face value** — for points/miles cards, it distinguishes a conservative/guaranteed redemption value from an optimistic "if you transfer well" community value, plus a separate fixed rate for points redeemed through an issuer's own travel portal (Chase Travel, Amex Travel, etc.) versus booking direct with an airline/hotel.
- **Cash back vs. points comparison** — a secondary panel shows the best cash-back card next to the best points/miles card, since the two aren't really comparable for everyone.
- **Active promos** — pulls cached, researched promotions for the recommended card and shows them inline.
- **Spending cap tracking** — flags when a bonus category is approaching or has hit its cap, and excludes capped-out cards from the top recommendation.
- **Google sign-in or guest mode** — sign in with Google to keep your cards, or "Continue as guest" to try it with a throwaway anonymous session.

## How it works

1. You type a purchase; the merchant/item text is classified into a reward category by Claude.
2. Your cards are matched against that category (falling back to each card's base rate if none matches).
3. Each card's value is computed in real dollars — cash back directly, points/miles via the relevant cents-per-point valuation — and ranked, with caps and rotating-category staleness factored in.
4. Points/miles valuations and card promos are researched once via Claude with a real `web_search` tool call (not hallucinated) and cached in Postgres, refreshed on demand rather than re-fetched on every lookup.

## Tech stack

- **Next.js** (App Router) — note: the route-protection file is `src/proxy.ts`, not `middleware.ts` — this app runs against a Next.js build where `middleware` has been renamed to `proxy` (see `AGENTS.md`).
- **Supabase** — Postgres, Auth (Google OAuth + anonymous guest sessions), Row Level Security on every user-owned table.
- **Anthropic Claude** — merchant classification, card/terms research, and points-valuation research, the latter two grounded with the `web_search` tool.
- **Tailwind CSS v4**

## Getting started

### Prerequisites

- Node 20+
- A [Supabase](https://supabase.com) project
- An [Anthropic API key](https://console.anthropic.com)
- A [Google Cloud](https://console.cloud.google.com) OAuth client (only needed if you want Google sign-in — guest mode works without it)

### 1. Clone and install

```bash
git clone https://github.com/ambijani/ccMax.git
cd ccMax
npm install
```

### 2. Set up the database

In your Supabase project's **SQL Editor**, run every file in `supabase/migrations/` **in filename order** (they're timestamped, so sorting alphabetically is sorting chronologically).

Then, in **Authentication → Settings**, turn on **"Allow anonymous sign-ins"** (powers guest mode).

### 3. (Optional) Set up Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com), create an OAuth client (Web application). Add this as an authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
2. In Supabase **Authentication → Providers → Google**, paste the Client ID and Client Secret from step 1.
3. In Supabase **Authentication → URL Configuration**, set **Site URL** to your deployed domain, and add `<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback` for local dev) under **Redirect URLs**.

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the values from your Supabase project's **Settings → API** page and your Anthropic API key.

### 5. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying

Deploys cleanly to [Vercel](https://vercel.com) — connect the repo and set the same environment variables from `.env.example` in the project's **Settings → Environment Variables** (they don't come from `.env.local`, which is gitignored). Then update Supabase's **Site URL** / **Redirect URLs** (step 3 above) to point at your production domain instead of `localhost`.

## Security notes

- Every user-owned table (`cards`, `card_categories`, `purchases`, `user_cpp_overrides`, `card_promos`) has Postgres Row Level Security scoping access to `auth.uid()`; API routes add explicit ownership filters as defense-in-depth on top of RLS, not instead of it.
- `SUPABASE_SERVICE_ROLE_KEY` is used server-side only (writing shared reference data like `points_valuations`), never sent to the client.
- All Claude-calling routes require a signed-in (or guest) session and are rate-limited per user via a Postgres-backed limiter (`api_rate_limits` table), so a script can't run up API costs even from a valid account.
- Security headers (`X-Frame-Options`, `Strict-Transport-Security`, etc.) are set in `next.config.ts`.

## License

[MIT](LICENSE)
