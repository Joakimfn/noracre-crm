import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {drizzle} from 'drizzle-orm/sqlite-proxy';
import {getTableConfig} from 'drizzle-orm/sqlite-core';
import {mkdtemp,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'..'),dir=await mkdtemp(path.join(tmpdir(),'outbound-legacy-'));
await build({stdin:{contents:`export * as callLists from './app/api/call-lists/route';export * as lists from './app/api/saved-call-lists/route';export * as email from './app/api/email/route';export * as campaigns from './lib/email-campaigns';export * as schema from './db/schema';`,resolveDir:root},bundle:true,platform:'node',format:'esm',packages:'external',outfile:path.join(dir,'app.mjs'),plugins:[{name:'test-runtime',setup(b){
 b.onResolve({filter:/^@\/db$/},()=>({path:'db',namespace:'mock'}));
 b.onResolve({filter:/^@\/lib\/tenant$/},()=>({path:'tenant',namespace:'mock'}));
 b.onResolve({filter:/^@\/lib\/user-mail$/},()=>({path:'mail',namespace:'mock'}));
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},({path:p})=>({contents:p==='db'?'export const getDb=()=>globalThis.legacyOrm;':p==='env'?'export const env=new Proxy({}, {get(_,key){return globalThis.legacyEnv[key]}});':p==='tenant'?`export class AccessError extends Error{constructor(status,message,code='ACCESS_DENIED'){super(message);this.status=status;this.code=code}};export const accessResponse=e=>{if(!e.status)console.error(e);return Response.json({error:e.message,code:e.code},{status:e.status||500})};export async function requireTenant(r){const membershipId=Number(r.headers.get('member')),organizationId=Number(r.headers.get('org'));const m=globalThis.legacySql.prepare('SELECT * FROM memberships WHERE id=? AND organization_id=? AND active=1').get(membershipId,organizationId);if(!m)throw new AccessError(403,'Forbidden');return {organizationId,membershipId,role:m.role,user:{id:m.user_id,email:m.email,displayName:m.name,fullName:null},memberships:[],isSuperadmin:false}};`: `export const digest=async s=>(await import('node:crypto')).createHash('sha256').update(s).digest('hex');export const getMailAccount=async(org,member)=>({...globalThis.legacyAccount,organization_id:org,membership_id:member});export const sendFromMailbox=async(a,p)=>globalThis.legacySends.push({a,p});export const sealMail=async(p,c)=>JSON.stringify({p,c});export const unsealMail=async(s,c)=>{const v=JSON.parse(s);if(v.c!==c)throw Error('Wrong context');return v.p};`}));
}}],nodePaths:[path.join(root,'node_modules')]});
await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'),process.platform==='win32'?'junction':'dir');
const app=await import(pathToFileURL(path.join(dir,'app.mjs'))),sql=new DatabaseSync(':memory:');
for(const table of Object.values(app.schema)){
 const c=getTableConfig(table),columns=c.columns.map(col=>`"${col.name}" ${col.getSQLType()}${col.primary?' PRIMARY KEY':''}${col.notNull?' NOT NULL':''}${col.default!==undefined?' DEFAULT '+(typeof col.default==='string'?"'"+col.default.replaceAll("'","''")+"'":Number(col.default)):''}`);
 sql.exec(`CREATE TABLE "${c.name}" (${columns.join(',')})`);
}
sql.exec(`CREATE UNIQUE INDEX lead_unique ON outbound_lead_state(entry_id);CREATE UNIQUE INDEX deal_unique ON outbound_deals(entry_id);CREATE UNIQUE INDEX owner_unique ON outbound_company_ownership(organization_id,country,org_number);CREATE UNIQUE INDEX suppression_unique ON outbound_suppression(organization_id,country,org_number);CREATE UNIQUE INDEX call_request_unique ON outbound_call_logs(organization_id,request_id) WHERE request_id<>'';CREATE UNIQUE INDEX assignment_unique ON call_list_assignments(list_id,membership_id);`);
globalThis.legacySql=sql;
globalThis.legacyOrm=drizzle(async(query,params,method)=>{assert.ok(params.length<=100,`D1 bind limit exceeded: ${params.length}`);const statement=sql.prepare(query);statement.setReturnArrays(true);return {rows:method==='run'?(statement.run(...params),[]):method==='get'?statement.get(...params):statement.all(...params)}});
let batchQueue=Promise.resolve();legacyOrm.batch=statements=>{const run=batchQueue.catch(()=>{}).then(async()=>{sql.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement);sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}});batchQueue=run;return run;};
const raw={prepare(query){let params=[];return {bind(...values){params=values;return this},async run(){assert.ok(params.length<=100);const result=sql.prepare(query).run(...params);return {meta:{changes:Number(result.changes)}}},async first(){assert.ok(params.length<=100);return sql.prepare(query).get(...params)??null},async all(){assert.ok(params.length<=100);return {results:sql.prepare(query).all(...params)}}}}};
const objects=new Map();globalThis.legacyEnv={DB:raw,BUCKET:{async put(key,value){objects.set(key,value)},async get(key){return objects.has(key)?{async text(){return objects.get(key)}}:null},async delete(key){objects.delete(key)}}};
globalThis.legacyAccount={organization_id:1,membership_id:10,email:'seller@example.test',provider:'google'};globalThis.legacySends=[];
const add=(table,values)=>{const keys=Object.keys(values);return sql.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...Object.values(values));};
const now=new Date().toISOString();
for(const id of [1,2])add('organizations',{id,name:'Tenant '+id,outbound_enabled:1,operating_countries:'["NO","FR","GB"]',created_at:now});
for(const [id,org,role] of [[1,1,'Administrator'],[10,1,'Bruker'],[11,1,'Bruker'],[20,2,'Administrator']]){
 add('memberships',{id,organization_id:org,user_id:'user'+id,email:id+'@test.no',name:'Seller '+id,role,created_at:now});
 for(const module of ['ringelister','markedsforing'])add('module_licenses',{organization_id:org,membership_id:id,module_key:module,active:1,activated_at:now});
}
for(const org of [1,2])for(const module of ['ringelister','markedsforing'])add('organization_modules',{organization_id:org,module_key:module,active:1,activated_at:now});
add('saved_call_lists',{id:100,organization_id:1,country:'FR',name:'Shared list',created_by_membership_id:1,created_at:now,updated_at:now});
for(const member of [10,11])add('call_list_assignments',{organization_id:1,list_id:100,membership_id:member,assigned_by:'Admin',created_at:now});
for(const [id,country,number,member] of [[101,'FR','123 456 789 00011',11],[102,'FR','123456789',10],[103,'GB','SC000123',10],[104,'NO','999999999',0],[105,'GB','SC000124',10]]){
 add('call_list_entries',{id,organization_id:1,list_id:100,country,org_number:number,name:'Lead '+id,created_at:now,updated_at:now});
 if(member)add('outbound_lead_state',{organization_id:1,entry_id:id,assigned_membership_id:member,created_at:now,updated_at:now});
}
for(const [country,number,member] of [['FR','123456789',10],['GB','SC000123',11]])add('outbound_company_ownership',{organization_id:1,country,org_number:number,assigned_membership_id:member,updated_at:now});
add('call_list_entries',{id:201,organization_id:2,country:'FR',org_number:'123456789',name:'Foreign tenant lead',created_at:now,updated_at:now});
const request=(member=10,body,query='',org=1)=>new Request('https://crm.test/api'+query,{method:body?'POST':'GET',headers:{member:String(member),org:String(org),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const queue=async(member=10,query='')=>{const response=await app.callLists.GET(request(member,undefined,'?listId=100'+query));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));return (await response.json()).entries;};
const formRequest=(member,companyIds,mode='')=>{const form=new FormData();form.set('companyIds',JSON.stringify(companyIds));form.set('attachmentIds','[]');form.set('subject','Personal follow-up');form.set('message','Documented information');if(mode)form.set('mode',mode);return new Request('https://crm.test/api/email',{method:'POST',headers:{member:String(member),org:'1','idempotency-key':crypto.randomUUID()},body:form});};

test('legacy reads enforce canonical ownership, excluding unassigned leads and foreign tenants',async()=>{
 assert.deepEqual((await queue()).map(row=>row.id).sort(),[101,102,105]);
 assert.deepEqual((await queue(11)).map(row=>row.id),[103]);
 assert.deepEqual((await queue(1)).map(row=>row.id).sort(),[101,102,103,104,105]);
});
test('legacy status and customer conversion cannot mutate another seller or an unassigned lead',async()=>{
 for(const id of [103,104])for(const type of ['status','addCustomer'])assert.equal((await app.callLists.POST(request(10,{type,id,status:'Kontaktet'}))).status,403);
 assert.equal(sql.prepare('SELECT count(*) n FROM companies').get().n,0);
 assert.equal(sql.prepare('SELECT count(*) n FROM outbound_call_logs').get().n,0);
});
test('opt-out suppresses imported SIRET duplicates, retains history, and survives disabling outbound',async()=>{
 add('outbound_suppression',{organization_id:1,country:'FR',org_number:'123456789',name:'Reserved company',created_by_membership_id:10,created_at:now});
 assert.deepEqual((await queue()).map(row=>row.id),[105]);
 sql.exec("UPDATE call_list_entries SET status='Kontaktet' WHERE id=101");
 assert.deepEqual((await queue(10,'&view=history')).map(row=>row.id),[101]);
 for(const enabled of [1,0]){
  sql.prepare('UPDATE organizations SET outbound_enabled=? WHERE id=1').run(enabled);
  for(const body of [{type:'status',id:101,status:'Ny'},{type:'addCustomer',id:102}])assert.equal((await app.callLists.POST(request(10,body))).status,409);
 }
 sql.exec('UPDATE organizations SET outbound_enabled=1 WHERE id=1');
});
test('legacy logs append repeated attempts, deduplicate request replay, schedule callbacks and keep history on reset',async()=>{
 const first={type:'status',id:105,status:'Kontaktet',requestId:crypto.randomUUID(),note:'Spoke to the decision maker'};
 assert.equal((await app.callLists.POST(request(10,first))).status,200);
 const replay=await app.callLists.POST(request(10,first));assert.equal(replay.status,200);assert.equal((await replay.json()).replayed,true);
 const callback=new Date(Date.now()+86400000).toISOString();
 assert.equal((await app.callLists.POST(request(10,{type:'status',id:105,status:'Ringte – ikke svar',requestId:crypto.randomUUID(),nextCallAt:callback}))).status,200);
 assert.equal(sql.prepare('SELECT attempts FROM outbound_lead_state WHERE entry_id=105').get().attempts,2);
 assert.equal(sql.prepare('SELECT count(*) n FROM outbound_call_logs WHERE entry_id=105').get().n,2);
 assert.equal((await queue()).some(row=>row.id===105),false);
 sql.prepare('UPDATE outbound_lead_state SET next_call_at=? WHERE entry_id=105').run(new Date(Date.now()-60000).toISOString());
 assert.equal((await queue()).some(row=>row.id===105),true);
 assert.equal((await app.callLists.POST(request(10,{type:'status',id:105,status:'Ny'}))).status,200);
 assert.equal(sql.prepare('SELECT attempts FROM outbound_lead_state WHERE entry_id=105').get().attempts,2);
 assert.equal(sql.prepare('SELECT count(*) n FROM outbound_call_logs WHERE entry_id=105').get().n,2);
 const created=await app.callLists.POST(request(10,{type:'addCustomer',id:105}));assert.equal(created.status,200,JSON.stringify(await created.clone().json()));
 const {company}=await created.json();assert.equal(company.country,'GB');
 assert.equal(sql.prepare('SELECT customer_company_id FROM outbound_deals WHERE entry_id=105').get().customer_company_id,company.id);
 assert.equal(sql.prepare('SELECT attempts FROM outbound_lead_state WHERE entry_id=105').get().attempts,2);
});
test('active call leases prevent simultaneous legacy mutations',async()=>{
 sql.prepare('UPDATE outbound_lead_state SET lease_token=?,lease_until=? WHERE entry_id=105').run('open-tab',new Date(Date.now()+60000).toISOString());
 const response=await app.callLists.POST(request(10,{type:'status',id:105,status:'Kontaktet'}));assert.equal(response.status,409);
 assert.equal((await response.json()).code,'OUTBOUND_LEASE_ACTIVE');
 sql.exec("UPDATE outbound_lead_state SET lease_token='',lease_until='' WHERE entry_id=105");
});
test('legacy callbacks apply to existing and newly imported copies in another saved list',async()=>{
 add('saved_call_lists',{id:190,organization_id:1,country:'GB',name:'Duplicate list',created_by_membership_id:1,created_at:now,updated_at:now});
 add('call_list_assignments',{organization_id:1,list_id:190,membership_id:10,assigned_by:'Admin',created_at:now});
 add('call_list_entries',{id:1901,organization_id:1,list_id:190,country:'GB',org_number:'SC000124',name:'Imported duplicate',created_at:now,updated_at:now});
 assert.equal((await app.callLists.POST(request(10,{type:'status',id:105,status:'Ny'}))).status,200);
 const callback=new Date(Date.now()+86400000).toISOString();assert.equal((await app.callLists.POST(request(10,{type:'status',id:105,status:'Ringte – ikke svar',nextCallAt:callback,requestId:crypto.randomUUID()}))).status,200);
 let response=await app.callLists.GET(request(10,undefined,'?listId=190'));assert.equal(response.status,200);assert.deepEqual((await response.json()).entries,[]);
 sql.prepare('UPDATE outbound_lead_state SET next_call_at=? WHERE entry_id=105').run(new Date(Date.now()-60000).toISOString());
 response=await app.callLists.GET(request(10,undefined,'?listId=190'));assert.deepEqual((await response.json()).entries.map(entry=>entry.id),[1901]);
 assert.equal((await app.callLists.POST(request(10,{type:'status',id:1901,status:'Kontaktet',requestId:crypto.randomUUID()}))).status,200);
 assert.equal(sql.prepare('SELECT attempts FROM outbound_lead_state WHERE entry_id=105').get().attempts,4);
 assert.equal(sql.prepare('SELECT status FROM call_list_entries WHERE id=105').get().status,'Kontaktet');
});
test('invalid callbacks and a failed call log cannot leave customer, contact or calendar writes behind',async()=>{
 add('call_list_entries',{id:1751,organization_id:1,list_id:100,country:'NO',org_number:'175000001',name:'Atomic meeting',created_at:now,updated_at:now});
 add('outbound_lead_state',{organization_id:1,entry_id:1751,assigned_membership_id:10,created_at:now,updated_at:now});
 const body={type:'status',id:1751,status:'Møte booket',meetingAt:new Date(Date.now()+86400000).toISOString(),contactName:'Decision maker',contactEmail:'decision@example.test',requestId:crypto.randomUUID()};
 const counts=()=>['companies','contacts','activities','outbound_call_logs'].map(table=>sql.prepare(`SELECT count(*) n FROM ${table}`).get().n),before=counts();
 assert.equal((await app.callLists.POST(request(10,{...body,nextCallAt:'invalid'}))).status,400);assert.deepEqual(counts(),before);
 sql.exec("CREATE TRIGGER fail_legacy_log BEFORE INSERT ON outbound_call_logs WHEN NEW.entry_id=1751 BEGIN SELECT RAISE(ABORT,'planned log failure'); END");
 const original=console.error;console.error=()=>{};try{assert.equal((await app.callLists.POST(request(10,body))).status,500);}finally{console.error=original;sql.exec('DROP TRIGGER fail_legacy_log');}
 assert.deepEqual(counts(),before);assert.equal(sql.prepare('SELECT status FROM call_list_entries WHERE id=1751').get().status,'Ny');
 const replies=await Promise.all([app.callLists.POST(request(10,body)),app.callLists.POST(request(10,body))]);assert.deepEqual(replies.map(response=>response.status),[200,200]);
 const after=counts();assert.deepEqual(after,before.map(n=>n+1));assert.equal(sql.prepare('SELECT attempts FROM outbound_lead_state WHERE entry_id=1751').get().attempts,1);
 const changed=await app.callLists.POST(request(10,{...body,status:'Kontaktet'}));assert.equal(changed.status,409);
});
test('saved-list deletion preserves call, sale, payment and opt-out records and protects other sellers',async()=>{
 assert.equal((await app.lists.POST(request(1,{type:'delete',listId:100}))).status,409);
 assert.equal(sql.prepare('SELECT count(*) n FROM call_list_entries WHERE list_id=100').get().n,6);
 add('saved_call_lists',{id:150,organization_id:1,country:'NO',name:'Uncontacted',created_by_membership_id:10,created_at:now,updated_at:now});
 add('call_list_entries',{id:1501,organization_id:1,list_id:150,country:'NO',org_number:'150000001',name:'Another seller',created_at:now,updated_at:now});
 add('outbound_lead_state',{organization_id:1,entry_id:1501,assigned_membership_id:11,created_at:now,updated_at:now});
 assert.equal((await app.lists.POST(request(10,{type:'delete',listId:150}))).status,403);
 assert.equal((await app.lists.POST(request(1,{type:'delete',listId:150}))).status,200);
 assert.equal(sql.prepare('SELECT count(*) n FROM outbound_lead_state WHERE entry_id=1501').get().n,0);
 add('saved_call_lists',{id:180,organization_id:1,country:'NO',name:'Payment basis',created_by_membership_id:1,created_at:now,updated_at:now});
 add('call_list_entries',{id:1801,organization_id:1,list_id:180,name:'Paid customer',created_at:now,updated_at:now});
 add('outbound_deal_payments',{organization_id:1,entry_id:1801,membership_id:10,payment_reference:'actual-payment',paid_amount_minor:49000,currency:'NOK',commission_bps:0,created_at:now});
 assert.equal((await app.lists.POST(request(1,{type:'delete',listId:180}))).status,409);
 assert.equal(sql.prepare('SELECT count(*) n FROM outbound_deal_payments WHERE entry_id=1801').get().n,1);
});
test('employee enrichment cannot update a different seller through a list they created',async()=>{
 add('saved_call_lists',{id:160,organization_id:1,country:'GB',name:'Seller list',created_by_membership_id:10,created_at:now,updated_at:now});
 add('call_list_entries',{id:1601,organization_id:1,list_id:160,country:'GB',org_number:'SC000123',name:'Other seller copy',created_at:now,updated_at:now});
 const response=await app.callLists.POST(request(10,{type:'enrichEmployees',listId:160,country:'GB',rows:[{orgNumber:'SC000123',employees:90}]}));
 assert.equal(response.status,403);assert.equal(sql.prepare('SELECT employees FROM call_list_entries WHERE id=1601').get().employees,null);
});
test('email protects other sellers and suppressed duplicates; own manually created customers still work',async()=>{
 add('companies',{id:501,organization_id:1,country:'GB',org_number:'SC000123',name:'Another seller customer',email:'other@example.test'});
 add('companies',{id:502,organization_id:1,country:'FR',org_number:'12345678900022',name:'Reserved duplicate',email:'reserved@example.test'});
 add('companies',{id:503,organization_id:1,name:'Manual owned customer',assigned_to:'Seller 10',email:'owned@example.test'});
 const before=legacySends.length;
 assert.equal((await app.email.POST(formRequest(10,[501]))).status,404);
 assert.equal((await app.email.POST(formRequest(1,[502]))).status,409);
 sql.exec('UPDATE organizations SET outbound_enabled=0 WHERE id=1');
 assert.equal((await app.email.POST(formRequest(1,[502]))).status,409);
 sql.exec('UPDATE organizations SET outbound_enabled=1 WHERE id=1');
 assert.equal(legacySends.length,before);
 const response=await app.email.POST(formRequest(10,[503]));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));assert.equal(legacySends.length,before+1);
});
test('large selections with repeated email stay within D1 limits and send one deduplicated recipient',async()=>{
 const ids=[];for(let i=0;i<500;i++){const id=10000+i;ids.push(id);add('companies',{id,organization_id:1,name:'Own '+i,assigned_to:'Seller 10',email:'same@example.test'});}
 const response=await app.email.POST(formRequest(10,ids,'bulk'));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));assert.equal((await response.json()).count,1);
 assert.deepEqual(legacySends.at(-1).p.bcc,['same@example.test']);
});
test('scheduled campaigns recheck opt-out and reassignment immediately before delivery',async()=>{
 const payload=()=>({to:['seller@example.test'],bcc:['owned@example.test'],subject:'Scheduled follow-up',message:'Documented facts',files:[],key:crypto.randomUUID()});
 const row=await app.campaigns.createCampaign(legacyAccount,payload(),[503],'');
 add('call_list_entries',{id:1701,organization_id:1,list_id:100,country:'NO',customer_id:503,name:'Manual customer reservation',created_at:now,updated_at:now});
 add('outbound_lead_state',{organization_id:1,entry_id:1701,assigned_membership_id:10,do_not_contact:1,created_at:now,updated_at:now});
 const before=legacySends.length;await app.campaigns.dispatchCampaign(row.id);assert.equal(legacySends.length,before);assert.equal((await app.campaigns.campaignOutcome(row.id)).status,'Feilet');
 sql.exec('UPDATE outbound_lead_state SET do_not_contact=0 WHERE entry_id=1701');
 const moved=await app.campaigns.createCampaign(legacyAccount,payload(),[503],'');sql.exec("UPDATE companies SET assigned_to='Seller 11' WHERE id=503");
 await app.campaigns.dispatchCampaign(moved.id);assert.equal(legacySends.length,before);assert.equal((await app.campaigns.campaignOutcome(moved.id)).status,'Feilet');
});
test('configured market restrictions apply to legacy contact and mail delivery',async()=>{
 sql.prepare('UPDATE organizations SET outbound_market_rules=? WHERE id=1').run(JSON.stringify({blockedIndustries:['legal']}));
 sql.exec("UPDATE call_list_entries SET industry='Legal services' WHERE id=105; UPDATE companies SET industry='Legal services',assigned_to='Seller 10' WHERE id=503");
 assert.equal((await app.callLists.POST(request(10,{type:'status',id:105,status:'Kontaktet'}))).status,409);
 assert.equal((await app.email.POST(formRequest(10,[503]))).status,409);
 sql.exec("UPDATE organizations SET outbound_market_rules='{}' WHERE id=1");
});
test.after(async()=>{sql.close();for(const key of ['legacySql','legacyOrm','legacyEnv','legacyAccount','legacySends'])delete globalThis[key];await rm(dir,{recursive:true,force:true});});
