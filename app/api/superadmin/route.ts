import {storedCountries} from "@/lib/operating-countries";
import {parseCommissionPercentage} from "@/lib/commission-percentage";
import {validateReferral} from "@/lib/partners";
import {sendSupportRequest} from "@/lib/resend";
import { actorJson, actorRef } from "@/lib/actor-names";
import {parsePricing} from "@/lib/pricing";
import {disableAt} from "@/lib/deactivation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  activities,
  auditLogs,
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
            !s.revokedAt && (s.supportUserId === ctx.user.id || s.supportUserId === "*") &&
            new Date(s.expiresAt).getTime() > now,
        ),
        primary =
          orgUsers.find((u) => u.active && ["Administrator","Partner"].includes(u.role)) ??
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
        commissionBps: org.commissionBps, isPartner: org.isPartner, referredByPartnerId: org.referredByPartnerId, partnerAssignedAt: org.partnerAssignedAt,
        crmPrice: org.crmPrice, ringPrice: org.ringPrice, marketingPrice: org.marketingPrice,
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
        monthlyAmount: activeUsers * (org.crmPrice ?? 0) + moduleMonthly,
        baseMonthlyAmount: activeUsers * (org.crmPrice ?? 0),
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
        pendingAccessRequest: requests.some((r) => r.organizationId === org.id && r.requestedUserId === ctx.user.id && Boolean(r.notificationSentAt)),
        hasSupportAccess: hasDirectAccess || hasSupportAccess,
        primaryContactName: primary?.name ?? "Ikke registrert",
        primaryContactEmail: primary?.email ?? "",
        primaryContactPhone: primary?.phone ?? "",
        retainUntil: org.retainUntil,
      };
    });
    return await actorJson(ctx,{
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
      if(!Number.isSafeInteger(organizationId)||organizationId<1)throw new AccessError(400,'Velg en gyldig bedrift.');
      const [org]=await db.select().from(organizations).where(eq(organizations.id,organizationId)).limit(1);
      if(!org||org.status!=='Aktiv')throw new AccessError(404,'Bedriften er ikke aktiv.');
      const admins=await db.select().from(memberships).where(and(eq(memberships.organizationId,organizationId),inArray(memberships.role,['Administrator','Partner']),eq(memberships.active,true)));
      const emails=[...new Set(admins.filter(a=>!a.scheduledDisableAt||a.scheduledDisableAt>now).map(a=>a.email))];
      if(!emails.length)throw new AccessError(409,'Bedriften har ingen aktiv administrator som kan godkjenne forespørselen.');
      let [created]=await db.select().from(supportRequests).where(and(eq(supportRequests.organizationId,organizationId),eq(supportRequests.requestedUserId,ctx.user.id),eq(supportRequests.status,'Venter'))).limit(1);
      if(!created)[created]=await db.insert(supportRequests).values({organizationId,requestedBy:actorRef(ctx.user),requestedUserId:ctx.user.id,status:'Venter',createdAt:now,resolvedAt:''}).returning();
      if(created.notificationSentAt)return await actorJson(ctx,{request:created,notificationSent:true});
      const sent=await Promise.all(emails.map(to=>sendSupportRequest({to,organization:org.name,requester:ctx.user.displayName,organizationId,requestId:created.id}).catch(()=>({sent:false}))));
      const notificationSent=sent.every(r=>r.sent);
      if(notificationSent)await db.update(supportRequests).set({notificationSentAt:now}).where(eq(supportRequests.id,created.id));
      return await actorJson(ctx,{request:created,notificationSent}, {status:201});
    }
    if (data.type === "organizationStatus") {
      const scheduledDisableAt = data.status === "Deaktivert" ? disableAt(data.effectiveAt) : "";
      if (scheduledDisableAt) {
        const [org] = await db.update(organizations).set({scheduledDisableAt}).where(eq(organizations.id,organizationId)).returning();
        if(!org) throw new AccessError(404,"Bedriften finnes ikke");
        return await actorJson(ctx,{organization:org});
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
      return await actorJson(ctx,{ organization: org });
    }
    if (data.type === "organizationDetails") {
      if (!Number.isSafeInteger(organizationId) || organizationId < 1) throw new AccessError(400,"Velg en gyldig bedrift.");
      const [existing] = await db.select().from(organizations).where(eq(organizations.id,organizationId)).limit(1);
      if (!existing) throw new AccessError(404,"Bedriften finnes ikke.");
      const referredByPartnerId = data.referredByPartnerId === undefined || (data.referredByPartnerId === existing.referredByPartnerId || (existing.referredByPartnerId !== null && data.referredByPartnerId === String(existing.referredByPartnerId))) ? existing.referredByPartnerId : await validateReferral(data.referredByPartnerId,organizationId);
      let commissionBps=existing.commissionBps;
      if(existing.isPartner && data.commissionPercent!==undefined)try{commissionBps=parseCommissionPercentage(data.commissionPercent);}catch(e){throw new AccessError(400,(e as Error).message);}
      const referralChanged = referredByPartnerId !== existing.referredByPartnerId;
      const partnerAssignedAt = referralChanged ? referredByPartnerId ? now : "" : existing.partnerAssignedAt;
      const orgNumber = String(data.orgNumber ?? "").trim().replace(/\s/g, "");
      const countries=storedCountries(existing.operatingCountries);
      if (orgNumber && countries.length===1 && countries[0]==="NO" && !/^\d{9}$/.test(orgNumber))
        return await actorJson(ctx,
          { error: "Organisasjonsnummeret må inneholde ni sifre." },
          { status: 400 },
        );
      const prices = parsePricing(data);
      const enabledModules = await db.select().from(organizationModules).where(and(eq(organizationModules.organizationId,organizationId),eq(organizationModules.active,true)));
      if (enabledModules.some(m => (m.moduleKey === 'ringelister' ? prices.ringPrice : prices.marketingPrice) == null))
        throw new AccessError(400, "Aktive moduler må ha en avtalt pris. Bruk 0 hvis modulen er inkludert.");
      if (prices.crmPrice == null) throw new AccessError(400, "CRM-pris må fylles ut.");
      const [updated] = await db.batch([db
        .update(organizations)
        .set({
          ...prices,
          referredByPartnerId, partnerAssignedAt, commissionBps,
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
        .returning(), ...(referralChanged ? [db.insert(auditLogs).values({organizationId,actor:actorRef(ctx.user),action:"Partnerkobling endret",detail:JSON.stringify({previousPartnerId:existing.referredByPartnerId,referredByPartnerId,partnerAssignedAt}),createdAt:now})] : []), ...(commissionBps!==existing.commissionBps ? [db.insert(auditLogs).values({organizationId,actor:actorRef(ctx.user),action:"Partnerprovisjon endret",detail:JSON.stringify({previousBasisPoints:existing.commissionBps,basisPoints:commissionBps}),createdAt:now})] : [])]);
      const [org] = updated;
      if (!org)
        return await actorJson(ctx,
          { error: "Kundeorganisasjonen finnes ikke." },
          { status: 404 },
        );
      return await actorJson(ctx,{ organization: org });
    }
    return await actorJson(ctx,{ error: "Ukjent handling" }, { status: 400 });
  } catch (e) {
    return accessResponse(e);
  }
}


