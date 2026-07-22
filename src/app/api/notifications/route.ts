import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

/** Recent notifications + unread count for the signed-in user. */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ items: [], unread: 0 });

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return NextResponse.json({
    unread,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      body: n.body,
      href: n.href,
      read: n.read,
      createdAt: n.createdAt,
    })),
  });
}

/** Mark notifications read. Body: { id } for one, or {} for all. */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;

  await prisma.notification.updateMany({
    where: id ? { id, userId } : { userId, read: false },
    data: { read: true },
  });
  return NextResponse.json({ ok: true });
}
