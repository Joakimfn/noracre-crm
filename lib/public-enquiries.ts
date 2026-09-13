type Statement={bind(...values:unknown[]):Statement;run():Promise<unknown>;first<T=Record<string,unknown>>():Promise<T|null>};
type PublicEnv={DB:{prepare(sql:string):Statement};RESEND_API_KEY?:string};
const recipient='jfn@noracre.no';
export const enquiryDDL=[
 `CREATE TABLE IF NOT EXISTS website_enquiries (request_id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS website_enquiry_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL)`
];
const initialized=new WeakMap<object,Promise<void>>();
async function init(db:PublicEnv['DB']){let p=initialized.get(db);if(!p){p=(async()=>{for(const q of enquiryDDL)await db.prepare(q).run();})();initialized.set(db,p);p.catch(()=>initialized.delete(db));}await p;}
const hash=async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
const fail=(error:string,status=400)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
const okay=()=>Response.json({sent:true},{headers:{'Cache-Control':'no-store'}});
type Enquiry={requestId:string;type:'customer'|'demo';company:string;organizationNumber:string;name:string;email:string;phone:string;users:string;message:string;website:string};
export function validateEnquiry(raw:unknown):Enquiry|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const r=raw as Record<string,unknown>,data={} as Record<keyof Enquiry,string>;
 for(const [key,max] of Object.entries({requestId:36,type:20,company:160,organizationNumber:12,name:120,email:254,phone:30,users:30,message:3000,website:200})){const value=r[key]??'';if(typeof value!=='string'||value.length>max)return null;data[key as keyof Enquiry]=value.trim();}
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(data.requestId)||!['customer','demo'].includes(data.type))return null;
 if(!data.company||!data.name||!/^\S+@[^\s@]+\.[^\s@]+$/.test(data.email)||/[\r\n]/.test(data.email))return null;
 if(!['1–5','6–10','11–25','26 eller flere','Usikker ennå'].includes(data.users))return null;
 if(data.organizationNumber&&!/^\d{9}$/.test(data.organizationNumber.replace(/\s/g,'')))return null;
 return data as Enquiry;
}
export async function publicEnquiry(request:Request,env:PublicEnv):Promise<Response>{
 if(request.method!=='POST')return fail('Metoden er ikke tillatt.',405);
 const origin=request.headers.get('origin');
 if(origin!==new URL(request.url).origin||!['https://noracre.no','https://www.noracre.no','https://crm.noracre.no'].includes(origin||''))return fail('Send skjemaet fra Noracre-nettsiden.',403);
 if(!(request.headers.get('content-type')||'').startsWith('application/json'))return fail('Ugyldig format.',415);
 if(Number(request.headers.get('content-length'))>16000)return fail('Henvendelsen er for stor.',413);
 if(!request.body)return fail('Skjemaet mangler.');
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>16000){await reader.cancel();return fail('Henvendelsen er for stor.',413);}chunks.push(r.value);}}catch{return fail('Skjemaet kunne ikke leses.');}
 let input:Enquiry|null;try{input=validateEnquiry(JSON.parse(await new Blob(chunks as BlobPart[]).text()));}catch{return fail('Kontroller feltene og prøv igjen.');}
 if(!input)return fail('Kontroller navn, bedrift, e-post, antall brukere og eventuelt organisasjonsnummer.');
 if(input.website)return fail('Skjemaet kunne ikke sendes.');
 if(!env.RESEND_API_KEY)return fail('Skjemaet er midlertidig utilgjengelig. Kontakt jfn@noracre.no.',503);
 const now=Date.now(),payload={...input,website:undefined,requestId:undefined},fingerprint=await hash(JSON.stringify(payload));
 try{
  await init(env.DB);
  await env.DB.prepare('DELETE FROM website_enquiries WHERE created_at<?').bind(now-7*86400000).run();
  const existing=await env.DB.prepare('SELECT fingerprint,status,created_at FROM website_enquiries WHERE request_id=?').bind(input.requestId).first<{fingerprint:string;status:string;created_at:number}>();
  if(existing&&existing.fingerprint!==fingerprint)return fail('Skjemaet er endret. Last siden på nytt og prøv igjen.',409);
  if(existing?.status==='sent')return okay();
  // Resend retains idempotency keys for 24 hours; never replay older uncertain submissions.
  if(existing&&now-existing.created_at>23*60*60*1000)return fail('Kontakt jfn@noracre.no for å følge opp henvendelsen.',409);
  const ip=request.headers.get('cf-connecting-ip')||'unknown',key=await hash(ip+':'+Math.floor(now/3600000));
  await env.DB.prepare('DELETE FROM website_enquiry_limits WHERE expires_at<?').bind(now).run();
  const limit=await env.DB.prepare('INSERT INTO website_enquiry_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+3600000).first<{count:number}>();
  if(!limit||limit.count>8)return fail('Du har sendt flere henvendelser på kort tid. Prøv igjen senere eller kontakt jfn@noracre.no.',429);
  await env.DB.prepare('INSERT OR IGNORE INTO website_enquiries(request_id,fingerprint,status,created_at,updated_at) VALUES(?,?,\'pending\',?,?)').bind(input.requestId,fingerprint,now,now).run();
  const claimed=await env.DB.prepare("UPDATE website_enquiries SET status='sending',updated_at=? WHERE request_id=? AND fingerprint=? AND (status IN ('pending','failed') OR (status='sending' AND updated_at<?)) RETURNING request_id").bind(now,input.requestId,fingerprint,now-60000).first();
  if(!claimed)return fail('Henvendelsen behandles allerede. Vent litt før du prøver igjen.',409);
  const text=[input.type==='demo'?'Ny forespørsel om demo fra Noracre.no':'Ny kundehenvendelse fra Noracre.no','','Bedrift: '+input.company,'Organisasjonsnummer: '+(input.organizationNumber||'Ikke oppgitt'),'Navn: '+input.name,'E-post: '+input.email,'Telefon: '+(input.phone||'Ikke oppgitt'),'Antall brukere: '+input.users,'','Melding:',input.message||'Ingen melding lagt ved.','','Kunden er lovet kontakt innen én virkedag.','Referanse: '+input.requestId].join('\n');
  let delivered=false;
  try{const result=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':'website-'+input.requestId},body:JSON.stringify({from:'Noracre <varsler@mail.noracre.no>',to:[recipient],reply_to:input.email,subject:`${input.type==='demo'?'Demo':'Ny kundehenvendelse'}: ${input.company.replace(/[\r\n]/g,' ')}`,text}),signal:AbortSignal.timeout(20000)});delivered=result.ok;}catch{/* Retry uses the same provider idempotency key. */}
  await env.DB.prepare('UPDATE website_enquiries SET status=?,updated_at=? WHERE request_id=?').bind(delivered?'sent':'failed',Date.now(),input.requestId).run();
  return delivered?okay():fail('Kunne ikke bekrefte sendingen. Prøv igjen, eller send e-post til jfn@noracre.no.',503);
 }catch{return fail('Henvendelsen kunne ikke bekreftes. Prøv igjen, eller kontakt jfn@noracre.no.',503);}
}
