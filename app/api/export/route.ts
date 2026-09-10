import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { activities,companies,contacts } from "@/db/schema";
import { accessResponse,requireTenant } from "@/lib/tenant";

export async function GET(request:Request){
 try{
  const ctx=await requireTenant(request),db=getDb();
  const [companyRows,contactRows,activityRows]=await Promise.all([
   db.select().from(companies).where(eq(companies.organizationId,ctx.organizationId)),
   db.select().from(contacts).where(eq(contacts.organizationId,ctx.organizationId)),
   db.select().from(activities).where(eq(activities.organizationId,ctx.organizationId))
  ]);
  return Response.json({exportedAt:new Date().toISOString(),companies:companyRows,contacts:contactRows,activities:activityRows});
 }catch(e){return accessResponse(e)}
}
