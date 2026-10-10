import {outboundCompanyIds,outboundCompanyScope} from "@/lib/outbound-company-access";
import { actorJson, actorRef } from "@/lib/actor-names";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { activities,companies,contacts } from "@/db/schema";
import { accessResponse,requireTenant } from "@/lib/tenant";

export async function GET(request:Request){
 try{
  const ctx=await requireTenant(request),db=getDb(),allowed=await outboundCompanyIds(ctx);
  const [companyRows,contactRows,activityRows]=await Promise.all([
   db.select().from(companies).where(and(eq(companies.organizationId,ctx.organizationId),await outboundCompanyScope(ctx))),
   db.select().from(contacts).where(and(eq(contacts.organizationId,ctx.organizationId),allowed?inArray(contacts.companyId,allowed.query):undefined)),
   db.select().from(activities).where(and(eq(activities.organizationId,ctx.organizationId),allowed?inArray(activities.companyId,allowed.query):undefined))
  ]);
  return await actorJson(ctx,{exportedAt:new Date().toISOString(),companies:companyRows,contacts:contactRows,activities:activityRows});
 }catch(e){return accessResponse(e)}
}
