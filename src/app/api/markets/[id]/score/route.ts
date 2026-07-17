import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const STATUSES = ["SCHEDULED", "LIVE", "FINAL"] as const;
type Status = (typeof STATUSES)[number];

/**
 * Admin-only live-score update for a match market. The admin watches the real
 * game and posts the score/status here; it broadcasts to everyone via polling.
 * Body: { homeScore?, awayScore?, matchStatus?, matchMinute? }.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!admin.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: {
    homeScore?: number;
    awayScore?: number;
    matchStatus?: Status;
    matchMinute?: string | null;
  } = {};

  for (const key of ["homeScore", "awayScore"] as const) {
    if (body[key] !== undefined) {
      const n = Number(body[key]);
      if (!Number.isInteger(n) || n < 0 || n > 99) {
        return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
      }
      data[key] = n;
    }
  }
  if (body.matchStatus !== undefined) {
    if (!STATUSES.includes(body.matchStatus)) {
      return NextResponse.json({ error: "Invalid matchStatus" }, { status: 400 });
    }
    data.matchStatus = body.matchStatus;
  }
  if (body.matchMinute !== undefined) {
    data.matchMinute = body.matchMinute ? String(body.matchMinute).slice(0, 8) : null;
  }

  const market = await prisma.market.findUnique({ where: { id } });
  if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });

  await prisma.market.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
