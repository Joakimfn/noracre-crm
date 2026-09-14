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
const routes=['linkedin/start','linkedin/callback','linkedin/accounts','meta/start','meta/callback','meta/accounts','connections','publish'];
await build({stdin:{contents:routes.map((r,i)=>`export * as r${i} from './app/api/social/${r}/route';`).join('\n')+`\nexport * as schema from './db/schema';export * as meta from './lib/social-meta';export * as linkedin from './lib/social-linkedin';export {guardRequest} from './lib/request-security';export {jpegDimensions,publishMeta} from './lib/social-publish';`,resolveDir:root},bundle:true,format:'esm',platform:'node',packages:'external',outfile:path.join(dir,'app.mjs'),nodePaths:[path.join(root,'node_modules')],plugins:[{name:'test',setup(b){
 b.onResolve({filter:/^@\/db$/},()=>({path:'db',namespace:'test'}));b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));
 b.onResolve({filter:/^next\//},args=>({path:args.path,namespace:'next-test'}));
 b.onLoad({filter:/.*/,namespace:'next-test'},()=>({contents:'export const headers=async()=>new Headers();export const redirect=()=>{};'}));
 b.onLoad({filter:/.*/,namespace:'test'},({path:p})=>({contents:p==='db'?'export const getDb=()=>globalThis.testDb':'export const env=globalThis.testEnv'}));
}}]});
await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'),process.platform==='win32'?'junction':'dir');
globalThis.testEnv={SUPABASE_URL:'https://auth.test',SUPABASE_ANON_KEY:'public',LINKEDIN_CLIENT_ID:'testclient123',LINKEDIN_CLIENT_SECRET:'test-only-linkedin-secret-1234567',BUCKET:{get:async()=>({arrayBuffer:async()=>new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,120,0,0,0,120]).buffer})}};
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
const original=globalThis.fetch;let calls=[],postFailure='',roles=true,uploadHost='https://www.linkedin.com';
globalThis.fetch=async(input,init)=>{
 const url=new URL(String(input));if(url.origin==='https://auth.test'){const id=init.headers.Authorization.slice(7);return Response.json({id,email:`${id}@test.no`,email_confirmed_at:'now'});}
 assert.equal(init.redirect,'manual');calls.push({url,init});
 if(url.pathname==='/oauth/v2/accessToken'){assert.equal(url.origin,'https://www.linkedin.com');return Response.json({access_token:'test-private-linkedin-token',expires_in:5000000,scope:'rw_organization_admin w_organization_social'});}
 if(url.pathname.startsWith('/dms-uploads/')){assert.equal(url.origin,'https://www.linkedin.com');assert.equal(init.method,'PUT');return new Response(null,{status:201});}
 assert.equal(url.origin,'https://api.linkedin.com');assert.equal(init.headers['LinkedIn-Version'],'202608');
 if(url.pathname==='/rest/organizationAcls')return Response.json({elements:roles?[{organizationTarget:'urn:li:organization:111',role:'ADMINISTRATOR',state:'APPROVED'},{organization:'urn:li:organization:999',role:'ANALYST',state:'APPROVED'},{organization:'urn:li:organization:888',role:'ADMINISTRATOR',state:'REVOKED'}]:[]});
 if(url.pathname==='/rest/organizations/111')return Response.json({id:111,localizedName:'Noracre test'});
 if(url.pathname==='/rest/images')return Response.json({value:{uploadUrl:uploadHost+'/dms-uploads/test',image:'urn:li:image:TESTIMAGE'}});
 if(url.pathname.startsWith('/rest/images/'))return Response.json({owner:'urn:li:organization:111',status:'AVAILABLE'});
 if(url.pathname==='/rest/posts'){
  if(postFailure==='timeout')throw Error('test-private-linkedin-token');
  if(postFailure==='403')return Response.json({message:'test-private-linkedin-token'},{status:403});
  return new Response(null,{status:201,headers:{'x-restli-id':'urn:li:share:1234567'}});
 }
 throw Error('Unexpected endpoint '+url.pathname);
};
const route=p=>app['r'+routes.indexOf(p)];
const req=(p,user=1,org=user,body,method=body?'POST':'GET')=>new Request('https://crm.noracre.no/api/social/'+p,{method,headers:{authorization:'Bearer '+user,'x-organization-id':String(org),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
async function start(){const r=await route('linkedin/start').POST(req('linkedin/start',1,1,{}));assert.equal(r.status,200);const d=await r.json();return {...d,state:new URL(d.url).searchParams.get('state'),cookie:r.headers.get('set-cookie').split(';')[0]};}
const callback=(flow,cookie=flow.cookie)=>route('linkedin/callback').GET(new Request('https://crm.noracre.no/api/social/linkedin/callback?'+new URLSearchParams({state:flow.state,code:'test-code'}),{headers:{cookie}}));
let flow;
test('LinkedIn is configured independently of Meta and management remains admin and tenant scoped',async()=>{
 assert.equal(app.linkedin.linkedinReady(),true);assert.equal(app.meta.metaReady(),false);
 for(const [user,org] of [[3,1],[1,2]])assert.equal((await route('linkedin/start').POST(req('linkedin/start',user,org,{}))).status,403);
 const d=await (await route('connections').GET(req('connections'))).json();assert.deepEqual(d.providers,{meta:false,linkedin:true});
});
test('OAuth validates browser, state, consent and one-time exchange without exposing tokens',async()=>{
 flow=await start();assert.equal(new URL(flow.url).origin,'https://www.linkedin.com');assert.equal(new URL(flow.url).searchParams.get('scope'),'rw_organization_admin w_organization_social');
 const before=calls.length;assert.equal((await callback(flow,'')).status,400);assert.equal(calls.length,before);
 assert.equal((await callback(flow)).status,200);assert.equal((await callback(flow)).status,400);
 assert.equal((await route('linkedin/accounts').GET(req('linkedin/accounts?id='+flow.id,3,1))).status,403);
 const response=await route('linkedin/accounts').GET(req('linkedin/accounts?id='+flow.id));const text=await response.text();assert.ok(!text.includes('token'));assert.deepEqual(JSON.parse(text).pages,[{id:'111',name:'Noracre test'}]);
 assert.equal((await route('meta/accounts').GET(req('meta/accounts?id='+flow.id))).status,404);
});
test('only a consented page can be saved, current role rechecked and token is encrypted',async()=>{
 assert.equal((await route('linkedin/accounts').POST(req('linkedin/accounts',1,1,{id:flow.id,pageId:'999'}))).status,400);
 roles=false;assert.equal((await route('linkedin/accounts').POST(req('linkedin/accounts',1,1,{id:flow.id,pageId:'111'}))).status,409);roles=true;
 assert.equal((await route('linkedin/accounts').POST(req('linkedin/accounts',1,1,{id:flow.id,pageId:'111'}))).status,200);
 const row=sql.prepare('select * from social_connections').get();assert.equal(row.platform,'LinkedIn');assert.ok(!row.token.includes('test-private'));
 await assert.rejects(()=>app.linkedin.unsealLinkedIn(row.token,app.meta.tokenContext(2,'LinkedIn','111')));
 assert.equal((await route('connections').POST(req('connections',1,1,{id:row.id}))).status,200);
});
const post=(id,content='Hei, velkommen til Noracre!',type)=>{add('marketing_posts',{id,organization_id:1,content,platforms:'["LinkedIn"]',created_by:'test',created_at:'now',updated_at:'now'});if(type)add('marketing_post_images',{id,organization_id:1,post_id:id,object_key:'test',filename:'logo.png',content_type:type,size:24,created_at:'now'});};
const publish=id=>route('publish').POST(req('publish',1,1,{postId:id,confirm:true,targets:sql.prepare('select id,account_id as accountId,platform from social_connections').all()}));
test('text and PNG posts publish once to the selected organization and return LinkedIn IDs',async()=>{
 for(const [id,type] of [[100,undefined],[101,'image/png']]){
  post(id,undefined,type);const r=await publish(id);assert.equal(r.status,200);assert.equal((await r.json()).status,'Publisert');
  const external=calls.filter(c=>c.url.pathname==='/rest/posts').at(-1),payload=JSON.parse(external.init.body);assert.equal(payload.author,'urn:li:organization:111');assert.equal(payload.commentary,'Hei, velkommen til Noracre!');if(type)assert.equal(payload.content.media.id,'urn:li:image:TESTIMAGE');
  const count=calls.filter(c=>c.url.pathname==='/rest/posts').length;assert.equal((await publish(id)).status,409);assert.equal(calls.filter(c=>c.url.pathname==='/rest/posts').length,count);
 }
});
test('publishing blocks oversized text, unsupported images, stale targets and lost roles before writes',async()=>{
 post(102,'x'.repeat(3001));assert.equal((await publish(102)).status,400);
 post(103,undefined,'image/webp');assert.equal((await publish(103)).status,400);
 post(104);assert.equal((await route('publish').POST(req('publish',1,1,{postId:104,confirm:true,targets:[]}))).status,409);
 roles=false;assert.equal((await publish(104)).status,409);roles=true;
 assert.equal(sql.prepare('select status from marketing_posts where id=104').get().status,'Kladd');
});
test('multi-image posts keep image order and punctuation is sent as literal little text',async()=>{
 const content='Hei (Noracre)! #CRM @navn [test] {tekst}|* _~ <hei> \\';
 post(108,content,'image/png');
 add('marketing_post_images',{id:109,organization_id:1,post_id:108,object_key:'second',filename:'second.png',content_type:'image/png',size:24,created_at:'now'});
 const before=calls.length,r=await publish(108);assert.equal((await r.json()).status,'Publisert');
 const activity=calls.slice(before),payload=JSON.parse(activity.find(c=>c.url.pathname==='/rest/posts').init.body);
 assert.equal(activity.filter(c=>c.url.pathname.startsWith('/dms-uploads/')).length,2);
 assert.deepEqual(payload.content.multiImage.images,[{id:'urn:li:image:TESTIMAGE'},{id:'urn:li:image:TESTIMAGE'}]);
 assert.equal(payload.commentary,String.raw`Hei \(Noracre\)! \#CRM \@navn \[test\] \{tekst\}\|\* \_\~ \<hei\> \\`);
});
test('upload redirects and unexpected destinations never receive image bytes or credentials',async()=>{
 post(105,undefined,'image/png');uploadHost='https://attacker.test';const before=calls.length;const r=await publish(105);assert.equal((await r.json()).status,'Kontroller publisering');assert.ok(!calls.slice(before).some(c=>c.url.origin==='https://attacker.test'));uploadHost='https://www.linkedin.com';
});
test('ambiguous sends are never retried and provider errors never expose tokens',async()=>{
 post(106);postFailure='timeout';const r=await publish(106),text=await r.text();assert.ok(!text.includes('test-private'));assert.equal(JSON.parse(text).results[0].status,'unknown');assert.equal((await publish(106)).status,409);
 post(107);postFailure='403';const denied=await (await publish(107)).json();assert.equal(denied.results[0].status,'failed');assert.ok(!JSON.stringify(denied).includes('test-private'));postFailure='';
});
test('LinkedIn callback is public GET only, disconnect is scoped and clears the stored token',async()=>{
 assert.ok(await app.guardRequest(new Request('https://crm.noracre.no/api/social/linkedin/callback')) instanceof Request);
 assert.equal((await app.guardRequest(new Request('https://crm.noracre.no/api/social/linkedin/callback',{method:'POST'}))).status,401);
 const row=sql.prepare('select id from social_connections').get();assert.equal((await route('connections').DELETE(req('connections?id='+row.id,2,2,undefined,'DELETE'))).status,200);assert.ok(sql.prepare('select id from social_connections').get());
 assert.equal((await route('connections').DELETE(req('connections?id='+row.id,1,1,undefined,'DELETE'))).status,200);assert.equal(sql.prepare('select id from social_connections').get(),undefined);
});
process.on('exit',()=>{globalThis.fetch=original;rm(dir,{recursive:true,force:true});});
