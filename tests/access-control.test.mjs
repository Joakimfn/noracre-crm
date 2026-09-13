// Run with Node 24: node --test tests/access-control.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const dir=await mkdtemp(path.join(tmpdir(),'noracre-access-'));
const routes=['companies','activities','contacts','attachments','admin','marketing','marketing-images','call-lists','offers','export','session','profile','company-lookup','superadmin','operations','email'];
await build({stdin:{contents:routes.map((r,i)=>`export * as route${i} from './app/api/${r}/route';`).join('\n')+`\nexport * as schema from './db/schema';\nexport {getChatGPTUser} from './app/chatgpt-auth';\nexport {reminderIsDue} from './lib/followup-reminder';\nexport {validateImage,safeImageType} from './lib/safe-image';\nexport {guardRequest,secureResponse} from './lib/request-security';\nexport {apiFetch} from './lib/api-client';`,resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'routes.mjs'),packages:'external',plugins:[{name:'test-runtime',setup(b){
 b.onResolve({filter:/^@\/lib\/email-campaigns$/},()=>({path:'campaigns',namespace:'test'}));
 b.onResolve({filter:/^@\/lib\/user-mail$/},()=>({path:'user-mail',namespace:'test'}));
 b.onResolve({filter:/^@\/db$/},()=>({path:'db',namespace:'test'}));
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));
 b.onResolve({filter:/^next\//},args=>({path:args.path,namespace:'test'}));
 b.onLoad({filter:/.*/,namespace:'test'},({path:p})=>({contents:p==='campaigns'?'export const createCampaign=()=>{throw Error("Unexpected campaign")};export const dispatchCampaign=()=>{};export const campaignOutcome=()=>{};':p==='user-mail'?'export const getMailAccount=async()=>globalThis.testMailAccount;export const sendFromMailbox=async(a,p)=>globalThis.testMailSend(a,p);':p==='db'?'export const getDb=()=>globalThis.testDb':p==='env'?'export const env={SUPABASE_URL:"https://auth.test",SUPABASE_ANON_KEY:"public",get RESEND_API_KEY(){return globalThis.testMailKey},BUCKET:{get(){throw Error("Unexpected bucket access")}}}':'export const headers=async()=>new Headers({"oai-authenticated-user-email":"joakimfn@gmail.com"});export const redirect=()=>{};'}));
}}],nodePaths:[path.join(root,'node_modules')]});
// External packages resolve from the repository, not the temporary directory.
const {symlink}=await import('node:fs/promises');await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'),process.platform==='win32'?'junction':'dir');
const app=await import(pathToFileURL(path.join(dir,'routes.mjs')));
const sql=new DatabaseSync(':memory:');
for(const table of Object.values(app.schema)){
 const c=getTableConfig(table);
 const cols=c.columns.map(col=>`"${col.name}" ${col.getSQLType()}${col.primary?' PRIMARY KEY':''}${col.notNull?' NOT NULL':''}${col.default!==undefined?' DEFAULT '+(typeof col.default==='string'?"'"+col.default.replaceAll("'","''")+"'":Number(col.default)):''}`);
 sql.exec(`CREATE TABLE "${c.name}" (${cols.join(',')})`);
}
globalThis.testDb=drizzle(async(query,params,method)=>{const s=sql.prepare(query);s.setReturnArrays(true);return {rows:method==='run'?(s.run(...params),[]):method==='get'?s.get(...params):s.all(...params)}});
// Match D1's atomic batch semantics using the local SQLite transaction.
globalThis.testDb.batch=async statements=>{sql.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement);sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}};
const add=(table,values)=>{const keys=Object.keys(values);sql.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...Object.values(values));};
for(const id of [1,2]){add('organizations',{id,name:'Org '+id,crm_price:id===1?199:299,ring_price:29,marketing_price:69,created_at:'2026-01-01'});add('companies',{id,organization_id:id,name:'Customer '+id});add('contacts',{id,organization_id:id,company_id:id,name:'Contact '+id,created_at:'2026-01-01'});add('activities',{id,organization_id:id,company_id:id,kind:'Telefon'});}
for(const [id,org,role] of [[1,1,'Administrator'],[2,2,'Administrator'],[3,1,'Bruker'],[4,1,'Bruker']])add('memberships',{id,organization_id:org,user_id:String(id),email:`${id}@test.no`,name:'User '+id,role,created_at:'2026-01-01'});
const realFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{assert.equal(String(url),'https://auth.test/auth/v1/user');const id=init.headers.Authorization.replace('Bearer ','');if(id==='invalid')return new Response('',{status:401});return Response.json({id,email:id==='owner'?'jfn@noracre.no':`${id}@test.no`,email_confirmed_at:id==='unverified'?null:'2026-01-01'})};
const request=(user=1,org=1,body,query='')=>new Request('https://crm.test/'+query,{method:body?'POST':'GET',headers:{authorization:`Bearer ${user}`,'x-organization-id':String(org),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const route=name=>app['route'+routes.indexOf(name)];
test('caller-supplied legacy identity is not authentication',async()=>assert.equal(await app.getChatGPTUser(new Request('https://crm.test',{headers:{'oai-authenticated-user-email':'jfn@noracre.no'}})),null));
test('invalid and unverified identities are rejected',async()=>{assert.equal(await app.getChatGPTUser(request('invalid')),null);assert.equal(await app.getChatGPTUser(request('unverified')),null)});
for(const name of routes)test(`${name}: switching organization header cannot grant access`,async()=>assert.equal((await route(name).GET(request(1,2))).status,403));
test('customer lists remain tenant-scoped in both directions',async()=>{for(const id of [1,2])assert.deepEqual((await (await route('companies').GET(request(id,id))).json()).companies.map(x=>x.id),[id])});
test('foreign customer cannot be updated',async()=>{const r=request(1,1,{id:2,name:'Wrong'});assert.equal((await route('companies').PATCH(r)).status,404);assert.equal(sql.prepare('select name from companies where id=2').get().name,'Customer 2')});
test('foreign parent and contact rejected for followups',async()=>{for(const body of [{companyId:2},{companyId:1,contactId:2}])assert.equal((await route('activities').POST(request(1,1,body))).status,404)});
test('foreign contact cannot be linked to own customer',async()=>assert.equal((await route('companies').PATCH(request(1,1,{id:1,name:'Customer 1',nextContactId:2}))).status,404));
test('foreign files are not fetched from storage',async()=>assert.equal((await route('attachments').GET(request(1,1,undefined,'?id=2'))).status,404));
test('regular user cannot buy modules',async()=>assert.equal((await route('admin').POST(request(3,1,{type:'moduleStatus',moduleKey:'ringelister',membershipIds:[3]}))).status,403));
test('administrator cannot license another organization member',async()=>assert.equal((await route('admin').POST(request(1,1,{type:'moduleStatus',moduleKey:'ringelister',membershipIds:[2]}))).status,400));

test('employees cannot assign or revoke either module, including their own access',async()=>{
 for(const moduleKey of ['ringelister','markedsforing'])for(const membershipIds of [[],[3],[1,3,4]])
   assert.equal((await route('admin').POST(request(3,1,{type:'moduleStatus',moduleKey,membershipIds,acceptedPrice:29}))).status,403);
});
test('only selected users receive module access and catalog stays private',async()=>{
 for(const moduleKey of ['ringelister','markedsforing'])assert.equal((await route('admin').POST(request(1,1,{type:'moduleStatus',moduleKey,membershipIds:[3],acceptedPrice:moduleKey==='ringelister'?29:69}))).status,200);
 assert.deepEqual((await (await route('admin').GET(request(4))).json()).modules,{});
 assert.equal((await route('marketing').GET(request(3))).status,200);
 for(const user of [1,4])assert.equal((await route('marketing').GET(request(user))).status,403);
 assert.equal((await route('call-lists').POST(request(4,1,{}))).status,403);
 sql.exec("UPDATE organization_modules SET active=0");
 assert.equal((await route('marketing').GET(request(3))).status,403);
 assert.equal((await route('call-lists').POST(request(3,1,{}))).status,403);
});
test('owner bootstrap never joins arbitrary customer organization',async()=>{assert.equal((await route('companies').GET(request('owner',2))).status,403);const owned=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get();assert.ok(owned.organization_id>2)});
test('reminder starts 15 minutes before and ignores completed, late and dateless tasks',()=>{
 const due=Date.parse('2026-09-10T12:00:00Z'), task={dueAt:'2026-09-10T12:00:00Z',completedAt:''};
 assert.equal(app.reminderIsDue(task,due-900001),false);
 assert.equal(app.reminderIsDue(task,due-900000),true);
 assert.equal(app.reminderIsDue(task,due-1),true);
 assert.equal(app.reminderIsDue(task,due),false);
 assert.equal(app.reminderIsDue({...task,completedAt:'done'},due-900000),false);
 assert.equal(app.reminderIsDue({...task,dueAt:'2026-09-10'},due-900000),false);
});
test('inactive superadmin membership does not expose organization directory',async()=>{
 add('memberships',{id:50,organization_id:2,user_id:'4',email:'4@test.no',name:'User 4',role:'Superadmin',active:0,created_at:'2026-01-01'});
 const response=await route('session').GET(request(4));
 assert.deepEqual((await response.json()).organizations.map(x=>x.id),[1]);
});

test('ordinary users cannot enable or revoke support',async()=>{
 for(const enabled of [true,false])assert.equal((await route('admin').POST(request(3,1,{type:'support',enabled}))).status,403);
});
test('support consent must reference a pending request in the same tenant',async()=>{
 add('support_requests',{id:1,organization_id:2,requested_by:'Support',status:'Venter',created_at:'2026-01-01'});
 assert.equal((await route('admin').POST(request(1,1,{type:'supportApproval',requestId:1}))).status,404);
 assert.equal(sql.prepare('select count(*) n from support_sessions').get().n,0);
});
test('consented support expires, is revocable, and cannot renew itself',async()=>{
 const enable=await route('admin').POST(request(2,2,{type:'support',enabled:true}));
 assert.equal(enable.status,200);
 assert.equal((await route('companies').GET(request('owner',2))).status,200);
 assert.equal((await route('admin').POST(request('owner',2,{type:'support',enabled:true}))).status,403);
 sql.exec("UPDATE support_sessions SET expires_at='2000-01-01'");
 assert.equal((await route('companies').GET(request('owner',2))).status,403);
 assert.equal((await route('admin').POST(request(2,2,{type:'support',enabled:true}))).status,200);
 assert.equal((await route('admin').POST(request(2,2,{type:'support',enabled:false}))).status,200);
 assert.equal((await route('companies').GET(request('owner',2))).status,403);
});
test('role escalation and unknown roles are rejected',async()=>{
 for(const [role,status] of [['Superadmin',403],['root',400]])assert.equal((await route('admin').POST(request(1,1,{type:'member',role,name:'Test',email:'new@test.no'}))).status,status);
});

test('only superadmin can target another company when creating users',async()=>{
 const data={type:'member',organizationId:2,name:'Cross tenant',email:'cross@test.no',role:'Bruker',acceptedPrice:299};
 for(const user of [1,3])assert.equal((await route('admin').POST(request(user,1,data))).status,403);
 assert.equal(sql.prepare("SELECT count(*) n FROM memberships WHERE email='cross@test.no'").get().n,0);
});

test('superadmin provisions a customer user without support access and uses the target price',async()=>{
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 const data={type:'member',organizationId:2,name:'Customer Admin',email:' CUSTOMER@TEST.NO ',phone:'12345678',role:'Administrator',acceptedPrice:299};
 assert.equal((await route('companies').GET(request('owner',2))).status,403);
 assert.equal((await route('admin').POST(request('owner',own,{...data,acceptedPrice:199}))).status,409);
 const response=await route('admin').POST(request('owner',own,data));
 assert.equal(response.status,201);
 const result=await response.json();assert.equal(result.member.organizationId,2);assert.equal(result.member.email,'customer@test.no');assert.equal(result.member.phone,'12345678');assert.equal(result.monthlyPrice,299);
 assert.equal(sql.prepare("SELECT organization_id FROM team_members WHERE email='customer@test.no'").get().organization_id,2);
 assert.equal(sql.prepare("SELECT organization_id FROM audit_logs WHERE detail LIKE 'Customer Admin%'").get().organization_id,2);
 assert.equal((await route('companies').GET(request('owner',2))).status,403);
 assert.equal((await route('admin').POST(request('owner',own,data))).status,409);
 assert.equal(sql.prepare("SELECT count(*) n FROM memberships WHERE email='customer@test.no'").get().n,1);
});

test('customer provisioning rejects privilege escalation, invalid input and disabled companies',async()=>{
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 const data={type:'member',organizationId:2,name:'Blocked',email:'blocked@test.no',role:'Bruker',acceptedPrice:299};
 for(const [change,status] of [[{role:'Superadmin'},403],[{role:'Root'},400],[{organizationId:999999},404],[{organizationId:-1},400],[{email:'bad@@email'},400],[{name:' '},400]])
   assert.equal((await route('admin').POST(request('owner',own,{...data,...change}))).status,status);
 sql.exec("UPDATE organizations SET status='Deaktivert' WHERE id=2");
 assert.equal((await route('admin').POST(request('owner',own,data))).status,409);
 sql.exec("UPDATE organizations SET status='Aktiv', scheduled_disable_at='2000-01-01' WHERE id=2");
 assert.equal((await route('admin').POST(request('owner',own,data))).status,409);
 sql.exec("UPDATE organizations SET scheduled_disable_at='' WHERE id=2");
 assert.equal(sql.prepare("SELECT count(*) n FROM memberships WHERE email='blocked@test.no'").get().n,0);
});

test('customer membership, team entry and audit are atomic on write failure',async()=>{
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 sql.exec("CREATE TRIGGER fail_customer_team BEFORE INSERT ON team_members WHEN NEW.email='rollback@test.no' BEGIN SELECT RAISE(ABORT, 'test failure'); END");
 const r=await route('admin').POST(request('owner',own,{type:'member',organizationId:2,name:'Rollback user',email:'rollback@test.no',role:'Bruker',acceptedPrice:299}));
 assert.equal(r.status,500);
 assert.equal(sql.prepare("SELECT count(*) n FROM memberships WHERE email='rollback@test.no'").get().n,0);
 assert.equal(sql.prepare("SELECT count(*) n FROM audit_logs WHERE detail LIKE 'Rollback user%'").get().n,0);
 sql.exec('DROP TRIGGER fail_customer_team');
});

test('the invitation identifies the selected customer company and only emails the created user',async()=>{
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 const authFetch=globalThis.fetch;let message;
 globalThis.testMailKey='test-key';
 globalThis.fetch=async(url,options)=>{if(String(url)==='https://api.resend.com/emails'){message=JSON.parse(options.body);return Response.json({id:'test-only'});}return authFetch(url,options);};
 try {
   const response=await route('admin').POST(request('owner',own,{type:'member',organizationId:2,name:'Invited employee',email:'invited-employee@test.no',role:'Bruker',acceptedPrice:299}));
   assert.equal(response.status,201);assert.equal((await response.json()).invitationSent,true);
   assert.deepEqual(message.to,['invited-employee@test.no']);assert.match(message.subject,/Org 2/);assert.match(message.html,/Opprett konto eller logg inn/);
 } finally {globalThis.fetch=authFetch;delete globalThis.testMailKey;}
});
test('SQL injection strings remain data, never executable SQL',async()=>{
 const name="'; DROP TABLE companies; --";
 assert.equal((await route('companies').POST(request(1,1,{name}))).status,201);
 assert.equal(sql.prepare('select name from companies where name=?').get(name).name,name);
 assert.equal(sql.prepare('select name from companies where id=2').get().name,'Customer 2');
});
test('SVG, spoofed images and oversized files are rejected',async()=>{
 for(const file of [new File(['<svg onload="alert(1)"/>'],'x.svg',{type:'image/svg+xml'}),new File(['<html>bad</html>'],'x.png',{type:'image/png'}),new File([new Uint8Array(100)],'x.jpg',{type:'image/jpeg'})])
   await assert.rejects(app.validateImage(file,50),error=>error.status===400);
 const png=new File([new Uint8Array([137,80,78,71,13,10,26,10])],'x.png',{type:'image/png'});
 await app.validateImage(png,100);
 assert.equal(app.safeImageType('image/svg+xml'),false);
});
test('anonymous APIs blocked; public auth configuration remains accessible',async()=>{
 assert.equal((await app.guardRequest(new Request('https://crm.test/api/companies'))).status,401);
 assert.ok(await app.guardRequest(new Request('https://crm.test/api/auth/config')) instanceof Request);
});
test('cross-origin writes blocked and same-origin writes preserved',async()=>{
 const make=origin=>new Request('https://crm.test/api/activities',{method:'POST',headers:{authorization:'Bearer test',origin},body:'{}'});
 assert.equal((await app.guardRequest(make('https://evil.test'))).status,403);
 const allowed=await app.guardRequest(make('https://crm.test'));
 assert.ok(allowed instanceof Request);assert.equal(await allowed.text(),'{}');
});
test('oversized bodies blocked even without Content-Length',async()=>{
 const r=new Request('https://crm.test/api/activities',{method:'POST',headers:{authorization:'Bearer test','content-type':'application/json'},body:'x'.repeat(1024*1024+1)});
 assert.equal((await app.guardRequest(r)).status,413);
});
test('API responses disable caching and embedding',()=>{
 const response=app.secureResponse(new Request('https://crm.test/api/companies'),Response.json({ok:true}));
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.equal(response.headers.get('x-frame-options'),'DENY');
 assert.match(response.headers.get('content-security-policy'),/object-src 'none'/);
});

test('non-API POST cannot invoke unused Server Actions',async()=>{
 const r=new Request('https://crm.test/',{method:'POST',headers:{'next-action':'arbitrary'},body:'[]'});
 assert.equal((await app.guardRequest(r)).status,405);
});
test('unused public image proxies are disabled',async()=>{
 for (const path of ['/_vinext/image','/_next/image'])
   assert.equal((await app.guardRequest(new Request('https://crm.test'+path+'?url=https://example.invalid'))).status,404);
});
test('disabled users are denied even with a valid identity token',async()=>{
 sql.exec('UPDATE memberships SET active=0 WHERE id=3');
 assert.equal((await route('companies').GET(request(3))).status,403);
 sql.exec('UPDATE memberships SET active=1 WHERE id=3');
});
test('disabled organizations are denied',async()=>{
 sql.exec("UPDATE organizations SET status='Deaktivert' WHERE id=1");
 assert.equal((await route('companies').GET(request(1))).status,403);
 sql.exec("UPDATE organizations SET status='Aktiv' WHERE id=1");
});
test('foreign activity deletion leaves the other organization unchanged',async()=>{
 assert.equal((await route('activities').DELETE(request(1,1,undefined,'?id=2'))).status,404);
 assert.equal(sql.prepare('SELECT count(*) n FROM activities WHERE id=2').get().n,1);
});
test('API client never sends session tokens to external URLs',async()=>{
 const saved=globalThis.fetch;
 globalThis.window={location:{origin:'https://crm.test'}};
 let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({})};
 try {
   await assert.rejects(app.apiFetch('https://evil.test/api'),/egen adresse/);
   await assert.rejects(app.apiFetch('//evil.test/api'),/egen adresse/);
   assert.equal(calls,0);
 } finally {globalThis.fetch=saved;delete globalThis.window;}
});
test('marketing drafts retain channel choices but never claim scheduled delivery',async()=>{
 sql.exec("UPDATE organization_modules SET active=1 WHERE module_key='markedsforing'");
 const send=async(platforms)=>{
   const form=new FormData();form.set('content','Test draft');form.set('platforms',JSON.stringify(platforms));form.set('scheduledAt','2026-12-01T12:00');
   return route('marketing').POST(new Request('https://crm.test/api/marketing',{method:'POST',headers:{authorization:'Bearer 3','x-organization-id':'1'},body:form}));
 };
 for(const channel of ['Facebook','Instagram','LinkedIn']){
   const response=await send([channel]);assert.equal(response.status,201);
   const {post}=await response.json();assert.equal(post.status,'Kladd');assert.deepEqual(JSON.parse(post.platforms),[channel]);
 }
 for(const channels of [['X'],['Snapchat'],['Google Ads'],['unknown'],[]])assert.equal((await send(channels)).status,400);
});

test('operations data is unavailable to ordinary users and administrators',async()=>{
 for(const id of [1,3])assert.equal((await route('operations').GET(request(id))).status,403);
});
test('two followups survive unrelated customer edits and completing one preserves the other',async()=>{
 const create=async(id,note,dueAt)=>{const r=await route('activities').POST(request(id,1,{companyId:1,companyName:'Customer 1',contactId:1,isTask:true,note,dueAt}));assert.equal(r.status,201);return (await r.json()).activity;};
 const first=await create(1,'Meeting with contact A','2027-01-02T09:00');
 const second=await create(3,'Meeting with contact B','2027-01-03T10:00');
 assert.equal(first.createdBy,'User 1');assert.equal(second.createdBy,'User 3');
 const save=await route('companies').PATCH(request(1,1,{id:1,name:'Customer 1',note:'New note',nextActionDate:''}));assert.equal(save.status,200);
 assert.equal(sql.prepare('SELECT count(*) n FROM activities WHERE id IN (?,?) AND completed_at=\'\'').get(first.id,second.id).n,2);
 const done=await route('activities').PATCH(request(1,1,{id:first.id,completedAt:new Date().toISOString()}));assert.equal(done.status,200);
 assert.equal(sql.prepare('SELECT completed_at FROM activities WHERE id=?').get(second.id).completed_at,'');
 assert.equal(sql.prepare('SELECT due_at FROM activities WHERE id=?').get(first.id).due_at,first.dueAt);
 assert.equal(sql.prepare('SELECT next_action_date FROM companies WHERE id=1').get().next_action_date,second.dueAt);
 const edit=await route('activities').PATCH(request(3,1,{id:second.id,note:'Changed'}));assert.equal(edit.status,200);
 assert.equal((await edit.json()).activity.createdBy,'User 3');
 const foreign=await route('activities').PATCH(request(2,2,{id:second.id,note:'Foreign'}));assert.equal(foreign.status,404);
});
test('scheduled member deactivation keeps access until due and can be cancelled',async()=>{
 const future=new Date(Date.now()+86400000).toISOString();
 const planned=await route('admin').POST(request(1,1,{type:'memberStatus',id:3,active:false,effectiveAt:future}));assert.equal(planned.status,200);const {member}=await planned.json();assert.equal(member.active,true);assert.equal(member.scheduledDisableAt,future);
 assert.equal((await route('companies').GET(request(3))).status,200);
 const cancelled=await route('admin').POST(request(1,1,{type:'memberStatus',id:3,active:true}));assert.equal(cancelled.status,200);assert.equal((await cancelled.json()).member.scheduledDisableAt,'');
 sql.prepare('UPDATE memberships SET scheduled_disable_at=? WHERE id=3').run('2020-01-01T00:00:00.000Z');
 assert.equal((await route('companies').GET(request(3))).status,403);
 sql.exec("UPDATE memberships SET scheduled_disable_at='' WHERE id=3");
 assert.equal((await route('admin').POST(request(3,1,{type:'memberStatus',id:4,active:false,effectiveAt:future}))).status,403);
 assert.equal((await route('admin').POST(request(1,1,{type:'memberStatus',id:3,active:false,effectiveAt:'invalid'}))).status,400);
});
test('scheduled organization cutoff denies access before cron executes',async()=>{
 sql.prepare('UPDATE organizations SET scheduled_disable_at=? WHERE id=1').run('2020-01-01T00:00:00.000Z');
 assert.equal((await route('companies').GET(request(1))).status,403);
 sql.exec("UPDATE organizations SET scheduled_disable_at='' WHERE id=1");
});
const mailRequest=(user=3,overrides={},files=[])=>{
 const form=new FormData();const fields={companyIds:[1],attachmentIds:[],subject:'Hei',message:'Melding',mode:'offer',...overrides};
 for(const [key,value] of Object.entries(fields))form.set(key,Array.isArray(value)?JSON.stringify(value):String(value));
 for(const file of files)form.append('files',file);
 return new Request('https://crm.test/api/email',{method:'POST',headers:{authorization:`Bearer ${user}`,'x-organization-id':'1','idempotency-key':'12345678-1234-1234-1234-123456789012'},body:form});
};
test('history note can be changed without changing original author, date or completion',async()=>{
 const before=sql.prepare('SELECT * FROM activities WHERE id=1').get();
 assert.equal((await route('activities').PATCH(request(3,1,{id:1,note:'Oppdatert notat'}))).status,200);
 const after=sql.prepare('SELECT * FROM activities WHERE id=1').get();assert.equal(after.note,'Oppdatert notat');
 for(const key of ['created_by','created_at','completed_at','company_id'])assert.equal(after[key],before[key]);
});
test('email validates tenant, contacts, module license, file ownership and size before sending',async()=>{
 globalThis.testMailAccount={email:'sender@example.test',provider:'google'};
 sql.exec("UPDATE organization_modules SET active=0 WHERE module_key='markedsforing'");
 sql.exec("UPDATE companies SET email='customer@example.test' WHERE id=1");
 assert.equal((await route('email').POST(mailRequest(3,{companyIds:[2]}))).status,404);
 assert.equal((await route('email').POST(mailRequest(3,{contactId:2}))).status,404);
 assert.equal((await route('email').POST(mailRequest(3,{mode:'bulk'}))).status,403);
 assert.equal((await route('email').POST(mailRequest(3,{attachmentIds:[999]}))).status,404);
 assert.equal((await route('email').POST(mailRequest(3,{},[new File([new Uint8Array(10*1024*1024+1)],'large.pdf')]))).status,413);
 globalThis.testMailAccount=null;
 assert.equal((await route('email').POST(mailRequest())).status,409);
});
test('email sends through connected mailbox with files and private bulk recipients',async()=>{
 globalThis.testMailAccount={email:'sender@example.test',provider:'google'};const sent=[];
 globalThis.testMailSend=async(account,payload)=>sent.push({account,payload});
 const files=[new File(['PDF test bytes'],'tilbud.pdf',{type:'application/pdf'})];
 assert.equal((await route('email').POST(mailRequest(3,{},files))).status,200);
 assert.equal(sent[0].account.email,'sender@example.test');assert.deepEqual(sent[0].payload.to,['customer@example.test']);
 assert.equal(Buffer.from(sent[0].payload.files[0].content,'base64').toString(),'PDF test bytes');
 sql.exec("UPDATE organization_modules SET active=1 WHERE module_key='markedsforing'");
 assert.equal((await route('email').POST(mailRequest(3,{mode:'bulk'}))).status,200);
 assert.deepEqual(sent.at(-1).payload.bcc,['customer@example.test']);assert.deepEqual(sent.at(-1).payload.to,['sender@example.test']);
 globalThis.testMailAccount=null;
});
test.after(()=>{globalThis.fetch=realFetch;sql.close();return rm(dir,{recursive:true,force:true})});


test('invitation name is preserved and becomes session/profile default',async()=>{
 add('memberships',{id:80,organization_id:1,user_id:'invite:80@test.no',email:'80@test.no',name:'Invitert Navn',role:'Bruker',created_at:'2026-01-01'});
 const session=await (await route('session').GET(request(80))).json();
 assert.equal(session.user.displayName,'Invitert Navn');
 assert.equal(sql.prepare('select name from memberships where id=80').get().name,'Invitert Navn');
 const profile=await (await route('profile').GET(request(80))).json();assert.equal(profile.profile.displayName,'Invitert Navn');
});
test('each company receives only its negotiated prices',async()=>{
 for(const [id,price] of [[1,199],[2,299]]) {
   const d=await (await route('admin').GET(request(id,id))).json();assert.equal(d.pricing.crmPrice,price);
   assert.equal(d.pricing.marketingPrice,69);
 }
 assert.equal((await route('superadmin').GET(request(1))).status,403);
});
test('member creation rejects missing or stale prices before inserting a user',async()=>{
 const before=sql.prepare('select count(*) n from memberships').get().n;
 for(const acceptedPrice of [undefined,0,399]) {
   const r=await route('admin').POST(request(1,1,{type:'member',name:'Quote Test',email:'quote@test.no',role:'Bruker',acceptedPrice}));assert.equal(r.status,409);
 }
 assert.equal(sql.prepare('select count(*) n from memberships').get().n,before);
});
test('module purchase rejects a stale price and charges the agreed amount',async()=>{
 const stale=await route('admin').POST(request(1,1,{type:'moduleStatus',moduleKey:'ringelister',membershipIds:[3],acceptedPrice:49}));assert.equal(stale.status,409);
 const r=await route('admin').POST(request(1,1,{type:'moduleStatus',moduleKey:'ringelister',membershipIds:[3],acceptedPrice:29}));assert.equal(r.status,200);assert.equal((await r.json()).monthlyAmount,29);
 assert.equal(sql.prepare("select price_per_user from module_licenses where organization_id=1 and module_key='ringelister' and membership_id=3").get().price_per_user,29);
});

test('legacy overwritten invitation name is recovered from the original team record',async()=>{
 add('memberships',{id:81,organization_id:1,user_id:'81',email:'81@test.no',name:'81@test.no',role:'Bruker',created_at:'2026-01-01'});
 add('team_members',{id:81,organization_id:1,email:'81@test.no',name:'Opprinnelig Navn',role:'Bruker',created_at:'2026-01-01'});
 const d=await (await route('session').GET(request(81))).json();assert.equal(d.user.displayName,'Opprinnelig Navn');
});
test('confirmed user creation uses the company price in audit and response',async()=>{
 const r=await route('admin').POST(request(1,1,{type:'member',name:'Ny Ansatt',email:'newprice@test.no',acceptedPrice:199}));
 assert.equal(r.status,201);assert.equal((await r.json()).monthlyPrice,199);
 assert.match(sql.prepare("select detail from audit_logs where action='Aktiverte bruker' order by id desc limit 1").get().detail,/199 kr/);
});

test('booked meetings retain their own notes and return the updated customer for navigation',async()=>{
 add('organizations',{id:99,name:'Meeting test',created_at:'2026-01-01'});
 add('memberships',{id:99,organization_id:99,user_id:'99',email:'99@test.no',name:'Booker',role:'Administrator',created_at:'2026-01-01'});
 add('organization_modules',{organization_id:99,module_key:'ringelister',activated_at:'2026-01-01'});
 add('module_licenses',{organization_id:99,membership_id:99,module_key:'ringelister',activated_at:'2026-01-01'});
 add('companies',{id:999,organization_id:99,name:'Meeting customer',org_number:'999999999',note:'Existing customer note',stage:'Ny kunde'});
 add('call_list_entries',{id:999,organization_id:99,name:'Meeting customer',org_number:'999999999',created_at:'2026-01-01',updated_at:'2026-01-01'});
 const body={type:'status',id:999,status:'Møte booket',meetingAt:'2026-10-15T13:30',meetingNote:'Behovsanalyse\nDiskutere budsjett og videre fremdrift.',contactName:'Contact',contactEmail:'meeting@test.no'};
 const response=await route('call-lists').POST(request(99,99,body));assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.company.id,999);assert.equal(data.company.stage,'Møte avtalt');assert.equal(data.company.nextActionDate,body.meetingAt);
 const saved=sql.prepare('SELECT * FROM activities WHERE organization_id=99').get();assert.equal(saved.note,body.meetingNote);assert.equal(saved.due_at,body.meetingAt);assert.equal((await (await route('activities').GET(request(99,99))).json()).activities[0].createdBy,'Booker');assert.ok(saved.contact_id);
 assert.equal(sql.prepare('SELECT note FROM companies WHERE id=999').get().note,'Existing customer note');
 body.meetingAt='2026-10-20T10:00';body.meetingNote='';
 assert.equal((await route('call-lists').POST(request(99,99,body))).status,200);
 const notes=sql.prepare('SELECT note FROM activities WHERE organization_id=99 ORDER BY id').all().map(r=>r.note);assert.deepEqual(notes,['Behovsanalyse\nDiskutere budsjett og videre fremdrift.','Møte booket fra ringelisten']);
 for(const invalid of [{meetingAt:''},{meetingAt:'invalid'},{meetingNote:'x'.repeat(5001)}])assert.equal((await route('call-lists').POST(request(99,99,{...body,...invalid}))).status,400);
 assert.equal(sql.prepare('SELECT count(*) n FROM activities WHERE organization_id=99').get().n,2);
 assert.equal((await route('call-lists').POST(request(99,99,{...body,id:1}))).status,404);
});

test('removing plan entries is tenant scoped, requires confirmation and preserves external delivery records',async()=>{
 add('organization_modules',{organization_id:99,module_key:'markedsforing',activated_at:'2026-01-01'});
 add('module_licenses',{organization_id:99,membership_id:99,module_key:'markedsforing',activated_at:'2026-01-01'});
 add('marketing_posts',{id:999,organization_id:99,content:'Delete test',created_by:'Test',platforms:'["Facebook"]',status:'Publisert',created_at:'now',updated_at:'now'});
 add('social_deliveries',{organization_id:99,post_id:999,platform:'Facebook',account_id:'test-page',status:'published',remote_id:'external-post',created_at:'now'});
 const deletion=body=>route('marketing').DELETE(request(99,99,body));
 assert.equal((await deletion({id:999})).status,400);
 assert.equal((await deletion({id:1,confirm:true})).status,409);
 sql.exec("UPDATE marketing_posts SET status='Publiserer' WHERE id=999");assert.equal((await deletion({id:999,confirm:true})).status,409);
 sql.exec("UPDATE marketing_posts SET status='Publisert' WHERE id=999");assert.equal((await deletion({id:999,confirm:true})).status,200);
 assert.equal(sql.prepare('SELECT status FROM marketing_posts WHERE id=999').get().status,'Slettet');
 assert.equal(sql.prepare('SELECT remote_id FROM social_deliveries WHERE post_id=999').get().remote_id,'external-post');
 assert.equal((await (await route('marketing').GET(request(99,99))).json()).posts.length,0);
});

test('content plan searches all tenant posts, paginates five and separates published history',async()=>{
 for(let i=0;i<112;i++)add('marketing_posts',{id:2000+i,organization_id:99,content:i===0?'Hei, velkommen til Noracre CRM. ÆØÅ 10%_':`Innlegg ${i}`,created_by:'Booker',platforms:'["Facebook"]',status:i<6?'Publisert':i===6?'Delvis publisert':'Kladd',scheduled_at:i===7?'2026-10-01T12:00':'',created_at:'2026-01-01',updated_at:'2026-01-01'});
 add('marketing_posts',{id:2200,organization_id:2,content:'Hei velkommen',created_by:'Other',status:'Kladd',created_at:'now',updated_at:'now'});
 const get=async(query)=>{const r=await route('marketing').GET(request(99,99,undefined,'?'+query));assert.equal(r.status,200);return r.json();};
 const first=await get('view=upcoming');assert.equal(first.posts.length,5);assert.equal(first.posts[0].id,2007);assert.equal(first.pagination.total,106);assert.deepEqual(first.counts,{upcoming:106,history:6});
 const second=await get('view=upcoming&page=2');assert.equal(second.posts.length,5);assert.ok(second.posts.every(p=>!first.posts.some(f=>f.id===p.id)));
 const clamped=await get('view=upcoming&page=99999');assert.equal(clamped.pagination.page,22);assert.equal(clamped.posts.length,1);
 assert.equal((await get('view=history&page=2')).posts.length,1);
 for(const q of ['velkommen','HEI','æøå','%_']){const found=await get('view=history&q='+encodeURIComponent(q));assert.equal(found.posts.length,1);assert.equal(found.posts[0].id,2000);}
 assert.equal((await get('view=upcoming&q=velkommen')).pagination.total,0);
 assert.equal((await get('view=history&q=Delete')).pagination.total,0);
 assert.equal((await get('view=upcoming&page=NaN')).pagination.page,1);
});


test('profile rename follows stable identities across history, attachments, owners and organizations',async()=>{
 for(const id of [301,302]){add('organizations',{id,name:'Rename '+id,created_at:'now'});add('memberships',{id,organization_id:id,user_id:'301',email:'301@test.no',name:'Old Name',role:'Administrator',created_at:'now'});add('companies',{id,organization_id:id,name:'Customer',assigned_to:'Old Name',note:'Old Name is quoted in this note'});}
 add('activities',{id:3001,organization_id:301,company_id:301,kind:'Telefon',created_by:'Old Name',note:'Old Name is quoted'});
 add('activities',{id:3002,organization_id:302,company_id:302,kind:'Telefon',created_by:'301@test.no'});
 add('activities',{id:3003,organization_id:2,company_id:2,kind:'Telefon',created_by:'Old Name'});
 add('attachments',{id:3001,organization_id:301,company_id:301,filename:'test.txt',object_key:'test',size:1,uploaded_by:'Old Name',created_at:'now'});
 add('offer_templates',{id:3001,organization_id:301,name:'Template',created_by:'Old Name',created_at:'now',updated_at:'now'});
 add('call_list_entries',{id:3001,organization_id:301,name:'Prospect',handled_by:'Old Name',created_at:'now',updated_at:'now'});
 add('audit_logs',{id:3001,organization_id:301,actor:'Old Name',action:'Test',created_at:'now'});
 add('support_requests',{id:3001,organization_id:301,requested_by:'Old Name',created_at:'now'});
 const rename=async name=>{const form=new FormData();form.set('displayName',name);form.set('contactEmail','301@test.no');const r=await route('profile').POST(new Request('https://crm.test/api/profile',{method:'POST',headers:{authorization:'Bearer 301','x-organization-id':'301'},body:form}));assert.equal(r.status,200,await r.text());};
 await rename('New Name');
 assert.equal((await (await route('activities').GET(request(301,301))).json()).activities[0].createdBy,'New Name');
 assert.equal((await (await route('activities').GET(request(301,302))).json()).activities[0].createdBy,'New Name');
 assert.equal(sql.prepare('SELECT created_by FROM activities WHERE id=3003').get().created_by,'Old Name');
 assert.equal((await (await route('attachments').GET(request(301,301,undefined,'?companyId=301'))).json()).attachments[0].uploadedBy,'New Name');
 assert.equal((await (await route('offers').GET(request(301,301))).json()).templates[0].createdBy,'New Name');
 let admin=await (await route('admin').GET(request(301,301))).json();assert.equal(admin.audit[0].actor,'New Name');assert.equal(admin.supportRequests[0].requestedBy,'New Name');assert.equal(admin.members[0].name,'New Name');
 assert.equal((await (await route('session').GET(request(301,301))).json()).user.displayName,'New Name');
 // A later namesake must never take ownership of already identified history.
 add('memberships',{id:303,organization_id:301,user_id:'303',email:'303@test.no',name:'New Name',role:'Administrator',created_at:'now'});
 const created=await (await route('activities').POST(request(301,301,{companyId:301,kind:'Telefon'}))).json();assert.equal(created.activity.createdBy,'New Name');
 const other=await (await route('activities').POST(request(303,301,{companyId:301,kind:'Telefon'}))).json();
 add('activities',{id:3100,organization_id:301,company_id:301,kind:'Telefon',created_by:'New Name'});
 const company=await (await route('companies').GET(request(301,301))).json();assert.equal(company.companies[0].assignedTo,'New Name');
 assert.equal((await route('companies').PATCH(request(301,301,{...company.companies[0],note:'Edited note'}))).status,200);
 await rename('Newest Name');
 const history=(await (await route('activities').GET(request(301,301))).json()).activities;
 assert.equal(history.find(a=>a.id===3001).createdBy,'Newest Name');assert.equal(history.find(a=>a.id===created.activity.id).createdBy,'Newest Name');
 assert.equal(history.find(a=>a.id===other.activity.id).createdBy,'New Name');assert.equal(history.find(a=>a.id===3100).createdBy,'New Name');
 assert.equal(history.find(a=>a.id===3001).note,'Old Name is quoted');
 assert.equal((await (await route('companies').GET(request(301,301))).json()).companies[0].assignedTo,'Newest Name');
 const exported=await (await route('export').GET(request(301,301))).json();assert.ok(exported.activities.some(a=>a.id===3001&&a.createdBy==='Newest Name'));assert.ok(!JSON.stringify(exported).includes('crm-actor:v1:'));
});
