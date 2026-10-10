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
const routes=['companies','activities','contacts','attachments','admin','marketing','marketing-images','call-lists','offers','export','session','profile','company-lookup','superadmin','operations','email','call-list-ai','partners','partner-payments','saved-call-lists'];
await build({stdin:{contents:routes.map((r,i)=>`export * as route${i} from './app/api/${r}/route';`).join('\n')+`\nexport * as importRoute from './app/api/import/route';\nexport {matchesCustomer} from './lib/customer-search';\nexport {activeReminder,validateReminderMinutes} from './lib/followup-reminder';\nexport {guessColumns,mapImportRow,importDate} from './lib/data-import';\nexport * as schema from './db/schema';\nexport {getChatGPTUser} from './app/chatgpt-auth';\nexport {reminderIsDue} from './lib/followup-reminder';\nexport {validateImage,safeImageType} from './lib/safe-image';\nexport {guardRequest,secureResponse} from './lib/request-security';\nexport {apiFetch} from './lib/api-client';`,resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'routes.mjs'),packages:'external',plugins:[{name:'test-runtime',setup(b){
 b.onResolve({filter:/^@\/lib\/email-campaigns$/},()=>({path:'campaigns',namespace:'test'}));
 b.onResolve({filter:/^@\/lib\/user-mail$/},()=>({path:'user-mail',namespace:'test'}));
 b.onResolve({filter:/^@\/db$/},()=>({path:'db',namespace:'test'}));
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));
 b.onResolve({filter:/^next\//},args=>({path:args.path,namespace:'test'}));
 b.onLoad({filter:/.*/,namespace:'test'},({path:p})=>({contents:p==='campaigns'?'export const createCampaign=()=>{throw Error("Unexpected campaign")};export const dispatchCampaign=()=>{};export const campaignOutcome=()=>{};':p==='user-mail'?'export const getMailAccount=async()=>globalThis.testMailAccount;export const sendFromMailbox=async(a,p)=>globalThis.testMailSend(a,p);':p==='db'?'export const getDb=()=>globalThis.testDb':p==='env'?'export const env={SUPABASE_URL:"https://auth.test",SUPABASE_ANON_KEY:"public",get AI(){return globalThis.testAI},get CALL_LIST_AI_ENABLED(){return globalThis.testAIEnabled===false?"false":"true"},get RESEND_API_KEY(){return globalThis.testMailKey},BUCKET:{get(){throw Error("Unexpected bucket access")}}}':'export const headers=async()=>new Headers({"oai-authenticated-user-email":"joakimfn@gmail.com"});export const redirect=()=>{};'}));
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
sql.exec('CREATE UNIQUE INDEX test_assignment_unique ON call_list_assignments(list_id,membership_id); CREATE UNIQUE INDEX test_org_module_unique ON organization_modules(organization_id,module_key); CREATE UNIQUE INDEX test_member_module_unique ON module_licenses(organization_id,membership_id,module_key)');
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
for(const name of routes.filter(n=>n!=='call-list-ai'))test(`${name}: switching organization header cannot grant access`,async()=>assert.equal((await route(name).GET(request(1,2))).status,403));
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
 const body={type:'status',id:999,status:'Møte booket',meetingAt:'2026-10-15T13:30',reminderMinutes:[15,1440],meetingNote:'Behovsanalyse\nDiskutere budsjett og videre fremdrift.',contactName:'Contact',contactEmail:'meeting@test.no'};
 const response=await route('call-lists').POST(request(99,99,body));assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.company.id,999);assert.equal(data.company.stage,'Møte avtalt');assert.equal(data.company.nextActionDate,body.meetingAt);
 const saved=sql.prepare('SELECT * FROM activities WHERE organization_id=99').get();assert.equal(saved.note,body.meetingNote);assert.equal(saved.due_at,body.meetingAt);assert.equal(saved.reminder_minutes,'[1440,15]');assert.equal((await (await route('activities').GET(request(99,99))).json()).activities[0].createdBy,'Booker');assert.ok(saved.contact_id);
 assert.equal(sql.prepare('SELECT note FROM companies WHERE id=999').get().note,'Existing customer note');
 body.meetingAt='2026-10-20T10:00';body.meetingNote='';body.reminderMinutes=[];
 assert.equal((await route('call-lists').POST(request(99,99,body))).status,200);
 const notes=sql.prepare('SELECT note FROM activities WHERE organization_id=99 ORDER BY id').all().map(r=>r.note);assert.deepEqual(notes,['Behovsanalyse\nDiskutere budsjett og videre fremdrift.','Møte booket fra ringelisten']);
 assert.equal(sql.prepare('SELECT reminder_minutes FROM activities WHERE organization_id=99 ORDER BY id DESC LIMIT 1').get().reminder_minutes,'[]');
 for(const invalid of [{meetingAt:''},{meetingAt:'invalid'},{meetingNote:'x'.repeat(5001)},{reminderMinutes:[15,15]},{reminderMinutes:[1,2,3]},{reminderMinutes:[-1]}])assert.equal((await route('call-lists').POST(request(99,99,{...body,...invalid}))).status,400);
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
test('superadmin creates a customer employee with both modules and preserves existing licenses',async()=>{
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 add('organizations',{id:950,name:'Module customer',crm_price:499,ring_price:49,marketing_price:79,created_at:'now'});
 add('memberships',{id:950,organization_id:950,user_id:'950',email:'950@test.no',name:'Existing employee',role:'Bruker',created_at:'now'});
 add('organization_modules',{organization_id:950,module_key:'ringelister',active:1,price_per_user:49,activated_at:'old'});
 add('module_licenses',{organization_id:950,membership_id:950,module_key:'ringelister',active:1,price_per_user:39,activated_at:'old'});
 const r=await route('admin').POST(request('owner',own,{type:'member',organizationId:950,name:'Module employee',email:'951@test.no',role:'Bruker',acceptedPrice:499,moduleKeys:['ringelister','markedsforing'],acceptedModulePrices:{ringelister:49,markedsforing:79}}));
 assert.equal(r.status,201);const d=await r.json();assert.equal(d.monthlyPrice,627);assert.deepEqual(d.modules,['ringelister','markedsforing']);
 const licenses=sql.prepare('SELECT module_key,price_per_user,active FROM module_licenses WHERE membership_id=? AND organization_id=950 ORDER BY module_key').all(d.member.id);
 assert.deepEqual(licenses.map(x=>({...x})),[{module_key:'markedsforing',price_per_user:79,active:1},{module_key:'ringelister',price_per_user:49,active:1}]);
 assert.equal(sql.prepare("SELECT active FROM module_licenses WHERE membership_id=950 AND module_key='ringelister'").get().active,1);
 assert.equal(sql.prepare("SELECT price_per_user FROM module_licenses WHERE membership_id=950 AND module_key='ringelister'").get().price_per_user,39);
 assert.equal((await route('marketing').GET(request(951,950))).status,200);
 assert.equal((await route('call-lists').GET(request(951,950))).status,200);
 assert.equal((await route('companies').GET(request(951,1))).status,403);
});

test('module choices and every agreed price must validate before any customer user is inserted',async()=>{
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 const base={type:'member',organizationId:950,name:'Invalid modules',email:'invalid-modules@test.no',acceptedPrice:499,moduleKeys:['ringelister'],acceptedModulePrices:{ringelister:49}};
 for(const [change,status] of [[{moduleKeys:['unknown']},400],[{moduleKeys:'ringelister'},400],[{acceptedModulePrices:{}},409],[{acceptedModulePrices:{ringelister:0}},409],[{acceptedModulePrices:{ringelister:'49'}},409]])
  assert.equal((await route('admin').POST(request('owner',own,{...base,...change}))).status,status);
 sql.exec('UPDATE organizations SET marketing_price=NULL WHERE id=950');
 assert.equal((await route('admin').POST(request('owner',own,{...base,moduleKeys:['markedsforing'],acceptedModulePrices:{markedsforing:0}}))).status,409);
 sql.exec('UPDATE organizations SET marketing_price=79 WHERE id=950');
 assert.equal(sql.prepare("SELECT count(*) n FROM memberships WHERE email='invalid-modules@test.no'").get().n,0);
});

test('included modules cost zero and reactivation does not revive other employees licenses',async()=>{
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 add('organizations',{id:952,name:'Included customer',crm_price:499,ring_price:0,created_at:'now'});
 add('memberships',{id:952,organization_id:952,user_id:'952',email:'952@test.no',name:'Old employee',created_at:'now'});
 add('organization_modules',{organization_id:952,module_key:'ringelister',active:0,activated_at:'old'});
 add('module_licenses',{organization_id:952,membership_id:952,module_key:'ringelister',active:1,activated_at:'old'});
 const r=await route('admin').POST(request('owner',own,{type:'member',organizationId:952,name:'Included employee',email:'included@test.no',acceptedPrice:499,moduleKeys:['ringelister','ringelister'],acceptedModulePrices:{ringelister:0}}));
 assert.equal(r.status,201);const d=await r.json();assert.equal(d.monthlyPrice,499);assert.equal(d.modules.length,1);
 assert.equal(sql.prepare('SELECT active FROM module_licenses WHERE membership_id=952').get().active,0);
 assert.equal(sql.prepare('SELECT price_per_user FROM module_licenses WHERE membership_id=?').get(d.member.id).price_per_user,0);
});

test('module failure rolls back the new membership and module activation together',async()=>{
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 add('organizations',{id:954,name:'Rollback modules',crm_price:499,ring_price:49,created_at:'now'});
 sql.exec("CREATE TRIGGER fail_module BEFORE INSERT ON module_licenses WHEN NEW.organization_id=954 BEGIN SELECT RAISE(ABORT,'module failure'); END");
 const r=await route('admin').POST(request('owner',own,{type:'member',organizationId:954,name:'Rollback modules',email:'module-rollback@test.no',acceptedPrice:499,moduleKeys:['ringelister'],acceptedModulePrices:{ringelister:49}}));
 assert.equal(r.status,500);
 for(const table of ['memberships','team_members','organization_modules','module_licenses','audit_logs'])assert.equal(sql.prepare(`SELECT count(*) n FROM ${table} WHERE organization_id=954`).get().n,0);
 sql.exec('DROP TRIGGER fail_module');
});

test('search matches all contacts and formatted telephone numbers without combining unrelated numbers',()=>{
 const customer={name:'Nordvik Bygg',phone:'+47 22 33 44 55',searchContacts:[{name:'Ingrid Hansen',phone:'900 12 345',email:'ingrid@example.no',title:'Daglig leder'},{name:'Per Olsen',phone:'888 99 000'}]};
 for(const query of ['nordvik','ingrid hansen','PER OLSEN','daglig leder','90012345','900 12 345','+47 22334455','88899000','ingrid@example.no'])assert.equal(app.matchesCustomer(customer,query),true,query);
 for(const query of ['nobody','455900','12345 name'])assert.equal(app.matchesCustomer(customer,query),false,query);
});

test('two reminders have separate windows, support no reminders and reject invalid offsets',()=>{
 const due=Date.parse('2026-10-01T12:00:00Z'),task={dueAt:'2026-10-01T12:00:00Z',completedAt:'',reminderMinutes:'[1440,15]'};
 assert.equal(app.activeReminder(task,due-1440*60000-1),null);
 assert.equal(app.activeReminder(task,due-1440*60000),1440);
 assert.equal(app.activeReminder(task,due-15*60000-1),1440);
 assert.equal(app.activeReminder(task,due-15*60000),15);
 assert.equal(app.activeReminder(task,due),null);
 assert.equal(app.activeReminder({...task,completedAt:'done'},due-60000),null);
 assert.equal(app.activeReminder({...task,reminderMinutes:'[]'},due-60000),null);
 assert.deepEqual(app.validateReminderMinutes([15,1440]),[1440,15]);
 for(const value of [[15,15],[0],[-1],[1,2,3],[1.5],['15'],[43201],null])assert.throws(()=>app.validateReminderMinutes(value));
});

test('followup reminders persist through creation and editing without crossing tenants',async()=>{
 const response=await route('activities').POST(request(1,1,{companyId:1,isTask:true,dueAt:'2027-01-01T12:00:00',note:'Two reminders',reminderMinutes:[15,1440]}));
 assert.equal(response.status,201);const {activity}=await response.json();assert.equal(activity.reminderMinutes,'[1440,15]');
 assert.equal((await route('activities').PATCH(request(2,2,{id:activity.id,reminderMinutes:[]}))).status,404);
 assert.equal((await route('activities').PATCH(request(1,1,{id:activity.id,reminderMinutes:[15,15]}))).status,400);
 assert.equal((await route('activities').PATCH(request(1,1,{id:activity.id,reminderMinutes:[]}))).status,200);
 assert.equal(sql.prepare('SELECT reminder_minutes FROM activities WHERE id=?').get(activity.id).reminder_minutes,'[]');
});

test('contact editing updates all fields and cannot move contacts between customers or tenants',async()=>{
 add('companies',{id:970,organization_id:1,name:'Contact testing',contact_name:'Old Name',phone:'111',email:'old@example.no'});
 add('contacts',{id:970,organization_id:1,company_id:970,name:'Old Name',phone:'111',email:'old@example.no',is_primary:1,created_at:'now'});
 assert.equal((await route('contacts').PATCH(request(2,2,{id:970,name:'Wrong'}))).status,404);
 assert.equal((await route('contacts').DELETE(request(2,2,undefined,'?id=970'))).status,404);
 assert.equal((await route('contacts').PATCH(request(1,1,{id:970,name:'',email:'bad'}))).status,400);
 const response=await route('contacts').PATCH(request(1,1,{id:970,name:'New Name',title:'CEO',phone:'222 33 444',email:'new@example.no',companyId:2,organizationId:2}));
 assert.equal(response.status,200);const {contact}=await response.json();assert.equal(contact.companyId,970);assert.equal(contact.organizationId,1);assert.equal(contact.title,'CEO');assert.equal(contact.phone,'222 33 444');assert.equal(contact.email,'new@example.no');
 assert.equal(sql.prepare('SELECT contact_name FROM companies WHERE id=970').get().contact_name,'New Name');
 const list=await (await route('companies').GET(request(1))).json();assert.equal(app.matchesCustomer(list.companies.find(c=>c.id===970),'22233444'),true);
});

test('deleting contacts preserves history, promotes a replacement and never resurrects legacy contacts',async()=>{
 add('contacts',{id:971,organization_id:1,company_id:970,name:'Replacement',is_primary:0,created_at:'now'});
 add('activities',{id:970,organization_id:1,company_id:970,contact_id:970,note:'Keep this history',kind:'Telefon'});
 assert.equal((await route('contacts').DELETE(request(1,1,undefined,'?id=970'))).status,200);
 assert.equal(sql.prepare('SELECT contact_id FROM activities WHERE id=970').get().contact_id,null);
 assert.equal(sql.prepare('SELECT is_primary FROM contacts WHERE id=971').get().is_primary,1);
 assert.equal((await route('contacts').DELETE(request(1,1,undefined,'?id=971'))).status,200);
 assert.deepEqual((await (await route('contacts').GET(request(1,1,undefined,'?companyId=970'))).json()).contacts,[]);
 assert.equal(sql.prepare('SELECT note FROM activities WHERE id=970').get().note,'Keep this history');
});

const importRequest=(mode,rows,requestId=crypto.randomUUID(),org=1,user=1)=>request(user,org,{mode,source:'Migration test',requestId,rows});
test('import infers CRM export columns without treating a company name as a contact',()=>{
 const customerMap=app.guessColumns(['Name','id','orgNumber','contactName','email'],'customers');
 assert.equal(customerMap.name,0);assert.equal(customerMap.externalId,1);assert.equal(customerMap.contactName,3);
 assert.equal(app.guessColumns(['Name'],'customers').contactName,-1);
 assert.equal(app.guessColumns(['name','companyId'],'contacts').companyReference,1);
 assert.deepEqual(app.mapImportRow(['Acme','123'],{name:0,externalId:1,note:-1}),{name:'Acme',externalId:'123'});
 assert.equal(app.importDate('24.09.2026 12:30'),'2026-09-24T12:30:00');
 assert.throws(()=>app.importDate('not a date'));
});

test('customer import supports contacts, safe retries, separate history and atomic followup summaries',async()=>{
 const body={name:'Imported customer',externalId:'old-001',contactName:'Imported person',contactEmail:'imported@example.no',phone:'12345678',dueAt:'2027-04-01T12:00:00'};
 const key=crypto.randomUUID();let r=await app.importRoute.POST(importRequest('customers',[body],key));assert.equal(r.status,201);const first=await r.json();assert.equal(first.customers,1);assert.equal(first.contacts,1);assert.equal(first.activities,1);
 r=await app.importRoute.POST(importRequest('customers',[body],key));assert.equal(r.status,200);assert.deepEqual(await r.json(),first);
 assert.equal((await app.importRoute.POST(importRequest('customers',[{...body,name:'Changed'}],key))).status,409);
 const customer=sql.prepare("SELECT * FROM companies WHERE import_id='old-001' AND organization_id=1").get();assert.equal(customer.next_action_date,body.dueAt);
 r=await app.importRoute.POST(importRequest('customers',[body]));assert.equal(r.status,201);assert.equal((await r.json()).skipped,1);
 r=await app.importRoute.POST(importRequest('contacts',[{companyReference:'old-001',contactName:'Second person',contactPhone:'999 88 777'}]));assert.equal(r.status,201);assert.equal((await r.json()).contacts,1);
 r=await app.importRoute.POST(importRequest('activities',[{companyReference:'old-001',note:'Old conversation',createdAt:'12.09.2026',kind:'Telefon'}]));assert.equal(r.status,201);
 const history=sql.prepare("SELECT * FROM activities WHERE company_id=? AND note='Old conversation'").get(customer.id);assert.equal(history.completed_at,'2026-09-12T09:00:00');
});

test('imports validate complete batches and cannot access another tenant',async()=>{
 assert.equal((await app.importRoute.POST(importRequest('customers',[{name:'No access'}],crypto.randomUUID(),2,1))).status,403);
 assert.equal((await app.importRoute.POST(importRequest('contacts',[{companyReference:'old-001',contactName:'Foreign'}],crypto.randomUUID(),2,2))).status,400);
 assert.equal((await app.importRoute.POST(importRequest('customers',[{name:'Must roll back'},{name:''}]))).status,400);
 assert.equal(sql.prepare("SELECT count(*) n FROM companies WHERE name='Must roll back'").get().n,0);
 assert.equal((await app.importRoute.POST(importRequest('customers',Array.from({length:51},()=>({name:'Too many'}))))).status,400);
 sql.exec("CREATE TRIGGER fail_import BEFORE INSERT ON contacts WHEN NEW.name='Fail import' BEGIN SELECT RAISE(ABORT,'import failure'); END");
 const key=crypto.randomUUID();assert.equal((await app.importRoute.POST(importRequest('customers',[{name:'Atomic import',contactName:'Fail import'}],key))).status,500);
 assert.equal(sql.prepare("SELECT count(*) n FROM companies WHERE name='Atomic import'").get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM data_imports WHERE id=?').get(`1:${key}`).n,0);
 sql.exec('DROP TRIGGER fail_import');
 assert.equal((await app.importRoute.POST(importRequest('customers',[{name:'Atomic import',contactName:'Fail import'}],key))).status,201);
});

test('AI call-list search requires the assigned module and enforces tenant isolation',async()=>{
 let calls=0;globalThis.testAI={run:async()=>{calls++;throw Error('Must not call AI')}};
 assert.equal((await route('call-list-ai').POST(request('invalid',1,{prompt:'Find companies'}))).status,401);
 assert.equal((await route('call-list-ai').POST(request(1,2,{prompt:'Find companies'}))).status,403);
 add('organizations',{id:980,name:'AI tenant',created_at:'now'});
 add('memberships',{id:980,organization_id:980,user_id:'980',email:'980@test.no',name:'AI user',role:'Bruker',created_at:'now'});
 assert.equal((await route('call-list-ai').POST(request(980,980,{prompt:'Find companies'}))).status,403);
 assert.equal(calls,0);
 add('organization_modules',{organization_id:980,module_key:'ringelister',active:1,activated_at:'now'});
 add('module_licenses',{organization_id:980,membership_id:980,module_key:'ringelister',active:1,activated_at:'now'});
});

test('AI validates output, preserves all requested filters and limits usage before inference',async()=>{
 let calls=0;const output={count:20,minEmployees:1,maxEmployees:15,locationCodes:['county:18','county:55','county:56'],industryCodes:[],organizationForms:['AS'],establishedFrom:'2025-01-01',establishedTo:'2026-12-31',requirePhone:false,requireEmail:false,clarifications:[]};
 globalThis.testAI={run:async(model,input)=>{calls++;assert.match(model,/llama/);assert.equal(input.messages.length,2);return {response:output};}};
 let r=await route('call-list-ai').POST(request(980,980,{prompt:'20 bedrifter i Nord-Norge med 1–15 ansatte etablert i 2025 eller 2026'}));assert.equal(r.status,200);let result=await r.json();assert.deepEqual(result.filters.locationCodes,output.locationCodes);assert.equal(result.filters.establishedFrom,'2025-01-01');assert.equal(result.filters.count,20);
 output.locationCodes=['county:00'];r=await route('call-list-ai').POST(request(980,980,{prompt:'Find companies in nowhere'}));assert.equal(r.status,422);
 output.locationCodes=[];output.clarifications=[{kind:'revenue',phrase:'omsetning'}];r=await route('call-list-ai').POST(request(980,980,{prompt:'Bedrifter med 10 millioner i omsetning'}));assert.equal(r.status,422);assert.match((await r.json()).error,/Omsetning/);
 sql.prepare('UPDATE call_list_ai_usage SET count=30 WHERE membership_id=980').run();const before=calls;assert.equal((await route('call-list-ai').POST(request(980,980,{prompt:'Finn 20 bedrifter'}))).status,429);assert.equal(calls,before);
 sql.prepare('UPDATE call_list_ai_usage SET window_started=0 WHERE membership_id=980').run();output.clarifications=[];output.locationCodes=['county:18'];assert.equal((await route('call-list-ai').POST(request(980,980,{prompt:'Finn 20 bedrifter'}))).status,200);
 globalThis.testAI=undefined;
});

test('ringeliste generation combines places, industries, employees and establishment dates with atomic replacement',async()=>{
 const authFetch=globalThis.fetch,requests=[];
 const company=(id,extra={})=>({organisasjonsnummer:String(id),navn:'Fixture '+id,antallAnsatte:10,stiftelsesdato:'2025-06-01',forretningsadresse:{kommunenummer:'1804',kommune:'Bodø'},naeringskode1:{kode:'43.210',beskrivelse:'Elektro'},...extra});
 let rows=[company(980000001),company(980000002,{antallAnsatte:undefined,harRegistrertAntallAnsatte:true}),company(980000003,{stiftelsesdato:'2024-12-31'}),company(980000004,{antallAnsatte:16}),company(980000005,{forretningsadresse:{kommunenummer:'0301'}}),company(980000006,{naeringskode1:{kode:'99.999'}}),company(980000007,{forretningsadresse:{kommunenummer:'5501'},naeringskode1:{kode:'41.000'}})];
 globalThis.fetch=async(url,init)=>{const u=new URL(url);if(u.hostname==='auth.test')return authFetch(url,init);if(u.hostname==='data.ssb.no')return new Response('',{status:503});assert.equal(u.hostname,'data.brreg.no');requests.push(u);return Response.json({_embedded:{enheter:rows},page:{totalPages:1}});};
 const filters={type:'generate',count:20,minEmployees:1,maxEmployees:15,locationCodes:['county:18','5501'],industryCodes:['43.210','41.000'],organizationForms:['AS'],establishedFrom:'2025-01-01',establishedTo:'2026-12-31'};
 try{
  let r=await route('call-lists').POST(request(980,980,filters));assert.equal(r.status,200,JSON.stringify(await r.clone().json()));let d=await r.json();assert.equal(d.added,3);assert.deepEqual(d.entries.map(x=>x.orgNumber).sort(),['980000001','980000002','980000007']);assert.equal(d.entries.find(x=>x.orgNumber==='980000002').employees,null);
  assert.equal(requests[0].searchParams.get('fraAntallAnsatte'),'1');assert.equal(requests[0].searchParams.get('tilAntallAnsatte'),'15');assert.equal(requests[0].searchParams.get('fraStiftelsesdato'),'2025-01-01');assert.equal(requests[0].searchParams.get('naeringskode'),'43.210,41.000');assert.ok(requests[0].searchParams.get('forretningsadresse.kommunenummer').split(',').includes('5501'));
  rows=[];assert.equal((await route('call-lists').POST(request(980,980,filters))).status,404);assert.equal(sql.prepare('SELECT count(*) n FROM call_list_entries WHERE organization_id=980').get().n,3);
  rows=[company(980000009)];sql.exec("CREATE TRIGGER fail_call_list BEFORE INSERT ON call_list_entries WHEN NEW.org_number='980000009' BEGIN SELECT RAISE(ABORT,'forced failure'); END");
  assert.equal((await route('call-lists').POST(request(980,980,filters))).status,500);assert.equal(sql.prepare('SELECT count(*) n FROM call_list_entries WHERE organization_id=980').get().n,3);sql.exec('DROP TRIGGER fail_call_list');
  assert.equal((await route('call-lists').POST(request(980,980,{...filters,minEmployees:3}))).status,400);
  assert.equal((await route('call-lists').POST(request(980,980,{...filters,establishedFrom:'2026-02-30'}))).status,400);
 }finally{globalThis.fetch=authFetch;}
});

test('support requests notify only customer administrators, consent is specific, atomic and revocable',async()=>{
 add('organizations',{id:991,name:'Support target',created_at:'2026-01-01'});
 add('memberships',{id:991,organization_id:991,user_id:'991',email:'991@test.no',name:'Customer admin',role:'Administrator',active:1,created_at:'2026-01-01'});
 add('memberships',{id:992,organization_id:991,user_id:'992',email:'992@test.no',name:'Employee',role:'Bruker',active:1,created_at:'2026-01-01'});
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 const authFetch=globalThis.fetch,sent=[];globalThis.testMailKey='test-key';
 globalThis.fetch=async(url,init)=>{if(String(url)==='https://api.resend.com/emails'){sent.push(JSON.parse(init.body));assert.ok(init.headers['Idempotency-Key']);return Response.json({id:'test'});}return authFetch(url,init);};
 try{
 const r=await route('superadmin').POST(request('owner',own,{type:'requestAccess',organizationId:991}));assert.equal(r.status,201,JSON.stringify(await r.clone().json()));const d=await r.json();assert.equal(d.notificationSent,true);assert.equal(sent.length,1);assert.deepEqual(sent[0].to,['991@test.no']);assert.equal(sent[0].from,'Noracre CRM <noreply@mail.noracre.no>');assert.ok(sent[0].html.includes('supportRequest='+d.request.id));
 assert.equal((await route('superadmin').POST(request('owner',own,{type:'requestAccess',organizationId:991}))).status,200);assert.equal(sent.length,1);
 assert.equal((await route('admin').POST(request(992,991,{type:'supportApproval',requestId:d.request.id}))).status,403);
 assert.equal((await route('admin').POST(request(1,1,{type:'supportApproval',requestId:d.request.id}))).status,404);
 sql.exec("CREATE TRIGGER fail_support BEFORE INSERT ON support_sessions WHEN NEW.organization_id=991 BEGIN SELECT RAISE(ABORT,'forced failure'); END");
 assert.equal((await route('admin').POST(request(991,991,{type:'supportApproval',requestId:d.request.id,duration:'untilRevoked'}))).status,500);
 assert.equal(sql.prepare('SELECT status FROM support_requests WHERE id=?').get(d.request.id).status,'Venter');sql.exec('DROP TRIGGER fail_support');
 const approval=await route('admin').POST(request(991,991,{type:'supportApproval',requestId:d.request.id,duration:'untilRevoked'}));assert.equal(approval.status,200,JSON.stringify(await approval.clone().json()));
 const grant=sql.prepare('SELECT * FROM support_sessions WHERE organization_id=991').get();assert.equal(grant.support_user_id,'owner');assert.ok(grant.expires_at.startsWith('9999'));
 assert.equal((await route('admin').POST(request(991,991,{type:'supportApproval',requestId:d.request.id}))).status,404);
 assert.equal((await route('companies').GET(request('owner',991))).status,200);
 assert.equal((await route('admin').POST(request(991,991,{type:'support',enabled:false}))).status,200);
 assert.equal((await route('companies').GET(request('owner',991))).status,403);
 const second=await(await route('superadmin').POST(request('owner',own,{type:'requestAccess',organizationId:991}))).json();
 const short=await(await route('admin').POST(request(991,991,{type:'supportApproval',requestId:second.request.id,duration:'24h'}))).json();assert.ok(Math.abs(new Date(short.expiresAt).getTime()-Date.now()-86400000)<5000);
 }finally{globalThis.fetch=authFetch;globalThis.testMailKey=undefined;}
});

test('paused AI endpoint cannot invoke a model or consume quota',async()=>{
 globalThis.testAIEnabled=false;globalThis.testAI={run(){throw Error('Paused AI must not run');}};
 try{const before=sql.prepare('SELECT SUM(count) n FROM call_list_ai_usage').get().n;const r=await route('call-list-ai').POST(request(980,980,{prompt:'10 håndverkere i Midt-Norge'}));assert.equal(r.status,503);assert.match((await r.json()).error,/midlertidig deaktivert/);assert.equal(sql.prepare('SELECT SUM(count) n FROM call_list_ai_usage').get().n,before);}finally{delete globalThis.testAIEnabled;delete globalThis.testAI;}
});


test('partner referrals are scoped to the authenticated partner and expose no customer records',async()=>{
 for(const [id,isPartner,referrer] of [[1100,1,null],[1101,1,null],[1102,0,1100],[1103,0,1101]])add('organizations',{id,name:'Partner company '+id,is_partner:isPartner,referred_by_partner_id:referrer,partner_assigned_at:referrer?'2026-01-01T00:00:00Z':'',created_at:'2026-01-01'});
 for(const [id,org,role] of [[1100,1100,'Partner'],[1101,1101,'Partner'],[1104,1100,'Bruker'],[1105,1100,'Administrator']])add('memberships',{id,organization_id:org,user_id:String(id),email:id+'@test.no',name:'Test',role,created_at:'2026-01-01'});
 for(const org of [1102,1103])for(const [type,price] of [['organization',0],['user',499],['module',0],['license',49]])add('billing_events',{organization_id:org,entity_type:type,entity_id:org,membership_id:org,module_key:'ringelister',label:'PRIVATE EMPLOYEE DATA',active:1,monthly_price:price,event_kind:'activated',occurred_at:'2026-01-01T10:00:00Z'});
 const r=await route('partners').GET(request(1100,1100,undefined,'?partnerId=1101&organizationId=1103'));
 assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);
 const data=await r.json();assert.deepEqual(data.rows.map(r=>r.id),[1102]);assert.equal(data.rows[0].currentOre,0);assert.doesNotMatch(JSON.stringify(data),/PRIVATE EMPLOYEE|email|membershipId/);
 assert.deepEqual((await(await route('partners').GET(request(1101,1101))).json()).rows.map(r=>r.id),[1103]);
 for(const user of [1104,1105])assert.equal((await route('partners').GET(request(user,1100))).status,403);
 for(const target of [1101,1102,1103]){assert.equal((await route('partners').GET(request(1100,target))).status,403);assert.equal((await route('companies').GET(request(1100,target))).status,403);}
 assert.equal((await route('superadmin').GET(request(1100,1100))).status,403);
 assert.equal((await route('operations').GET(request(1100,1100))).status,403);
 for(const mutation of ["UPDATE organizations SET is_partner=0 WHERE id=1100","UPDATE memberships SET active=0 WHERE id=1100","UPDATE organizations SET status='Deaktivert' WHERE id=1100","UPDATE memberships SET scheduled_disable_at='2000-01-01' WHERE id=1100"]){sql.exec(mutation);assert.equal((await route('partners').GET(request(1100,1100))).status,403);sql.exec("UPDATE organizations SET is_partner=1,status='Aktiv' WHERE id=1100; UPDATE memberships SET active=1,scheduled_disable_at='' WHERE id=1100");}
});

test('only superadmin can manage referral ownership; assignment changes revoke former partner access',async()=>{
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 const data={organizationId:1102,isPartner:false,referredByPartnerId:1101};
 for(const user of [1100,1104,1105])assert.equal((await route('partners').POST(request(user,1100,data))).status,403);
 assert.equal((await route('partners').POST(request('owner',own,{...data,referredByPartnerId:1102}))).status,400);
 assert.equal((await route('partners').POST(request('owner',own,{...data,referredByPartnerId:1103}))).status,400);
 sql.exec("UPDATE organizations SET status='Deaktivert' WHERE id=1101");assert.equal((await route('partners').POST(request('owner',own,data))).status,400);sql.exec("UPDATE organizations SET status='Aktiv' WHERE id=1101");
 assert.equal((await route('partners').POST(request('owner',own,data))).status,200);
 assert.deepEqual((await(await route('partners').GET(request(1100,1100))).json()).rows,[]);
 const row=(await(await route('partners').GET(request(1101,1101))).json()).rows.find(r=>r.id===1102);assert.equal(row.ytdOre,0);assert.equal(row.previousOre,0);assert.equal(row.currentOre,0);
 assert.ok(sql.prepare("SELECT count(*) n FROM audit_logs WHERE organization_id=1102 AND action='Partnerkobling endret'").get().n>0);
 const assigned=sql.prepare('SELECT partner_assigned_at t FROM organizations WHERE id=1102').get().t;
 assert.equal((await route('partners').POST(request('owner',own,data))).status,200);assert.equal(sql.prepare('SELECT partner_assigned_at t FROM organizations WHERE id=1102').get().t,assigned);
 assert.equal((await route('partners').POST(request('owner',own,{organizationId:1101,isPartner:false,referredByPartnerId:null}))).status,409);
 assert.equal((await route('partners').POST(request('owner',own,{...data,referredByPartnerId:null}))).status,200);
 assert.equal((await(await route('partners').GET(request(1101,1101))).json()).rows.some(r=>r.id===1102),false);
});

test('partner role and referrals can be created only by superadmin and must refer to a real partner',async()=>{
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 const data={type:'organization',name:'New partner',adminName:'Partner contact',adminEmail:'newpartner@test.no',adminRole:'Partner',commissionPercent:'20',crmPrice:0};
 assert.equal((await route('admin').POST(request(1105,1100,data))).status,403);
 const before=sql.prepare('SELECT COUNT(*) n FROM organizations').get().n;
 assert.equal((await route('admin').POST(request('owner',own,{...data,referredByPartnerId:999999}))).status,400);assert.equal(sql.prepare('SELECT COUNT(*) n FROM organizations').get().n,before);
 const r=await route('admin').POST(request('owner',own,data));assert.equal(r.status,201);const org=(await r.json()).organization;assert.equal(org.isPartner,true);assert.equal(sql.prepare('SELECT role FROM memberships WHERE organization_id=?').get(org.id).role,'Partner');
 const customer=await route('admin').POST(request('owner',own,{...data,name:'Referred customer',adminEmail:'referral@test.no',adminRole:'Administrator',referredByPartnerId:org.id}));assert.equal(customer.status,201);const referred=(await customer.json()).organization;assert.equal(referred.isPartner,false);assert.equal(referred.referredByPartnerId,org.id);assert.ok(referred.partnerAssignedAt);
 const member={type:'member',organizationId:org.id,role:'Partner',name:'Partner staff',email:'staffpartner@test.no',acceptedPrice:0};
 assert.equal((await route('admin').POST(request('owner',own,member))).status,201);
 assert.equal((await route('admin').POST(request('owner',own,{...member,organizationId:referred.id,email:'badpartner@test.no'}))).status,403);
 assert.equal((await route('admin').POST(request(1105,1100,{type:'member',role:'Partner',name:'Escalation',email:'e@test.no'}))).status,403);
});


test('Drift saves referral and company details atomically without changing partner status',async()=>{
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 const data={type:'organizationDetails',organizationId:1102,name:'Edited referral',orgNumber:'',crmPrice:499,ringPrice:49,marketingPrice:49,referredByPartnerId:'1100',isPartner:true};
 assert.equal((await route('superadmin').POST(request(1100,1100,data))).status,403);
 assert.equal((await route('superadmin').POST(request('owner',own,{...data,referredByPartnerId:'1103'}))).status,400);
 assert.equal(sql.prepare('SELECT name FROM organizations WHERE id=1102').get().name,'Partner company 1102');
 const response=await route('superadmin').POST(request('owner',own,data));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
 const result=(await response.json()).organization;assert.equal(result.referredByPartnerId,1100);assert.equal(result.isPartner,false);assert.equal(result.name,'Edited referral');
 const assignedAt=result.partnerAssignedAt;
 sql.exec("UPDATE organizations SET status='Deaktivert' WHERE id=1100");
 assert.equal((await route('superadmin').POST(request('owner',own,data))).status,200);assert.equal(sql.prepare('SELECT partner_assigned_at d FROM organizations WHERE id=1102').get().d,assignedAt);
 sql.exec("UPDATE organizations SET status='Aktiv' WHERE id=1100; CREATE TRIGGER fail_referral_audit BEFORE INSERT ON audit_logs WHEN NEW.organization_id=1102 BEGIN SELECT RAISE(ABORT,'test failure'); END");
 assert.equal((await route('superadmin').POST(request('owner',own,{...data,name:'Should roll back',referredByPartnerId:'1101'}))).status,500);
 const unchanged=sql.prepare('SELECT name,referred_by_partner_id p FROM organizations WHERE id=1102').get();assert.equal(unchanged.p,1100);assert.equal(unchanged.name,'Edited referral');sql.exec('DROP TRIGGER fail_referral_audit');
 assert.equal((await route('superadmin').POST(request('owner',own,{...data,referredByPartnerId:'none'}))).status,200);assert.equal(sql.prepare('SELECT referred_by_partner_id p FROM organizations WHERE id=1102').get().p,null);
});

test('automatic partner preview is offered to the owner only and preserves real role',async()=>{
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 const owner=await(await route('session').GET(request('owner',own))).json();assert.equal(owner.partnerPreviewVersion,'2026-09-21-v1');assert.equal(owner.role,'Superadmin');
 for(const [id,org]of [[1,1],[1100,1100],[1104,1100]]){const user=await(await route('session').GET(request(id,org))).json();assert.equal(user.partnerPreviewVersion,null);}
});


test('partner creation requires a valid percentage without creating partial companies',async()=>{
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 const data={type:'organization',name:'Percentage partner',adminName:'Test',adminEmail:'percentage@test.no',adminRole:'Partner',crmPrice:0};
 const before=sql.prepare('SELECT count(*) n FROM organizations').get().n;
 for(const commissionPercent of ['',null,-1,101,'12.345','abc',true])assert.equal((await route('admin').POST(request('owner',own,{...data,commissionPercent}))).status,400);
 assert.equal(sql.prepare('SELECT count(*) n FROM organizations').get().n,before);
 const r=await route('admin').POST(request('owner',own,{...data,commissionPercent:'12,5'}));assert.equal(r.status,201);assert.equal((await r.json()).organization.commissionBps,1250);
});

test('payment commission is superadmin-only, tenant-scoped, duplicate-safe and snapshots the rate',async()=>{
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 sql.exec("UPDATE organizations SET commission_bps=2500 WHERE id=1100; UPDATE organizations SET commission_bps=4000 WHERE id=1101; UPDATE organizations SET referred_by_partner_id=1100 WHERE id=1102; CREATE UNIQUE INDEX test_payment_reference ON partner_payments(organization_id,reference_key)");
 const body={type:'payment',organizationId:1102,amount:'1 000,50',paidOn:'2026-09-01',reference:'BANK-001',acceptedPartnerId:1100,acceptedBasisPoints:2500};
 for(const [user,org]of [[1,1],[3,1],[1100,1100]]){assert.equal((await route('partner-payments').POST(request(user,org,body))).status,403);assert.equal((await route('partner-payments').GET(request(user,org,undefined,'?organizationId=1102'))).status,403);}
 for(const change of [{amount:'-1'},{amount:'0'},{paidOn:'2099-01-01'},{paidOn:'2026-02-30'},{reference:''}])assert.equal((await route('partner-payments').POST(request('owner',own,{...body,...change}))).status,400);
 assert.equal((await route('partner-payments').POST(request('owner',own,{...body,acceptedBasisPoints:2000}))).status,409);
 const created=await route('partner-payments').POST(request('owner',own,body));assert.equal(created.status,201);assert.equal((await created.json()).commissionOre,25013);
 assert.equal((await route('partner-payments').POST(request('owner',own,{...body,reference:' bank-001 '}))).status,409);
 const payment=sql.prepare("SELECT * FROM partner_payments WHERE reference='BANK-001'").get();assert.equal(payment.amount_ore,100050);assert.equal(payment.basis_points,2500);
 const scoped=await(await route('partners').GET(request(1100,1100,undefined,'?partnerId=1101'))).json();assert.equal(scoped.commission.months.find(m=>m.month==='2026-09').commissionOre,25013);
 assert.equal((await(await route('partners').GET(request(1101,1101))).json()).commission.months.flatMap(m=>m.entries).length,0);
 sql.exec('UPDATE organizations SET commission_bps=5000 WHERE id=1100; UPDATE organizations SET referred_by_partner_id=1101 WHERE id=1102');
 assert.equal((await(await route('partners').GET(request(1100,1100))).json()).commission.months.find(m=>m.month==='2026-09').commissionOre,25013);
 assert.equal((await route('partner-payments').POST(request('owner',own,{...body,reference:'BANK-002'}))).status,409);
 for(const voided of [true,false]){assert.equal((await route('partner-payments').POST(request('owner',own,{type:'status',id:payment.id,voided}))).status,200);const total=(await(await route('partners').GET(request(1100,1100))).json()).commission.months.flatMap(m=>m.entries).reduce((s,p)=>s+p.commissionOre,0);assert.equal(total,voided?0:25013);}
 sql.exec("CREATE TRIGGER fail_payment_audit BEFORE INSERT ON audit_logs WHEN NEW.action='Innbetaling registrert' BEGIN SELECT RAISE(ABORT,'test failure'); END");
 assert.equal((await route('partner-payments').POST(request('owner',own,{...body,reference:'ROLLBACK',acceptedPartnerId:1101,acceptedBasisPoints:4000}))).status,409);assert.equal(sql.prepare("SELECT COUNT(*) n FROM partner_payments WHERE reference='ROLLBACK'").get().n,0);sql.exec('DROP TRIGGER fail_payment_audit');
});


test('only superadmin changes partner commission and older payments keep the agreed rate',async()=>{
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 const body={type:'organizationDetails',organizationId:1100,name:'Partner company 1100',crmPrice:0,commissionPercent:'12,5'};
 assert.equal((await route('superadmin').POST(request(1100,1100,body))).status,403);
 assert.equal((await route('superadmin').POST(request('owner',own,{...body,commissionPercent:'101'}))).status,400);
 const old=sql.prepare('SELECT basis_points FROM partner_payments WHERE partner_id=1100 LIMIT 1').get().basis_points;
 const r=await route('superadmin').POST(request('owner',own,body));assert.equal(r.status,200);assert.equal((await r.json()).organization.commissionBps,1250);
 assert.equal(sql.prepare('SELECT basis_points FROM partner_payments WHERE partner_id=1100 LIMIT 1').get().basis_points,old);assert.ok(sql.prepare("SELECT count(*) n FROM audit_logs WHERE action='Partnerprovisjon endret'").get().n>0);
});


test('partner administers its own CRM at agreed prices while employees and referred companies stay isolated',async()=>{
 add('organizations',{id:1200,name:'Working partner',is_partner:1,crm_price:199,ring_price:29,marketing_price:39,created_at:'2026-01-01'});
 for(const [id,role]of [[1200,'Partner'],[1201,'Bruker']])add('memberships',{id,organization_id:1200,user_id:String(id),email:id+'@test.no',name:'Partner team '+id,role,created_at:'2026-01-01'});
 const summary=await(await route('admin').GET(request(1200,1200))).json();assert.equal(summary.pricing.crmPrice,199);assert.equal(summary.members.length,2);
 assert.equal((await route('companies').GET(request(1200,1200))).status,200);
 assert.equal((await route('partners').GET(request(1200,1200))).status,200);
 for(const action of ['superadmin','operations','partner-payments'])assert.equal((await route(action).GET(request(1200,1200))).status,403);
 assert.equal((await route('admin').GET(request(1200,1102))).status,403);
 const employee=await(await route('admin').GET(request(1201,1200))).json();assert.deepEqual(employee.members,[]);assert.deepEqual(employee.audit,[]);
 assert.equal((await route('partners').GET(request(1201,1200))).status,403);
 const member={type:'member',role:'Bruker',name:'New employee',email:'partner-employee@test.no',acceptedPrice:199};
 assert.equal((await route('admin').POST(request(1201,1200,member))).status,403);
 assert.equal((await route('admin').POST(request(1200,1200,{...member,acceptedPrice:0}))).status,409);
 for(const role of ['Partner','Superadmin'])assert.equal((await route('admin').POST(request(1200,1200,{...member,role}))).status,403);
 assert.equal((await route('admin').POST(request(1200,1200,{...member,organizationId:1102}))).status,403);
 const created=await route('admin').POST(request(1200,1200,member));assert.equal(created.status,201);assert.equal((await created.json()).monthlyPrice,199);
 assert.equal((await route('admin').POST(request(1200,1200,{type:'memberStatus',id:1201,active:false}))).status,200);
 assert.equal((await route('admin').POST(request(1200,1200,{type:'memberStatus',id:1201,active:true,acceptedPrice:199}))).status,200);
 assert.equal((await route('marketing').GET(request(1200,1200))).status,403);
 const module={type:'moduleStatus',moduleKey:'markedsforing',membershipIds:[1200],acceptedPrice:39};
 assert.equal((await route('admin').POST(request(1201,1200,module))).status,403);
 assert.equal((await route('admin').POST(request(1200,1200,{...module,membershipIds:[1104]}))).status,400);
 assert.equal((await route('admin').POST(request(1200,1200,module))).status,200);
 assert.equal(sql.prepare("SELECT price_per_user FROM module_licenses WHERE membership_id=1200 AND module_key='markedsforing'").get().price_per_user,39);
 assert.equal((await route('marketing').GET(request(1200,1200))).status,200);assert.equal((await route('marketing').GET(request(1201,1200))).status,403);
 const template={name:'Partner offer',subject:'Quote',body:'Agreed services'};
 assert.equal((await route('offers').POST(request(1201,1200,template))).status,403);
 const offer=await route('offers').POST(request(1200,1200,template));assert.equal(offer.status,201);assert.equal((await offer.json()).template.organizationId,1200);
});

test('support requests go to the partner administrator and require that companys consent',async()=>{
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 const authFetch=globalThis.fetch,sent=[];globalThis.testMailKey='test-key';
 globalThis.fetch=async(url,init)=>{if(String(url)==='https://api.resend.com/emails'){sent.push(JSON.parse(init.body));return Response.json({id:'test'});}return authFetch(url,init);};
 try{
 const r=await route('superadmin').POST(request('owner',own,{type:'requestAccess',organizationId:1200}));assert.equal(r.status,201);const d=await r.json();assert.equal(d.notificationSent,true);assert.deepEqual(sent.map(m=>m.to),[['1200@test.no']]);
 assert.equal((await route('admin').POST(request(1201,1200,{type:'supportApproval',requestId:d.request.id}))).status,403);
 assert.equal((await route('admin').POST(request(1200,1200,{type:'supportApproval',requestId:d.request.id,duration:'24h'}))).status,200);
 assert.equal((await route('admin').POST(request(1200,1200,{type:'support',enabled:false}))).status,200);
 }finally{globalThis.fetch=authFetch;globalThis.testMailKey=undefined;}
});


test('saved call lists isolate users, survive generation, delegate with durable notices, and delete without deleting customers',async()=>{
 add('organizations',{id:1300,name:'Lists tenant',operating_countries:'["NO","GB","IE","AU","NZ"]',created_at:'2026-01-01'});
 for(const [id,role]of [[1300,'Administrator'],[1301,'Bruker'],[1302,'Bruker']]){
 add('memberships',{id,organization_id:1300,user_id:String(id),email:id+'@test.no',name:'List user '+id,role,created_at:'2026-01-01'});
 add('module_licenses',{organization_id:1300,membership_id:id,module_key:'ringelister',active:1,price_per_user:29,activated_at:'2026-01-01'});
 }
 add('organization_modules',{organization_id:1300,module_key:'ringelister',active:1,price_per_user:29,activated_at:'2026-01-01'});
 const imported=async(user,name,country='GB')=>{const r=await route('call-lists').POST(request(user,1300,{type:'import',listName:name,country,rows:[{orgNumber:'SC012345',name:'Example Ltd'}]}));assert.equal(r.status,201);return r.json();};
 const one=await imported(1300,'UK leads'),two=await imported(1302,'Other personal list','IE');
 assert.equal(one.list.country,'GB');assert.equal(one.entries[0].country,'GB');
 const listing=async user=>(await(await route('saved-call-lists').GET(request(user,1300))).json());
 assert.deepEqual((await listing(1301)).lists,[]);
 assert.equal((await route('call-lists').GET(request(1301,1300,undefined,'?listId='+one.list.id))).status,404);
 assert.equal((await route('call-lists').POST(request(1301,1300,{type:'status',id:one.entries[0].id,status:'Kontaktet'}))).status,404);
 assert.equal((await route('saved-call-lists').POST(request(1301,1300,{type:'assign',listId:one.list.id,membershipId:1301}))).status,404);
 const action=body=>route('saved-call-lists').POST(request(1300,1300,body));
 assert.equal((await action({type:'assign',listId:one.list.id,membershipId:2})).status,400);
 assert.equal((await action({type:'assign',listId:one.list.id,membershipId:1301})).status,200);
 let assigned=await listing(1301);assert.deepEqual(assigned.lists.map(l=>l.id),[one.list.id]);assert.equal(assigned.assignments[0].assignedBy,'List user 1300');assert.equal(assigned.assignments[0].acknowledgedAt,'');
 const assignmentId=assigned.assignments[0].id;
 assert.equal((await route('saved-call-lists').POST(request(1301,1300,{type:'acknowledge',ids:[assignmentId]}))).status,200);
 assert.ok((await listing(1301)).assignments[0].acknowledgedAt);
 assert.equal((await route('call-lists').GET(request(1301,1300,undefined,'?listId='+one.list.id))).status,200);
 assert.equal((await route('saved-call-lists').POST(request(1301,1300,{type:'rename',listId:one.list.id,name:'Wrong'}))).status,403);
 assert.equal((await action({type:'rename',listId:one.list.id,name:'Renamed UK'})).status,200);
 const customer=await route('call-lists').POST(request(1301,1300,{type:'addCustomer',id:one.entries[0].id}));assert.equal(customer.status,200);const created=(await customer.json()).company;assert.equal(created.country,'GB');
 assert.equal((await action({type:'unassign',listId:one.list.id,membershipId:1301})).status,200);
 assert.equal((await route('call-lists').GET(request(1301,1300,undefined,'?listId='+one.list.id))).status,404);
 assert.equal((await action({type:'delete',listId:one.list.id})).status,200);
 assert.equal(sql.prepare('SELECT count(*) n FROM call_list_entries WHERE list_id=?').get(one.list.id).n,0);
 assert.equal(sql.prepare('SELECT count(*) n FROM companies WHERE id=?').get(created.id).n,1);
 assert.equal(sql.prepare('SELECT count(*) n FROM call_list_entries WHERE list_id=?').get(two.list.id).n,1);
 assert.equal((await route('saved-call-lists').POST(request(1301,1300,{type:'countries',operatingCountries:['GB']}))).status,403);
 assert.equal((await action({type:'countries',operatingCountries:['GB','IE']})).status,200);
 assert.equal((await route('call-lists').POST(request(1300,1300,{type:'generate',country:'NO'}))).status,400);
 for(const country of ['GB','AU','NZ'])assert.equal((await route('call-lists').POST(request(1300,1300,{type:'generate',country}))).status,country==='GB'?503:400);
});

test('partner creates a customer with countries and is always its referrer without granting CRM access',async()=>{
 const data={type:'organization',name:'UK partner customer',orgNumber:'SC012345',adminName:'Jane',adminEmail:'jane@partner-test.no',adminRole:'Administrator',crmPrice:199,operatingCountries:['GB','IE'],referredByPartnerId:1101};
 const r=await route('admin').POST(request(1200,1200,data));assert.equal(r.status,201);const org=(await r.json()).organization;
 assert.equal(org.operatingCountries,'["GB","IE"]');assert.equal(org.orgNumber,'SC012345');assert.equal(org.referredByPartnerId,1200);assert.equal(org.isPartner,false);
 const own=sql.prepare("SELECT organization_id FROM memberships WHERE user_id='owner'").get().organization_id;
 const edit=await route('superadmin').POST(request('owner',own,{type:'organizationDetails',organizationId:org.id,name:org.name,orgNumber:org.orgNumber,crmPrice:199}));assert.equal(edit.status,200);assert.equal((await edit.json()).organization.orgNumber,'SC012345');
 assert.equal((await route('companies').GET(request(1200,org.id))).status,403);
 assert.equal((await route('admin').POST(request(1201,1200,data))).status,403);
 assert.equal((await route('admin').POST(request(1200,1200,{...data,adminRole:'Partner'}))).status,403);
 assert.equal((await route('admin').POST(request(1200,1200,{...data,operatingCountries:[]}))).status,400);
});

test('home country is persisted independently of sales markets and sets each tenant language',async()=>{
 const data={type:'organization',name:'Nigeria based Ireland sales',homeCountry:'NG',operatingCountries:['IE'],adminName:'Agent',adminEmail:'homecountry@test.no',adminRole:'Administrator',crmPrice:199};
 const created=await route('admin').POST(request(1200,1200,data));assert.equal(created.status,201);
 const org=(await created.json()).organization;assert.equal(org.homeCountry,'NG');assert.equal(org.operatingCountries,'["IE"]');
 add('memberships',{id:1700,organization_id:org.id,user_id:'1700',email:'1700@test.no',name:'Foreign admin',role:'Administrator',created_at:'now'});
 let settings=await (await route('admin').GET(request(1700,org.id))).json();assert.equal(settings.language,'en');assert.equal(settings.homeCountry,'NG');
 assert.equal((await route('saved-call-lists').POST(request(1700,org.id,{type:'countries',homeCountry:'FR',operatingCountries:['IE','GB']}))).status,200);
 const markets=await (await route('saved-call-lists').GET(request(1700,org.id))).json();assert.equal(markets.homeCountry,'FR');assert.deepEqual(markets.operatingCountries,['IE','GB']);assert.ok(!markets.sources.some(s=>s.code==='NO'));
 assert.equal((await route('saved-call-lists').POST(request(1700,org.id,{type:'countries',homeCountry:'invalid',operatingCountries:['IE']}))).status,400);
 assert.equal((await route('saved-call-lists').POST(request(3,1,{type:'countries',homeCountry:'NG',operatingCountries:['IE']}))).status,403);
 assert.equal((await route('admin').POST(request(1200,1200,{...data,adminEmail:'invalid-country@test.no',homeCountry:'invalid'}))).status,400);
 settings=await (await route('admin').GET(request(1,1))).json();assert.equal(settings.language,'nb');
});

test('outbound customer creation uses local defaults and preserves paid customer attribution',async()=>{
 const owner=sql.prepare("SELECT organization_id,id FROM memberships WHERE user_id='owner'").get();
 for(const [id,paid] of [[9911,false],[9912,true]]){
  const number=paid?'552199912':'552199911';
  add('call_list_entries',{id,organization_id:owner.organization_id,name:'French outbound prospect '+id,country:'FR',org_number:number,created_at:'now',updated_at:'now'});
  add('outbound_deals',{id,organization_id:owner.organization_id,entry_id:id,membership_id:owner.id,pipeline:'Kunde',customer_company_id:paid?id:null,created_at:'now',updated_at:'now'});
  if(paid)add('outbound_deal_payments',{organization_id:owner.organization_id,entry_id:id,membership_id:owner.id,payment_reference:'Frozen customer receipt',paid_amount_minor:100,currency:'EUR',commission_bps:0,created_at:'now'});
  const response=await route('admin').POST(request('owner',owner.organization_id,{type:'organization',name:'French outbound customer '+id,homeCountry:'FR',operatingCountries:['FR'],orgNumber:number+'00013',adminName:'Test admin',adminEmail:`outbound-${id}@test.no`,adminRole:'Administrator',crmPrice:199,outboundEnabled:true}));
  const result=await response.json();assert.equal(response.status,201,JSON.stringify(result));
  assert.equal(result.organization.orgNumber,number);assert.equal(result.organization.outboundEnabled,true);assert.equal(result.organization.outboundCurrency,'EUR');assert.equal(result.organization.outboundTimezone,'Europe/Paris');
  const deal=sql.prepare('SELECT customer_organization_id,customer_company_id,subscription_activated_at FROM outbound_deals WHERE id=?').get(id);
  assert.equal(deal.customer_organization_id,paid?null:result.organization.id);assert.equal(deal.customer_company_id,paid?id:null);assert.equal(deal.subscription_activated_at,'');
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM memberships WHERE organization_id=?').get(result.organization.id).n,1);
 }
});

test('France generation persists official ranges, continues without duplicates and never matches Norway by a shared numeric ID',async()=>{
 add('organizations',{id:1800,name:'French sales',home_country:'FR',operating_countries:'["NO","FR"]',created_at:'now'});
 add('memberships',{id:1800,organization_id:1800,user_id:'1800',email:'1800@test.no',name:'France admin',role:'Administrator',created_at:'now'});
 add('organization_modules',{organization_id:1800,module_key:'ringelister',active:1,price_per_user:0,activated_at:'now'});
 add('module_licenses',{organization_id:1800,membership_id:1800,module_key:'ringelister',active:1,activated_at:'now'});
 add('companies',{id:1800,organization_id:1800,name:'Norwegian company with same numeric ID',country:'NO',org_number:'000000001'});
 const authFetch=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{
  if(new URL(url).hostname!=='recherche-entreprises.api.gouv.fr')return authFetch(url,init);
  const page=Number(url.searchParams.get('page'));
  return Response.json({results:Array.from({length:25},(_,i)=>{const n=(page-1)*25+i+1;return {siren:String(n).padStart(9,'0'),nom_complet:'French company '+n,etat_administratif:'A',statut_diffusion:'O',tranche_effectif_salarie:'11',annee_tranche_effectif_salarie:'2024',activite_principale:'62.01Z',siege:{adresse:'10 RUE DE PARIS 75001 PARIS',code_postal:'75001',libelle_commune:'PARIS',etat_administratif:'A',statut_diffusion_etablissement:'O'}}}),total_pages:20});
 };
 try{
  const generate=()=>route('call-lists').POST(request(1800,1800,{type:'generate',country:'FR',count:2}));
  const firstResponse=await generate();assert.equal(firstResponse.status,200);const first=await firstResponse.json();
  assert.deepEqual(first.entries.map(row=>row.orgNumber),['000000001','000000002']);assert.equal(first.nextPage,1);assert.equal(first.hasMore,true);
  assert.equal(first.entries[0].country,'FR');assert.equal(first.entries[0].employees,null);assert.equal(first.entries[0].employeeRange,'10–19');assert.equal(first.entries[0].employeeRangeYear,'2024');assert.equal(first.entries[0].postalCode,'75001');
  const second=await (await generate()).json();assert.deepEqual(second.entries.map(row=>row.orgNumber),['000000003','000000004']);
  const converted=await route('call-lists').POST(request(1800,1800,{type:'addCustomer',id:first.entries[0].id}));assert.equal(converted.status,200);const customer=(await converted.json()).company;
  assert.equal(customer.country,'FR');assert.notEqual(customer.id,1800);assert.equal(customer.employeeRange,'10–19');assert.equal(customer.employeeRangeYear,'2024');assert.equal(customer.address,'10 RUE DE PARIS 75001 PARIS');assert.equal(customer.employees,null);
  const patched=await route('companies').PATCH(request(1800,1800,{id:customer.id,name:'Updated French company'}));assert.equal(patched.status,200);const edited=(await patched.json()).company;
  assert.equal(edited.country,'FR');assert.equal(edited.employeeRange,'10–19');assert.equal(edited.employeeRangeYear,'2024');assert.equal(edited.address,customer.address);assert.equal(edited.source,customer.source);
  const listing=await (await route('saved-call-lists').GET(request(1800,1800))).json();assert.equal(listing.sources.find(source=>source.code==='FR').ready,true);
  for(let n=5;n<=200;n++)add('companies',{organization_id:1800,name:'Already saved '+n,country:'FR',org_number:String(n).padStart(9,'0')});
  const before=sql.prepare('SELECT count(*) n FROM saved_call_lists WHERE organization_id=1800').get().n;
  const exhaustedWindow=await route('call-lists').POST(request(1800,1800,{type:'generate',country:'FR',count:25,page:1}));assert.equal(exhaustedWindow.status,200);const continuation=await exhaustedWindow.json();assert.equal(continuation.added,0);assert.equal(continuation.nextPage,9);assert.equal(continuation.hasMore,true);assert.equal(continuation.list,undefined);
  assert.equal(sql.prepare('SELECT count(*) n FROM saved_call_lists WHERE organization_id=1800').get().n,before);
  const nextWindow=await route('call-lists').POST(request(1800,1800,{type:'generate',country:'FR',count:25,page:continuation.nextPage}));assert.equal(nextWindow.status,200);const continued=await nextWindow.json();assert.equal(continued.added,25);assert.equal(continued.entries[0].orgNumber,'000000201');assert.equal(continued.nextPage,10);
 }finally{globalThis.fetch=authFetch;}
});

test('France call-list imports normalize establishment SIRETs to SIREN and deduplicate across chunks',async()=>{
 const first=await route('call-lists').POST(request(1800,1800,{type:'import',country:'FR',listName:'French CSV',rows:[{name:'La Poste',orgNumber:'356 000 000 00048'},{name:'Same legal company',orgNumber:'356.000.000'}]}));
 assert.equal(first.status,201);const saved=await first.json();assert.equal(saved.added,1);assert.equal(saved.entries[0].orgNumber,'356000000');assert.equal(saved.entries[0].country,'FR');
 const second=await route('call-lists').POST(request(1800,1800,{type:'import',country:'FR',listId:saved.list.id,rows:[{name:'Same company next CSV chunk',orgNumber:'35600000000066'},{name:'New company',orgNumber:'849239587'}]}));
 assert.equal(second.status,201);const result=await second.json();assert.equal(result.added,1);assert.equal(result.entries[0].orgNumber,'849239587');
 const ids=sql.prepare('SELECT org_number FROM call_list_entries WHERE list_id=? ORDER BY id').all(saved.list.id).map(row=>row.org_number);assert.deepEqual(ids,['356000000','849239587']);
});

test('advanced France imports infer official CSV columns and preserve country, SIREN, addresses and employee bands',async()=>{
 const headers=['nom_complet','SIRET','pays','adresse','code_postal','tranche_effectif_salarie','annee_tranche_effectif_salarie'];
 const mapping=app.guessColumns(headers,'customers');assert.equal(mapping.name,0);assert.equal(mapping.orgNumber,1);assert.equal(mapping.country,2);assert.equal(mapping.address,3);assert.equal(mapping.postalCode,4);assert.equal(mapping.employeeRange,5);assert.equal(mapping.employeeRangeYear,6);
 const row=app.mapImportRow(['Import France SAS','12345678900001','France','10 RUE DE PARIS','75001','11','2024'],mapping);
 add('companies',{organization_id:1800,country:'NO',org_number:'123456789',name:'Norway counterpart'});
 const create=rows=>app.importRoute.POST(request(1800,1800,{mode:'customers',source:'French CSV',requestId:crypto.randomUUID()+'-0',rows}));
 const first=await create([row]);assert.equal(first.status,201);assert.equal((await first.json()).customers,1);
 const company=sql.prepare("SELECT * FROM companies WHERE organization_id=1800 AND country='FR' AND org_number='123456789'").get();assert.equal(company.name,'Import France SAS');assert.equal(company.address,'10 RUE DE PARIS');assert.equal(company.postal_code,'75001');assert.equal(company.employee_range,'10–19');assert.equal(company.employee_range_year,'2024');assert.equal(company.employees,null);
 const duplicate=await create([{name:'Another establishment',orgNumber:'123 456 789 00002',country:'FR'}]);assert.equal(duplicate.status,201);assert.equal((await duplicate.json()).customers,0);
 const defaultCountry=await create([{name:'French tenant default',orgNumber:'98765432100001'}]);assert.equal(defaultCountry.status,201);assert.equal(sql.prepare("SELECT country,org_number FROM companies WHERE name='French tenant default'").get().country,'FR');
 const invalid=await create([{name:'Invalid country',orgNumber:'111111111',country:'ZZ'}]);assert.equal(invalid.status,400);assert.equal(sql.prepare("SELECT count(*) n FROM companies WHERE name='Invalid country'").get().n,0);
});

test('advanced imports retain international alphanumeric IDs and link foreign contacts without digit collisions',async()=>{
 const create=rows=>app.importRoute.POST(request(1800,1800,{mode:'customers',source:'International CSV',requestId:crypto.randomUUID()+'-0',rows}));
 const first=await create([{name:'UK Scotland','orgNumber':' sc 001234 ','country':'GB'},{name:'UK Wales',orgNumber:'WC001234',country:'GB'}]);assert.equal(first.status,201);assert.equal((await first.json()).customers,2);
 const firms=sql.prepare("SELECT id,org_number,country FROM companies WHERE organization_id=1800 AND name IN ('UK Scotland','UK Wales') ORDER BY name").all();assert.deepEqual(firms.map(f=>f.org_number),['SC001234','WC001234']);
 const duplicate=await create([{name:'Duplicate UK','orgNumber':'SC001234',country:'GB'}]);assert.equal((await duplicate.json()).customers,0);
 const contacts=await app.importRoute.POST(request(1800,1800,{mode:'contacts',source:'International CSV',requestId:crypto.randomUUID()+'-0',rows:[{companyReference:'sc 001234',contactName:'Foreign reference contact'}]}));assert.equal(contacts.status,201);assert.equal((await contacts.json()).contacts,1);
 assert.equal(sql.prepare("SELECT company_id FROM contacts WHERE name='Foreign reference contact'").get().company_id,firms[0].id);
 const frenchContact=await app.importRoute.POST(request(1800,1800,{mode:'contacts',source:'French CSV',requestId:crypto.randomUUID()+'-0',rows:[{companyReference:'12345678900002',country:'FR',contactName:'French SIRET contact'}]}));assert.equal(frenchContact.status,201);const linked=sql.prepare("SELECT c.country,c.org_number FROM contacts p JOIN companies c ON p.company_id=c.id WHERE p.name='French SIRET contact'").get();assert.equal(linked.country,'FR');assert.equal(linked.org_number,'123456789');
 const norwegian=await create([{name:'Norwegian VAT format',orgNumber:'NO 555-444-333 MVA',country:'NO'}]);assert.equal(norwegian.status,201);assert.equal((await norwegian.json()).customers,1);assert.equal(sql.prepare("SELECT org_number FROM companies WHERE name='Norwegian VAT format'").get().org_number,'555444333');
 const norwegianDuplicate=await create([{name:'Formatted existing Norway',orgNumber:'NO 123.456.789 MVA',country:'NO'}]);assert.equal((await norwegianDuplicate.json()).customers,0);
});
