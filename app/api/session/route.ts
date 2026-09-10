import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { memberships, organizations } from "@/db/schema";
import { accessResponse, requireTenant } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const ctx = await requireTenant(request),
      db = getDb();
    const mine = ctx.memberships;
    const current = mine.find((m) => m.organizationId === ctx.organizationId);
    let all = ctx.isSuperadmin
      ? await db.select().from(organizations)
      : await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, ctx.organizationId));
    const legacy = all.find(
      (organization) => organization.name === "Enkel CRM",
    );
    if (ctx.role === "Superadmin" && legacy) {
      await db
        .update(organizations)
        .set({ name: "Noracre" })
        .where(eq(organizations.id, legacy.id));
      all = all.map((organization) =>
        organization.id === legacy.id
          ? { ...organization, name: "Noracre" }
          : organization,
      );
    }
    return Response.json({
      user: ctx.user,
      currentOrganizationId: ctx.organizationId,
      role: ctx.role,
      organizations: all,
      acceptedTermsAt: current?.acceptedTermsAt ?? "",
      acceptedTermsVersion: current?.acceptedTermsVersion ?? "",
      completedOnboardingAt: current?.completedOnboardingAt ?? "",
    });
  } catch (e) {
    return accessResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireTenant(request),
      data = (await request.json()) as Record<string, unknown>,
      now = new Date().toISOString(),
      changes: Record<string, string> = {};
    if (data.acceptedTerms === true) {
      changes.acceptedTermsAt = now;
      changes.acceptedTermsVersion = "2026-09-09";
    }
    if (data.completedOnboarding === true) changes.completedOnboardingAt = now;
    if (Object.keys(changes).length)
      await getDb()
        .update(memberships)
        .set(changes)
        .where(
          and(
            eq(memberships.organizationId, ctx.organizationId),
            or(
              eq(memberships.userId, ctx.user.id),
              eq(memberships.email, ctx.user.email),
            ),
          ),
        );
    return Response.json({ ok: true, ...changes });
  } catch (e) {
    return accessResponse(e);
  }
}

