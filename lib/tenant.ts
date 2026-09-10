import { and, eq, gt, or } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { memberships, organizations, supportSessions } from "@/db/schema";

export const ownerAccounts = [
  { email: "joakimfn@gmail.com", name: "Joakim Ferdinand Nygård" },
  { email: "jfn@noracre.no", name: "Joakim Ferdinand Nygård" },
] as const;

export function isOwnerEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return ownerAccounts.some((account) => account.email === normalized);
}

export class AccessError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "ACCESS_DENIED",
  ) {
    super(message);
  }
}

export async function requireTenant(request: Request) {
  const user = await getChatGPTUser(request);
  if (!user) throw new AccessError(401, "Du må være logget inn.");
  const db = getDb();
  const ownerAccount = ownerAccounts.find(
    (account) => account.email === user.email.trim().toLowerCase(),
  );
  let member = await db
    .select()
    .from(memberships)
    .where(
      or(eq(memberships.userId, user.id), eq(memberships.email, user.email)),
    )
    .limit(20);
  if (ownerAccount) {
    const existingOwner = member.filter(
      (item) => item.email === ownerAccount.email,
    );
    let ownerOrganizationId: number;
    if (existingOwner.length) {
      const owner = existingOwner[0];
      ownerOrganizationId = owner.organizationId;
      if (
        owner.userId !== user.id ||
        owner.name !== ownerAccount.name ||
        owner.role !== "Superadmin" ||
        !owner.active
      ) {
        await db
          .update(memberships)
          .set({
            userId: user.id,
            name: ownerAccount.name,
            role: "Superadmin",
            active: true,
          })
          .where(eq(memberships.id, owner.id));
        member = member.map((item) =>
          item.id === owner.id
            ? {
                ...item,
                userId: user.id,
                name: ownerAccount.name,
                role: "Superadmin",
                active: true,
              }
            : item,
        );
      }
    } else {
      let org = (await db.select().from(organizations).limit(1))[0];
      const now = new Date().toISOString();
      if (!org)
        org = (
          await db
            .insert(organizations)
            .values({ name: "Noracre", createdAt: now })
            .returning()
        )[0];
      ownerOrganizationId = org.id;
      await db.insert(memberships).values({
        organizationId: org.id,
        userId: user.id,
        email: ownerAccount.email,
        name: ownerAccount.name,
        role: "Superadmin",
        active: true,
        createdAt: now,
      });
      member = await db
        .select()
        .from(memberships)
        .where(eq(memberships.email, ownerAccount.email))
        .limit(20);
    }
    for (const account of ownerAccounts) {
      const alias = await db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.organizationId, ownerOrganizationId),
            eq(memberships.email, account.email),
          ),
        )
        .limit(1);
      if (!alias.length)
        await db.insert(memberships).values({
          organizationId: ownerOrganizationId,
          userId:
            account.email === ownerAccount.email
              ? user.id
              : `invite:${account.email}`,
          email: account.email,
          name: account.name,
          role: "Superadmin",
          active: true,
          createdAt: new Date().toISOString(),
        });
    }
  }
  if (!member.length) {
    throw new AccessError(403, "Du har ikke tilgang til noen organisasjon.");
  } else {
    const invited = member.find((m) => m.userId.startsWith("invite:"));
    if (invited) {
      await db
        .update(memberships)
        .set({ userId: user.id, name: user.displayName })
        .where(eq(memberships.id, invited.id));
      member = member.map((m) =>
        m.id === invited.id
          ? { ...m, userId: user.id, name: user.displayName }
          : m,
      );
    }
  }
  const requested = Number(
    request.headers.get("x-organization-id") || member[0].organizationId,
  );
  const superadmin = member.find((m) => m.role === "Superadmin" && m.active);
  const anyDirect = member.find((m) => m.organizationId === requested);
  if (anyDirect && !anyDirect.active)
    throw new AccessError(
      403,
      "Brukeren din er deaktivert. Kontakt support dersom dette ikke skulle ha skjedd.",
      "USER_DISABLED",
    );
  const direct = anyDirect?.active ? anyDirect : undefined;
  if (direct) {
    const [organization] = superadmin
      ? []
      : await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, requested))
          .limit(1);
    if (organization && organization.status !== "Aktiv")
      throw new AccessError(
        403,
        "Bedriften er deaktivert. Kontakt support dersom dette ikke skulle ha skjedd.",
        "ORGANIZATION_DISABLED",
      );
    return {
      user,
      organizationId: requested,
      role: direct.role,
      membershipId: direct.id,
      isSuperadmin: Boolean(superadmin),
      memberships: member,
    };
  }
  if (!superadmin)
    throw new AccessError(403, "Du har ikke tilgang til denne organisasjonen.");
  const now = new Date().toISOString();
  const session = await db
    .select()
    .from(supportSessions)
    .where(
      and(
        eq(supportSessions.organizationId, requested),
        or(
          eq(supportSessions.supportUserId, user.id),
          eq(supportSessions.supportUserId, "*"),
        ),
        eq(supportSessions.revokedAt, ""),
        gt(supportSessions.expiresAt, now),
      ),
    )
    .limit(1);
  if (!session.length)
    throw new AccessError(
      403,
      "Kunden må gi supporttilgang før du kan åpne organisasjonen.",
    );
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, requested))
    .limit(1);
  if (organization && organization.status !== "Aktiv")
    throw new AccessError(
      403,
      "Bedriften er deaktivert. Kontakt support dersom dette ikke skulle ha skjedd.",
      "ORGANIZATION_DISABLED",
    );
  return {
    user,
    organizationId: requested,
    role: "Support",
    membershipId: 0,
    isSuperadmin: false,
    memberships: member,
  };
}

export function accessResponse(error: unknown) {
  if (!(error instanceof AccessError)) console.error(error);
  return error instanceof AccessError
    ? Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      )
    : Response.json({ error: "Noe gikk galt." }, { status: 500 });
}
