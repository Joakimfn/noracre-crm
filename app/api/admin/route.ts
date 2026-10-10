import {parseHomeCountry} from '@/lib/home-countries';
import {organizationLocale} from '@/lib/i18n/country';
import {parseCountries} from "@/lib/operating-countries";
import {canViewAdministration} from "@/lib/roles";
import {parseCommissionPercentage} from "@/lib/commission-percentage";
import {validateReferral} from "@/lib/partners";
import { actorJson, actorRef } from "@/lib/actor-names";
import {parsePricing, organizationPricing, confirmPrice} from "@/lib/pricing";
import {disableAt} from "@/lib/deactivation";
import { canManageModules } from "@/lib/module-access";
import { and, desc, eq, sql } from "drizzle-orm";
import { moduleCatalog } from "@/lib/module-catalog";
import { getDb } from "@/db";
import {
  auditLogs,
  callListEntries,
  outboundDeals,
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
import { sendInvitation } from "@/lib/resend";

export async function GET(request: Request) {
  try {
    const ctx = await requireTenant(request),
      db = getDb();
    const prices = await organizationPricing(ctx.organizationId);
    const [organization]=await db.select({homeCountry:organizations.homeCountry}).from(organizations).where(eq(organizations.id,ctx.organizationId)).limit(1);
    const language=organizationLocale(organization?.homeCountry??"NO");
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
        .orderBy(desc(supportSessions.id)),
      db
        .select()
        .from(organizationModules)
        .where(eq(organizationModules.organizationId, ctx.organizationId)),
      db
        .select()
        .from(moduleLicenses)
        .where(eq(moduleLicenses.organizationId, ctx.organizationId)),
    ]);
    if (!canManageModules(ctx.role)) return await actorJson(ctx,{
      language, homeCountry:organization?.homeCountry??"NO",
      pricing: prices,
      members: [], audit: [], supportRequests: [], activeSupport: false,
      modules: Object.fromEntries(modules.filter(item => item.active && licenses.some(license =>
        license.moduleKey === item.moduleKey && license.active && license.membershipId === ctx.membershipId
      )).map(item => [item.moduleKey, { currentUserActive: true }])),
      role: ctx.role, membershipId: ctx.membershipId,
    });
    return await actorJson(ctx,{
      language, homeCountry:organization?.homeCountry??"NO",
      pricing: prices,
      memberModuleCosts: Object.fromEntries(licenses.map(l => [l.membershipId, licenses.filter(x => x.membershipId === l.membershipId && x.active && modules.some(m => m.moduleKey === x.moduleKey && m.active)).reduce((sum, x) => sum + x.pricePerUser, 0)])),
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
      supportExpiresAt: activeSupport.filter(s=>!s.revokedAt&&s.expiresAt>new Date().toISOString()).map(s=>s.expiresAt).sort().at(-1)??"",
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
            currentUserActive: item.active && licenses.some(
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
      if (ctx.role !== "Superadmin" && ctx.role !== "Partner")
        throw new AccessError(
          403,
          "Bare superadmin og partnere kan opprette kundeorganisasjoner.",
        );
      const [creatorOrganization] = await db.select().from(organizations).where(eq(organizations.id,ctx.organizationId)).limit(1);
      if(ctx.role === "Partner" && !creatorOrganization?.isPartner)throw new AccessError(403,"Bedriften har ikke partnerstatus.");
      let operatingCountries;try{operatingCountries=parseCountries(data.operatingCountries);}catch(e){throw new AccessError(400,(e as Error).message);}
      let homeCountry;try{homeCountry=parseHomeCountry(data.homeCountry,operatingCountries[0]);}catch(e){throw new AccessError(400,(e as Error).message);}
      const email = String(data.adminEmail ?? "")
        .trim()
        .toLowerCase(),
        orgNumber = String(data.orgNumber ?? "").trim().replace(/\s/g, ""),
        phone = String(data.adminPhone ?? "").trim(),
        requestedRole = String(data.adminRole ?? "Administrator"),
        role = requestedRole;
      if (!["Bruker","Administrator","Partner"].includes(role)) throw new AccessError(400,"Ugyldig rolle.");
      if(ctx.role === "Partner" && role === "Partner")throw new AccessError(403,"Partnere kan opprette kunder med administrator eller bruker.");
      const referredByPartnerId = ctx.role === "Partner" ? ctx.organizationId : await validateReferral(data.referredByPartnerId);
      let commissionBps:number|null=null;
      if(role === "Partner")try{commissionBps=parseCommissionPercentage(data.commissionPercent);}catch(e){throw new AccessError(400,(e as Error).message); }
      if (orgNumber && operatingCountries.length === 1 && operatingCountries[0] === "NO" && !/^\d{9}$/.test(orgNumber))
        return await actorJson(ctx,
          { error: "Organisasjonsnummeret må inneholde ni sifre." },
          { status: 400 },
        );
      if (!String(data.name ?? "").trim() || !String(data.adminName ?? "").trim() || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email))
        throw new AccessError(400, "Fyll inn bedriftsnavn, kontaktperson og gyldig e-postadresse.");
      const prices = parsePricing(data);
      if (prices.crmPrice == null) throw new AccessError(400, "Oppgi avtalt CRM-pris før du oppretter bedriften.");
      const [org] = await db
        .insert(organizations)
        .values({
          ...prices,
          homeCountry,
          operatingCountries: JSON.stringify(operatingCountries),
          outboundEnabled: data.outboundEnabled === true,
          isPartner: role === "Partner",
          commissionBps,
          referredByPartnerId,
          partnerAssignedAt: referredByPartnerId ? now : "",
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
      // Link a won outbound lead to this newly provisioned paying customer
      // only when the official registration ID and country match exactly.
      if(orgNumber){
        const [won]=await db.select({dealId:outboundDeals.id}).from(outboundDeals)
          .innerJoin(callListEntries,and(eq(callListEntries.id,outboundDeals.entryId),eq(callListEntries.organizationId,ctx.organizationId)))
          .where(and(eq(outboundDeals.organizationId,ctx.organizationId),eq(outboundDeals.pipeline,'Kunde'),eq(callListEntries.country,homeCountry),eq(callListEntries.orgNumber,orgNumber)))
          .orderBy(desc(outboundDeals.id)).limit(1);
        if(won)await db.update(outboundDeals).set({customerOrganizationId:org.id,updatedAt:now}).where(and(eq(outboundDeals.id,won.dealId),eq(outboundDeals.organizationId,ctx.organizationId)));
      }
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
      const invitation = await sendInvitation({
        to: email,
        name: String(data.adminName ?? "Administrator"),
        organization: org.name,
        role,
      }).catch(() => ({ sent: false, reason: "provider_error" as const }));
      return await actorJson(ctx,
        { organization: org, invitationSent: invitation.sent },
        { status: 201 },
      );
    }
    if (data.type === "member") {
      if (!canViewAdministration(ctx.role))
        throw new AccessError(403, "Bare administrator kan legge til brukere.");
      const targeted = data.organizationId !== undefined;
      if (targeted && ctx.role !== "Superadmin")
        throw new AccessError(403, "Bare superadmin kan opprette brukere i andre bedrifter.");
      const organizationId = targeted ? Number(data.organizationId) : ctx.organizationId;
      if (!Number.isSafeInteger(organizationId) || organizationId < 1)
        throw new AccessError(400, "Velg en gyldig bedrift.");
      const [organization] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
      if (!organization) throw new AccessError(404, "Bedriften finnes ikke.");
      if (organization.status !== "Aktiv" || (organization.scheduledDisableAt && organization.scheduledDisableAt <= now))
        throw new AccessError(409, "Aktiver bedriften før du oppretter brukere.");
      const email = String(data.email ?? "").trim().toLowerCase();
      const name = String(data.name ?? "").trim();
      if (!name || name.length > 160 || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email) || email.length > 254)
        throw new AccessError(400, "Navn og gyldig e-postadresse må fylles ut.");
      const role = String(data.role ?? "Bruker");
      if (!["Bruker", "Administrator", "Superadmin", "Partner"].includes(role))
        throw new AccessError(400, "Ugyldig rolle.");
      if (role === "Partner" && (ctx.role !== "Superadmin" || !organization.isPartner))
        throw new AccessError(403, "Bare superadmin kan gi partnerrollen, og bare i partnerbedrifter.");
      if (role === "Superadmin" && (!isOwner || targeted))
        throw new AccessError(403, "Superadmintilgang må gis av eierkontoen under Superadministratorer.");
      const phone = String(data.phone ?? "").trim().slice(0, 50);
      const price = confirmPrice(organization.crmPrice, data.acceptedPrice);
      const requestedModules = data.moduleKeys ?? [];
      if (!Array.isArray(requestedModules) || requestedModules.some(key => !moduleCatalog.some(module => module.key === key)))
        throw new AccessError(400, "Velg gyldige tilleggsmoduler.");
      if (requestedModules.length && !canManageModules(ctx.role))
        throw new AccessError(403, "Bare administrator og superadmin kan tildele moduler.");
      const acceptedModulePrices = data.acceptedModulePrices as Record<string, unknown> | undefined;
      const selectedModules = moduleCatalog.filter(module => requestedModules.includes(module.key)).map(module => ({
        ...module, price: confirmPrice(organization[module.priceKey], acceptedModulePrices?.[module.key]),
      }));
      const monthlyPrice = price + selectedModules.reduce((sum, module) => sum + module.price, 0);
      const duplicate = await db.select().from(memberships).where(and(eq(memberships.organizationId, organizationId), eq(memberships.email, email))).limit(1);
      if (duplicate.length)
        throw new AccessError(409, "Denne e-postadressen er allerede registrert i bedriften.");
      const [[member]] = await db.batch([
        db.insert(memberships).values({organizationId, userId: `invite:${email}`, email, name, phone, role, active: true, createdAt: now}).returning(),
        db.insert(teamMembers).values({organizationId, email, name, phone, role, active: true, createdAt: now}),
        db.insert(auditLogs).values({organizationId, actor: actorRef(ctx.user), action: "Aktiverte bruker", detail: `${name} · ${monthlyPrice} kr per måned${selectedModules.length ? ` · CRM + ${selectedModules.map(module => module.name).join(", ")}` : ""}`, createdAt: now}),
        ...selectedModules.flatMap(module => [
          // Reactivating an organization module must not restore old users' access.
          db.update(moduleLicenses).set({active: false, deactivatedAt: now}).where(and(
            eq(moduleLicenses.organizationId, organizationId), eq(moduleLicenses.moduleKey, module.key),
            sql`NOT EXISTS (SELECT 1 FROM organization_modules WHERE organization_id = ${organizationId} AND module_key = ${module.key} AND active = 1)`,
          )),
          db.insert(organizationModules).values({organizationId, moduleKey: module.key, active: true, pricePerUser: module.price, activatedAt: now})
            .onConflictDoUpdate({target: [organizationModules.organizationId, organizationModules.moduleKey], set: {active: true, pricePerUser: module.price, activatedAt: now, deactivatedAt: ""}}),
          db.insert(moduleLicenses).values({organizationId,
            membershipId: sql`(SELECT id FROM memberships WHERE organization_id = ${organizationId} AND email = ${email} ORDER BY id DESC LIMIT 1)`,
            moduleKey: module.key, active: true, pricePerUser: module.price, activatedAt: now,
          }),
        ]),
      ]);
      const invitation = await sendInvitation({ to: email, name, organization: organization.name, role })
        .catch(() => ({ sent: false, reason: "provider_error" as const }));
      return await actorJson(ctx, { member, monthlyPrice, modules: selectedModules.map(module => module.key), invitationSent: invitation.sent }, { status: 201 });
    }
    if (data.type === "memberStatus") {
      if (!canViewAdministration(ctx.role))
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
        return await actorJson(ctx,
          { error: "Brukeren finnes ikke." },
          { status: 404 },
        );
      if (target.role === "Superadmin" && !isOwner)
        throw new AccessError(
          403,
          "Bare en eierkonto kan endre en superadministrator.",
        );
      if (target.email === ctx.user.email && !active)
        return await actorJson(ctx,
          { error: "Du kan ikke deaktivere din egen bruker." },
          { status: 400 },
        );
      if (active && !target.active) {
        const prices = await organizationPricing(ctx.organizationId);
    const [organization]=await db.select({homeCountry:organizations.homeCountry}).from(organizations).where(eq(organizations.id,ctx.organizationId)).limit(1);
    const language=organizationLocale(organization?.homeCountry??"NO");
        const [licenses, modules] = await Promise.all([db.select().from(moduleLicenses).where(and(eq(moduleLicenses.organizationId,ctx.organizationId),eq(moduleLicenses.membershipId,id))),db.select().from(organizationModules).where(eq(organizationModules.organizationId,ctx.organizationId))]);
        const extra = licenses.filter(l=>l.active&&modules.some(m=>m.moduleKey===l.moduleKey&&m.active)).reduce((sum,l)=>sum+l.pricePerUser,0);
        confirmPrice(prices.crmPrice == null ? null : prices.crmPrice + extra, data.acceptedPrice);
      }
      const scheduledDisableAt = active ? "" : disableAt(data.effectiveAt);
      const [member] = await db
        .update(memberships)
        .set({ active: scheduledDisableAt ? target.active : active, scheduledDisableAt })
        .where(
          and(
            eq(memberships.id, id),
            eq(memberships.organizationId, ctx.organizationId),
          ),
        )
        .returning();
      await db
        .update(teamMembers)
        .set({ active: member.active })
        .where(
          and(
            eq(teamMembers.organizationId, ctx.organizationId),
            eq(teamMembers.email, target.email),
          ),
        );
      await db.insert(auditLogs).values({
        organizationId: ctx.organizationId,
        actor: actorRef(ctx.user),
        action: active ? "Aktiverte bruker" : "Deaktiverte bruker",
        detail: target.email,
        createdAt: now,
      });
      return await actorJson(ctx,{ member });
    }
    if (data.type === "moduleStatus") {
      if (!canManageModules(ctx.role))
        throw new AccessError(403, "Bare administratorer og superadministratorer kan kjøpe moduler.");
      const moduleKey = String(data.moduleKey),
        requestedIds = Array.isArray(data.membershipIds)
          ? [...new Set(data.membershipIds.map(Number).filter(Number.isFinite))]
          : [],
        active = requestedIds.length > 0;
      if (!["ringelister", "markedsforing"].includes(moduleKey))
        return await actorJson(ctx,{ error: "Ukjent modul." }, { status: 400 });
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
      const prices = await organizationPricing(ctx.organizationId);
    const [organization]=await db.select({homeCountry:organizations.homeCountry}).from(organizations).where(eq(organizations.id,ctx.organizationId)).limit(1);
    const language=organizationLocale(organization?.homeCountry??"NO");
      const allowedIds = new Set(eligible.map((member) => member.id));
      if (requestedIds.some((id) => !allowedIds.has(id)))
        return await actorJson(ctx,
          { error: "En eller flere valgte brukere er ikke aktive." },
          { status: 400 },
        );
      const price = confirmPrice(moduleKey === "ringelister" ? prices.ringPrice : prices.marketingPrice, data.acceptedPrice);
      await Promise.all([
        ...requestedIds.map((membershipId) => {
          const license = currentLicenses.find(
            (item) => item.membershipId === membershipId,
          );
          return license
            ? db
                .update(moduleLicenses)
                .set({ active: true, pricePerUser: price, deactivatedAt: "", activatedAt: now })
                .where(eq(moduleLicenses.id, license.id))
            : db.insert(moduleLicenses).values({
                organizationId: ctx.organizationId,
                membershipId,
                moduleKey,
                active: true,
                pricePerUser: price,
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
              pricePerUser: price,
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
              pricePerUser: price,
              activatedAt: now,
              deactivatedAt: "",
            })
            .returning();
      await db.insert(auditLogs).values({
        organizationId: ctx.organizationId,
        actor: actorRef(ctx.user),
        action: active
          ? `Aktiverte ${moduleKey === "ringelister" ? "ringelistemodul" : "markedsføringsmodul"}`
          : `Deaktiverte ${moduleKey === "ringelister" ? "ringelistemodul" : "markedsføringsmodul"}`,
        detail: `${requestedIds.length} brukerlisenser · ${requestedIds.length * price} kr per måned`,
        createdAt: now,
      });
      return await actorJson(ctx,{
        module,
        licensedMemberIds: requestedIds,
        monthlyAmount: requestedIds.length * price,
        currentUserActive: requestedIds.includes(ctx.membershipId),
      });
    }
    if (data.type === "supportApproval") {
      if (!canManageModules(ctx.role))
        throw new AccessError(
          403,
          "Bare administrator kan godkjenne supporttilgang.",
        );
      const requestId = Number(data.requestId);
      const [pending] = await db.select().from(supportRequests).where(and(
        eq(supportRequests.id, requestId),
        eq(supportRequests.organizationId, ctx.organizationId),
        eq(supportRequests.status, "Venter"),
      )).limit(1);
      if (!pending) throw new AccessError(404, "Tilgangsforespørselen finnes ikke eller er allerede behandlet.");
      if(!pending.requestedUserId)throw new AccessError(409,"Be support sende en ny forespørsel.");
      if(data.duration!==undefined&&data.duration!=="24h"&&data.duration!=="untilRevoked")throw new AccessError(400,"Velg en gyldig varighet.");
      const expiresAt=data.duration==="untilRevoked"?"9999-12-31T23:59:59.999Z":new Date(Date.now()+86400000).toISOString();
      const guard=and(eq(supportRequests.id,requestId),eq(supportRequests.organizationId,ctx.organizationId),eq(supportRequests.status,'Venter'));
      const [granted]=await db.batch([
        db.insert(supportSessions).select(db.select({id:sql<number>`null`.as("id"),organizationId:sql<number>`${ctx.organizationId}`.as("organization_id"),supportUserId:supportRequests.requestedUserId,expiresAt:sql<string>`${expiresAt}`.as("expires_at"),revokedAt:sql<string>`''`.as("revoked_at"),createdAt:sql<string>`${now}`.as("created_at")}).from(supportRequests).where(guard)).returning(),
        db.update(supportRequests).set({status:'Godkjent',resolvedAt:now}).where(guard),
      ]);
      if(!granted.length)throw new AccessError(409,'Forespørselen er allerede behandlet.');
      await db.insert(auditLogs).values({
        organizationId: ctx.organizationId,
        actor: actorRef(ctx.user),
        action: "Godkjente supporttilgang",
        detail: data.duration==="untilRevoked"?"Tilgang til administrator slår den av":"Tilgang i 24 timer",
        createdAt: now,
      });
      return await actorJson(ctx,{ ok: true, expiresAt });
    }
    if (data.type === "support") {
      if (!canManageModules(ctx.role))
        throw new AccessError(403, "Bare administratorer kan endre supporttilgang.");
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
        actor: actorRef(ctx.user),
        action: enabled ? "Aktiverte supporttilgang" : "Stengte supporttilgang",
        detail: enabled ? "Tilgang i 24 timer" : "Tilgang avsluttet",
        createdAt: now,
      });
      return await actorJson(ctx,{ session });
    }
    await db.insert(auditLogs).values({
      organizationId: ctx.organizationId,
      actor: actorRef(ctx.user),
      action: String(data.action ?? "Endring"),
      detail: String(data.detail ?? ""),
      createdAt: now,
    });
    return await actorJson(ctx,{ ok: true });
  } catch (e) {
    return accessResponse(e);
  }
}

