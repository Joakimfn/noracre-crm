import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),dir=await mkdtemp(path.join(tmpdir(),'noracre-website-'));
await build({stdin:{contents:"export * from './lib/public-enquiries';export * from './lib/public-site';",resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'app.mjs')});
const app=await import(pathToFileURL(path.join(dir,'app.mjs')).href);
const sql=new DatabaseSync(':memory:');
const db={prepare(query){let args=[];return {bind(...v){args=v;return this},async run(){return sql.prepare(query).run(...args)},async first(){return sql.prepare(query).get(...args)||null}}}};
const env={DB:db,RESEND_API_KEY:'test-secret'};
const valid=()=>({requestId:crypto.randomUUID(),type:'customer',company:'Eksempel AS',name:'Test Person',email:'test@example.test',users:'1–5',message:'Hei',website:''});
let sends=[],providerOk=true;const realFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{sends.push({url,...options});return Response.json({id:'provider-test'},{status:providerOk?200:503})};
const req=(body,origin='https://noracre.no',ip=crypto.randomUUID())=>new Request('https://noracre.no/api/public/enquiry',{method:'POST',headers:{origin,'content-type':'application/json','cf-connecting-ip':ip},body:JSON.stringify(body)});
test('all public pages render with navigation, canonical URL and no shared public prices',async()=>{for(const p of ['/','/crm','/moduler','/om-noracre','/kontakt','/demo','/bli-kunde']){const r=app.publicWebsite(p),html=await r.text();assert.equal(r.status,200);assert.match(html,/href="\/kontakt"/);assert.match(html,/https:\/\/crm.noracre.no/);assert.match(html,/<main id="main">/);assert.doesNotMatch(html,/\d+\s*(kr|NOK)/);}assert.equal(app.publicWebsite('/missing').status,404);assert.equal(app.publicWebsite('/','/nettside').headers.get('X-Robots-Tag'),'noindex, nofollow');});
test('booking requires a real approved Google booking URL and escapes markup',async()=>{const no=await app.publicWebsite('/demo').text();assert.match(no,/Vi finner en tid sammen/);const yes=await app.publicWebsite('/demo','',{GOOGLE_DEMO_BOOKING_URL:'https://calendar.google.com/calendar/appointments/schedules/test'}).text();assert.match(yes,/Velg tidspunkt i Google Kalender/);const bad=await app.publicWebsite('/demo','',{GOOGLE_DEMO_BOOKING_URL:'javascript:alert(1)'}).text();assert.doesNotMatch(bad,/javascript:alert/);});
test('enquiries go only to the fixed sales recipient with reply-to and no secret exposure',async()=>{const v=valid();const r=await app.publicEnquiry(req({...v,to:'attacker@example.test'}),env);assert.equal(r.status,200);const mail=JSON.parse(sends.at(-1).body);assert.deepEqual(mail.to,['jfn@noracre.no']);assert.equal(mail.reply_to,v.email);assert.match(mail.text,/Eksempel AS/);assert.doesNotMatch(await r.text(),/test-secret|provider-test/);});
test('duplicate clicks do not send twice and changed payload cannot reuse a key',async()=>{const v=valid();await app.publicEnquiry(req(v),env);const n=sends.length;assert.equal((await app.publicEnquiry(req(v),env)).status,200);assert.equal(sends.length,n);assert.equal((await app.publicEnquiry(req({...v,company:'Changed'}),env)).status,409);});
test('provider errors never show success and retries preserve idempotency',async()=>{const v=valid();providerOk=false;assert.equal((await app.publicEnquiry(req(v),env)).status,503);const key=sends.at(-1).headers['Idempotency-Key'];providerOk=true;assert.equal((await app.publicEnquiry(req(v),env)).status,200);assert.equal(sends.at(-1).headers['Idempotency-Key'],key);});
test('external origins, oversized bodies, invalid recipients and honeypots are rejected',async()=>{const before=sends.length;assert.equal((await app.publicEnquiry(req(valid(),'https://evil.example'),env)).status,403);assert.equal((await app.publicEnquiry(req({...valid(),message:'x'.repeat(17000)}),env)).status,413);for(const patch of [{email:'not an email'},{email:'a@example.test\r\nBcc:b@example.test'},{users:'100000'},{website:'bot'},{organizationNumber:'xyz'},{company:''}])assert.equal((await app.publicEnquiry(req({...valid(),...patch}),env)).status,400);assert.equal(sends.length,before);});
test('rate limits bound public form abuse',async()=>{const ip='203.0.113.12';for(let i=0;i<8;i++)assert.equal((await app.publicEnquiry(req(valid(),'https://noracre.no',ip),env)).status,200);assert.equal((await app.publicEnquiry(req(valid(),'https://noracre.no',ip),env)).status,429);});
test('contact information is sent by email without a duplicate persistent payload',()=>{const columns=sql.prepare('PRAGMA table_info(website_enquiries)').all().map(r=>r.name);assert.ok(!columns.includes('payload'));});
test('an uncertain submission older than provider idempotency window is not resent',async()=>{const v=valid();providerOk=false;await app.publicEnquiry(req(v),env);providerOk=true;sql.prepare('UPDATE website_enquiries SET created_at=? WHERE request_id=?').run(Date.now()-24*3600000,v.requestId);const n=sends.length;assert.equal((await app.publicEnquiry(req(v),env)).status,409);assert.equal(sends.length,n);});
test('migration and runtime schema agree',async()=>{const other=new DatabaseSync(':memory:');other.exec(await readFile(path.join(root,'drizzle/0020_website_enquiries.sql'),'utf8'));for(const table of ['website_enquiries','website_enquiry_limits'])assert.deepEqual(other.prepare(`PRAGMA table_info(${table})`).all(),sql.prepare(`PRAGMA table_info(${table})`).all());other.close();});
test.after(async()=>{globalThis.fetch=realFetch;sql.close();await rm(dir,{recursive:true,force:true});});

test('paused AI search is not advertised on public pages',async()=>{for(const p of ['/','/crm','/moduler'])assert.doesNotMatch(await app.publicWebsite(p).text(),/AI-søk|med AI/);});

 test('all enquiry forms use the concise label and language-independent option values',async()=>{
  for(const path of ['/bli-kunde','/demo']){const html=await app.publicWebsite(path).text();assert.match(html,/<option value="unsure">Usikker<\/option>/);assert.doesNotMatch(html,/Usikker ennå/);assert.match(html,/data-messages=/);}
 });
 test('current and cached user-count values validate consistently without translated wire values',()=>{
  for(const users of ['unsure','Usikker','Usikker ennå'])assert.equal(app.validateEnquiry({...valid(),users}).users,'Usikker');
  for(const [users,expected] of [['1-5','1–5'],['6-10','6–10'],['11-25','11–25'],['26-plus','26 eller flere']])assert.equal(app.validateEnquiry({...valid(),users}).users,expected);
  assert.equal(app.validateEnquiry({...valid(),users:'Not sure'}),null);
 });
