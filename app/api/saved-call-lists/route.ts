import {parseHomeCountry} from '@/lib/home-countries';
import {and,eq,inArray,desc} from 'drizzle-orm';
import {env} from 'cloudflare:workers';
import {getDb} from '@/db';
import {savedCallLists,callListEntries,callListAssignments,memberships,moduleLicenses,organizations,outboundCallLogs,outboundDeals,outboundDealPayments,outboundLeadState} from '@/db/schema';
import {AccessError,accessResponse,requireTenant} from '@/lib/tenant';
import {requireModuleAccess,canManageModules} from '@/lib/module-access';
import {accessibleLists,requireList,listName} from '@/lib/saved-call-lists';
import {parseCountries,storedCountries,registerCountries} from '@/lib/operating-countries';
import {outboundEntryScope,outboundOrganizationFor,outboundOwnedEntryScope} from '@/lib/outbound-access';
import {sql} from 'drizzle-orm';
import {outboundRegistryExpression} from '@/lib/outbound-identity';
const json=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){try{
 const ctx=await requireTenant(request);if(!canManageModules(ctx.role))await requireModuleAccess(ctx.organizationId,ctx.membershipId,'ringelister');
 const db=getDb(),lists=await accessibleLists(ctx),[org]=await db.select().from(organizations).where(eq(organizations.id,ctx.organizationId)).limit(1);
 const assignments=await db.select().from(callListAssignments).where(and(eq(callListAssignments.organizationId,ctx.organizationId),canManageModules(ctx.role)?undefined:eq(callListAssignments.membershipId,ctx.membershipId))).orderBy(desc(callListAssignments.id));
 const settings=env as unknown as Record<string,unknown>;
 const countries=storedCountries(org.operatingCountries);
 const sources=registerCountries.filter(c=>countries.includes(c.code)||lists.some(l=>l.country===c.code)).map(c=>({...c,ready:c.code==='NO'||c.code==='IE'||c.code==='FR'||c.code==='GB'&&!!settings.COMPANIES_HOUSE_API_KEY||c.code==='AU'&&!!settings.ABN_LOOKUP_GUID||c.code==='NZ'&&!!settings.NZBN_API_KEY&&settings.NZBN_CALL_LISTS_APPROVED==='true'||c.code==='NG'&&!!settings.OPENCORPORATES_API_TOKEN&&settings.OPENCORPORATES_COMMERCIAL_APPROVED==='true',message:c.code==='ZM'?'Zambia kan bruke importerte leverandørlister fra offentlige innkjøpsdata. Automatisk registeroppslag er ikke tilgjengelig; dataene er ikke et komplett foretaksregister.':c.code==='NG'?'Automatisk Nigeriansk registersøk krever kommersiell OpenCorporates API-tilgang. Importer egne bedriftslister inntil da.':c.code==='NZ'?'NZBN krever godkjent API-tilgang og avklart bruk til ringelister.':c.code==='GB'?'Companies House krever API-nøkkel.':c.code==='AU'?'ABN Lookup krever registrert tilgang (GUID).':''}));
 return json({lists,assignments,homeCountry:org.homeCountry,operatingCountries:countries,sources});
}catch(e){return accessResponse(e);}}
export async function POST(request:Request){try{
 const ctx=await requireTenant(request);if(!canManageModules(ctx.role))await requireModuleAccess(ctx.organizationId,ctx.membershipId,'ringelister');
 const data=await request.json() as Record<string,unknown>,db=getDb(),now=new Date().toISOString();
 if(data.type==='countries'){
 if(!canManageModules(ctx.role))throw new AccessError(403,'Bare administrator kan endre land.');
 let countries;try{countries=parseCountries(data.operatingCountries);}catch(e){throw new AccessError(400,(e as Error).message);}
 let homeCountry;try{homeCountry=data.homeCountry===undefined?undefined:parseHomeCountry(data.homeCountry);}catch(e){throw new AccessError(400,(e as Error).message);}
 await db.update(organizations).set({...(homeCountry?{homeCountry}:{}),operatingCountries:JSON.stringify(countries)}).where(eq(organizations.id,ctx.organizationId));return json({ok:true});
 }
 if(data.type==='acknowledge'){
 if(!Array.isArray(data.ids)||data.ids.length>100||data.ids.some((id:unknown)=>!Number.isSafeInteger(id)))throw new AccessError(400,'Ugyldige varsler.');
 if(data.ids.length)await db.update(callListAssignments).set({acknowledgedAt:now}).where(and(eq(callListAssignments.organizationId,ctx.organizationId),eq(callListAssignments.membershipId,ctx.membershipId),inArray(callListAssignments.id,data.ids)));
 return json({ok:true});
 }
 const list=await requireList(ctx,data.listId,true),scope=and(eq(savedCallLists.id,list.id),eq(savedCallLists.organizationId,ctx.organizationId));
 if(data.type==='rename'){await db.update(savedCallLists).set({name:listName(data.name,''),updatedAt:now}).where(scope);return json({ok:true});}
 if(data.type==='delete'){
 const entries=db.select({id:callListEntries.id}).from(callListEntries).where(and(eq(callListEntries.organizationId,ctx.organizationId),eq(callListEntries.listId,list.id)));
 const ownership=await outboundEntryScope(ctx);
 if(ownership){const [other]=await db.select({id:callListEntries.id}).from(callListEntries).where(and(eq(callListEntries.organizationId,ctx.organizationId),eq(callListEntries.listId,list.id),sql`not (${ownership})`)).limit(1);if(other)throw new AccessError(403,'Bare administrator kan slette en liste med leads som ikke er tildelt deg.');}
 const [calls,deals,payments,followups]=await Promise.all([
  db.select({id:outboundCallLogs.id}).from(outboundCallLogs).where(and(eq(outboundCallLogs.organizationId,ctx.organizationId),inArray(outboundCallLogs.entryId,entries))).limit(1),
  db.select({id:outboundDeals.id}).from(outboundDeals).where(and(eq(outboundDeals.organizationId,ctx.organizationId),inArray(outboundDeals.entryId,entries))).limit(1),
  db.select({id:outboundDealPayments.id}).from(outboundDealPayments).where(and(eq(outboundDealPayments.organizationId,ctx.organizationId),inArray(outboundDealPayments.entryId,entries))).limit(1),
  db.select({id:outboundLeadState.id}).from(outboundLeadState).where(and(eq(outboundLeadState.organizationId,ctx.organizationId),inArray(outboundLeadState.entryId,entries),sql`(${outboundLeadState.attempts}>0 or ${outboundLeadState.nextCallAt}<>'' or ${outboundLeadState.doNotContact}=1 or ${outboundLeadState.leaseUntil}>${now})`)).limit(1),
 ]);
 if(calls.length||deals.length||payments.length||followups.length)throw new AccessError(409,'Listen har samtalehistorikk, oppfølging eller salgsgrunnlag og må beholdes.');
 // Recheck inside every statement of the atomic batch: a call can be logged
 // between the initial read and deletion, and its history must still survive.
 const historical=(table:string)=>sql`not exists(select 1 from ${sql.raw(table)} h join call_list_entries e on e.id=h.entry_id and e.organization_id=${ctx.organizationId} where h.organization_id=${ctx.organizationId} and e.list_id=${list.id})`;
 const safeDeletion=and(historical('outbound_call_logs'),historical('outbound_deals'),historical('outbound_deal_payments'),sql`not exists(select 1 from outbound_lead_state h join call_list_entries e on e.id=h.entry_id and e.organization_id=${ctx.organizationId} where h.organization_id=${ctx.organizationId} and e.list_id=${list.id} and (h.attempts>0 or h.next_call_at<>'' or h.do_not_contact=1 or h.lease_until>${now}))`,sql`not exists(select 1 from outbound_company_ownership h join call_list_entries e on e.organization_id=h.organization_id and e.country=h.country and h.org_number=${outboundRegistryExpression(sql`e.org_number`,sql`e.country`)} where h.organization_id=${ctx.organizationId} and e.list_id=${list.id} and h.lease_until>${now})`,ownership?sql`not exists(select 1 from call_list_entries where organization_id=${ctx.organizationId} and list_id=${list.id} and not (${ownership}))`:undefined);
 const result=await db.batch([db.delete(outboundLeadState).where(and(eq(outboundLeadState.organizationId,ctx.organizationId),inArray(outboundLeadState.entryId,entries),safeDeletion)),db.delete(callListEntries).where(and(eq(callListEntries.organizationId,ctx.organizationId),eq(callListEntries.listId,list.id),safeDeletion)),db.delete(callListAssignments).where(and(eq(callListAssignments.organizationId,ctx.organizationId),eq(callListAssignments.listId,list.id),safeDeletion)),db.delete(savedCallLists).where(and(scope,safeDeletion,sql`not exists(select 1 from call_list_entries where organization_id=${ctx.organizationId} and list_id=${list.id})`)).returning({id:savedCallLists.id})]);
 if(!result[3].length)throw new AccessError(409,'Listen fikk ny aktivitet og må beholdes.');return json({ok:true});
 }
 if(data.type==='assign'){
 if(!canManageModules(ctx.role))throw new AccessError(403,'Bare administrator kan delegere ringelister.');
 const memberId=Number(data.membershipId),[member]=await db.select().from(memberships).where(and(eq(memberships.id,memberId),eq(memberships.organizationId,ctx.organizationId),eq(memberships.active,true))).limit(1);
 if(!member)throw new AccessError(400,'Velg en aktiv bruker i din bedrift.');
 const [license]=await db.select().from(moduleLicenses).where(and(eq(moduleLicenses.organizationId,ctx.organizationId),eq(moduleLicenses.membershipId,memberId),eq(moduleLicenses.moduleKey,'ringelister'),eq(moduleLicenses.active,true))).limit(1);
 if(!license)throw new AccessError(400,'Brukeren må først få tilgang til Ringelister.');
 await db.batch([db.delete(callListAssignments).where(and(eq(callListAssignments.organizationId,ctx.organizationId),eq(callListAssignments.listId,list.id),eq(callListAssignments.membershipId,memberId))),db.insert(callListAssignments).values({organizationId:ctx.organizationId,listId:list.id,membershipId:memberId,assignedBy:ctx.user.displayName,createdAt:now,acknowledgedAt:''})]);return json({ok:true});
 }
 if(data.type==='unassign'){
 if(!canManageModules(ctx.role))throw new AccessError(403,'Bare administrator kan fjerne delegering.');
 if((await outboundOrganizationFor(ctx)).outboundEnabled){const [owned]=await db.select({id:callListEntries.id}).from(callListEntries).where(and(eq(callListEntries.organizationId,ctx.organizationId),eq(callListEntries.listId,list.id),outboundOwnedEntryScope({...ctx,membershipId:Number(data.membershipId)}))).limit(1);if(owned)throw new AccessError(409,'Omfordel brukerens leads før du fjerner tilgangen til listen.');}
 await db.delete(callListAssignments).where(and(eq(callListAssignments.organizationId,ctx.organizationId),eq(callListAssignments.listId,list.id),eq(callListAssignments.membershipId,Number(data.membershipId))));return json({ok:true});
 }
 throw new AccessError(400,'Ukjent handling.');
}catch(e){return accessResponse(e);}}
