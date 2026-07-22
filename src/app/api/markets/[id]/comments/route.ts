import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { getSessionUserId } from "@/lib/session";

const MAX_LEN = 1000;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const comments = await prisma.comment.findMany({
    where: { marketId: id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { username: true } } },
  });
  return NextResponse.json(
    comments.map((c) => ({
      id: c.id,
      username: c.user.username,
      body: c.body,
      createdAt: c.createdAt,
    }))
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
  if (text.length > MAX_LEN) {
    return NextResponse.json({ error: `Comment must be under ${MAX_LEN} characters` }, { status: 400 });
  }

  const market = await prisma.market.findUnique({
    where: { id },
    select: { id: true, creatorId: true, question: true },
  });
  if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });

  const comment = await prisma.comment.create({
    data: { marketId: id, userId, body: text },
    include: { user: { select: { username: true } } },
  });

  // Let the market's creator know someone weighed in (not on their own comment).
  if (market.creatorId !== userId) {
    await notify(
      prisma,
      market.creatorId,
      "COMMENT",
      `@${comment.user.username} commented on "${market.question}"`,
      `/markets/${id}`
    );
  }
  return NextResponse.json(
    {
      id: comment.id,
      username: comment.user.username,
      body: comment.body,
      createdAt: comment.createdAt,
    },
    { status: 201 }
  );
}
