import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {drizzle} from 'drizzle-orm/sqlite-proxy';
import {getTableConfig} from 'drizzle-orm/sqlite-core';
import {mkdtemp,symlink,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),dir=await mkdtemp(path.join(tmpdir(),'noracre-social-'));
const routes=['insights'];
await build({stdin:{contents:routes.map((r,i)=>`export * as r${i} from './app/api/social/${r}/route';`).join('\n')+`\nexport * as schema from './db/schema';export * as meta from './lib/social-meta';export {guardRequest} from './lib/request-security';export * as insights from './lib/social-insights';export * as linkedin from './lib/social-linkedin';`,resolveDir:root},bundle:true,format:'esm',platform:'node',packages:'external',outfile:path.join(dir,'app.mjs'),nodePaths:[path.join(root,'node_modules')],plugins:[{name:'test',setup(b){
 b.onResolve({filter:/^@\/db$/},()=>({path:'db',namespace:'test'}));b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));
 b.onResolve({filter:/^next\//},args=>({path:args.path,namespace:'next-test'}));
 b.onLoad({filter:/.*/,namespace:'next-test'},()=>({contents:'export const headers=async()=>new Headers();export const redirect=()=>{};'}));
 b.onLoad({filter:/.*/,namespace:'test'},({path:p})=>({contents:p==='db'?'export const getDb=()=>globalThis.testDb':'export const env=globalThis.testEnv'}));
}}]});
await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'));
globalThis.testEnv={SUPABASE_URL:'https://auth.test',SUPABASE_ANON_KEY:'public',META_APP_ID:'123',META_APP_SECRET:'test-only-secret-not-production-12345',META_GRAPH_VERSION:'v24.0',BUCKET:{get:async()=>({body:'image bytes'})}};
const app=await import(pathToFileURL(path.join(dir,'app.mjs'))),sql=new DatabaseSync(':memory:');
for(const table of Object.values(app.schema)){
 const c=getTableConfig(table);if(c.name.startsWith('social_'))continue;
 const cols=c.columns.map(col=>`"${col.name}" ${col.getSQLType()}${col.primary?' PRIMARY KEY':''}${col.notNull?' NOT NULL':''}${col.default!==undefined?' DEFAULT '+(typeof col.default==='string'?"'"+col.default.replaceAll("'","''")+"'":Number(col.default)):''}`);
 sql.exec(`CREATE TABLE "${c.name}" (${cols.join(',')})`);
}
sql.exec(await readFile(path.join(root,'drizzle/0015_social_meta.sql'),'utf8'));
globalThis.testDb=drizzle(async(query,params,method)=>{const s=sql.prepare(query);s.setReturnArrays(true);return {rows:method==='run'?(s.run(...params),[]):method==='get'?s.get(...params):s.all(...params)}});
const add=(table,obj)=>{const keys=Object.keys(obj);sql.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...Object.values(obj));};
for(const id of [1,2]){
 add('organizations',{id,name:'Org '+id,created_at:'now'});
 add('memberships',{id,organization_id:id,user_id:String(id),email:`${id}@test.no`,name:'Admin',role:'Administrator',created_at:'now'});
 add('organization_modules',{organization_id:id,module_key:'markedsforing',active:1,activated_at:'now'});
 add('module_licenses',{organization_id:id,membership_id:id,module_key:'markedsforing',active:1,activated_at:'now'});
}
add('memberships',{id:3,organization_id:1,user_id:'3',email:'3@test.no',name:'User',role:'Bruker',created_at:'now'});
add('module_licenses',{organization_id:1,membership_id:3,module_key:'markedsforing',active:1,activated_at:'now'});

let calls=[];let mode='ok';
globalThis.testEnv.LINKEDIN_CLIENT_ID='testclient123';globalThis.testEnv.LINKEDIN_CLIENT_SECRET='test-only-linkedin-secret123';
globalThis.fetch=async(input,init)=>{
 const url=new URL(String(input));
 if(url.origin==='https://auth.test'){const id=init.headers.Authorization.slice(7);return Response.json({id,email:`${id}@test.no`,email_confirmed_at:'now'});}
 assert.equal(init.redirect,'manual');assert.ok(!url.searchParams.has('access_token'));assert.equal(init.method,'GET');calls.push({url,init});
 if(url.origin==='https://api.linkedin.com')return Response.json({elements:[{share:'urn:li:share:333',totalShareStatistics:{impressionCount:40,likeCount:2,commentCount:3,shareCount:4,clickCount:999,engagement:12}}]});
 assert.equal(url.origin,'https://graph.facebook.com');
 const metric=url.searchParams.get('metric');
 if(mode==='permission'&&metric)return Response.json({error:{code:200,message:'private-page-token'}},{status:403});
 if(mode==='expired')return Response.json({error:{code:190,message:'private-page-token'}},{status:400});
 if(mode==='empty'&&metric)return Response.json({data:[]});
 if(mode==='zero'&&metric)return Response.json({data:[{name:metric,values:[{value:0}]}]});
 if(mode==='malformed'&&metric)return Response.json({data:[{name:metric,values:[{value:'20'}]}]});
 if(metric)return Response.json({data:[{name:metric,values:[{value:metric==='total_interactions'?7:20}]}]});
 return Response.json({id:url.pathname.split('/').at(-1),reactions:{summary:{total_count:2}},comments:{summary:{total_count:3}},shares:{count:4}});
};
const req=(query='',user=1,org=1)=>new Request('https://crm.noracre.no/api/social/insights'+query,{headers:{authorization:'Bearer '+user,'x-organization-id':String(org)}});
const get=async(query='',user=1,org=1)=>{const r=await app.r0.GET(req(query,user,org));return {status:r.status,data:await r.json()};};
const now=()=>new Date().toISOString();
const addDelivery=(id,org=1,platform='Facebook',account='111',created=now(),status='published')=>add('social_deliveries',{id,organization_id:org,post_id:id,platform,account_id:account,status,remote_id:platform==='Instagram'?'666':'111_'+id,created_at:created});
for(const [id,platform,account] of [[1,'Facebook','111'],[2,'Instagram','222']])add('social_connections',{id,organization_id:1,platform,account_id:account,account_name:'Test',page_id:'111',token:await app.meta.seal('private-page-token',app.meta.tokenContext(1,platform,account)),expires_at:Date.now()+86400000,connected_by:1,updated_at:now()});
addDelivery(1);addDelivery(2,1,'Instagram','222');addDelivery(3,2);addDelivery(4,1,'Facebook','111',new Date(Date.now()-31*86400000).toISOString());addDelivery(5,1,'Facebook','111',now(),'failed');

