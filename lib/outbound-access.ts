import {and, asc, desc, eq, inArray, sql, type SQL} from 'drizzle-orm';
import {getDb} from '@/db';
import {callListEntries, companies, organizations, outboundCallLogs, outboundCompanyOwnership, outboundDeals, outboundLeadState, outboundSuppression} from '@/db/schema';
import {AccessError} from '@/lib/tenant';
import {canManageModules} from '@/lib/module-access';
import {normalizeRegistryId} from '@/lib/prospect-import';
import {outboundRegistryExpression} from '@/lib/outbound-identity';
import {eligibleForOutbound, normalizeOutboundRules} from '@/lib/outbound-markets';
import {outboundCompanyScope} from '@/lib/outbound-company-access';
import type {requireTenant} from '@/lib/tenant';

export type OutboundAccessContext = {organizationId:number; membershipId:number; role:string};
type Entry = typeof callListEntries.$inferSelect;
type Company = Pick<typeof companies.$inferSelect,'id'|'country'|'orgNumber'|'industry'|'city'|'address'>;

function copies(ctx:OutboundAccessContext,entry:Entry) {
  const number=normalizeRegistryId(entry.orgNumber,entry.country);
  return getDb().select({id:callListEntries.id}).from(callListEntries).where(and(eq(callListEntries.organizationId,ctx.organizationId),number?eq(callListEntries.country,entry.country):undefined,number?eq(outboundRegistryExpression(callListEntries.orgNumber,callListEntries.country),number):eq(callListEntries.id,entry.id)));
}
function canonicalStateValue(ctx:OutboundAccessContext,field:'next_call_at'|'pipeline'|'assigned_membership_id') {
  const number=outboundRegistryExpression(sql`call_list_entries.org_number`,sql`call_list_entries.country`);
  return sql`(select s.${sql.raw(field)} from outbound_lead_state s join call_list_entries e on e.id=s.entry_id and e.organization_id=${ctx.organizationId} where s.organization_id=${ctx.organizationId} and
    (e.id=call_list_entries.id or (${number}<>'' and e.country=call_list_entries.country and ${outboundRegistryExpression(sql`e.org_number`,sql`e.country`)}=${number})) order by s.updated_at desc,s.id asc limit 1)`;
}
export function outboundDueEntryScope(ctx:OutboundAccessContext,now=new Date().toISOString()) {
  const nextCallAt=sql`coalesce(${canonicalStateValue(ctx,'next_call_at')},'')`;
  return sql`coalesce(${canonicalStateValue(ctx,'pipeline')},'Prospekt') not in ('Kunde','Tapt') and ((${nextCallAt}='' and ${callListEntries.status}='Ny') or (${nextCallAt}<>'' and ${nextCallAt}<=${now}))`;
}

export async function outboundOrganizationFor(ctx:OutboundAccessContext) {
  const [organization] = await getDb().select({
    outboundEnabled:organizations.outboundEnabled,
    outboundTimezone:organizations.outboundTimezone,
    outboundCurrency:organizations.outboundCurrency,
    outboundMarketRules:organizations.outboundMarketRules,
  }).from(organizations).where(eq(organizations.id,ctx.organizationId)).limit(1);
  if(!organization)throw new AccessError(404,'Bedriften finnes ikke.');
  return organization;
}

/** Canonical company ownership takes precedence over a stale copy in another list. */
export function outboundOwnedEntryScope(ctx:OutboundAccessContext):SQL {
  const number=outboundRegistryExpression(callListEntries.orgNumber,callListEntries.country);
  const key=sql`${outboundCompanyOwnership.organizationId}=${ctx.organizationId} and ${outboundCompanyOwnership.country}=${callListEntries.country} and ${outboundCompanyOwnership.orgNumber}=${number}`;
  return sql`(exists(select 1 from ${outboundCompanyOwnership} where ${key} and ${outboundCompanyOwnership.assignedMembershipId}=${ctx.membershipId}) or
    (not exists(select 1 from ${outboundCompanyOwnership} where ${key}) and ${canonicalStateValue(ctx,'assigned_membership_id')}=${ctx.membershipId}))`;
}

