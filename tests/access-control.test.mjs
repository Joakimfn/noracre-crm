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
const routes=['companies','activities','contacts','attachments','admin','marketing','marketing-images','call-lists','offers','export','session'];
await build({stdin:{contents:routes.map((r,i)=>`export * as route${i} from './app/api/${r}/route';`).join('\n')+`\nexport * as schema from './db/schema';\nexport {getChatGPTUser} from './app/chatgpt-auth';\nexport {reminderIsDue} from './lib/followup-reminder';`,resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'routes.mjs'),packages:'external',plugins:[{name:'test-runtime',setup(b){
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
test.after(()=>{globalThis.fetch=realFetch;sql.close();return rm(dir,{recursive:true,force:true})});
