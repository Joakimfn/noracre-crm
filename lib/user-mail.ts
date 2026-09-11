import {env} from "cloudflare:workers";
import {Buffer} from "node:buffer";
import {AccessError} from "@/lib/tenant";
export type Provider="google"|"microsoft";
export type MailAccount={organization_id:number;membership_id:number;provider:Provider;email:string;token:string;updated_at:number};
type Token={access_token:string;refresh_token:string;expires_at:number};
export const mailEnv=()=>env as unknown as Record<string,string>&{DB:D1Database};
export const mailDb=()=>mailEnv().DB;
export const callback="https://crm.noracre.no/api/email/callback";
export const mailCookie="__Host-noracre-mail";
export const random=()=>Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
export const digest=async(s:string)=>Buffer.from(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))).toString("hex");
export function providerConfig(provider:Provider){
 const e=mailEnv(),google=provider==="google";
 return {id:e[google?"GOOGLE_MAIL_CLIENT_ID":"MICROSOFT_MAIL_CLIENT_ID"],secret:e[google?"GOOGLE_MAIL_CLIENT_SECRET":"MICROSOFT_MAIL_CLIENT_SECRET"],
 authorize:google?"https://accounts.google.com/o/oauth2/v2/auth":"https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
 token:google?"https://oauth2.googleapis.com/token":"https://login.microsoftonline.com/common/oauth2/v2.0/token",
 scope:google?"openid email https://www.googleapis.com/auth/gmail.send":"offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Send"};
}
export function mailReady(provider:Provider){const c=providerConfig(provider);return Boolean(c.id&&c.secret&&(mailEnv().MAIL_TOKEN_KEY||"").length>=32);}
async function cryptoKey(){const secret=mailEnv().MAIL_TOKEN_KEY;if(!secret||secret.length<32)throw new AccessError(503,"Noracre må fullføre oppsettet for e-postkontoer.");return crypto.subtle.importKey("raw",await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret)),"AES-GCM",false,["encrypt","decrypt"]);}
export async function sealMail(value:unknown,context:string){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:new TextEncoder().encode(context)},await cryptoKey(),new TextEncoder().encode(JSON.stringify(value)));return `${Buffer.from(iv).toString("base64")}.${Buffer.from(data).toString("base64")}`;}
export async function unsealMail<T>(value:string,context:string):Promise<T>{try{const[iv,data]=value.split('.');return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:Buffer.from(iv,"base64"),additionalData:new TextEncoder().encode(context)},await cryptoKey(),Buffer.from(data,"base64"))));}catch{throw new AccessError(409,"Koble e-postkontoen til på nytt.");}}
const context=(org:number,member:number)=>`mail:${org}:${member}`;
export async function getMailAccount(org:number,member:number){return mailDb().prepare("SELECT * FROM mail_accounts WHERE organization_id=? AND membership_id=?").bind(org,member).first<MailAccount>();}
export async function tokenRequest(provider:Provider,fields:Record<string,string>){const c=providerConfig(provider);const r=await fetch(c.token,{method:"POST",redirect:"manual",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:c.id,client_secret:c.secret,...fields}),signal:AbortSignal.timeout(20000)});const data=await r.json() as {access_token?:string;refresh_token?:string;expires_in?:number;scope?:string};if(!r.ok||!data.access_token)throw new AccessError(409,"E-posttilgangen kunne ikke fornyes. Koble kontoen til på nytt.");return data;}
export async function saveMailAccount(org:number,member:number,provider:Provider,email:string,token:Token,state:string){
 const encrypted=await sealMail(token,context(org,member)),now=new Date().toISOString();
 const result=await mailDb().prepare("INSERT INTO mail_accounts(organization_id,membership_id,provider,email,token,updated_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM mail_oauth f JOIN memberships m ON m.id=f.membership_id JOIN organizations o ON o.id=f.organization_id WHERE f.state=? AND f.status='exchanging' AND f.organization_id=? AND f.membership_id=? AND f.expires_at>? AND m.active=1 AND o.status='Aktiv' AND (m.scheduled_disable_at='' OR m.scheduled_disable_at>?) AND (o.scheduled_disable_at='' OR o.scheduled_disable_at>?)) ON CONFLICT(organization_id,membership_id) DO UPDATE SET provider=excluded.provider,email=excluded.email,token=excluded.token,updated_at=excluded.updated_at").bind(org,member,provider,email,encrypted,Date.now(),state,org,member,Date.now(),now,now).run();
 if(!result.meta.changes)throw new AccessError(409,"Tilkoblingen er avbrutt. Start på nytt.");
}
async function accessToken(account:MailAccount){let t=await unsealMail<Token>(account.token,context(account.organization_id,account.membership_id));if(t.expires_at<Date.now()+60000){const renewed=await tokenRequest(account.provider,{grant_type:"refresh_token",refresh_token:t.refresh_token});t={access_token:renewed.access_token!,refresh_token:renewed.refresh_token||t.refresh_token,expires_at:Date.now()+Number(renewed.expires_in||3600)*1000};const encrypted=await sealMail(t,context(account.organization_id,account.membership_id));const saved=await mailDb().prepare("UPDATE mail_accounts SET token=?,updated_at=? WHERE organization_id=? AND membership_id=? AND token=?").bind(encrypted,Date.now(),account.organization_id,account.membership_id,account.token).run();if(!saved.meta.changes)throw new AccessError(409,"Kontotilkoblingen er endret. Oppdater siden før sending.");}return t.access_token;}
const b64=(s:string)=>Buffer.from(s).toString("base64");
const fold=(s:string)=>s.match(/.{1,76}/g)?.join("\r\n")||"";
export function mimeMessage(from:string,to:string[],bcc:string[],subject:string,message:string,files:{filename:string;content:string}[]){
 const boundary="noracre_"+random();
 const lines=[`From: ${from}`,`To: ${to.join(", ")}`,...(bcc.length?[`Bcc: ${bcc.join(", ")}`]:[]),`Subject: =?UTF-8?B?${b64(subject)}?=`,"MIME-Version: 1.0",`Content-Type: multipart/mixed; boundary="${boundary}"`,"",`--${boundary}`,"Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: base64","",fold(b64(message))];
 for(const file of files)lines.push(`--${boundary}`,"Content-Type: application/octet-stream",`Content-Disposition: attachment; filename*=UTF-8''${encodeURIComponent(file.filename).replace(/'/g,"%27")}`,"Content-Transfer-Encoding: base64","",fold(file.content));
 lines.push(`--${boundary}--`,"");return lines.join("\r\n");
}
export async function sendFromMailbox(account:MailAccount,input:{to:string[];bcc:string[];subject:string;message:string;files:{filename:string;content:string}[];key:string}){
 if(account.provider==="microsoft"&&input.files.reduce((sum,f)=>sum+Buffer.from(f.content,"base64").length,0)>2*1024*1024)throw new AccessError(413,"Microsoft-sending støtter maks 2 MB vedlegg samlet. Velg mindre filer.");
 const token=await accessToken(account);
 // Reserve once before calling the provider. A timeout must never auto-send twice.
 const id=await digest(`${account.organization_id}:${account.membership_id}:${input.key}:${JSON.stringify({...input,key:undefined})}`);
 const reserved=await mailDb().prepare("INSERT OR IGNORE INTO mail_attempts(id,status,created_at) VALUES(?,'pending',?)").bind(id,Date.now()).run();
 if(!reserved.meta.changes){const previous=await mailDb().prepare("SELECT status FROM mail_attempts WHERE id=?").bind(id).first<{status:string}>();if(previous?.status==="sent")return;throw new AccessError(409,"En tidligere sending er uavklart. Kontroller Sendt-mappen før du sender på nytt.");}
 let r:Response;
 try{
  const mime=mimeMessage(account.email,input.to,input.bcc,input.subject,input.message,input.files);
  const google=account.provider==="google";
  r=await fetch(google?"https://gmail.googleapis.com/gmail/v1/users/me/messages/send":"https://graph.microsoft.com/v1.0/me/sendMail",{method:"POST",redirect:"manual",headers:{Authorization:`Bearer ${token}`,"Content-Type":google?"application/json":"text/plain"},body:google?JSON.stringify({raw:Buffer.from(mime).toString("base64url")}):Buffer.from(mime).toString("base64"),signal:AbortSignal.timeout(25000)});
 }catch{throw new AccessError(502,"Sendingen kunne ikke bekreftes. Kontroller Sendt-mappen før du forsøker igjen.");}
 if(!r.ok){if([400,401,403,413,429].includes(r.status))await mailDb().prepare("DELETE FROM mail_attempts WHERE id=?").bind(id).run();throw new AccessError(502,[401,403].includes(r.status)?"E-postkontoen mangler sendetilgang. Koble kontoen til på nytt.":"E-postleverandøren avviste sendingen. Kontroller vedlegg og kontoens sendegrenser.");}
 await mailDb().prepare("UPDATE mail_attempts SET status='sent' WHERE id=?").bind(id).run();
}
