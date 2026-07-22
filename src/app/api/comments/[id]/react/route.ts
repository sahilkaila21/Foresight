import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const ALLOWED = ["👍", "🔥", "😂", "🤔", "🚀", "💯"];

/** Toggle the caller's emoji reaction on a comment. Body: { emoji }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const emoji = typeof body?.emoji === "string" ? body.emoji : "";
  if (!ALLOWED.includes(emoji)) {
    return NextResponse.json({ error: "Unsupported emoji" }, { status: 400 });
  }

  const comment = await prisma.comment.findUnique({ where: { id }, select: { id: true } });
  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

  const existing = await prisma.commentReaction.findUnique({
    where: { commentId_userId_emoji: { commentId: id, userId, emoji } },
  });
  if (existing) {
    await prisma.commentReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.commentReaction.create({ data: { commentId: id, userId, emoji } });
  }

  // Return the fresh reaction summary for this comment.
  const rows = await prisma.commentReaction.findMany({ where: { commentId: id } });
  const counts = new Map<string, number>();
  const mineSet = new Set<string>();
  for (const r of rows) {
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
    if (r.userId === userId) mineSet.add(r.emoji);
  }
  const reactions = [...counts.entries()].map(([e, count]) => ({
    emoji: e,
    count,
    mine: mineSet.has(e),
  }));
  return NextResponse.json({ reactions });
}
