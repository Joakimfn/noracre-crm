import { getDb } from "@/db";
import { socialConnections, socialOAuth } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { AccessError, accessResponse } from "@/lib/tenant";
import { PendingAccounts, pendingContext, permittedPlatforms, seal, socialAccess, tokenContext, unseal } from "@/lib/social-meta";
async function flowFor(request:Request,id:string) {
  const ctx=await socialAccess(request,true);
  const [flow]=await getDb().select().from(socialOAuth).where(and(eq(socialOAuth.id,id),eq(socialOAuth.organizationId,ctx.organizationId),eq(socialOAuth.membershipId,ctx.membershipId),gt(socialOAuth.expiresAt,Date.now()))).limit(1);
  if(!flow)throw new AccessError(404,"Tilkoblingsforsøket er utløpt. Start på nytt.");
  return {ctx,flow};
}
export async function GET(request:Request) {
  try {
    const {ctx,flow}=await flowFor(request,new URL(request.url).searchParams.get("id")??"");
    if(flow.status!=="ready")return Response.json({status:flow.status});
    const payload=await unseal<PendingAccounts>(flow.payload,pendingContext(ctx.organizationId,flow.id));
    return Response.json({status:"ready",platforms:permittedPlatforms(payload),pages:payload.pages.map(p=>({id:p.id,name:p.name,instagram:p.instagram_business_account?{id:p.instagram_business_account.id,name:p.instagram_business_account.username??p.name}:null}))});
  } catch(e){return accessResponse(e);}
}
export async function POST(request:Request) {
  try {
    const body=await request.json();
    const {ctx,flow}=await flowFor(request,String(body.id??""));
    if(flow.status!=="ready")throw new AccessError(409,"Start tilkoblingen på nytt.");
    const payload=await unseal<PendingAccounts>(flow.payload,pendingContext(ctx.organizationId,flow.id));
    const selected=payload.pages.find(p=>p.id===body.pageId);
    const channels: string[]=Array.isArray(body.platforms)?[...new Set(body.platforms.filter((p:unknown)=>typeof p==="string"))] as string[]:[];
    const allowed=permittedPlatforms(payload);
    if(!selected||!channels.length||channels.some(p=>!allowed.includes(p as "Facebook"|"Instagram"))||channels.includes("Instagram")&&!selected.instagram_business_account)
      throw new AccessError(400,"Velg en side og kanaler du har gitt publiseringstilgang til.");
    const [claimed]=await getDb().update(socialOAuth).set({status:"saving"}).where(and(eq(socialOAuth.id,flow.id),eq(socialOAuth.status,"ready"))).returning();
    if(!claimed)throw new AccessError(409,"Tilkoblingen er allerede behandlet.");
    for(const platform of channels){
      const accountId=platform==="Facebook"?selected.id:selected.instagram_business_account!.id;
      const accountName=platform==="Facebook"?selected.name:selected.instagram_business_account!.username??selected.name;
      const values={organizationId:ctx.organizationId,platform,accountId,accountName,pageId:selected.id,token:await seal(selected.access_token,tokenContext(ctx.organizationId,platform,accountId)),expiresAt:payload.expiresAt,connectedBy:ctx.membershipId,updatedAt:new Date().toISOString()};
      await getDb().insert(socialConnections).values(values).onConflictDoUpdate({target:[socialConnections.organizationId,socialConnections.platform],set:values});
    }
    await getDb().delete(socialOAuth).where(eq(socialOAuth.id,flow.id));
    return Response.json({ok:true});
  } catch(e){return accessResponse(e);}
}
