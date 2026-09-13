import {and,eq,gt,like} from "drizzle-orm";
import {getDb} from "@/db";
import {socialConnections,socialOAuth} from "@/db/schema";
import {AccessError,accessResponse} from "@/lib/tenant";
import {pendingContext,socialAccess,tokenContext} from "@/lib/social-meta";
import {LinkedInError,LinkedInPending,requireLinkedInPage,sealLinkedIn,unsealLinkedIn} from "@/lib/social-linkedin";
async function flowFor(request:Request,id:string){const ctx=await socialAccess(request,true);const [flow]=await getDb().select().from(socialOAuth).where(and(eq(socialOAuth.id,id),like(socialOAuth.id,'linkedin_%'),eq(socialOAuth.organizationId,ctx.organizationId),eq(socialOAuth.membershipId,ctx.membershipId),gt(socialOAuth.expiresAt,Date.now()))).limit(1);if(!flow)throw new AccessError(404,'Tilkoblingsforsøket er utløpt. Start på nytt.');return {ctx,flow};}
export async function GET(request:Request){try{
 const {ctx,flow}=await flowFor(request,new URL(request.url).searchParams.get('id')??'');
 if(flow.status==='error'){let status=400;try{status=JSON.parse(flow.payload).status;}catch{}return Response.json({status:'error',error:new LinkedInError(false,status===401,status).message});}
 if(flow.status!=='ready')return Response.json({status:flow.status});
 const payload=await unsealLinkedIn<LinkedInPending>(flow.payload,pendingContext(ctx.organizationId,flow.id));return Response.json({status:'ready',pages:payload.pages});
}catch(e){return accessResponse(e);}}
export async function POST(request:Request){try{
 const body=await request.json(),{ctx,flow}=await flowFor(request,String(body.id??''));if(flow.status!=='ready')throw new AccessError(409,'Start tilkoblingen på nytt.');
 const payload=await unsealLinkedIn<LinkedInPending>(flow.payload,pendingContext(ctx.organizationId,flow.id)),page=payload.pages.find(p=>p.id===body.pageId);
 if(!page||payload.expiresAt<=Date.now())throw new AccessError(400,'Velg en bedriftsside du administrerer.');
 await requireLinkedInPage(payload.token,page.id);
 const [claimed]=await getDb().update(socialOAuth).set({status:'saving'}).where(and(eq(socialOAuth.id,flow.id),eq(socialOAuth.status,'ready'))).returning();if(!claimed)throw new AccessError(409,'Tilkoblingen er allerede behandlet.');
 const values={organizationId:ctx.organizationId,platform:'LinkedIn',accountId:page.id,accountName:page.name,pageId:page.id,token:await sealLinkedIn(payload.token,tokenContext(ctx.organizationId,'LinkedIn',page.id)),expiresAt:payload.expiresAt,connectedBy:ctx.membershipId,updatedAt:new Date().toISOString()};
 await getDb().insert(socialConnections).values(values).onConflictDoUpdate({target:[socialConnections.organizationId,socialConnections.platform],set:values});
 await getDb().delete(socialOAuth).where(eq(socialOAuth.id,flow.id));return Response.json({ok:true});
}catch(e){return accessResponse(e);}}
