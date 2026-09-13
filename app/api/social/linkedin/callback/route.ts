import {and,eq,gt,like} from "drizzle-orm";
import {getDb} from "@/db";
import {memberships,organizations,socialOAuth} from "@/db/schema";
import {canManageModules,requireModuleAccess} from "@/lib/module-access";
import {hash,pendingContext} from "@/lib/social-meta";
import {discoverLinkedIn,LINKEDIN_COOKIE,LinkedInError,sealLinkedIn} from "@/lib/social-linkedin";
const page=(ok:boolean)=>new Response(`<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Noracre · LinkedIn</title><body style="font:16px system-ui;background:#f1f7f5;color:#073e3e;padding:10vh 8vw"><main style="max-width:480px;margin:auto;background:white;padding:32px;border-radius:20px"><h1>${ok?'LinkedIn-sidene er hentet':'Tilkoblingen ble ikke fullført'}</h1><p>${ok?'Gå tilbake til Noracre og velg bedriftssiden som skal kobles til.':'Gå tilbake til Noracre og start tilkoblingen på nytt. Kontroller at du ga de nødvendige tillatelsene.'}</p><p>Du kan lukke denne fanen.</p></main></body></html>`,{status:ok?200:400,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
export async function GET(request:Request){
 const url=new URL(request.url),state=url.searchParams.get('state')??'',browser=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(LINKEDIN_COOKIE+'='))?.slice(LINKEDIN_COOKIE.length+1)??'';
 if(!/^[\w-]{43}$/.test(state)||!/^[\w-]{43}$/.test(browser))return page(false);
 let id='';
 try{
  const [flow]=await getDb().update(socialOAuth).set({status:'exchanging'}).where(and(eq(socialOAuth.stateHash,await hash(state)),eq(socialOAuth.browserHash,await hash(browser)),eq(socialOAuth.status,'waiting'),like(socialOAuth.id,'linkedin_%'),gt(socialOAuth.expiresAt,Date.now()))).returning();
  if(!flow)return page(false);id=flow.id;
  const [member]=await getDb().select().from(memberships).where(and(eq(memberships.id,flow.membershipId),eq(memberships.organizationId,flow.organizationId))).limit(1);
  const [org]=await getDb().select().from(organizations).where(eq(organizations.id,flow.organizationId)).limit(1),now=new Date().toISOString();
  if(!member?.active||!canManageModules(member.role)||(member.scheduledDisableAt&&member.scheduledDisableAt<=now)||org?.status!=='Aktiv'||(org.scheduledDisableAt&&org.scheduledDisableAt<=now))throw Error();
  await requireModuleAccess(flow.organizationId,flow.membershipId,'markedsforing');
  const code=url.searchParams.get('code');if(url.searchParams.has('error')||!code||code.length>4096)throw Error();
  const accounts=await discoverLinkedIn(code);
  await getDb().update(socialOAuth).set({status:'ready',payload:await sealLinkedIn(accounts,pendingContext(flow.organizationId,flow.id))}).where(eq(socialOAuth.id,flow.id));return page(true);
 }catch(e){if(id)await getDb().update(socialOAuth).set({status:'error',payload:JSON.stringify({status:e instanceof LinkedInError?e.providerStatus:400})}).where(eq(socialOAuth.id,id));return page(false);}
}
