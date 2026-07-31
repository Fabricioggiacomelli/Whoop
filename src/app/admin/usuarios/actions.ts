"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/server/db";
import { requireAdmin } from "@/server/services/auth-guard";

export async function toggleUserStatusAction(userId: string) {
  const admin = await requireAdmin();

  if (userId === admin.id) {
    return; // admin não pode suspender a própria conta
  }

  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const nextStatus = target.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { status: nextStatus } }),
    db.auditLog.create({
      data: {
        actorId: admin.id,
        action: nextStatus === "SUSPENDED" ? "user.suspended" : "user.reactivated",
        targetType: "User",
        targetId: userId,
      },
    }),
  ]);

  revalidatePath("/admin/usuarios");
}
