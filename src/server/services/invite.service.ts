import { randomBytes } from "node:crypto";

import { db } from "@/server/db";
import { hashPassword } from "@/lib/password";
import { logger } from "@/lib/logger";
import { evaluateInviteRedeemability } from "@/lib/invite-rules";

const INVITE_DEFAULT_TTL_DAYS = 7;

export class InviteError extends Error {}

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function createInvite(params: { createdById: string; email: string; ttlDays?: number }) {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (params.ttlDays ?? INVITE_DEFAULT_TTL_DAYS));

  const invite = await db.invite.create({
    data: {
      token,
      email: params.email.toLowerCase().trim(),
      createdById: params.createdById,
      expiresAt,
    },
  });

  await db.auditLog.create({
    data: {
      actorId: params.createdById,
      action: "invite.created",
      targetType: "Invite",
      targetId: invite.id,
      metadata: { email: invite.email },
    },
  });

  logger.info("invite.created", { inviteId: invite.id, email: invite.email });

  return invite;
}

export async function revokeInvite(inviteId: string, actorId: string) {
  const invite = await db.invite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date() },
  });

  await db.auditLog.create({
    data: {
      actorId,
      action: "invite.revoked",
      targetType: "Invite",
      targetId: invite.id,
    },
  });

  return invite;
}

/** Retorna o convite se ele for válido para uso (não expirado, não revogado, não usado). */
export async function getRedeemableInvite(token: string) {
  const invite = await db.invite.findUnique({ where: { token } });

  if (!invite) return { invite: null, reason: "NOT_FOUND" as const };

  const reason = evaluateInviteRedeemability(invite);
  if (reason) return { invite: null, reason };

  return { invite, reason: null };
}

export async function redeemInvite(params: {
  token: string;
  password: string;
  displayName: string;
  nickname: string;
}) {
  const { invite, reason } = await getRedeemableInvite(params.token);

  if (!invite) {
    throw new InviteError(`Convite inválido: ${reason}`);
  }

  const passwordHash = await hashPassword(params.password);

  const user = await db.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email: invite.email,
        passwordHash,
        profile: {
          create: {
            displayName: params.displayName,
            nickname: params.nickname,
          },
        },
      },
    });

    await tx.invite.update({
      where: { id: invite.id },
      data: { usedById: createdUser.id },
    });

    await tx.auditLog.create({
      data: {
        actorId: createdUser.id,
        action: "invite.redeemed",
        targetType: "Invite",
        targetId: invite.id,
      },
    });

    return createdUser;
  });

  logger.info("invite.redeemed", { userId: user.id, inviteId: invite.id });

  return user;
}
