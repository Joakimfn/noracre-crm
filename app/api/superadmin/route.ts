import {disableAt} from "@/lib/deactivation";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  activities,
  companies,
  memberships,
  moduleLicenses,
  organizationModules,
  organizations,
  supportRequests,
  supportSessions,
} from "@/db/schema";
import { AccessError, accessResponse, requireTenant } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const ctx = await requireTenant(request);
    if (ctx.role !== "Superadmin")
      throw new AccessError(403, "Bare superadministratorer har tilgang.");
    const db = getDb(),
      [
        orgs,
        users,
        customerRows,
        activityRows,
        requests,
        sessions,
        modules,
        licenses,
      ] = await Promise.all([
        db.select().from(organizations).orderBy(desc(organizations.id)),
        db.select().from(memberships),
        db.select({ organizationId: companies.organizationId }).from(companies),
        db
          .select({
            organizationId: activities.organizationId,
            createdAt: activities.createdAt,
          })
          .from(activities),
        db
          .select()
          .from(supportRequests)
          .where(eq(supportRequests.status, "Venter"))
          .orderBy(desc(supportRequests.id)),
        db.select().from(supportSessions),
        db.select().from(organizationModules),
        db.select().from(moduleLicenses),
      ]),
      now = Date.now();
    const rows = orgs.map((org) => {
      const orgUsers = users.filter((u) => u.organizationId === org.id),
        activeUsers = orgUsers.filter((u) => u.active).length,
        lostUsers = orgUsers.filter((u) => !u.active).length,
        usage = activityRows.filter((a) => a.organizationId === org.id),
        lastActivity =
          usage
            .map((a) => a.createdAt)
            .sort()
            .at(-1) ?? org.createdAt,
        hasDirectAccess = orgUsers.some(
          (u) => u.active && u.role === "Superadmin",
        ),
        hasSupportAccess = sessions.some(
          (s) =>
            s.organizationId === org.id &&
            !s.revokedAt &&
            new Date(s.expiresAt).getTime() > now,
        ),
        primary =
          orgUsers.find((u) => u.active && u.role === "Administrator") ??
          orgUsers.find((u) => u.active) ??
          orgUsers[0],
        ringModule = modules.find(
          (m) =>
            m.organizationId === org.id &&
            m.moduleKey === "ringelister" &&
            m.active,
        ),
        marketingModule = modules.find(
          (m) =>
            m.organizationId === org.id &&
            m.moduleKey === "markedsforing" &&
            m.active,
        ),
        moduleUsers = licenses.filter(
          (license) =>
            license.organizationId === org.id &&
            license.moduleKey === "ringelister" &&
            license.active && orgUsers.some(u=>u.id===license.membershipId&&u.active) && modules.some(m=>m.organizationId===org.id&&m.moduleKey===license.moduleKey&&m.active),
        ).length,
        marketingModuleUsers = licenses.filter(
          (license) =>
            license.organizationId === org.id &&
            license.moduleKey === "markedsforing" &&
            license.active && orgUsers.some(u=>u.id===license.membershipId&&u.active) && modules.some(m=>m.organizationId===org.id&&m.moduleKey===license.moduleKey&&m.active),
        ).length,
        moduleMonthly = licenses.filter(l=>l.organizationId===org.id&&l.active&&orgUsers.some(u=>u.id===l.membershipId&&u.active)&&modules.some(m=>m.organizationId===org.id&&m.moduleKey===l.moduleKey&&m.active)).reduce((sum,l)=>sum+l.pricePerUser,0),
        status = org.status === "Tapt" ? "Deaktivert" : org.status;
      return {
        id: org.id,
        scheduledDisableAt: org.scheduledDisableAt,
        name: org.name,
        orgNumber: org.orgNumber,
        address: org.address,
        postalCode: org.postalCode,
        city: org.city,
        industry: org.industry,
        phone: org.phone,
        email: org.email || primary?.email || "",
        status,
        activeUsers,
        lostUsers,
        activeSubscriptions: activeUsers,
        monthlyAmount: activeUsers * 399 + moduleMonthly,
        baseMonthlyAmount: activeUsers * 399,
        moduleMonthly,
        ringModuleActive: Boolean(ringModule),
        ringModuleUsers: moduleUsers,
        marketingModuleActive: Boolean(marketingModule),
        marketingModuleUsers,
        crmCustomers: customerRows.filter((c) => c.organizationId === org.id)
          .length,
        activities30d: usage.filter(
          (a) => new Date(a.createdAt).getTime() > now - 30 * 86400000,
        ).length,
        lastActivity,
        pendingAccessRequest: requests.some((r) => r.organizationId === org.id),
        hasSupportAccess: hasDirectAccess || hasSupportAccess,
        primaryContactName: primary?.name ?? "Ikke registrert",
        primaryContactEmail: primary?.email ?? "",
        primaryContactPhone: primary?.phone ?? "",
        retainUntil: org.retainUntil,
      };
    });
    return Response.json({
      summary: {
        activeOrganizations: rows.filter((o) => o.status === "Aktiv").length,
        lostOrganizations: rows.filter((o) => o.status === "Deaktivert").length,
        activeUsers: users.filter((u) => u.active && orgs.some(o=>o.id===u.organizationId&&o.status==="Aktiv")).length,
        lostUsers: users.filter((u) => !u.active).length,
        ringModuleOrganizations: rows.filter((o) => o.status === "Aktiv" && o.ringModuleActive).length,
        marketingModuleOrganizations: rows.filter(
          (o) => o.status === "Aktiv" && o.marketingModuleActive,
        ).length,
        moduleMonthlyAmount: rows
          .filter((r) => r.status === "Aktiv")
          .reduce((sum, r) => sum + r.moduleMonthly, 0),
        monthlyAmount: rows
          .filter((r) => r.status === "Aktiv")
          .reduce((sum, r) => sum + r.monthlyAmount, 0),
        serverStatus: "Ikke kontrollert",
      },
      organizations: rows,
    });
  } catch (e) {
    return accessResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireTenant(request);
    if (ctx.role !== "Superadmin")
      throw new AccessError(403, "Bare superadministratorer har tilgang.");
    const data = (await request.json()) as Record<string, unknown>,
      organizationId = Number(data.organizationId),
      db = getDb(),
      now = new Date().toISOString();
    if (data.type === "requestAccess") {
      const pending = await db
        .select()
        .from(supportRequests)
        .where(
          and(
            eq(supportRequests.organizationId, organizationId),
            eq(supportRequests.status, "Venter"),
          ),
        )
        .limit(1);
      if (pending.length) return Response.json({ request: pending[0] });
      const [created] = await db
        .insert(supportRequests)
        .values({
          organizationId,
          requestedBy: ctx.user.displayName,
          status: "Venter",
          createdAt: now,
          resolvedAt: "",
        })
        .returning();
      return Response.json({ request: created }, { status: 201 });
    }
    if (data.type === "organizationStatus") {
      const scheduledDisableAt = data.status === "Deaktivert" ? disableAt(data.effectiveAt) : "";
      if (scheduledDisableAt) {
        const [org] = await db.update(organizations).set({scheduledDisableAt}).where(eq(organizations.id,organizationId)).returning();
        if(!org) throw new AccessError(404,"Bedriften finnes ikke");
        return Response.json({organization:org});
      }
      const status = data.status === "Deaktivert" ? "Deaktivert" : "Aktiv",
        deactivatedAt = status === "Deaktivert" ? now : "",
        retainUntil =
          status === "Deaktivert"
            ? new Date(Date.now() + 90 * 86400000).toISOString()
            : "";
      const [org] = await db
        .update(organizations)
        .set({ status, deactivatedAt, retainUntil, scheduledDisableAt: "" })
        .where(eq(organizations.id, organizationId))
        .returning();
      return Response.json({ organization: org });
    }
    if (data.type === "organizationDetails") {
      const orgNumber = String(data.orgNumber ?? "").replace(/\D/g, "");
      if (orgNumber && orgNumber.length !== 9)
        return Response.json(
          { error: "Organisasjonsnummeret må inneholde ni sifre." },
          { status: 400 },
        );
      const [org] = await db
        .update(organizations)
        .set({
          name: String(data.name ?? "").trim(),
          orgNumber,
          address: String(data.address ?? "").trim(),
          postalCode: String(data.postalCode ?? "").trim(),
          city: String(data.city ?? "").trim(),
          industry: String(data.industry ?? "").trim(),
          phone: String(data.phone ?? "").trim(),
          email: String(data.email ?? "")
            .trim()
            .toLowerCase(),
        })
        .where(eq(organizations.id, organizationId))
        .returning();
      if (!org)
        return Response.json(
          { error: "Kundeorganisasjonen finnes ikke." },
          { status: 404 },
        );
      return Response.json({ organization: org });
    }
    return Response.json({ error: "Ukjent handling" }, { status: 400 });
  } catch (e) {
    return accessResponse(e);
  }
}


