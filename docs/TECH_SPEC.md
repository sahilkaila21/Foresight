# Prediction Market — Technical Specification

**Status:** v1 draft · **Date:** 2026-07-16

## 1. Product concept

A play-money prediction market web app. Users pose questions about future events
("Will X happen by date Y?"), and other users trade YES/NO shares on the outcome.
Prices emerge from trading and can be read directly as crowd-sourced probabilities
(a YES price of 0.72 ⇒ the market believes there is a 72% chance the event happens).

**Why play money for v1:** real-money prediction markets carry heavy regulatory
burden (CFTC/gambling law, KYC/AML, payments). Play money ("points", ₱) gets the
full product loop — question creation, trading, resolution, leaderboards — with
zero compliance surface. The engine is designed so a real-money or crypto backend
could be swapped in later.

### Core loop
1. User signs up → receives a starting balance of **₱1,000**.
2. Anyone can **create a market**: a question, description/resolution criteria, and a close date.
3. Anyone can **trade** YES or NO shares against an automated market maker while the market is open.
4. After the event, the market creator **resolves** YES or NO (v1 trust model; admin/oracle later).
5. Each winning share pays **₱1**; losing shares pay 0. Balances update instantly.

## 2. Market mechanism — LMSR

We use Hanson's **Logarithmic Market Scoring Rule** (LMSR) automated market maker.
Chosen over an order book because it guarantees liquidity at all times (critical with
few users), it has closed-form math for binary markets, and it is the proven standard
for play-money markets.

- State per market: outstanding share quantities `q_yes`, `q_no`, liquidity parameter `b`.
- Cost function: `C(q) = b · ln(e^(q_yes/b) + e^(q_no/b))`
- Instantaneous YES probability: `p_yes = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))`
- Cost to buy `Δ` YES shares: `C(q_yes + Δ, q_no) − C(q_yes, q_no)`; selling is a negative `Δ`.
- Inverse (closed form, binary): given a spend `s`, shares bought
  `Δ = b · ln( ((e^(q_yes/b) + e^(q_no/b)) · e^(s/b) − e^(q_no/b)) / e^(q_yes/b) )`.
- All exponentials computed with the log-sum-exp trick for numerical stability.
- `b` fixes the market maker's max subsidy (worst-case loss = `b · ln 2`). Default **b = 100**
  ⇒ max subsidy ≈ ₱69, and moving the price 50→90% costs on the order of a few hundred ₱.

Trades are **buy by spend amount** (user enters ₱ to spend, engine computes shares) and
**sell by share count**. Both directions settle against the same cost function, so the
AMM is path-independent and can't be arbitraged by round-tripping.

## 3. Architecture

Single **Next.js 15 (App Router) + TypeScript** application. Server components for
reads, route handlers (`/api/*`) for mutations. No separate backend service in v1.

```
Browser ── React (App Router pages, client trade panel)
   │
Next.js server
   ├─ Server components  → direct Prisma reads
   ├─ /api route handlers → auth, trades, resolution (transactional writes)
   └─ src/lib/lmsr.ts     → pure market-math module (unit-tested)
   │
Prisma ORM ── SQLite (dev) / PostgreSQL (prod, same schema)
```

**Key decisions**
| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js App Router | One deployable, SSR for market pages, API routes included |
| DB | SQLite dev → Postgres prod | Zero-setup local; Prisma makes the swap a connection-string change |
| Auth | Signed JWT session cookie (`jose`) + `bcryptjs` | No third-party dependency; NextAuth can replace it later |
| Money | Float play-points in v1 | Simplicity; production real-money would use integer micro-units |
| Concurrency | Serialized trade transactions per market (Prisma interactive transaction re-reading state) | Prevents stale-price execution |

## 4. Data model

```prisma
User    { id, username (unique), passwordHash, balance Float (start 1000), createdAt }
Market  { id, question, description, closesAt, liquidityB Float, qYes Float, qNo Float,
          resolution enum(YES|NO) nullable, resolvedAt nullable, creatorId, createdAt }
Trade   { id, marketId, userId, outcome enum(YES|NO), shares Float (+buy/−sell),
          cost Float, probAfter Float, createdAt }
Position{ id, userId, marketId, outcome, shares Float, @@unique(userId, marketId, outcome) }
```

- `Trade` is the append-only ledger (also drives the probability history chart).
- `Position` is a denormalized running total updated in the same transaction as the trade.
- Resolution pays `shares × ₱1` for the winning outcome, zeroes all positions, stamps the market.

## 5. API surface

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/auth/signup` | – | Create account, set session cookie |
| `POST /api/auth/login` / `POST /api/auth/logout` | – / ✓ | Session management |
| `GET  /api/auth/me` | ✓ | Current user + balance |
| `GET  /api/markets` | – | List markets w/ price, volume |
| `POST /api/markets` | ✓ | Create market |
| `GET  /api/markets/:id` | – | Market detail + trades + caller's position |
| `POST /api/markets/:id/trade` | ✓ | `{outcome, spend}` buy or `{outcome, shares}` sell |
| `POST /api/markets/:id/resolve` | creator | `{outcome: YES\|NO}` — pays out |

Validation errors return `400 {error}`, auth failures `401`, ownership failures `403`.

## 6. UI (v1)

- `/` — market list: question, live probability pill, volume, close date.
- `/markets/new` — create form.
- `/markets/[id]` — probability header, buy/sell trade panel with live cost preview
  (computed client-side with the same lmsr module), position summary, trade history.
- `/login`, `/signup` — forms; nav bar shows username + live balance.
- Styling: Tailwind, dark-mode-friendly, no component library in v1.

## 7. Testing & quality

- **Vitest** unit tests on `lmsr.ts`: price/cost invariants, buy↔sell round-trip,
  inverse-of-cost identity, log-sum-exp stability at extreme prices, subsidy bound.
- API route logic kept thin; money-moving code paths all inside Prisma transactions.
- `npm run build` + `npm test` are the CI gate.

## 8. Roadmap

**Shipped since v1**
- ✅ Probability history chart, portfolio with P/L, leaderboard.
- ✅ Market search, status filters, sorting; comments.
- ✅ Multi-outcome (categorical) markets — the LMSR engine is generalized to N
  outcomes (`costN`/`pricesN`/`sharesForSpendN`/`buyN`/`sellN`), with binary as
  the two-outcome special case. Added alongside binary via a `Market.kind` flag
  and an `Outcome` table; `Trade`/`Position.outcome` holds `"YES"/"NO"` for
  binary and the `Outcome` id for categorical, so those tables were unchanged.
  Worst-case maker subsidy generalizes to `b · ln(N)`.

**Still ahead**
- Categorical probability-history chart (binary chart is single-line today).
- Admin/oracle resolution + dispute flow (replace creator-resolves trust model).
- Loans/daily bonuses to keep the play-money economy liquid.
- Market tags/categories; Postgres + hosting (Vercel/Fly), rate limiting, audit log.
