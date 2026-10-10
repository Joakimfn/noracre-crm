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
 for(const c of ['IE','GB','NG','FR','US',undefined,'XX'])assert.equal(lang.websiteLocale(c),'en');
 assert.equal(lang.organizationLocale('NO'),'nb');
 for(const c of ['SE','DK','IE','NG','FR',undefined])assert.equal(lang.organizationLocale(c),'en');
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
 b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export default {fetch:()=>new Response('CRM')};export const applyScheduledDeactivations=()=>{};export const refreshBrregBatch=()=>{};export const dispatchDueSocialPosts=()=>{};export const dispatchDueCampaigns=()=>{};export const guardRequest=r=>r;export const secureResponse=(r,s)=>s;export const publicEnquiry=()=>new Response('form');`}));
}}]});
const worker=(await import(pathToFileURL(path.join(dir,'worker.mjs')))).default;
test('actual website response follows trusted country and explicit language preferences',async()=>{
 for(const [country,cookie,query,expected] of [['NO','','','nb'],['SE','','','nb'],['DK','','','nb'],['IE','','','en'],['NG','','','en'],['FR','','','en'],[undefined,'','','en'],['NG','noracre-language=nb','','nb'],['NO','noracre-language=en','','en'],['NO','noracre-language=nb','?lang=en','en']]){
  const request=new Request('https://noracre.no/'+query,{headers:{cookie,'cf-ipcountry':'NO'}});Object.defineProperty(request,'cf',{value:{country}});
  const response=await worker.fetch(request,{},{});assert.equal(response.status,200);assert.equal(response.headers.get('Content-Language'),expected);assert.match(await response.text(),new RegExp('<html lang="'+expected+'"'));
 }
});
