import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

/** Clear the current user's post-reset notice so it stops showing. */
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await prisma.user.update({ where: { id: userId }, data: { showResetNotice: false } });
  return NextResponse.json({ ok: true });
}
