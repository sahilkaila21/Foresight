import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const MAX_LEN = 4000;

/**
 * Set a market's "Market Context" analysis. Allowed for the market's creator or
 * an admin. Body: { context }.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const text = typeof body?.context === "string" ? body.context.trim() : "";
  if (text.length > MAX_LEN) {
    return NextResponse.json({ error: `Context must be under ${MAX_LEN} characters` }, { status: 400 });
  }

  const market = await prisma.market.findUnique({
    where: { id },
    select: { creatorId: true },
  });
  if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });
  if (!user.isAdmin && market.creatorId !== user.id) {
    return NextResponse.json({ error: "Only the creator or an admin can edit context" }, { status: 403 });
  }

  await prisma.market.update({ where: { id }, data: { context: text } });
  return NextResponse.json({ ok: true, context: text });
}
