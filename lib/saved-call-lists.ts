import {and,eq,or,inArray,isNull} from 'drizzle-orm';
import {getDb} from '@/db';
import {savedCallLists,callListAssignments,callListEntries,organizations} from '@/db/schema';
import {AccessError,requireTenant} from '@/lib/tenant';
import {canManageModules} from '@/lib/module-access';
import {storedCountries,registerCountries,type RegisterCountry} from '@/lib/operating-countries';
export type ListContext=Awaited<ReturnType<typeof requireTenant>>;
export async function accessibleLists(ctx:ListContext){
 const db=getDb(),all=await db.select().from(savedCallLists).where(eq(savedCallLists.organizationId,ctx.organizationId));
 if(canManageModules(ctx.role))return all;
 const assignments=await db.select().from(callListAssignments).where(and(eq(callListAssignments.organizationId,ctx.organizationId),eq(callListAssignments.membershipId,ctx.membershipId)));
 return all.filter(l=>l.createdByMembershipId===ctx.membershipId||l.createdByMembershipId===0||assignments.some(a=>a.listId===l.id));
}
export async function requireList(ctx:ListContext,id:unknown,manage=false){
 const list=(await accessibleLists(ctx)).find(l=>l.id===Number(id));
 if(!list)throw new AccessError(404,'Ringelisten finnes ikke eller du har ikke tilgang.');
 if(manage&&!canManageModules(ctx.role)&&list.createdByMembershipId!==ctx.membershipId)throw new AccessError(403,'Bare administrator eller den som opprettet listen kan endre den.');
 return list;
}
export async function entryScope(ctx:ListContext,listId:string|null){
 if(listId){await requireList(ctx,listId);return eq(callListEntries.listId,Number(listId));}
 const ids=(await accessibleLists(ctx)).map(l=>l.id);
 // Null is reserved for pre-migration entries. These retain their previous shared access.
 return ids.length?or(inArray(callListEntries.listId,ids),isNull(callListEntries.listId)):isNull(callListEntries.listId);
}
export async function countryFor(ctx:ListContext,value:unknown):Promise<RegisterCountry>{
 const [org]=await getDb().select().from(organizations).where(eq(organizations.id,ctx.organizationId)).limit(1);
 const countries=storedCountries(org?.operatingCountries??'["NO"]'),country=String(value??countries[0]);
 if(!countries.includes(country as RegisterCountry)||!registerCountries.some(c=>c.code===country))throw new AccessError(400,'Landet er ikke valgt for denne bedriften.');
 return country as RegisterCountry;
}
export function listName(value:unknown,fallback:string){const name=String(value??fallback).trim();if(!name||name.length>120)throw new AccessError(400,'Listenavnet må ha 1–120 tegn.');return name;}
export async function createList(ctx:ListContext,country:RegisterCountry,name:unknown,now:string){
 return (await getDb().insert(savedCallLists).values({organizationId:ctx.organizationId,country,name:listName(name,`${registerCountries.find(c=>c.code===country)!.name} · ${now.slice(0,10)}`),createdByMembershipId:ctx.membershipId,createdAt:now,updatedAt:now}).returning())[0];
}