export async function outboundEntryScope(ctx:OutboundAccessContext) {
  const organization=await outboundOrganizationFor(ctx);
  return organization.outboundEnabled&&!canManageModules(ctx.role)?outboundOwnedEntryScope(ctx):undefined;
}

/** Opt-out remains enforced even after an administrator switches off outbound mode. */
export function outboundContactEntryScope(ctx:OutboundAccessContext):SQL {
  const number=outboundRegistryExpression(callListEntries.orgNumber,callListEntries.country);
  return sql`not exists(select 1 from ${outboundSuppression} where ${outboundSuppression.organizationId}=${ctx.organizationId} and ${outboundSuppression.country}=${callListEntries.country} and ${outboundSuppression.orgNumber}=${number})
    and not exists(select 1 from ${outboundLeadState} s join ${callListEntries} e on e.id=s.entry_id and e.organization_id=${ctx.organizationId} where s.organization_id=${ctx.organizationId} and s.do_not_contact=1 and
      (e.id=${callListEntries.id} or (${number}<>'' and e.country=${callListEntries.country} and ${outboundRegistryExpression(sql`e.org_number`,sql`e.country`)}=${number})))`;
}

export function outboundEntryPermission(ctx:OutboundAccessContext) {
  // Drizzle removes table qualifiers in SELECT expressions; these correlations
  // must explicitly refer to the outer table, rather than the joined aliases.
  const number=outboundRegistryExpression(sql`call_list_entries.org_number`,sql`call_list_entries.country`);
  return sql<boolean>`exists(select 1 from ${outboundLeadState} s join ${callListEntries} e on e.id=s.entry_id and e.organization_id=${ctx.organizationId} where s.organization_id=${ctx.organizationId} and s.contact_permission=1 and
    (e.id=call_list_entries.id or (${number}<>'' and e.country=call_list_entries.country and ${outboundRegistryExpression(sql`e.org_number`,sql`e.country`)}=${number})))`.mapWith(Boolean);
}

export function assertOutboundMarketContact(organization:Awaited<ReturnType<typeof outboundOrganizationFor>>, entry:Record<string,unknown>, now=new Date()) {
  const eligibility=eligibleForOutbound(entry,normalizeOutboundRules(organization.outboundMarketRules),now,organization.outboundTimezone);
  if(!eligibility.eligible)throw new AccessError(409,eligibility.reason==='do_not_contact'?'Denne bedriften har reservert seg mot kontakt.':'Bedriften kan ikke kontaktes med de gjeldende markedsreglene.','OUTBOUND_CONTACT_BLOCKED');
}

export function legacyCallOutcome(status:string) {
  return ({'Ringte – ikke svar':'Ikke svar','Kontaktet':'Beslutningstaker kontaktet','Møte booket':'Møte booket','Tilbud sendt':'Interessert','Ikke aktuell':'Ikke interessert'} as Record<string,string>)[status];
}

export async function requireOutboundEntryAccess(ctx:OutboundAccessContext,entry:Entry,contact=true) {
  const db=getDb(),organization=await outboundOrganizationFor(ctx),number=normalizeRegistryId(entry.orgNumber,entry.country);
  const [state]=await db.select().from(outboundLeadState).where(and(eq(outboundLeadState.organizationId,ctx.organizationId),inArray(outboundLeadState.entryId,copies(ctx,entry)))).orderBy(desc(outboundLeadState.updatedAt),asc(outboundLeadState.id)).limit(1);
  const [owner]=number?await db.select().from(outboundCompanyOwnership).where(and(eq(outboundCompanyOwnership.organizationId,ctx.organizationId),eq(outboundCompanyOwnership.country,entry.country),eq(outboundCompanyOwnership.orgNumber,number))).limit(1):[];
  if(organization.outboundEnabled&&!canManageModules(ctx.role)&&(owner?.assignedMembershipId??state?.assignedMembershipId??0)!==ctx.membershipId)
    throw new AccessError(403,'Dette leadet er ikke tildelt deg.');
  if(contact) {
    const [allowed]=await db.select({id:callListEntries.id,contactPermission:outboundEntryPermission(ctx)}).from(callListEntries).where(and(eq(callListEntries.organizationId,ctx.organizationId),eq(callListEntries.id,entry.id),outboundContactEntryScope(ctx))).limit(1);
    if(!allowed)throw new AccessError(409,'Denne bedriften har reservert seg mot kontakt.','OUTBOUND_CONTACT_BLOCKED');
    assertOutboundMarketContact(organization,{...entry,state,contactPermission:allowed.contactPermission});
    const lease=owner??state;
    if(lease?.leaseToken&&lease.leaseUntil>new Date().toISOString())throw new AccessError(409,'Bedriften er åpen i ringemodus. Fullfør samtalen der før du endrer status.','OUTBOUND_LEASE_ACTIVE');
  }
  return {organization,state,owner};
}

