import { prisma } from "./db";
import { DAY_MS } from "./history";
import { probYes } from "./lmsr";

/** Set of market ids the given user is watching (empty for signed-out). */
export async function watchedMarketIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await prisma.watchlist.findMany({
    where: { userId },
    select: { marketId: true },
  });
  return new Set(rows.map((r) => r.marketId));
}

interface Binaryish {
  id: string;
  kind: string;
  qYes: number;
  qNo: number;
  liquidityB: number;
  resolution: string | null;
  _count?: { trades: number };
}

/**
 * Map of marketId -> signed 24h YES-probability change for the given binary
 * markets (categorical/resolved/untraded ones map to null). One query fetches
 * the last pre-cutoff trade per market.
 */
export async function change24hMap(markets: Binaryish[]): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  const cutoff = new Date(Date.now() - DAY_MS);
  const binaryIds = markets
    .filter((m) => m.kind !== "CATEGORICAL" && !m.resolution && (m._count?.trades ?? 1) > 0)
    .map((m) => m.id);

  if (binaryIds.length === 0) {
    for (const m of markets) out.set(m.id, null);
    return out;
  }

  // Last trade at/before the cutoff for each market = its price 24h ago.
  const past = await prisma.trade.findMany({
    where: { marketId: { in: binaryIds }, createdAt: { lte: cutoff } },
    orderBy: { createdAt: "asc" },
    select: { marketId: true, probAfter: true },
  });
  const pastProb = new Map<string, number>();
  for (const t of past) pastProb.set(t.marketId, t.probAfter); // last write wins (ascending)

  for (const m of markets) {
    if (m.kind === "CATEGORICAL" || m.resolution || (m._count?.trades ?? 1) === 0) {
      out.set(m.id, null);
      continue;
    }
    const current = probYes({ qYes: m.qYes, qNo: m.qNo, b: m.liquidityB });
    const before = pastProb.get(m.id) ?? 0.5; // no pre-cutoff trade → opened at 50%
    const delta = current - before;
    out.set(m.id, Math.abs(delta) < 1e-4 ? 0 : delta);
  }
  return out;
}

/** Both card decorations at once: which markets are watched, and 24h changes. */
export async function cardData(userId: string | null, markets: Binaryish[]) {
  const [watched, changes] = await Promise.all([
    watchedMarketIds(userId),
    change24hMap(markets),
  ]);
  return { watched, changes };
}
