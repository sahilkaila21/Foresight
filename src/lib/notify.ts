import type { Prisma } from "@prisma/client";

/**
 * In-app notification helpers. Notifications are cheap rows the navbar bell
 * polls for. All creation goes through here so the shape stays consistent.
 */

export type NotificationType = "RESOLVED" | "COMMENT" | "LIMIT_FILLED" | "COMBO";

export async function notify(
  tx: Prisma.TransactionClient,
  userId: string,
  type: NotificationType,
  body: string,
  href = ""
): Promise<void> {
  await tx.notification.create({ data: { userId, type, body, href } });
}

/** Same, for many users at once (e.g. every holder of a resolved market). */
export async function notifyMany(
  tx: Prisma.TransactionClient,
  userIds: string[],
  type: NotificationType,
  body: string,
  href = ""
): Promise<void> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await tx.notification.createMany({
    data: unique.map((userId) => ({ userId, type, body, href })),
  });
}
