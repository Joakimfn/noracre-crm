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
const routes=['meta/start','meta/callback','meta/accounts','connections','publish','media'];
await build({stdin:{contents:routes.map((r,i)=>`export * as r${i} from './app/api/social/${r}/route';`).join('\n')+`\nexport * as schema from './db/schema';export * as meta from './lib/social-meta';export {guardRequest} from './lib/request-security';export {jpegDimensions,publishMeta} from './lib/social-publish';`,resolveDir:root},bundle:true,format:'esm',platform:'node',packages:'external',outfile:path.join(dir,'app.mjs'),nodePaths:[path.join(root,'node_modules')],plugins:[{name:'test',setup(b){
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
const original=globalThis.fetch;let calls=[],failure=false;
const permissions=['pages_show_list','pages_read_engagement','pages_manage_posts','instagram_basic','instagram_content_publish'];
globalThis.fetch=async(input,init)=>{
 const url=new URL(String(input));if(url.origin==='https://auth.test'){const id=init.headers.Authorization.slice(7);return Response.json({id,email:`${id}@test.no`,email_confirmed_at:'now'});}
 assert.equal(init.redirect,'manual');assert.equal(url.origin,'https://graph.facebook.com');calls.push({url,init});
 const p=url.pathname.replace('/v24.0/','');
 if(p==='oauth/access_token')return Response.json({access_token:'private-user-token',expires_in:5000000});
 if(p==='me/permissions')return Response.json({data:permissions.map(permission=>({permission,status:'granted'}))});
 if(p==='me/accounts')return Response.json({data:[{id:'111',name:'Org page',access_token:'private-page-token',tasks:['CREATE_CONTENT'],instagram_business_account:{id:'222',username:'org_instagram'}}]});
 if(p==='111'||p==='222')return Response.json({id:p});
 if(p==='111/feed')return Response.json({id:'111_333'});
 if(p==='111/photos')return Response.json({id:'444'});
 if(p==='222/media')return Response.json({id:'555'});
 if(p==='555')return Response.json({status_code:'FINISHED'});
 if(p==='222/media_publish')return failure?Response.json({error:{code:2,message:'private-page-token'}},{status:500}):Response.json({id:'666'});
 throw Error('Unexpected request '+p);
};
const route=p=>app['r'+routes.indexOf(p)];
const targets=()=>sql.prepare('select id,account_id as accountId,platform from social_connections').all();
const req=(p,user=1,org=user,body,method=body?'POST':'GET')=>new Request('https://crm.noracre.no/api/social/'+p,{method,headers:{authorization:'Bearer '+user,'x-organization-id':String(org),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
async function start(){const r=await route('meta/start').POST(req('meta/start',1,1,{}));assert.equal(r.status,200);const d=await r.json();return {...d,state:new URL(d.url).searchParams.get('state'),cookie:r.headers.get('set-cookie').split(';')[0]};}
const callback=(f,cookie=f.cookie)=>route('meta/callback').GET(new Request('https://crm.noracre.no/api/social/meta/callback?'+new URLSearchParams({state:f.state,code:'test-code'}),{headers:{cookie}}));
let flow;
test('ordinary users and foreign tenants cannot manage connections',async()=>{
 for(const [u,o] of [[3,1],[1,2]]){
  assert.equal((await route('meta/start').POST(req('meta/start',u,o,{}))).status,403);
  assert.equal((await route('connections').DELETE(req('connections?id=1',u,o,undefined,'DELETE'))).status,403);
 }
});
test('unconfigured Meta fails closed',async()=>{
 const secret=testEnv.META_APP_SECRET;delete testEnv.META_APP_SECRET;
 assert.equal((await route('meta/start').POST(req('meta/start',1,1,{}))).status,503);testEnv.META_APP_SECRET=secret;
});
test('Meta redirects are rejected without forwarding credentials',async()=>{
 const normal=globalThis.fetch;let count=0;
 globalThis.fetch=async(input,init)=>{count++;assert.equal(new URL(String(input)).origin,'https://graph.facebook.com');assert.equal(init.redirect,'manual');return new Response(null,{status:302,headers:{location:'https://untrusted.test/'}});};
 try {await assert.rejects(app.meta.graph('me/accounts','private-token'),app.meta.MetaError);assert.equal(count,1);}finally{globalThis.fetch=normal;}
});
test('OAuth diagnostics identify the failing stage without exposing provider secrets',async()=>{
 const normal=globalThis.fetch;
 for(const target of ['oauth/access_token','me/permissions','me/accounts']){
  const f=await start();
  globalThis.fetch=async(input,init)=>String(input).includes('/'+target)?Response.json({error:{code:190,message:'SECRET token=private-page-token'}},{status:400}):normal(input,init);
  try {assert.equal((await callback(f)).status,400);} finally {globalThis.fetch=normal;}
  const result=await route('meta/accounts').GET(req('meta/accounts?id='+f.id));
  const data=await result.json();
  assert.equal(data.stage,{'oauth/access_token':'code_exchange','me/permissions':'permissions','me/accounts':'pages'}[target]);
  assert.match(data.error,/190/);assert.doesNotMatch(JSON.stringify(data),/SECRET|private-page-token/);
  assert.doesNotMatch(sql.prepare('select payload from social_oauth where id=?').get(f.id).payload,/SECRET|private-page-token/);
  assert.equal((await route('meta/accounts').GET(req('meta/accounts?id='+f.id,2,2))).status,404);
  const own=await (await route('connections').GET(req('connections'))).json();
  assert.equal(own.connectionError,data.error);
  for(const [user,org] of [[2,2],[3,1]]) {
    const other=await (await route('connections').GET(req('connections',user,org))).json();
    assert.equal(other.connectionError,undefined);
  }

 }
});
test('repeated exchange verifies missing lifetime through Meta and bounds expiry',async()=>{
 const normal=globalThis.fetch, now=Math.floor(Date.now()/1000);
 let debug={is_valid:true,app_id:'123',type:'USER',expires_at:now+10000,data_access_expires_at:now+5000};
 globalThis.fetch=async(input,init)=>{
   const u=new URL(String(input));
   if(u.pathname.endsWith('/oauth/access_token'))return Response.json({access_token:'private-user-token'});
   if(u.pathname.endsWith('/debug_token')) {
     assert.equal(u.searchParams.get('input_token'),'private-user-token');
     assert.equal(init.headers.Authorization,'Bearer 123|'+testEnv.META_APP_SECRET);
     return Response.json({data:debug});
   }
   return normal(input,init);
 };
 try {
   assert.equal((await app.meta.discoverAccounts('code')).expiresAt,(now+5000)*1000);
   for(const patch of [{is_valid:false},{app_id:'other'},{type:'PAGE'},{expires_at:now-1},{data_access_expires_at:now-1},{expires_at:undefined}]) {
     const saved=debug;debug={...saved,...patch};
     await assert.rejects(app.meta.discoverAccounts('code'),app.meta.MetaError);debug=saved;
   }
   debug={...debug,expires_at:0,data_access_expires_at:0};
   const before=Date.now();const result=await app.meta.discoverAccounts('code');
   assert.ok(result.expiresAt>=before+60*86400000 && result.expiresAt<=Date.now()+60*86400000);
 } finally {globalThis.fetch=normal;}
});
test('OAuth state is bound to browser, is one-use, and callback never selects accounts',async()=>{
 flow=await start();assert.equal((await callback(flow,'')).status,400);assert.equal(sql.prepare('select status from social_oauth where id=?').get(flow.id).status,'waiting');
 assert.equal((await callback(flow)).status,200);const n=calls.length;
 assert.equal((await callback(flow)).status,400);assert.equal(calls.length,n);
 assert.equal(sql.prepare('select count(*) n from social_connections').get().n,0);
 assert.ok(!sql.prepare('select payload from social_oauth').get().payload.includes('private-page-token'));
});
test('pending accounts omit secrets and are scoped to initiating member and organization',async()=>{
 assert.equal((await route('meta/accounts').GET(req('meta/accounts?id='+flow.id,2,2))).status,404);
 const r=await route('meta/accounts').GET(req('meta/accounts?id='+flow.id));const d=await r.json();assert.equal(d.status,'ready');assert.equal(d.pages[0].instagram.id,'222');assert.ok(!JSON.stringify(d).includes('token'));
 assert.equal((await route('meta/accounts').POST(req('meta/accounts',1,1,{id:flow.id,pageId:'999',platforms:['Facebook']}))).status,400);
 assert.equal((await route('meta/accounts').POST(req('meta/accounts',1,1,{id:flow.id,pageId:'111',platforms:['X']}))).status,400);
});
test('explicit choice persists only encrypted scoped credentials',async()=>{
 assert.equal((await route('meta/accounts').POST(req('meta/accounts',1,1,{id:flow.id,pageId:'111',platforms:['Facebook','Instagram']}))).status,200);
 const c=sql.prepare('select * from social_connections limit 1').get();assert.notEqual(c.token,'private-page-token');
 assert.equal(await app.meta.unseal(c.token,app.meta.tokenContext(1,c.platform,c.account_id)),'private-page-token');
 await assert.rejects(app.meta.unseal(c.token,app.meta.tokenContext(2,c.platform,c.account_id)));
 assert.equal(sql.prepare('select count(*) n from social_oauth').get().n,0);
 const response=await route('connections').GET(req('connections',3,1));const d=await response.json();assert.equal(d.connections.length,2);assert.ok(!JSON.stringify(d).includes('token'));
});
test('deactivated administrators cannot complete OAuth',async()=>{
 const f=await start();sql.exec('update memberships set active=0 where id=1');const n=calls.length;
 assert.equal((await callback(f)).status,400);assert.equal(calls.length,n);sql.exec('update memberships set active=1 where id=1');
});
const post=(id,platforms=['Facebook'])=>add('marketing_posts',{id,organization_id:1,content:'Test content',platforms:JSON.stringify(platforms),created_by:'test',created_at:'now',updated_at:'now'});
test('publishing requires explicit confirmation and tenant membership',async()=>{
 post(1);
 assert.equal((await route('publish').POST(req('publish',1,1,{postId:1}))).status,400);
 assert.equal((await route('publish').POST(req('publish',2,2,{postId:1,confirm:true,targets:targets()}))).status,404);
});
test('publishing rejects a target changed after the confirmation was shown',async()=>{
 const n=calls.length;
 assert.equal((await route('publish').POST(req('publish',1,1,{postId:1,confirm:true,targets:[{id:999,platform:'Facebook',accountId:'other'}]}))).status,409);
 assert.equal(calls.length,n);
});
test('parallel or retried publishing sends only one Facebook post',async()=>{
 const before=calls.filter(c=>c.url.pathname.endsWith('/feed')).length;
 const results=await Promise.all([route('publish').POST(req('publish',3,1,{postId:1,confirm:true,targets:targets()})),route('publish').POST(req('publish',3,1,{postId:1,confirm:true,targets:targets()}))]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 assert.equal(calls.filter(c=>c.url.pathname.endsWith('/feed')).length-before,1);
 assert.equal(sql.prepare('select status from marketing_posts where id=1').get().status,'Publisert');
});
test('unsupported channels and invalid Instagram images fail before publishing',async()=>{
 post(2,['Snapchat']);post(3,['Instagram']);const before=calls.length;
 for(const postId of [2,3])assert.equal((await route('publish').POST(req('publish',1,1,{postId,confirm:true}))).status,400);
 assert.equal(calls.length,before);
 assert.equal(app.jpegDimensions(new Uint8Array([255,216,255,192,0,0])),null);
});
test('Instagram uses container status then publish; uncertain response is never retried',async()=>{
 const before=calls.length;failure=true;
 await assert.rejects(app.publishMeta('Instagram','222','private-page-token','Caption',['https://crm.noracre.no/api/social/media?signature=test']),e=>e.uncertain===true&&!e.message.includes('private-page-token'));
 assert.deepEqual(calls.slice(before).map(c=>c.url.pathname.split('/').slice(2).join('/')),['222/media','555','222/media_publish']);failure=false;
});
test('media signatures bind organization, image and post with expiry',async()=>{
 const expires=Date.now()+60000,signature=await app.meta.signMedia(1,7,1,expires);
 assert.equal(await app.meta.verifyMedia(1,7,1,expires,signature),true);
 for(const values of [[2,7,1,expires],[1,8,1,expires],[1,7,2,expires],[1,7,1,expires+1],[1,7,1,Date.now()-1]])assert.equal(await app.meta.verifyMedia(...values,signature),false);
 assert.equal((await route('media').GET(new Request('https://crm.noracre.no/api/social/media?image=7'))).status,403);
});
test('partial multi-channel results are recorded and cannot be retried into duplicates',async()=>{
 post(10,['Facebook','Instagram']);
 add('marketing_post_images',{id:7,organization_id:1,post_id:10,object_key:'test-image',filename:'test.jpg',content_type:'image/jpeg',size:12,created_at:'now'});
 testEnv.BUCKET.get=async()=>({body:'jpeg',arrayBuffer:async()=>new Uint8Array([255,216,255,192,0,8,8,2,128,2,128,1]).buffer});
 failure=true;
 const result=await route('publish').POST(req('publish',1,1,{postId:10,confirm:true,targets:targets()}));
 assert.equal(result.status,200);const data=await result.json();assert.equal(data.status,'Delvis publisert');assert.deepEqual(data.results.map(r=>r.status),['published','unknown']);assert.ok(!JSON.stringify(data).includes('private-page-token'));
 const callsBefore=calls.length;
 assert.equal((await route('publish').POST(req('publish',1,1,{postId:10,confirm:true,targets:targets()}))).status,409);
 assert.equal(calls.slice(callsBefore).filter(c=>c.init.method==='POST').length,0);
 failure=false;
});
test('signed media requires the exact image tenant and an active linked delivery',async()=>{
 const expires=Date.now()+60000,signature=await app.meta.signMedia(1,7,10,expires);
 const request=new Request('https://crm.noracre.no/api/social/media?'+new URLSearchParams({org:'1',image:'7',post:'10',expires:String(expires),signature}));
 assert.equal((await route('media').GET(request)).status,200);
 sql.exec("update social_connections set expires_at=0");
 assert.equal((await route('media').GET(request)).status,404);
 sql.prepare('update social_connections set expires_at=?').run(Date.now()+600000);
});
test('only GET callback and signed media bypass bearer gate; handlers still validate',async()=>{
 for(const p of ['meta/callback','media']){
   const request=new Request('https://crm.noracre.no/api/social/'+p);assert.ok(await app.guardRequest(request) instanceof Request);
   assert.equal((await app.guardRequest(new Request(request,{method:'POST'}))).status,401);
 }
 assert.equal((await app.guardRequest(new Request('https://crm.noracre.no/api/social/meta/accounts'))).status,401);
});
test('prepared JPEG replaces an existing PNG draft only after validation, then sends both channels once',async()=>{
 post(90,['Instagram','Facebook']);
 add('marketing_post_images',{id:90,organization_id:1,post_id:90,object_key:'old-png',filename:'logo.png',content_type:'image/png',size:900,created_at:'now'});
 const jpeg=new Uint8Array([255,216,255,192,0,8,8,1,64,1,64,1]);
 let uploaded=[];testEnv.BUCKET.put=async(key,bytes,options)=>{uploaded.push({key,bytes,options});};
 const send=(imageId,blob)=>{
  const form=new FormData();form.append('payload',JSON.stringify({postId:90,confirm:true,targets:targets()}));form.append(`image:${imageId}`,blob,'prepared.jpg');
  return route('publish').POST(new Request('https://crm.noracre.no/api/social/publish',{method:'POST',headers:{authorization:'Bearer 1','x-organization-id':'1'},body:form}));
 };
 let before=calls.length;
 assert.equal((await send(7,new Blob([jpeg],{type:'image/jpeg'}))).status,400);
 assert.equal((await send(90,new Blob(['not a jpeg'],{type:'image/jpeg'}))).status,400);
 assert.equal(calls.length,before);assert.equal(uploaded.length,0);
 testEnv.BUCKET.put=async()=>{throw Error('Storage unavailable')};
 assert.equal((await send(90,new Blob([jpeg],{type:'image/jpeg'}))).status,503);
 assert.equal(sql.prepare('SELECT status FROM marketing_posts WHERE id=90').get().status,'Kladd');
 assert.equal(calls.slice(before).filter(c=>c.init.method==='POST').length,0);
 testEnv.BUCKET.put=async(key,bytes,options)=>{uploaded.push({key,bytes,options});};
 const result=await send(90,new Blob([jpeg],{type:'image/jpeg'}));assert.equal(result.status,200);assert.equal((await result.json()).status,'Publisert');
 assert.equal(uploaded.length,1);assert.equal(uploaded[0].options.httpMetadata.contentType,'image/jpeg');
 const stored=sql.prepare('SELECT content_type,filename,object_key FROM marketing_post_images WHERE id=90').get();assert.equal(stored.content_type,'image/jpeg');assert.equal(stored.filename,'logo.jpg');assert.equal(stored.object_key,uploaded[0].key);
 before=calls.length;assert.equal((await send(90,new Blob([jpeg],{type:'image/jpeg'}))).status,409);assert.equal(calls.slice(before).filter(c=>c.init.method==='POST').length,0);assert.equal(uploaded.length,1);
});

test('disconnect is tenant-scoped and removes stored credential',async()=>{
 const row=sql.prepare("select id from social_connections where platform='Facebook'").get();
 await route('connections').DELETE(req('connections?id='+row.id,2,2,undefined,'DELETE'));
 assert.ok(sql.prepare('select id from social_connections where id=?').get(row.id));
 await route('connections').DELETE(req('connections?id='+row.id,1,1,undefined,'DELETE'));
 assert.equal(sql.prepare('select id from social_connections where id=?').get(row.id),undefined);
});
test.after(()=>{globalThis.fetch=original;sql.close();return rm(dir,{recursive:true,force:true});});


