import {and,eq,inArray,desc} from 'drizzle-orm';
import {env} from 'cloudflare:workers';
import {getDb} from '@/db';
import {savedCallLists,callListEntries,callListAssignments,memberships,moduleLicenses,organizations} from '@/db/schema';
import {AccessError,accessResponse,requireTenant} from '@/lib/tenant';
import {requireModuleAccess,canManageModules} from '@/lib/module-access';
import {accessibleLists,requireList,listName} from '@/lib/saved-call-lists';
import {parseCountries,storedCountries,registerCountries} from '@/lib/operating-countries';
const json=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){try{
 const ctx=await requireTenant(request);if(!canManageModules(ctx.role))await requireModuleAccess(ctx.organizationId,ctx.membershipId,'ringelister');
 const db=getDb(),lists=await accessibleLists(ctx),[org]=await db.select().from(organizations).where(eq(organizations.id,ctx.organizationId)).limit(1);
 const assignments=await db.select().from(callListAssignments).where(and(eq(callListAssignments.organizationId,ctx.organizationId),canManageModules(ctx.role)?undefined:eq(callListAssignments.membershipId,ctx.membershipId))).orderBy(desc(callListAssignments.id));
 const settings=env as unknown as Record<string,unknown>;
 const countries=storedCountries(org.operatingCountries);
 const sources=registerCountries.filter(c=>countries.includes(c.code)||lists.some(l=>l.country===c.code)).map(c=>({...c,ready:c.code==='NO'||c.code==='IE'||c.code==='GB'&&!!settings.COMPANIES_HOUSE_API_KEY||c.code==='AU'&&!!settings.ABN_LOOKUP_GUID||c.code==='NZ'&&!!settings.NZBN_API_KEY&&settings.NZBN_CALL_LISTS_APPROVED==='true',message:c.code==='NZ'?'NZBN krever godkjent API-tilgang og avklart bruk til ringelister.':c.code==='GB'?'Companies House krever API-nøkkel.':c.code==='AU'?'ABN Lookup krever registrert tilgang (GUID).':''}));
 return json({lists,assignments,operatingCountries:countries,sources});
}catch(e){return accessResponse(e);}}
export async function POST(request:Request){try{
 const ctx=await requireTenant(request);if(!canManageModules(ctx.role))await requireModuleAccess(ctx.organizationId,ctx.membershipId,'ringelister');
 const data=await request.json(),db=getDb(),now=new Date().toISOString();
 if(data.type==='countries'){
 if(!canManageModules(ctx.role))throw new AccessError(403,'Bare administrator kan endre land.');
 let countries;try{countries=parseCountries(data.operatingCountries);}catch(e){throw new AccessError(400,(e as Error).message);}
 await db.update(organizations).set({operatingCountries:JSON.stringify(countries)}).where(eq(organizations.id,ctx.organizationId));return json({ok:true});
 }
 if(data.type==='acknowledge'){
 if(!Array.isArray(data.ids)||data.ids.length>100||data.ids.some((id:unknown)=>!Number.isSafeInteger(id)))throw new AccessError(400,'Ugyldige varsler.');
 if(data.ids.length)await db.update(callListAssignments).set({acknowledgedAt:now}).where(and(eq(callListAssignments.organizationId,ctx.organizationId),eq(callListAssignments.membershipId,ctx.membershipId),inArray(callListAssignments.id,data.ids)));
 return json({ok:true});
 }
 const list=await requireList(ctx,data.listId,true),scope=and(eq(savedCallLists.id,list.id),eq(savedCallLists.organizationId,ctx.organizationId));
 if(data.type==='rename'){await db.update(savedCallLists).set({name:listName(data.name,''),updatedAt:now}).where(scope);return json({ok:true});}
 if(data.type==='delete'){
 await db.batch([db.delete(callListEntries).where(and(eq(callListEntries.organizationId,ctx.organizationId),eq(callListEntries.listId,list.id))),db.delete(callListAssignments).where(and(eq(callListAssignments.organizationId,ctx.organizationId),eq(callListAssignments.listId,list.id))),db.delete(savedCallLists).where(scope)]);return json({ok:true});
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
 await db.delete(callListAssignments).where(and(eq(callListAssignments.organizationId,ctx.organizationId),eq(callListAssignments.listId,list.id),eq(callListAssignments.membershipId,Number(data.membershipId))));return json({ok:true});
 }
 throw new AccessError(400,'Ukjent handling.');
}catch(e){return accessResponse(e);}}
