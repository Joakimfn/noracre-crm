import {callback,digest,mailCookie,mailDb,saveMailAccount,tokenRequest,unsealMail,Provider} from "@/lib/user-mail";
const page=(ok:boolean)=>new Response(`<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Noracre · E-postkonto</title><body style="font:16px system-ui;background:#0e1715;color:#edf5f2;padding:10vh 20px"><main style="max-width:480px;margin:auto;background:#17221f;border:1px solid #31423d;border-radius:16px;padding:28px"><h1>${ok?"E-postkontoen er tilkoblet":"Tilkoblingen ble ikke fullført"}</h1><p>${ok?"Du kan nå sende e-post fra kontoen din. Gå tilbake til Noracre. Kontostatusen oppdateres automatisk.":"Gå tilbake til Noracre og prøv igjen. Gi tilgang til å sende e-post og kontroller at kontoen har en aktiv postkasse."}</p><p>Du kan lukke denne fanen.</p></main></body></html>`,{status:ok?200:400,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer","Set-Cookie":`${mailCookie}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`}});
export async function GET(request:Request){try{
 const url=new URL(request.url),state=url.searchParams.get("state")||"",code=url.searchParams.get("code")||"",browser=request.headers.get("cookie")?.split(';').map(x=>x.trim()).find(x=>x.startsWith(mailCookie+'='))?.slice(mailCookie.length+1)||"";
 if(!/^[\w-]{43}$/.test(state)||!/^[\w-]{43}$/.test(browser)||!code||code.length>8192||url.searchParams.has("error"))return page(false);
 const stateHash=await digest(state);
 const flow=await mailDb().prepare("UPDATE mail_oauth SET status='exchanging' WHERE state=? AND browser_hash=? AND expires_at>? AND status='waiting' RETURNING *").bind(stateHash,await digest(browser),Date.now()).first<{organization_id:number;membership_id:number;provider:Provider;verifier:string}>();
 if(!flow)return page(false);
 const member=await mailDb().prepare("SELECT m.id FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.id=? AND m.organization_id=? AND m.active=1 AND o.status='Aktiv' AND (m.scheduled_disable_at='' OR m.scheduled_disable_at>?) AND (o.scheduled_disable_at='' OR o.scheduled_disable_at>?)").bind(flow.membership_id,flow.organization_id,new Date().toISOString(),new Date().toISOString()).first();
 if(!member)return page(false);
 const token=await tokenRequest(flow.provider,{grant_type:"authorization_code",code,redirect_uri:callback,code_verifier:await unsealMail<string>(flow.verifier,stateHash)});
 if(!token.refresh_token||!token.scope?.split(' ').some(scope=>flow.provider==="google"?scope==="https://www.googleapis.com/auth/gmail.send":scope.toLowerCase().endsWith("mail.send")))return page(false);
 const r=await fetch(flow.provider==="google"?"https://openidconnect.googleapis.com/v1/userinfo":"https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName",{headers:{Authorization:`Bearer ${token.access_token}`},redirect:"manual",signal:AbortSignal.timeout(15000)});
 if(!r.ok)return page(false);const profile=await r.json() as {email?:string;email_verified?:boolean;mail?:string;userPrincipalName?:string};
 if(flow.provider==="google"&&!profile.email_verified)return page(false);
 const email=(flow.provider==="google"?profile.email:profile.mail||profile.userPrincipalName)?.toLowerCase()||"";
 if(!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email))return page(false);
 await saveMailAccount(flow.organization_id,flow.membership_id,flow.provider,email,{access_token:token.access_token!,refresh_token:token.refresh_token,expires_at:Date.now()+Number(token.expires_in||3600)*1000},stateHash);
 await mailDb().prepare("DELETE FROM mail_oauth WHERE state=?").bind(stateHash).run();return page(true);
}catch{return page(false);}}
