import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { activities, companies, contacts } from "@/db/schema";
import { AccessError, accessResponse, requireTenant } from "@/lib/tenant";

function fields(data: Record<string, unknown>) {
  const name=String(data.name ?? "").trim(), title=String(data.title ?? "").trim(), phone=String(data.phone ?? "").trim(), email=String(data.email ?? "").trim();
  if (!name || name.length>160 || title.length>160 || phone.length>60 || email.length>254)
    throw new AccessError(400,"Fyll inn navn og kontroller lengden på kontaktopplysningene.");
  if(email && !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email)) throw new AccessError(400,"Oppgi en gyldig e-postadresse.");
  return {name,title,phone,email};
}
export async function GET(request:Request){try{
 const ctx=await requireTenant(request),companyId=Number(new URL(request.url).searchParams.get("companyId")),db=getDb();
 let rows=await db.select().from(contacts).where(and(eq(contacts.organizationId,ctx.organizationId),eq(contacts.companyId,companyId)));
 if(!rows.length){const [legacy]=await db.select().from(companies).where(and(eq(companies.organizationId,ctx.organizationId),eq(companies.id,companyId))).limit(1);if(legacy?.contactName){const [created]=await db.insert(contacts).values({organizationId:ctx.organizationId,companyId,name:legacy.contactName,title:"",phone:legacy.phone,email:legacy.email,isPrimary:true,createdAt:new Date().toISOString()}).returning();rows=[created]}}
 return Response.json({contacts:rows});
}catch(e){return accessResponse(e)}}
export async function POST(request:Request){try{
 const ctx=await requireTenant(request),data=await request.json() as Record<string,unknown>,companyId=Number(data.companyId),db=getDb();
 const [company]=await db.select().from(companies).where(and(eq(companies.id,companyId),eq(companies.organizationId,ctx.organizationId))).limit(1);
 if(!company)throw new AccessError(404,"Bedriften finnes ikke");
 const [contact]=await db.insert(contacts).values({organizationId:ctx.organizationId,companyId,...fields(data),isPrimary:Boolean(data.isPrimary),createdAt:new Date().toISOString()}).returning();
 return Response.json({contact},{status:201});
}catch(e){return accessResponse(e)}}
export async function PATCH(request:Request){try{
 const ctx=await requireTenant(request),data=await request.json() as Record<string,unknown>,db=getDb();
 const [existing]=await db.select().from(contacts).where(and(eq(contacts.id,Number(data.id)),eq(contacts.organizationId,ctx.organizationId))).limit(1);
 if(!existing)throw new AccessError(404,"Kontaktpersonen finnes ikke");
 const values=fields({...existing,...data});
 const [company]=await db.select().from(companies).where(and(eq(companies.id,existing.companyId),eq(companies.organizationId,ctx.organizationId))).limit(1);
 const summary=company && (existing.isPrimary || company.contactName===existing.name) ? {
   contactName:values.name,...(company.phone===existing.phone?{phone:values.phone}:{}),...(company.email===existing.email?{email:values.email}:{}),updatedAt:new Date().toISOString(),
 } : {updatedAt:new Date().toISOString()};
 const [[contact]]=await db.batch([
  db.update(contacts).set(values).where(and(eq(contacts.id,existing.id),eq(contacts.organizationId,ctx.organizationId))).returning(),
  db.update(companies).set(summary).where(and(eq(companies.id,existing.companyId),eq(companies.organizationId,ctx.organizationId))),
 ]);
 return Response.json({contact});
}catch(e){return accessResponse(e)}}
export async function DELETE(request:Request){try{
 const ctx=await requireTenant(request),id=Number(new URL(request.url).searchParams.get("id")),db=getDb();
 const [existing]=await db.select().from(contacts).where(and(eq(contacts.id,id),eq(contacts.organizationId,ctx.organizationId))).limit(1);
 if(!existing)throw new AccessError(404,"Kontaktpersonen finnes ikke");
 const peers=await db.select().from(contacts).where(and(eq(contacts.companyId,existing.companyId),eq(contacts.organizationId,ctx.organizationId)));
 const next=peers.find(c=>c.id!==id&&c.isPrimary)??peers.find(c=>c.id!==id);
 const [company]=await db.select().from(companies).where(and(eq(companies.id,existing.companyId),eq(companies.organizationId,ctx.organizationId))).limit(1);
 if(!company)throw new AccessError(404,"Bedriften finnes ikke");
 const now=new Date().toISOString();
 await db.batch([
  db.delete(contacts).where(and(eq(contacts.id,id),eq(contacts.organizationId,ctx.organizationId))),
  db.update(activities).set({contactId:null}).where(and(eq(activities.contactId,id),eq(activities.organizationId,ctx.organizationId))),
  db.update(companies).set({updatedAt:now,...(company.nextContactId===id?{nextContactId:null}:{}),
   ...(existing.isPrimary||company.contactName===existing.name?{contactName:next?.name??"",...(company.phone===existing.phone?{phone:next?.phone??""}:{}),...(company.email===existing.email?{email:next?.email??""}:{})}:{})
  }).where(and(eq(companies.id,existing.companyId),eq(companies.organizationId,ctx.organizationId))),
  ...(next&&existing.isPrimary?[db.update(contacts).set({isPrimary:true}).where(and(eq(contacts.id,next.id),eq(contacts.organizationId,ctx.organizationId)))]:[]),
 ]);
 return Response.json({ok:true});
}catch(e){return accessResponse(e)}}
