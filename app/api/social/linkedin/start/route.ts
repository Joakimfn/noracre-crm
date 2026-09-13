import {and,eq,like,lt} from "drizzle-orm";
import {getDb} from "@/db";
import {socialOAuth} from "@/db/schema";
import {accessResponse} from "@/lib/tenant";
import {hash,randomSecret,socialAccess} from "@/lib/social-meta";
import {LINKEDIN_COOKIE,LINKEDIN_SCOPES,linkedinConfig} from "@/lib/social-linkedin";
export async function POST(request:Request){try{
 const ctx=await socialAccess(request,true),c=linkedinConfig(),state=randomSecret(),browser=randomSecret(),id=`linkedin_${crypto.randomUUID()}`;
 await getDb().delete(socialOAuth).where(lt(socialOAuth.expiresAt,Date.now()));
 await getDb().delete(socialOAuth).where(and(eq(socialOAuth.organizationId,ctx.organizationId),eq(socialOAuth.membershipId,ctx.membershipId),like(socialOAuth.id,'linkedin_%')));
 await getDb().insert(socialOAuth).values({id,organizationId:ctx.organizationId,membershipId:ctx.membershipId,stateHash:await hash(state),browserHash:await hash(browser),expiresAt:Date.now()+600000});
 const url=new URL('https://www.linkedin.com/oauth/v2/authorization');url.search=new URLSearchParams({client_id:c.id,redirect_uri:c.redirect,response_type:'code',scope:LINKEDIN_SCOPES.join(' '),state}).toString();
 return Response.json({id,url:url.toString()},{headers:{'Set-Cookie':`${LINKEDIN_COOKIE}=${browser}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`}});
}catch(e){return accessResponse(e);}}
