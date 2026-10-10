import {env} from "cloudflare:workers";
import {AccessError} from "@/lib/tenant";
import {getMailAccount,sendFromMailbox,sealMail,unsealMail,digest,type MailAccount} from "@/lib/user-mail";
import {getDb} from '@/db';
import {companies} from '@/db/schema';
import {and,eq,inArray} from 'drizzle-orm';
import {requireOutboundCompaniesContact} from '@/lib/outbound-access';
const runtime=()=>env as unknown as {DB:D1Database;BUCKET:R2Bucket};
// Additive, idempotent initialization also supports deployments without a migration hook.
export const campaignDDL=`CREATE TABLE IF NOT EXISTS email_campaigns (
 id INTEGER PRIMARY KEY AUTOINCREMENT, organization_id INTEGER NOT NULL, membership_id INTEGER NOT NULL,
 request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, sender TEXT NOT NULL, provider TEXT NOT NULL,
 subject TEXT NOT NULL, message TEXT NOT NULL, recipient_count INTEGER NOT NULL, company_ids TEXT NOT NULL,
 payload_key TEXT NOT NULL, files TEXT NOT NULL DEFAULT '[]', scheduled_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'Planlagt', error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL, sent_at TEXT NOT NULL DEFAULT '', hidden INTEGER NOT NULL DEFAULT 0,
 UNIQUE(organization_id,membership_id,request_key))`;
