import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),dir=await mkdtemp(path.join(tmpdir(),'noracre-registers-'));
await build({entryPoints:[path.join(root,'lib/international-registers.ts')],bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'registers.mjs'),plugins:[{name:'runtime',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));b.onResolve({filter:/^@\/lib\/tenant$/},()=>({path:'tenant',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},({path:p})=>({contents:p==='env'?'export const env=globalThis.registerSettings;':'export class AccessError extends Error {constructor(status,message,code){super(message);this.status=status;this.code=code;}}'}));}}]});
globalThis.registerSettings={};const app=await import(pathToFileURL(path.join(dir,'registers.mjs'))),realFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=realFetch;await rm(dir,{recursive:true,force:true});});
test('UK uses Companies House active companies, preserves alphanumeric identifiers, and keeps credentials in server headers',async()=>{
 registerSettings.COMPANIES_HOUSE_API_KEY='test-key';globalThis.fetch=async(url,init)=>{assert.equal(url.hostname,'api.company-information.service.gov.uk');assert.equal(url.searchParams.get('company_status'),'active');assert.equal(url.searchParams.get('sic_codes'),'62012');assert.equal(init.headers.Authorization,'Basic '+btoa('test-key:'));assert.ok(!String(url).includes('test-key'));return Response.json({items:[{company_number:'SC012345',company_name:'Scottish Ltd',company_status:'active',sic_codes:['62012'],registered_office_address:{locality:'Edinburgh'}},{company_number:'12345678',company_name:'Dissolved Ltd',company_status:'dissolved'}]});};
 const rows=await app.searchInternationalRegister('GB',{count:20,query:'Software',industry:'62012'});assert.equal(rows.length,1);assert.equal(rows[0].orgNumber,'SC012345');assert.equal(rows[0].city,'Edinburgh');
});
test('Ireland includes normal active status variants, escapes SQL values and never treats missing phone numbers as present',async()=>{
 globalThis.fetch=async url=>{assert.equal(url.hostname,'opendata.cro.ie');const sql=url.searchParams.get('sql');assert.ok(sql.includes("company_status_code IN (1151,1153)"));assert.ok(sql.includes("O''Reilly"));assert.ok(sql.endsWith('LIMIT 10'));return Response.json({success:true,result:{records:[{company_num:'765432',company_name:"O'Reilly Limited",company_address_4:'Dublin',nace_v2_code:'6201'}]}});};
 const rows=await app.searchInternationalRegister('IE',{count:10,query:"O'Reilly"});assert.equal(rows[0].orgNumber,'765432');assert.equal(rows[0].phone,undefined);
 await assert.rejects(app.searchInternationalRegister('IE',{requirePhone:true}),e=>e.status===400);
});
test('Australia decodes JSONP without executing it, excludes inactive and historical names, and deduplicates ABNs',async()=>{
 registerSettings.ABN_LOOKUP_GUID='guid';globalThis.fetch=async url=>{assert.equal(url.searchParams.get('callback'),'noracre');return new Response('noracre('+JSON.stringify({Message:'',Names:[{Abn:'12345678901',Name:'Active AU',AbnStatus:'0000000001',IsCurrent:true,State:'NSW',Postcode:'2000'},{Abn:'12345678901',Name:'Duplicate',AbnStatus:'Active',IsCurrent:true},{Abn:'99999999999',Name:'Closed',AbnStatus:'Cancelled',IsCurrent:true},{Abn:'88888888888',Name:'Old name',AbnStatus:'Active',IsCurrent:false}]})+');');};
 const rows=await app.searchInternationalRegister('AU',{query:'active'});assert.equal(rows.length,1);assert.equal(rows[0].orgNumber,'12345678901');
 globalThis.fetch=async()=>new Response('noracre({}); process.exit(1)');await assert.rejects(app.searchInternationalRegister('AU',{query:'active'}),e=>e.status===502);
});
test('NZ requires explicit approved API use and never downloads bulk marketing data',async()=>{
 registerSettings.NZBN_API_KEY='key';let calls=0;globalThis.fetch=async(url,init)=>{calls++;assert.equal(url.pathname,'/gateway/nzbn/v5/entities');assert.equal(url.searchParams.get('entity-status'),'Registered');assert.equal(init.headers['Ocp-Apim-Subscription-Key'],'key');return Response.json({items:[{nzbn:'9429041752715',entityName:'GRIZZLY LIMITED',entityStatusCode:'50'}]});};
 await assert.rejects(app.searchInternationalRegister('NZ',{query:'Grizzly'}),e=>e.status===503);assert.equal(calls,0);
 registerSettings.NZBN_CALL_LISTS_APPROVED='true';const rows=await app.searchInternationalRegister('NZ',{query:'Grizzly'});assert.equal(rows[0].orgNumber,'9429041752715');assert.equal(calls,1);
});

test('Ireland casts numeric NACE codes to text before prefix matching',async()=>{
 globalThis.fetch=async url=>{const sql=url.searchParams.get('sql');assert.ok(sql.includes("REPLACE(nace_v2_code::text, '.', '') LIKE '6201%'"));return Response.json({success:true,result:{records:[]}});};
 const rows=await app.searchInternationalRegister('IE',{count:10,industry:'6201'});assert.equal(rows.length,0);
});
test('Register network failures and malformed responses are returned as useful API errors',async()=>{
 globalThis.fetch=async()=>{throw new TypeError('connection reset');};
 await assert.rejects(app.searchInternationalRegister('IE',{}),e=>e.status===502&&e.code==='REGISTER_UNAVAILABLE');
 globalThis.fetch=async()=>new Response('Service Unavailable',{status:503});
 await assert.rejects(app.searchInternationalRegister('IE',{}),e=>e.status===502&&e.code==='REGISTER_ERROR');
 globalThis.fetch=async()=>Response.json({success:true,result:{}});
 await assert.rejects(app.searchInternationalRegister('IE',{}),e=>e.status===502&&e.code==='REGISTER_INVALID_RESPONSE');
});
