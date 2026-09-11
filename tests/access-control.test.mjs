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
const routes=['companies','activities','contacts','attachments','admin','marketing','marketing-images','call-lists','offers','export','session','profile','company-lookup','superadmin','operations'];
await build({stdin:{contents:routes.map((r,i)=>`export * as route${i} from './app/api/${r}/route';`).join('\n')+`\nexport * as schema from './db/schema';\nexport {getChatGPTUser} from './app/chatgpt-auth';\nexport {reminderIsDue} from './lib/followup-reminder';\nexport {validateImage,safeImageType} from './lib/safe-image';\nexport {guardRequest,secureResponse} from './lib/request-security';\nexport {apiFetch} from './lib/api-client';`,resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'routes.mjs'),packages:'external',plugins:[{name:'test-runtime',setup(b){
 b.onResolve({filter:/^@\/db$/},()=>({path:'db',namespace:'test'}));
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));
 b.onResolve({filter:/^next\//},args=>({path:args.path,namespace:'test'}));
 b.onLoad({filter:/.*/,namespace:'test'},({path:p})=>({contents:p==='db'?'export const getDb=()=>globalThis.testDb':p==='env'?'export const env={SUPABASE_URL:"https://auth.test",SUPABASE_ANON_KEY:"public",BUCKET:{get(){throw Error("Unexpected bucket access")}}}':'export const headers=async()=>new Headers({"oai-authenticated-user-email":"joakimfn@gmail.com"});export const redirect=()=>{};'}));
}}],nodePaths:[path.join(root,'node_modules')]});
// External packages resolve from the repository, not the temporary directory.
const {symlink}=await import('node:fs/promises');await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'));
const app=await import(pathToFileURL(path.join(dir,'routes.mjs')));
const sql=new DatabaseSync(':memory:');
for(const table of Object.values(app.schema)){
 const c=getTableConfig(table);
 const cols=c.columns.map(col=>`"${col.name}" ${col.getSQLType()}${col.primary?' PRIMARY KEY':''}${col.notNull?' NOT NULL':''}${col.default!==undefined?' DEFAULT '+(typeof col.default==='string'?"'"+col.default.replaceAll("'","''")+"'":Number(col.default)):''}`);
 sql.exec(`CREATE TABLE "${c.name}" (${cols.join(',')})`);
}
globalThis.testDb=drizzle(async(query,params,method)=>{const s=sql.prepare(query);s.setReturnArrays(true);return {rows:method==='run'?(s.run(...params),[]):method==='get'?s.get(...params):s.all(...params)}});
const add=(table,values)=>{const keys=Object.keys(values);sql.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...Object.values(values));};
for(const id of [1,2]){add('organizations',{id,name:'Org '+id,created_at:'2026-01-01'});add('companies',{id,organization_id:id,name:'Customer '+id});add('contacts',{id,organization_id:id,company_id:id,name:'Contact '+id,created_at:'2026-01-01'});add('activities',{id,organization_id:id,company_id:id,kind:'Telefon'});}
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
test('only selected users receive module access and catalog stays private',async()=>{
 for(const moduleKey of ['ringelister','markedsforing'])assert.equal((await route('admin').POST(request(1,1,{type:'moduleStatus',moduleKey,membershipIds:[3]}))).status,200);
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
 for(const channel of ['Facebook','Instagram','LinkedIn','X','Snapchat']){
   const response=await send([channel]);assert.equal(response.status,201);
   const {post}=await response.json();assert.equal(post.status,'Kladd');assert.deepEqual(JSON.parse(post.platforms),[channel]);
 }
 for(const channels of [['Google Ads'],['unknown'],[]])assert.equal((await send(channels)).status,400);
});

test('operations data is unavailable to ordinary users and administrators',async()=>{
 for(const id of [1,3])assert.equal((await route('operations').GET(request(id))).status,403);
});
test('two followups survive unrelated customer edits and completing one preserves the other',async()=>{
 const create=async(id,note,dueAt)=>{const r=await route('activities').POST(request(id,1,{companyId:1,companyName:'Customer 1',contactId:1,isTask:true,note,dueAt}));assert.equal(r.status,201);return (await r.json()).activity;};
 const first=await create(1,'Meeting with contact A','2027-01-02T09:00');
 const second=await create(3,'Meeting with contact B','2027-01-03T10:00');
 assert.equal(first.createdBy,'1@test.no');assert.equal(second.createdBy,'3@test.no');
 const save=await route('companies').PATCH(request(1,1,{id:1,name:'Customer 1',note:'New note',nextActionDate:''}));assert.equal(save.status,200);
 assert.equal(sql.prepare('SELECT count(*) n FROM activities WHERE id IN (?,?) AND completed_at=\'\'').get(first.id,second.id).n,2);
 const done=await route('activities').PATCH(request(1,1,{id:first.id,completedAt:new Date().toISOString()}));assert.equal(done.status,200);
 assert.equal(sql.prepare('SELECT completed_at FROM activities WHERE id=?').get(second.id).completed_at,'');
 assert.equal(sql.prepare('SELECT due_at FROM activities WHERE id=?').get(first.id).due_at,first.dueAt);
 assert.equal(sql.prepare('SELECT next_action_date FROM companies WHERE id=1').get().next_action_date,second.dueAt);
 const edit=await route('activities').PATCH(request(3,1,{id:second.id,note:'Changed'}));assert.equal(edit.status,200);
 assert.equal((await edit.json()).activity.createdBy,'3@test.no');
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
test.after(()=>{globalThis.fetch=realFetch;sql.close();return rm(dir,{recursive:true,force:true})});

