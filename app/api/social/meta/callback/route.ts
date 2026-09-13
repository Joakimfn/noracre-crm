import { getDb } from "@/db";
import { memberships, organizations, socialOAuth } from "@/db/schema";
import { notLike, and, eq, gt } from "drizzle-orm";
import { canManageModules, requireModuleAccess } from "@/lib/module-access";
import { discoverAccounts, MetaError, hash, OAUTH_COOKIE, pendingContext, seal } from "@/lib/social-meta";
const page=(ok:boolean)=>new Response(`<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Noracre · Kontotilkobling</title><body style="font:16px system-ui;background:#f1f7f5;color:#073e3e;padding:10vh 8vw"><main style="max-width:480px;margin:auto;background:white;padding:32px;border-radius:20px"><h1>${ok?"Kontoene er hentet":"Tilkoblingen ble ikke fullført"}</h1><p>${ok?"Gå tilbake til Noracre for å velge siden og Instagram-kontoen bedriften skal bruke.":"Gå tilbake til Noracre og start tilkoblingen på nytt. Kontroller at du har gitt de nødvendige tillatelsene."}</p><p>Du kan lukke denne fanen.</p></main></body></html>`,{status:ok?200:400,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
export async function GET(request: Request) {
  const url=new URL(request.url),state=url.searchParams.get("state")??"";
  const browser=request.headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith(OAUTH_COOKIE+"="))?.slice(OAUTH_COOKIE.length+1)??"";
  if(!/^[\w-]{43}$/.test(state)||!/^[\w-]{43}$/.test(browser))return page(false);
  let id="", stage="access";
  try {
    const [flow]=await getDb().update(socialOAuth).set({status:"exchanging"}).where(and(
      notLike(socialOAuth.id,"linkedin_%"),eq(socialOAuth.stateHash,await hash(state)),eq(socialOAuth.browserHash,await hash(browser)),eq(socialOAuth.status,"waiting"),gt(socialOAuth.expiresAt,Date.now()),
    )).returning();
    if(!flow)return page(false);
    id=flow.id;
    const [member]=await getDb().select().from(memberships).where(and(eq(memberships.id,flow.membershipId),eq(memberships.organizationId,flow.organizationId),eq(memberships.active,true))).limit(1);
    const [org]=await getDb().select().from(organizations).where(eq(organizations.id,flow.organizationId)).limit(1);
    if(!member||!canManageModules(member.role)||org?.status!=="Aktiv")throw Error();
    await requireModuleAccess(flow.organizationId,flow.membershipId,"markedsforing");
    stage="consent";
    const code=url.searchParams.get("code");
    if(url.searchParams.has("error")||!code||code.length>4096)throw Error();
    const accounts=await discoverAccounts(code, next=>{stage=next;});
    stage="storage";
    await getDb().update(socialOAuth).set({status:"ready",payload:await seal(accounts,pendingContext(flow.organizationId,id))}).where(eq(socialOAuth.id,id));
    return page(true);
  } catch (error) {
    if(id)await getDb().update(socialOAuth).set({status:"error",payload:JSON.stringify({stage,code:error instanceof MetaError ? error.providerCode : undefined})}).where(eq(socialOAuth.id,id));
    return page(false);
  }
}

