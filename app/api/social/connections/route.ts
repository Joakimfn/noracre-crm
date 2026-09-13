import {linkedinReady,requireLinkedInPage,unsealLinkedIn} from "@/lib/social-linkedin";
import { socialDiagnostic } from "@/lib/social-diagnostic";
import { canManageModules } from "@/lib/module-access";
import { getDb } from "@/db";
import { socialConnections, socialOAuth } from "@/db/schema";
import { notLike, and, eq, gt, desc } from "drizzle-orm";
import { accessResponse } from "@/lib/tenant";
import { graph, metaReady, socialAccess, tokenContext, unseal } from "@/lib/social-meta";
export async function GET(request:Request){
  try {
    const ctx=await socialAccess(request);
    const rows=await getDb().select({id:socialConnections.id,platform:socialConnections.platform,accountId:socialConnections.accountId,accountName:socialConnections.accountName,expiresAt:socialConnections.expiresAt}).from(socialConnections).where(eq(socialConnections.organizationId,ctx.organizationId));
    let connectionError: string | undefined;
    if(canManageModules(ctx.role)) {
      const [attempt]=await getDb().select({status:socialOAuth.status,payload:socialOAuth.payload}).from(socialOAuth).where(and(eq(socialOAuth.organizationId,ctx.organizationId),eq(socialOAuth.membershipId,ctx.membershipId),notLike(socialOAuth.id,"linkedin_%"),gt(socialOAuth.expiresAt,Date.now()-86400000))).orderBy(desc(socialOAuth.expiresAt)).limit(1);
      if(attempt?.status==="error")connectionError=socialDiagnostic(attempt.payload).error;
    }
    return Response.json({connectionError,ready:metaReady()||linkedinReady(),providers:{meta:metaReady(),linkedin:linkedinReady()},connections:rows.map(r=>({...r,expired:r.expiresAt<=Date.now()}))});
  }catch(e){return accessResponse(e);}
}
export async function DELETE(request:Request){
  try {
    const ctx=await socialAccess(request,true),id=Number(new URL(request.url).searchParams.get("id"));
    await getDb().delete(socialConnections).where(and(eq(socialConnections.id,id),eq(socialConnections.organizationId,ctx.organizationId)));
    return Response.json({ok:true});
  }catch(e){return accessResponse(e);}
}
export async function POST(request:Request){
  try {
    const ctx=await socialAccess(request,true),{id}=await request.json();
    const [row]=await getDb().select().from(socialConnections).where(and(eq(socialConnections.id,Number(id)),eq(socialConnections.organizationId,ctx.organizationId))).limit(1);
    if(!row)return Response.json({error:"Kontoen finnes ikke."},{status:404});
    if(row.expiresAt<=Date.now())return Response.json({error:"Koble til kontoen på nytt før du tester tilgangen."},{status:409});
    if(row.platform==="LinkedIn"){const token=await unsealLinkedIn<string>(row.token,tokenContext(ctx.organizationId,row.platform,row.accountId));await requireLinkedInPage(token,row.accountId);return Response.json({ok:true});}
    const token=await unseal<string>(row.token,tokenContext(ctx.organizationId,row.platform,row.accountId));
    const account=await graph<{id:string}>(row.accountId,token,{fields:"id"});
    return Response.json({ok:account.id===row.accountId});
  }catch(e){return accessResponse(e);}
}