export async function requireOutboundCompanyContact(ctx:Awaited<ReturnType<typeof requireTenant>>,company:Company) {
  return requireOutboundCompaniesContact(ctx,[company]);
}

export async function requireOutboundCompaniesContact(ctx:Awaited<ReturnType<typeof requireTenant>>,rows:Company[],now=new Date()) {
  const db=getDb(),organization=await outboundOrganizationFor(ctx),scope=await outboundCompanyScope(ctx);
  const number=outboundRegistryExpression(sql`companies.org_number`,sql`companies.country`);
  const linked=sql`(e.customer_id=companies.id or (${number}<>'' and e.country=companies.country and ${outboundRegistryExpression(sql`e.org_number`,sql`e.country`)}=${number}))`;
  const blocked=sql<boolean>`exists(select 1 from ${outboundSuppression} where ${outboundSuppression.organizationId}=${ctx.organizationId} and ${outboundSuppression.country}=companies.country and ${outboundSuppression.orgNumber}=${number}) or
    exists(select 1 from ${outboundLeadState} s join ${callListEntries} e on e.id=s.entry_id and e.organization_id=${ctx.organizationId} where s.organization_id=${ctx.organizationId} and s.do_not_contact=1 and ${linked})`.mapWith(Boolean);
  const permission=sql<boolean>`exists(select 1 from ${outboundLeadState} s join ${callListEntries} e on e.id=s.entry_id and e.organization_id=${ctx.organizationId} where s.organization_id=${ctx.organizationId} and s.contact_permission=1 and ${linked})`.mapWith(Boolean);
  for(let i=0;i<rows.length;i+=25) {
    const batch=rows.slice(i,i+25),found=await db.select({id:companies.id,blocked,contactPermission:permission}).from(companies).where(and(eq(companies.organizationId,ctx.organizationId),inArray(companies.id,batch.map(company=>company.id)),scope));
    if(found.length!==batch.length)throw new AccessError(404,'En av kundene finnes ikke eller er tildelt en annen selger.');
    const byId=new Map(found.map(company=>[company.id,company]));
    for(const company of batch) {
      const current=byId.get(company.id)!;
      if(current.blocked)throw new AccessError(409,'Denne bedriften har reservert seg mot kontakt.','OUTBOUND_CONTACT_BLOCKED');
      assertOutboundMarketContact(organization,{...company,contactPermission:current.contactPermission},now);
    }
  }
}

