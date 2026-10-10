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
 for(const c of ['IE','GB','NG','US','FR','fr','BE',undefined,'XX','T1',null])assert.equal(lang.websiteLocale(c),'en');
 for(const code of home.homeCountries)assert.equal(lang.websiteLocale(code),['NO','SE','DK'].includes(code)?'nb':'en',code);
 assert.equal(lang.websiteLocale(' se '),'nb');
 assert.equal(lang.organizationLocale('NO'),'nb');
 for(const c of ['FR','fr','BE'])assert.equal(lang.organizationLocale(c),'fr');
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
 for(const [country,cookie,query,expected] of [['NO','','','nb'],['SE','','','nb'],['DK','','','nb'],['IE','','','en'],['NG','','','en'],['FR','','','en'],['BE','','','en'],[undefined,'','','en'],['NG','noracre-language=nb','','nb'],['NO','noracre-language=en','','en'],['NO','noracre-language=fr','','fr'],['FR','noracre-language=en','','en'],['NO','noracre-language=nb','?lang=en','en'],['NO','noracre-language=en','?lang=fr','fr'],['FR','noracre-language=invalid','','en'],['FR','noracre-language=en','?lang=invalid','en'],['NG','','?lang=__proto__','en'],['NO','','?lang=','nb']]){
  const request=new Request('https://noracre.no/'+query,{headers:{cookie,'cf-ipcountry':'NO'}});Object.defineProperty(request,'cf',{value:{country}});
  const response=await worker.fetch(request,{},{});assert.equal(response.status,200);assert.equal(response.headers.get('Content-Language'),expected);assert.match(await response.text(),new RegExp('<html lang="'+expected+'"'));
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  if(['?lang=en','?lang=fr'].includes(query))assert.match(response.headers.get('Set-Cookie'),new RegExp('noracre-language='+expected+';.*Secure'));
  else assert.equal(response.headers.get('Set-Cookie'),null);
 }
});
test('CRM login starts in the chosen language without changing authentication cookies',async()=>{
 for(const [country,cookie,query,expected] of [['FR','session=keep','','en'],['IE','session=keep','','en'],['NO','session=keep','','nb'],['SE','session=keep','','nb'],['DK','session=keep','','nb'],['FR','session=keep; noracre-language=en','','en'],['NO','session=keep; noracre-language=en','?lang=fr','fr']]){
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
test('public navigation and CRM handoff preserve every selected language without JavaScript',async()=>{
 for(const locale of ['nb','en','fr']){
  const first=await worker.fetch(new Request('https://noracre.no/?lang='+locale),{},{});
  const cookie=first.headers.get('Set-Cookie').split(';')[0];
  const html=await first.text();
  const next=new URL(html.match(/href="([^\"]*\/kontakt\?lang=[^\"]+)"/)[1],'https://noracre.no');
  const request=new Request(next,{headers:{cookie}});Object.defineProperty(request,'cf',{value:{country:locale==='nb'?'NG':'NO'}});
  assert.equal((await worker.fetch(request,{},{})).headers.get('Content-Language'),locale);
  const cleanRequest=new Request('https://noracre.no/personvern',{headers:{cookie}});Object.defineProperty(cleanRequest,'cf',{value:{country:'US'}});
  assert.equal((await worker.fetch(cleanRequest,{},{})).headers.get('Content-Language'),locale);
  const login=html.match(/href="(https:\/\/crm\.noracre\.no\/\?lang=[^\"]+)"/)[1];
  const response=await worker.fetch(new Request(login,{headers:{cookie:'session=keep'}}),{},{});
  assert.equal(response.headers.get('Content-Language'),locale);
  assert.match(await response.text(),new RegExp('CRM session=keep; noracre-language='+locale));
 }
});
test('active CRM language remains stable on legal pages and query overrides stale session language',async()=>{
 for(const route of ['/','/om','/personvern','/vilkar','/databehandleravtale']){
  const response=await worker.fetch(new Request('https://crm.noracre.no'+route,{headers:{cookie:'session=keep; noracre-language=en; noracre-language-active=fr'}}),{},{});
  assert.equal(response.headers.get('Content-Language'),'fr');
  assert.match(await response.text(),/session=keep; noracre-language-active=fr; noracre-language=fr/);
 }
 const changed=await worker.fetch(new Request('https://crm.noracre.no/?lang=nb',{headers:{cookie:'session=keep; noracre-language=en; noracre-language-active=fr'}}),{},{});
 assert.equal(changed.headers.get('Content-Language'),'nb');
 assert.match(changed.headers.get('Set-Cookie'),/noracre-language=nb;/);
 assert.match(changed.headers.get('Set-Cookie'),/noracre-language-active=nb;/);
 // Session defaults never override a public-site manual choice.
 const website=await worker.fetch(new Request('https://noracre.no/',{headers:{cookie:'noracre-language=en; noracre-language-active=fr'}}),{},{});
 assert.equal(website.headers.get('Content-Language'),'en');
});
test('HEAD preserves locale and manual cookie with an empty body, including preview pages',async()=>{
 for(const url of ['https://noracre.no/kontakt?lang=nb','https://crm.noracre.no/nettside/kontakt?lang=nb']){
  const response=await worker.fetch(new Request(url,{method:'HEAD'}),{},{});
  assert.equal(response.status,200);assert.equal(await response.text(),'');
  assert.equal(response.headers.get('Content-Language'),'nb');assert.match(response.headers.get('Set-Cookie'),/noracre-language=nb;/);
 }
});
test('country headers cannot override trusted geography and absent metadata defaults to English',async()=>{
 const response=await worker.fetch(new Request('https://noracre.no/',{headers:{'cf-ipcountry':'NO','accept-language':'nb-NO'}}),{},{});
 assert.equal(response.headers.get('Content-Language'),'en');
});
test('language choices do not alter API or asset responses and canonical redirects retain the query',async()=>{
 const env={ASSETS:{fetch:()=>new Response('asset')}};
 const asset=await worker.fetch(new Request('https://noracre.no/favicon.svg?lang=fr'),env,{});
 assert.equal(await asset.text(),'asset');assert.equal(asset.headers.get('Set-Cookie'),null);
 for(const url of ['https://crm.noracre.no/api/session?lang=fr','https://crm.noracre.no/assets/app.js?lang=fr']){
  const response=await worker.fetch(new Request(url,{headers:{cookie:'session=keep'}}),env,{});
  assert.equal(await response.text(),'CRM session=keep');assert.equal(response.headers.get('Set-Cookie'),null);
 }
 const redirect=await worker.fetch(new Request('https://www.noracre.no/kontakt?lang=en'),{},{});
 assert.equal(redirect.status,308);assert.equal(redirect.headers.get('Location'),'https://noracre.no/kontakt?lang=en');
 const method=await worker.fetch(new Request('https://noracre.no/?lang=fr',{method:'POST'}),{},{});
 assert.equal(method.status,405);assert.equal(method.headers.get('Set-Cookie'),null);
});
