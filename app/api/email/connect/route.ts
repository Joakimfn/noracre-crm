import {accessResponse,requireTenant,AccessError} from "@/lib/tenant";
import {callback,digest,mailCookie,mailDb,mailReady,providerConfig,random,sealMail,Provider} from "@/lib/user-mail";
import {Buffer} from "node:buffer";
export async function POST(request:Request){try{
 const ctx=await requireTenant(request),data=await request.json() as {provider:Provider},provider=data.provider;
 if(!["google","microsoft"].includes(provider))throw new AccessError(400,"Velg Google eller Microsoft.");
 if(!mailReady(provider))throw new AccessError(503,"Noracre må fullføre leverandøroppsettet før kontoen kan kobles til.");
 const state=random(),browser=random(),verifier=random(),stateHash=await digest(state),c=providerConfig(provider);
 await mailDb().prepare("DELETE FROM mail_oauth WHERE expires_at<?").bind(Date.now()).run();
 await mailDb().prepare("INSERT INTO mail_oauth(state,organization_id,membership_id,browser_hash,provider,verifier,expires_at) VALUES(?,?,?,?,?,?,?)").bind(stateHash,ctx.organizationId,ctx.membershipId,await digest(browser),provider,await sealMail(verifier,stateHash),Date.now()+600000).run();
 const url=new URL(c.authorize);url.search=new URLSearchParams({client_id:c.id,redirect_uri:callback,response_type:"code",scope:c.scope,state,code_challenge:Buffer.from(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier))).toString("base64url"),code_challenge_method:"S256",...(provider==="google"?{access_type:"offline",prompt:"consent"}:{prompt:"select_account"})}).toString();
 return Response.json({url:url.toString()},{headers:{"Set-Cookie":`${mailCookie}=${browser}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`}});
}catch(e){return accessResponse(e);}}