const initialized=new WeakMap<object,Promise<void>>();
export function ensureCampaigns(db=runtime().DB){
 let promise=initialized.get(db);if(!promise){promise=(async()=>{await db.prepare(campaignDDL).run();await db.prepare("CREATE INDEX IF NOT EXISTS email_campaigns_due ON email_campaigns(status,scheduled_at)").run();await db.prepare("CREATE INDEX IF NOT EXISTS email_campaigns_org ON email_campaigns(organization_id,hidden,scheduled_at)").run();})().catch(e=>{initialized.delete(db);throw e;});initialized.set(db,promise);}return promise;
}
type Payload={to:string[];bcc:string[];subject:string;message:string;files:{filename:string;content:string}[];key:string};
export type Campaign={id:number;organization_id:number;membership_id:number;sender:string;provider:string;subject:string;message:string;recipient_count:number;company_ids:string;payload_key:string;files:string;scheduled_at:string;status:string;error:string;created_at:string;updated_at:string;sent_at:string;fingerprint:string};
const payloadContext=(org:number,member:number,key:string)=>`campaign:${org}:${member}:${key}`;
export function scheduleTime(value:string,now=Date.now()){
 if(!value)return new Date(now).toISOString();
 if(!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value))throw new AccessError(400,"Velg et gyldig tidspunkt med tidssone.");
 const timestamp=Date.parse(value);if(!Number.isFinite(timestamp)||timestamp<now+60000||timestamp>now+366*86400000)throw new AccessError(400,"Velg et tidspunkt minst ett minutt frem og maks ett år frem.");
 return new Date(timestamp).toISOString();
}
export async function createCampaign(account:MailAccount,input:Payload,companyIds:number[],scheduledAt:string){
 const {DB:db,BUCKET:bucket}=runtime();await ensureCampaigns(db);
 const fingerprint=await digest(JSON.stringify([account.email,account.provider,input,companyIds,scheduledAt]));
 const previous=await db.prepare("SELECT * FROM email_campaigns WHERE organization_id=? AND membership_id=? AND request_key=?").bind(account.organization_id,account.membership_id,input.key).first<Campaign>();
 if(previous){if(previous.fingerprint!==fingerprint)throw new AccessError(409,"Sendingsreferansen gjelder en annen melding.");return previous;}
 if(account.provider==='microsoft'&&input.files.reduce((n,f)=>n+Math.floor(f.content.length*3/4),0)>2*1024*1024)throw new AccessError(413,"Microsoft støtter maks 2 MB vedlegg samlet.");
 const normalized=scheduleTime(scheduledAt);
 const objectKey=`email-campaigns/${account.organization_id}/${account.membership_id}/${crypto.randomUUID()}`;
 const sealed=await sealMail(input,payloadContext(account.organization_id,account.membership_id,objectKey));
 await bucket.put(objectKey,sealed,{httpMetadata:{contentType:'application/octet-stream'}});
 const now=new Date().toISOString();
 try{
  const result=await db.prepare("INSERT OR IGNORE INTO email_campaigns(organization_id,membership_id,request_key,fingerprint,sender,provider,subject,message,recipient_count,company_ids,payload_key,files,scheduled_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
   .bind(account.organization_id,account.membership_id,input.key,fingerprint,account.email,account.provider,input.subject,input.message,input.bcc.length||input.to.length,JSON.stringify(companyIds),objectKey,JSON.stringify(input.files.map(f=>({filename:f.filename}))),normalized,now,now).run();
  const row=await db.prepare("SELECT * FROM email_campaigns WHERE organization_id=? AND membership_id=? AND request_key=?").bind(account.organization_id,account.membership_id,input.key).first<Campaign>();
  if(!result.meta.changes)await bucket.delete(objectKey);
  if(!row||row.fingerprint!==fingerprint)throw new AccessError(409,"Utsendingen er allerede registrert med annet innhold.");
  return row;
 }catch(e){await bucket.delete(objectKey).catch(()=>{});throw e;}
}
export async function campaignOutcome(id:number){return runtime().DB.prepare("SELECT status,error FROM email_campaigns WHERE id=?").bind(id).first<{status:string;error:string}>();}
export async function dispatchCampaign(id:number,now=new Date().toISOString()){
 const {DB:db,BUCKET:bucket}=runtime();await ensureCampaigns(db);
 const row=await db.prepare("UPDATE email_campaigns SET status='Sender',updated_at=? WHERE id=? AND status='Planlagt' AND scheduled_at<=? RETURNING *").bind(now,id,now).first<Campaign>();
 if(!row)return;
 let attempted=false;
 try{
  const access=await db.prepare(`SELECT m.id,m.name,m.email,m.user_id,m.role FROM memberships m JOIN organizations o ON o.id=m.organization_id
   JOIN organization_modules om ON om.organization_id=o.id AND om.module_key='markedsforing' AND om.active=1
   JOIN module_licenses ml ON ml.organization_id=o.id AND ml.membership_id=m.id AND ml.module_key='markedsforing' AND ml.active=1
   WHERE m.id=? AND m.organization_id=? AND m.active=1 AND o.status='Aktiv'
   AND (m.scheduled_disable_at='' OR m.scheduled_disable_at>?) AND (o.scheduled_disable_at='' OR o.scheduled_disable_at>?)`).bind(row.membership_id,row.organization_id,now,now).first<{id:number;name:string;email:string;user_id:string;role:string}>();
  if(!access)throw new AccessError(403,"Avsenderen har ikke lenger tilgang til bedriften eller markedsføringsmodulen.");
  const account=await getMailAccount(row.organization_id,row.membership_id);
  if(!account||account.email!==row.sender||account.provider!==row.provider)throw new AccessError(409,"Avsenderkontoen er koblet fra eller endret. Opprett utsendingen på nytt etter tilkobling.");
  const ids=JSON.parse(row.company_ids) as number[];
  if(!Array.isArray(ids)||!ids.length||ids.length>500||ids.some(id=>!Number.isSafeInteger(id)||id<1)||new Set(ids).size!==ids.length)throw new AccessError(409,'Utsendingen har et ugyldig kundeutvalg.');
  const orm=getDb(),customers:Pick<typeof companies.$inferSelect,'id'|'country'|'orgNumber'|'industry'|'city'|'address'>[]=[];
  for(let i=0;i<ids.length;i+=75)customers.push(...await orm.select({id:companies.id,country:companies.country,orgNumber:companies.orgNumber,industry:companies.industry,city:companies.city,address:companies.address}).from(companies).where(and(eq(companies.organizationId,row.organization_id),inArray(companies.id,ids.slice(i,i+75)))));
  if(customers.length!==ids.length)throw new AccessError(409,"En av de valgte kundene er slettet. Opprett utsendingen på nytt.");
  // Check current ownership, opt-outs and market restrictions immediately before delivery,
  // including campaigns created before a customer reserved against contact.
  await requireOutboundCompaniesContact({organizationId:row.organization_id,membershipId:row.membership_id,role:access.role,user:{id:access.user_id,displayName:access.name,email:access.email,fullName:null},isSuperadmin:false,memberships:[]},customers,new Date(now));
  const object=await bucket.get(row.payload_key);if(!object)throw new Error('Missing payload');
  const payload=await unsealMail<Payload>(await object.text(),payloadContext(row.organization_id,row.membership_id,row.payload_key));
  attempted=true;
  await sendFromMailbox(account,{...payload,key:`campaign-${row.organization_id}-${row.id}`});
  await db.prepare("UPDATE email_campaigns SET status='Sendt',sent_at=?,updated_at=?,error='' WHERE id=? AND status='Sender'").bind(new Date().toISOString(),new Date().toISOString(),row.id).run();
  await bucket.delete(row.payload_key).catch(()=>{});
 }catch(e){
  const message=attempted?'Sendingen er uavklart. Kontroller Sendt-mappen før du oppretter en ny utsending.':e instanceof AccessError?e.message:'Utsendingen kunne ikke klargjøres. Opprett den på nytt.';
  await db.prepare("UPDATE email_campaigns SET status=?,error=?,updated_at=? WHERE id=? AND status='Sender'").bind(attempted?'Uavklart':'Feilet',message,new Date().toISOString(),row.id).run();
 }
}
export async function dispatchDueCampaigns(){
 const db=runtime().DB;await ensureCampaigns(db);const now=new Date().toISOString();
 // Never retry a job after a crash: provider acceptance may have happened already.
 await db.prepare("UPDATE email_campaigns SET status='Uavklart',error='Sendingen ble avbrutt. Kontroller Sendt-mappen før en ny utsending.',updated_at=? WHERE status='Sender' AND updated_at<?").bind(now,new Date(Date.now()-15*60000).toISOString()).run();
 const due=await db.prepare("SELECT id FROM email_campaigns WHERE status='Planlagt' AND scheduled_at<=? ORDER BY scheduled_at,id LIMIT 10").bind(now).all<{id:number}>();
 for(const row of due.results)await dispatchCampaign(row.id,now);
}
