import {asc} from "drizzle-orm";
import {getDb} from "@/db";
import {billingEvents,organizations} from "@/db/schema";
import {requireTenant,AccessError,accessResponse} from "@/lib/tenant";
import {operationsReport} from "@/lib/operations-report";
export async function GET(request:Request){try{
 const ctx=await requireTenant(request);if(ctx.role!=="Superadmin")throw new AccessError(403,"Bare superadministratorer har tilgang.");
 const db=getDb();const [events,orgs]=await Promise.all([db.select().from(billingEvents).orderBy(asc(billingEvents.occurredAt),asc(billingEvents.id)),db.select({id:organizations.id,name:organizations.name}).from(organizations)]);
 const names=new Map(orgs.map(o=>[o.id,o.name]));
 for(const e of events)if(e.entityType==='organization'&&!names.has(e.organizationId))names.set(e.organizationId,e.label);
 return Response.json({...operationsReport(events),events:events.map(e=>({...e,organizationName:names.get(e.organizationId)??`Bedrift ${e.organizationId}`}))},{headers:{"Cache-Control":"no-store"}});
}catch(e){return accessResponse(e);}}
