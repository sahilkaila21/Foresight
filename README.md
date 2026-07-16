# 🔮 Foresight — play-money prediction markets

Users create YES/NO questions about future events and trade shares against an
LMSR automated market maker. Prices are probabilities; winning shares pay ₱1
at resolution. Full design in [docs/TECH_SPEC.md](docs/TECH_SPEC.md).

## Quickstart

```bash
npm install
npm run db:push    # create SQLite db from prisma/schema.prisma
npm run db:seed    # demo users (alice/bob, password "password123") + 3 markets
npm run dev        # http://localhost:3000
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | LMSR engine unit tests (Vitest) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:push` | Sync Prisma schema to SQLite |
| `npm run db:seed` | Seed demo users, markets, trades |

## Layout

```
docs/TECH_SPEC.md          full technical specification
prisma/schema.prisma       User, Market, Trade, Position
prisma/seed.ts             demo data (runs real LMSR trades)
src/lib/lmsr.ts            market maker math (pure, unit-tested)
src/lib/session.ts         JWT cookie sessions (jose + bcryptjs)
src/app/api/               auth, markets, trade, resolve route handlers
src/app/                   market list, detail, create, login/signup pages
src/components/            TradePanel, ResolvePanel, NavBar, AuthForm
```

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Prisma 6 + SQLite (Postgres-ready) · Vitest

**v1 trust model:** market creators resolve their own markets; money is play-money only.
Roadmap (multi-outcome markets, oracle resolution, leaderboards) is in the spec.
