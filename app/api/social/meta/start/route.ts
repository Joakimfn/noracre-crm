import { getDb } from "@/db";
import { socialOAuth } from "@/db/schema";
import { notLike, and, eq, lt } from "drizzle-orm";
import { accessResponse } from "@/lib/tenant";
import { hash, metaConfig, OAUTH_COOKIE, randomSecret, socialAccess } from "@/lib/social-meta";
export async function POST(request: Request) {
  try {
    const ctx=await socialAccess(request,true), c=metaConfig();
    const state=randomSecret(), browser=randomSecret(), id=crypto.randomUUID();
    await getDb().delete(socialOAuth).where(lt(socialOAuth.expiresAt,Date.now()));
    await getDb().delete(socialOAuth).where(and(eq(socialOAuth.organizationId,ctx.organizationId),eq(socialOAuth.membershipId,ctx.membershipId),notLike(socialOAuth.id,"linkedin_%")));
    await getDb().insert(socialOAuth).values({id,organizationId:ctx.organizationId,membershipId:ctx.membershipId,stateHash:await hash(state),browserHash:await hash(browser),expiresAt:Date.now()+600000});
    const url=new URL(`https://www.facebook.com/${c.version}/dialog/oauth`);
    url.search=new URLSearchParams({client_id:c.appId,redirect_uri:c.redirect,response_type:"code",state,
      ...(c.configId ? {config_id:c.configId} : {scope:"pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish",auth_type:"rerequest"})}).toString();
    return Response.json({id,url:url.toString()},{headers:{"Set-Cookie":`${OAUTH_COOKIE}=${browser}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`}});
  } catch(e) {return accessResponse(e);}
}

