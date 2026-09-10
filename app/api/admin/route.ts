import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLogs,
  memberships,
  moduleLicenses,
  organizationModules,
  organizations,
  supportRequests,
  supportSessions,
  teamMembers,
} from "@/db/schema";
import {
  AccessError,
  accessResponse,
  isOwnerEmail,
  requireTenant,
} from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const ctx = await requireTenant(request),
      db = getDb();
    const [activeSupport, modules, licenses] = await Promise.all([
      db
        .select()
        .from(supportSessions)
        .where(
          and(
            eq(supportSessions.organizationId, ctx.organizationId),
            eq(supportSessions.revokedAt, ""),
          ),
        )
        .orderBy(desc(supportSessions.id))
        .limit(1),
      db
        .select()
        .from(organizationModules)
        .where(eq(organizationModules.organizationId, ctx.organizationId)),
      db
        .select()
        .from(moduleLicenses)
        .where(eq(moduleLicenses.organizationId, ctx.organizationId)),
    ]);
    return Response.json({
      members: await db
        .select()
        .from(memberships)
        .where(eq(memberships.organizationId, ctx.organizationId))
        .orderBy(desc(memberships.id)),
      audit: await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.organizationId, ctx.organizationId))
        .orderBy(desc(auditLogs.id))
        .limit(30),
      supportRequests: await db
        .select()
        .from(supportRequests)
        .where(
          and(
            eq(supportRequests.organizationId, ctx.organizationId),
            eq(supportRequests.status, "Venter"),
          ),
        )
        .orderBy(desc(supportRequests.id))
        .limit(5),
      activeSupport: activeSupport.some(
        (item) => !item.revokedAt && item.expiresAt > new Date().toISOString(),
      ),
      modules: Object.fromEntries(
        modules.map((item) => [
          item.moduleKey,
          {
            active: item.active,
            pricePerUser: item.pricePerUser,
            licensedMemberIds: licenses
              .filter(
                (license) =>
                  license.moduleKey === item.moduleKey && license.active,
              )
              .map((license) => license.membershipId),
            currentUserActive: licenses.some(
              (license) =>
                license.moduleKey === item.moduleKey &&
                license.active &&
                license.membershipId === ctx.membershipId,
            ),
          },
        ]),
      ),
      role: ctx.role,
      membershipId: ctx.membershipId,
    });
  } catch (e) {
    return accessResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireTenant(request),
      data = (await request.json()) as Record<string, unknown>,
      db = getDb(),
      now = new Date().toISOString();
    const isOwner = isOwnerEmail(ctx.user.email);
    if (data.type === "organization") {
      if (ctx.role !== "Superadmin")
        throw new AccessError(
          403,
          "Bare superadmin kan opprette kundeorganisasjoner.",
        );
      const email = String(data.adminEmail ?? "")
        .trim()
        .toLowerCase(),
        orgNumber = String(data.orgNumber ?? "").replace(/\D/g, ""),
        phone = String(data.adminPhone ?? "").trim(),
        requestedRole = String(data.adminRole ?? "Administrator"),
        role = requestedRole === "Bruker" ? "Bruker" : "Administrator";
      if (orgNumber && orgNumber.length !== 9)
        return Response.json(
          { error: "Organisasjonsnummeret må inneholde ni sifre." },
          { status: 400 },
        );
      const [org] = await db
        .insert(organizations)
        .values({
          name: String(data.name ?? "Ny organisasjon"),
          orgNumber,
          address: String(data.address ?? "").trim(),
          postalCode: String(data.postalCode ?? "").trim(),
          city: String(data.city ?? "").trim(),
          industry: String(data.industry ?? "").trim(),
          phone: String(data.organizationPhone ?? "").trim(),
          email: String(data.organizationEmail ?? "")
            .trim()
            .toLowerCase(),
          createdAt: now,
        })
        .returning();
      await db.insert(memberships).values({
        organizationId: org.id,
        userId: `invite:${email}`,
        email,
        name: String(data.adminName ?? "Administrator"),
        phone,
        role,
        active: true,
        createdAt: now,
      });
      await db.insert(teamMembers).values({
        organizationId: org.id,
        email,
        name: String(data.adminName ?? "Administrator"),
        phone,
        role,
        active: true,
        createdAt: now,
      });
      return Response.json({ organization: org }, { status: 201 });
    }
    if (data.type === "member") {
      if (!ctx.isSuperadmin && ctx.role !== "Administrator")
        throw new AccessError(403, "Bare administrator kan legge til brukere.");
      const email = String(data.email ?? "")
          .trim()
          .toLowerCase(),
        name = String(data.name ?? "").trim();
      if (!name || !email.includes("@"))
        return Response.json(
          { error: "Navn og gyldig e-postadresse må fylles ut." },
          { status: 400 },
        );
      const requestedRole = String(data.role ?? "Bruker");
      if (requestedRole === "Superadmin" && !isOwner)
        throw new AccessError(403, "Bare en eierkonto kan gi superadmintilgang.");
      const role = requestedRole;
      const duplicate = await db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.organizationId, ctx.organizationId),
            eq(memberships.email, email),
          ),
        )
        .limit(1);
      if (duplicate.length)
        return Response.json(
          { error: "Denne e-postadressen er allerede registrert i bedriften." },
          { status: 409 },
        );
      await db
        .insert(teamMembers)
        .values({
          organizationId: ctx.organizationId,
          name,
          email,
          role,
          active: true,
          createdAt: now,
        })
        .returning();
      const [member] = await db
        .insert(memberships)
        .values({
          organizationId: ctx.organizationId,
          userId: `invite:${email}`,
          email,
          name,
          role,
          active: true,
          createdAt: now,
        })
        .returning();
      await db.insert(auditLogs).values({
        organizationId: ctx.organizationId,
        actor: ctx.user.displayName,
        action: "Aktiverte bruker",
        detail: `${name} · 399 kr per måned`,
        createdAt: now,
      });
      return Response.json({ member, monthlyPrice: 399 }, { status: 201 });
    }
    if (data.type === "memberStatus") {
      if (!ctx.isSuperadmin && ctx.role !== "Administrator")
        throw new AccessError(
          403,
          "Bare administrator kan endre brukertilgang.",
        );
      const id = Number(data.id),
        active = data.active === true;
      const [target] = await db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.id, id),
            eq(memberships.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!target)
        return Response.json(
          { error: "Brukeren finnes ikke." },
          { status: 404 },
        );
      if (target.role === "Superadmin" && !isOwner)
        throw new AccessError(
          403,
          "Bare en eierkonto kan endre en superadministrator.",
        );
      if (target.email === ctx.user.email && !active)
        return Response.json(
          { error: "Du kan ikke deaktivere din egen bruker." },
          { status: 400 },
        );
      const [member] = await db
        .update(memberships)
        .set({ active })
        .where(
          and(
            eq(memberships.id, id),
            eq(memberships.organizationId, ctx.organizationId),
          ),
        )
        .returning();
      await db
        .update(teamMembers)
        .set({ active })
        .where(
          and(
            eq(teamMembers.organizationId, ctx.organizationId),
            eq(teamMembers.email, target.email),
          ),
        );
      await db.insert(auditLogs).values({
        organizationId: ctx.organizationId,
        actor: ctx.user.displayName,
        action: active ? "Aktiverte bruker" : "Deaktiverte bruker",
        detail: target.email,
        createdAt: now,
      });
      return Response.json({ member });
    }
    if (data.type === "moduleStatus") {
      if (!ctx.isSuperadmin && ctx.role !== "Administrator")
        throw new AccessError(403, "Bare administrator kan kjøpe moduler.");
      const moduleKey = String(data.moduleKey),
        requestedIds = Array.isArray(data.membershipIds)
          ? [...new Set(data.membershipIds.map(Number).filter(Number.isFinite))]
          : [],
        active = requestedIds.length > 0;
      if (!["ringelister", "markedsforing"].includes(moduleKey))
        return Response.json({ error: "Ukjent modul." }, { status: 400 });
      const [existing, eligible, currentLicenses] = await Promise.all([
        db
          .select()
          .from(organizationModules)
          .where(
            and(
              eq(organizationModules.organizationId, ctx.organizationId),
              eq(organizationModules.moduleKey, moduleKey),
            ),
          )
          .limit(1),
        db
          .select({ id: memberships.id })
          .from(memberships)
          .where(
            and(
              eq(memberships.organizationId, ctx.organizationId),
              eq(memberships.active, true),
            ),
          ),
        db
          .select()
          .from(moduleLicenses)
          .where(
            and(
              eq(moduleLicenses.organizationId, ctx.organizationId),
              eq(moduleLicenses.moduleKey, moduleKey),
            ),
          ),
      ]);
      const allowedIds = new Set(eligible.map((member) => member.id));
      if (requestedIds.some((id) => !allowedIds.has(id)))
        return Response.json(
          { error: "En eller flere valgte brukere er ikke aktive." },
          { status: 400 },
        );
      await Promise.all([
        ...requestedIds.map((membershipId) => {
          const license = currentLicenses.find(
            (item) => item.membershipId === membershipId,
          );
          return license
            ? db
                .update(moduleLicenses)
                .set({ active: true, deactivatedAt: "", activatedAt: now })
                .where(eq(moduleLicenses.id, license.id))
            : db.insert(moduleLicenses).values({
                organizationId: ctx.organizationId,
                membershipId,
                moduleKey,
                active: true,
                pricePerUser: 49,
                activatedAt: now,
                deactivatedAt: "",
              });
        }),
        ...currentLicenses
          .filter(
            (item) => item.active && !requestedIds.includes(item.membershipId),
          )
          .map((license) =>
            db
              .update(moduleLicenses)
              .set({ active: false, deactivatedAt: now })
              .where(eq(moduleLicenses.id, license.id)),
          ),
      ]);
      const [module] = existing.length
        ? await db
            .update(organizationModules)
            .set({
              active,
              activatedAt: active ? now : existing[0].activatedAt,
              deactivatedAt: active ? "" : now,
            })
            .where(eq(organizationModules.id, existing[0].id))
            .returning()
        : await db
            .insert(organizationModules)
            .values({
              organizationId: ctx.organizationId,
              moduleKey,
              active,
              pricePerUser: 49,
              activatedAt: now,
              deactivatedAt: "",
            })
            .returning();
      await db.insert(auditLogs).values({
        organizationId: ctx.organizationId,
        actor: ctx.user.displayName,
        action: active
          ? `Aktiverte ${moduleKey === "ringelister" ? "ringelistemodul" : "markedsføringsmodul"}`
          : `Deaktiverte ${moduleKey === "ringelister" ? "ringelistemodul" : "markedsføringsmodul"}`,
        detail: `${requestedIds.length} brukerlisenser · ${requestedIds.length * 49} kr per måned`,
        createdAt: now,
      });
      return Response.json({
        module,
        licensedMemberIds: requestedIds,
        monthlyAmount: requestedIds.length * 49,
        currentUserActive: requestedIds.includes(ctx.membershipId),
      });
    }
    if (data.type === "supportApproval") {
      if (ctx.role !== "Administrator" && !ctx.isSuperadmin)
        throw new AccessError(
          403,
          "Bare administrator kan godkjenne supporttilgang.",
        );
      const requestId = Number(data.requestId);
      await db.insert(supportSessions).values({
        organizationId: ctx.organizationId,
        supportUserId: "*",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        revokedAt: "",
        createdAt: now,
      });
      await db
        .update(supportRequests)
        .set({ status: "Godkjent", resolvedAt: now })
        .where(
          and(
            eq(supportRequests.id, requestId),
            eq(supportRequests.organizationId, ctx.organizationId),
          ),
        );
      await db.insert(auditLogs).values({
        organizationId: ctx.organizationId,
        actor: ctx.user.displayName,
        action: "Godkjente supporttilgang",
        detail: "Tilgang i 24 timer",
        createdAt: now,
      });
      return Response.json({ ok: true });
    }
    if (data.type === "support") {
      const enabled = data.enabled === true;
      let session = null;
      if (enabled)
        [session] = await db
          .insert(supportSessions)
          .values({
            organizationId: ctx.organizationId,
            supportUserId: "*",
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            revokedAt: "",
            createdAt: now,
          })
          .returning();
      else {
        const open = await db
          .select()
          .from(supportSessions)
          .where(
            and(
              eq(supportSessions.organizationId, ctx.organizationId),
              eq(supportSessions.revokedAt, ""),
            ),
          );
        for (const item of open)
          await db
            .update(supportSessions)
            .set({ revokedAt: now })
            .where(eq(supportSessions.id, item.id));
      }
      await db.insert(auditLogs).values({
        organizationId: ctx.organizationId,
        actor: ctx.user.displayName,
        action: enabled ? "Aktiverte supporttilgang" : "Stengte supporttilgang",
        detail: enabled ? "Tilgang i 24 timer" : "Tilgang avsluttet",
        createdAt: now,
      });
      return Response.json({ session });
    }
    await db.insert(auditLogs).values({
      organizationId: ctx.organizationId,
      actor: ctx.user.displayName,
      action: String(data.action ?? "Endring"),
      detail: String(data.detail ?? ""),
      createdAt: now,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return accessResponse(e);
  }
}