test('insights enforce tenant/module access before reading provider data',async()=>{
 calls=[];assert.equal((await get('',1,2)).status,403);assert.equal(calls.length,0);
 sql.exec("UPDATE module_licenses SET active=0 WHERE membership_id=3");
 assert.equal((await get('',3,1)).status,403);assert.equal(calls.length,0);
 sql.exec("UPDATE module_licenses SET active=1 WHERE membership_id=3");
 assert.equal((await get('',3,1)).status,200);
});
test('only published deliveries from this tenant in the last 30 days are included',async()=>{
 calls=[];const {status,data}=await get();assert.equal(status,200);assert.deepEqual(data.entries.map(e=>e.id),[1,2]);assert.equal(data.nextCursor,null);
 assert.equal(data.entries[0].views.value,20);assert.equal(data.entries[0].engagement.value,9);assert.equal(data.entries[1].engagement.value,7);
 assert.ok(calls.some(c=>c.url.searchParams.get('metric')==='post_media_view'));assert.ok(calls.some(c=>c.url.searchParams.get('metric')==='views'));
 assert.ok(!JSON.stringify(data).includes('private-page-token'));assert.ok(!JSON.stringify(data).includes('click'));
});
test('partial permission errors retain accessible engagement without inventing views',async()=>{
 mode='permission';const {data}=await get();assert.deepEqual(data.entries[0].views,{value:null,reason:'permission'});assert.equal(data.entries[0].engagement.value,9);assert.equal(data.entries[1].engagement.value,null);
 assert.ok(!JSON.stringify(data).includes('private-page-token'));mode='ok';
});
test('empty and malformed responses differ from genuine zero',async()=>{
 for(const m of ['empty','malformed']){mode=m;const {data}=await get();assert.equal(data.entries[0].views.value,null);assert.equal(data.entries[0].views.reason,'unavailable');}
 mode='zero';assert.deepEqual((await get()).data.entries[0].views,{value:0,reason:null});mode='ok';
});
test('revoked tokens and replaced accounts request reconnection',async()=>{
 mode='expired';assert.equal((await get()).data.entries[0].views.reason,'reconnect');mode='ok';
 sql.exec("UPDATE social_connections SET account_id='999' WHERE id=1");calls=[];
 assert.equal((await get()).data.entries[0].views.reason,'reconnect');assert.ok(calls.every(c=>!c.url.pathname.includes('111_')));
 sql.exec("UPDATE social_connections SET account_id='111' WHERE id=1");
});
test('bounded pages have stable boundaries and no missing or duplicate deliveries',async()=>{
 for(let id=6;id<=18;id++)addDelivery(id);
 let cursor=0,until='',ids=[];do{const {data}=await get('?'+new URLSearchParams({cursor:String(cursor),...(until?{until}:{})}));assert.ok(data.entries.length<=6);ids.push(...data.entries.map(e=>e.id));until=data.until;cursor=data.nextCursor;}while(cursor!==null);
 assert.equal(new Set(ids).size,15);assert.equal(ids.length,15);assert.ok(!ids.includes(3));
 assert.equal((await get('?cursor=-1')).status,400);assert.equal((await get('?until=nope')).status,400);
});
test('LinkedIn stats use the exact saved post and exclude click counts',async()=>{
 const result=await app.insights.fetchPostInsights('LinkedIn','777','urn:li:share:333','test-li-token');
 assert.equal(result.views.value,40);assert.equal(result.engagement.value,9);
 const query=calls.at(-1).url.searchParams;assert.equal(query.get('shares'),'List(urn:li:share:333)');assert.equal(query.get('organizationalEntity'),'urn:li:organization:777');
 const invalid=await app.insights.fetchPostInsights('LinkedIn','777','https://evil.test','test-li-token');assert.equal(invalid.views.value,null);
});
test('unreadable encrypted tokens never leave this tenant',async()=>{
 sql.exec("UPDATE social_connections SET token='invalid' WHERE id=1");calls=[];
 const {data}=await get();assert.equal(data.entries[0].views.reason,'reconnect');assert.ok(calls.every(c=>!c.url.pathname.includes('111_')));
});
test.after(async()=>{sql.close();await rm(dir,{recursive:true,force:true});});