/** Keep the standard list editor and outbound history consistent in one D1 batch. */
export async function commitLegacyOutboundStatus(
  ctx:OutboundAccessContext,
  entry:Entry,
  changes:Partial<typeof callListEntries.$inferInsert>,
  access:Awaited<ReturnType<typeof requireOutboundEntryAccess>>,
  options:{requestId:string; note:string; nextCallAt?:unknown; now:string; customerId:number|null; isCustomer:boolean;pending:Parameters<ReturnType<typeof getDb>['batch']>[0][number][]},
) {
  const db=getDb(),status=String(changes.status),scope=and(eq(callListEntries.organizationId,ctx.organizationId),eq(callListEntries.id,entry.id));
  if(!access.organization.outboundEnabled){const statements=[...options.pending,db.update(callListEntries).set(changes).where(scope).returning()];const result=await db.batch(statements as [typeof statements[number],...typeof statements[number][]]);return (result.at(-1) as Entry[])[0];}
  const outcome=legacyCallOutcome(status),owner=access.owner?.assignedMembershipId||access.state?.assignedMembershipId||ctx.membershipId;
  let nextCallAt=access.state?.nextCallAt??'';
  if(options.nextCallAt!==undefined&&options.nextCallAt!=='') {
    if(typeof options.nextCallAt!=='string'||!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(options.nextCallAt)||!Number.isFinite(Date.parse(options.nextCallAt)))throw new AccessError(400,'Oppgi dato for neste samtale med tidssone.');
    nextCallAt=new Date(options.nextCallAt).toISOString();
  } else if(outcome==='Ikke svar')nextCallAt=new Date(Date.parse(options.now)+48*3600000).toISOString();
  if(status==='Ny'||status==='Møte booket'||status==='Ikke aktuell'||options.isCustomer)nextCallAt='';
  const pipeline=options.isCustomer?'Kunde':status==='Ny'?'Prospekt':status==='Møte booket'?'Demo booket':status==='Tilbud sendt'?'Tilbud':status==='Ikke aktuell'?'Tapt':access.state?.pipeline??'Prospekt';
  const primaryEntryId=access.state?.entryId??entry.id;
  const state={organizationId:ctx.organizationId,entryId:primaryEntryId,assignedMembershipId:owner,nextCallAt,pipeline,lastOutcome:outcome??access.state?.lastOutcome??'',lastNote:options.note||access.state?.lastNote||'',contactName:String(changes.contactName??entry.contactName),contactPhone:String(changes.contactPhone??entry.contactPhone),attempts:(access.state?.attempts??0)+(outcome?1:0),doNotContact:access.state?.doNotContact??false,createdAt:access.state?.createdAt??options.now,updatedAt:options.now};
  const {entryId:_entryId,createdAt:_createdAt,...shared}=state;
  const statements=[...options.pending,db.insert(outboundLeadState).values(state).onConflictDoUpdate({target:outboundLeadState.entryId,set:{...state,attempts:outcome?sql`${outboundLeadState.attempts}+1`:outboundLeadState.attempts}}),db.update(outboundLeadState).set({...shared,attempts:sql`(select attempts from outbound_lead_state where organization_id=${ctx.organizationId} and entry_id=${primaryEntryId})`}).where(and(eq(outboundLeadState.organizationId,ctx.organizationId),inArray(outboundLeadState.entryId,copies(ctx,entry)))),db.update(callListEntries).set({...changes,customerId:options.customerId??callListEntries.customerId}).where(and(eq(callListEntries.organizationId,ctx.organizationId),inArray(callListEntries.id,copies(ctx,entry)))).returning()];
  if(outcome)statements.push(db.insert(outboundCallLogs).values({organizationId:ctx.organizationId,entryId:entry.id,membershipId:ctx.membershipId,requestId:options.requestId,outcome,note:options.note,nextCallAt,createdAt:options.now}) as unknown as typeof statements[number]);
  if(options.isCustomer||['Demo booket','Tilbud','Tapt'].includes(pipeline)){const [deal]=await db.select({entryId:outboundDeals.entryId}).from(outboundDeals).where(and(eq(outboundDeals.organizationId,ctx.organizationId),inArray(outboundDeals.entryId,copies(ctx,entry)))).limit(1);statements.push(db.insert(outboundDeals).values({organizationId:ctx.organizationId,entryId:deal?.entryId??primaryEntryId,membershipId:owner,customerCompanyId:options.customerId,pipeline,currency:access.organization.outboundCurrency,createdAt:options.now,updatedAt:options.now}).onConflictDoUpdate({target:outboundDeals.entryId,set:{pipeline,customerCompanyId:options.customerId??outboundDeals.customerCompanyId,updatedAt:options.now}}) as unknown as typeof statements[number]);}
  try {
    const results=await db.batch(statements as [typeof statements[number],...typeof statements[number][]]);
    return (results[options.pending.length+2] as Entry[]).find(row=>row.id===entry.id)!;
  }catch(error) {
    // A simultaneous replay may win the request's unique index. The failed
    // batch rolls back its company, contact, calendar and attempt writes.
    const [previous]=await db.select().from(outboundCallLogs).where(and(eq(outboundCallLogs.organizationId,ctx.organizationId),eq(outboundCallLogs.requestId,options.requestId))).limit(1);
    if(previous&&previous.entryId===entry.id&&previous.membershipId===ctx.membershipId&&previous.outcome===outcome&&previous.note===options.note){const [saved]=await db.select().from(callListEntries).where(scope).limit(1);if(saved)return saved;}
    throw error;
  }
}
