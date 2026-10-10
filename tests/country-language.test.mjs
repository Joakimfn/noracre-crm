import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
const dir=await mkdtemp(path.join(tmpdir(),'noracre-country-'));
await build({entryPoints:['lib/i18n/country.ts','lib/home-countries.ts'],bundle:true,format:'esm',platform:'node',outdir:dir});
const lang=await import(pathToFileURL(path.join(dir,'i18n/country.js'))),home=await import(pathToFileURL(path.join(dir,'home-countries.js')));
after(()=>rm(dir,{recursive:true,force:true}));
test('website geography uses Scandinavian exception, CRM only Norwegian exception',()=>{
 for(const c of ['NO','SE','DK'])assert.equal(lang.websiteLocale(c),'nb');
 for(const c of ['IE','GB','NG','US',undefined,'XX'])assert.equal(lang.websiteLocale(c),'en');
 for(const c of ['FR','fr','BE'])assert.equal(lang.websiteLocale(c),'fr');
 assert.equal(lang.organizationLocale('NO'),'nb');
 for(const c of ['FR','fr','BE']){assert.equal(lang.organizationLocale(c),'fr');assert.equal(lang.websiteLocale(c),'fr');}
 for(const c of ['SE','DK','IE','NG',undefined])assert.equal(lang.organizationLocale(c),'en');
 for(const c of ['FR','fr','BE'])assert.equal(lang.organizationLocale(c),'fr');
});
test('home country accepts all ISO regions and rejects invalid input',()=>{
 for(const c of ['FR','SE','NG','US','IE'])assert.equal(home.parseHomeCountry(c),c);
 assert.equal(home.parseHomeCountry('fr'),'FR');assert.throws(()=>home.parseHomeCountry('bogus'));assert.equal(home.homeCountries.length,249);
});
test('migration preserves tenant markets and infers legacy home country',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE organizations(id INTEGER,operating_countries TEXT);INSERT INTO organizations VALUES(1,'["NO"]'),(2,'["IE","GB"]');`);
 db.exec(await readFile('drizzle/0028_organization_home_country.sql','utf8'));
 assert.deepEqual(db.prepare('SELECT home_country FROM organizations ORDER BY id').all().map(x=>x.home_country),['NO','IE']);
 assert.equal(db.prepare('SELECT operating_countries FROM organizations WHERE id=2').get().operating_countries,'["IE","GB"]');db.close();
});
await build({entryPoints:['worker/index.ts'],bundle:true,format:'esm',platform:'node',outfile:path.join(dir,'worker.mjs'),plugins:[{name:'isolate-worker',setup(b){
 b.onResolve({filter:/vinext\/server|maintenance|social-publication|email-campaigns|request-security|public-enquiries/},a=>({path:a.path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export default {fetch:r=>new Response('CRM '+(r.headers.get('cookie')||''))};export const applyScheduledDeactivations=()=>{};export const refreshBrregBatch=()=>{};export const dispatchDueSocialPosts=()=>{};export const dispatchDueCampaigns=()=>{};export const guardRequest=r=>r;export const secureResponse=(r,s)=>s;export const publicEnquiry=()=>new Response('form');`}));
}}]});
const worker=(await import(pathToFileURL(path.join(dir,'worker.mjs')))).default;
test('website sitemap includes every published language with matching alternates',async()=>{
 const response=await worker.fetch(new Request('https://noracre.no/sitemap.xml'),{},{});
 assert.equal(response.status,200);
 const xml=await response.text();
 assert.equal((xml.match(/<url>/g)||[]).length,27);
 for(const locale of ['nb','en','fr']){
  assert.match(xml,new RegExp('<loc>https://noracre.no/crm\\?lang='+locale+'</loc>'));
  assert.match(xml,new RegExp('hreflang="'+locale+'" href="https://noracre.no/crm\\?lang='+locale+'"'));
 }
});
test('actual website response follows trusted country and explicit language preferences',async()=>{
 for(const [country,cookie,query,expected] of [['NO','','','nb'],['SE','','','nb'],['DK','','','nb'],['IE','','','en'],['NG','','','en'],['FR','','','fr'],['BE','','','fr'],[undefined,'','','en'],['NG','noracre-language=nb','','nb'],['NO','noracre-language=en','','en'],['NO','noracre-language=fr','','fr'],['FR','noracre-language=en','','en'],['NO','noracre-language=nb','?lang=en','en'],['NO','noracre-language=en','?lang=fr','fr'],['FR','noracre-language=invalid','','fr']]){
  const request=new Request('https://noracre.no/'+query,{headers:{cookie,'cf-ipcountry':'NO'}});Object.defineProperty(request,'cf',{value:{country}});
  const response=await worker.fetch(request,{},{});assert.equal(response.status,200);assert.equal(response.headers.get('Content-Language'),expected);assert.match(await response.text(),new RegExp('<html lang="'+expected+'"'));
 }
});
test('CRM login starts in the chosen language without changing authentication cookies',async()=>{
 for(const [country,cookie,query,expected] of [['FR','session=keep','','fr'],['IE','session=keep','','en'],['NO','session=keep','','nb'],['FR','session=keep; noracre-language=en','','en'],['NO','session=keep; noracre-language=en','?lang=fr','fr']]){
  const request=new Request('https://crm.noracre.no/'+query,{headers:{cookie}});Object.defineProperty(request,'cf',{value:{country}});
  const response=await worker.fetch(request,{},{});
  assert.equal(response.headers.get('Content-Language'),expected);
  assert.equal(await response.text(),'CRM session=keep; noracre-language='+expected);
  assert.match(response.headers.get('Cache-Control'),/private/);
  if(query)assert.match(response.headers.get('Set-Cookie'),/noracre-language=fr;.*Secure/);else assert.equal(response.headers.get('Set-Cookie'),null);
 }
 const response=await worker.fetch(new Request('https://crm.noracre.no/api/session?lang=fr',{headers:{cookie:'session=keep'}}),{},{});
 assert.equal(await response.text(),'CRM session=keep');assert.equal(response.headers.get('Set-Cookie'),null);
});
