import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const root=path.resolve(import.meta.dirname,'..'),dir=await mkdtemp(path.join(tmpdir(),'noracre-france-'));
const runtime={name:'test-runtime',setup(builder){
 builder.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));
 builder.onResolve({filter:/^@\/lib\/tenant$/},()=>({path:'tenant',namespace:'test'}));
 builder.onLoad({filter:/.*/,namespace:'test'},({path:p})=>({contents:p==='env'?'export const env={};':`export class AccessError extends Error {constructor(status,message,code){super(message);this.status=status;this.code=code;}} export async function requireTenant(){return {organizationId:42}} export function accessResponse(error){return Response.json({error:error.message},{status:error.status??500})}`}));
}};
await build({entryPoints:[path.join(root,'lib/france-register.ts'),path.join(root,'app/api/company-lookup/route.ts'),path.join(root,'lib/prospect-import.ts')],outbase:root,outdir:dir,bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'},plugins:[runtime]});
const api=await import(pathToFileURL(path.join(dir,'lib/france-register.mjs'))),lookup=await import(pathToFileURL(path.join(dir,'app/api/company-lookup/route.mjs'))),imports=await import(pathToFileURL(path.join(dir,'lib/prospect-import.mjs')));
const originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;await rm(dir,{recursive:true,force:true});});
const company=(n=1,extra={})=>({siren:String(n).padStart(9,'0'),nom_complet:'Entreprise '+n,etat_administratif:'A',statut_diffusion:'O',activite_principale:'62.01Z',tranche_effectif_salarie:'11',annee_tranche_effectif_salarie:'2024',siege:{siret:String(n).padStart(9,'0')+'00001',adresse:'1 RUE DE LYON 69001 LYON',code_postal:'69001',commune:'69381',region:'84',libelle_commune:'LYON',etat_administratif:'A',statut_diffusion_etablissement:'O'},matching_etablissements:[{siret:String(n).padStart(9,'0')+'00002',adresse:'2 RUE DE PARIS 75002 PARIS',code_postal:'75002',commune:'75102',region:'11',libelle_commune:'PARIS',etat_administratif:'A',statut_diffusion_etablissement:'O'}],...extra});

test('French registry supports official employee bands, geography, activity sections and exact NAF codes',()=>{
 const {params}=api.franceSearchParams({count:50,employeeBands:['11','12','11'],location:'75,2a',region:'11',industry:'6201Z'});
 assert.equal(params.get('etat_administratif'),'A');assert.equal(params.get('tranche_effectif_salarie'),'11,12');
 assert.equal(params.get('departement'),'75,2A');assert.equal(params.get('region'),'11');assert.equal(params.get('activite_principale'),'62.01Z');
 assert.equal(api.franceSearchParams({location:'75001,69001',industry:'J,M'}).params.get('code_postal'),'75001,69001');
 assert.equal(api.franceSearchParams({industry:'J,M'}).params.get('section_activite_principale'),'J,M');
});

test('French search rejects unsupported filters, bad bands and direct IDs whose upstream filters would be ignored',()=>{
 for(const fields of [{count:101},{page:401},{page:0},{employeeBands:['99']},{employeeBands:'11'},{region:'99'},{industry:'62'},{location:'Paris'},{minEmployees:10},{maxEmployees:20},{establishedFrom:'2025-01-01'},{requirePhone:true},{query:'356 000 000',location:'75'}])assert.throws(()=>api.franceSearchParams(fields),error=>error.status===400);
 assert.equal(api.franceSearchParams({query:'356 000 000 00001'}).params.get('q'),'35600000000001');
});

test('French legal-company employee ranges never become fabricated exact headcounts',()=>{
 const row=api.normalizeFranceCompany(company());assert.equal(row.orgNumber,'000000001');assert.equal(row.employees,null);assert.equal(row.employeeRange,'10–19');assert.equal(row.employeeRangeYear,'2024');
 assert.equal(row.city,'LYON');assert.equal(row.address,'1 RUE DE LYON 69001 LYON');assert.equal(row.siret,'00000000100001');assert.equal(row.phone,undefined);
 assert.equal(api.normalizeFranceCompany(company(1,{tranche_effectif_salarie:'NN'})).employeeRange,'');
 assert.equal(api.normalizeFranceCompany(company(1,{tranche_effectif_salarie:'00'})).employees,null);
 assert.equal(api.normalizeFranceCompany(company(1,{etat_administratif:'C'})),null);
 assert.equal(api.normalizeFranceCompany(company(1,{statut_diffusion:'P'})),null);
});

test('pagination uses a fixed 25-row page size and returns the requested count across multiple pages',async()=>{
 const calls=[];globalThis.fetch=async(url,init)=>{calls.push(Number(url.searchParams.get('page')));assert.equal(url.hostname,'recherche-entreprises.api.gouv.fr');assert.equal(url.searchParams.get('per_page'),'25');assert.equal(url.searchParams.get('minimal'),'true');assert.match(init.headers['User-Agent'],/Noracre/);assert.equal(init.headers.Authorization,undefined);return Response.json({results:Array.from({length:25},(_,i)=>company((calls.at(-1)-1)*25+i+1)),total_pages:4});};
 const rows=await api.searchFranceRegister({count:63});assert.equal(rows.length,63);assert.deepEqual(calls,[1,2,3]);assert.equal(rows[62].orgNumber,'000000063');
 calls.length=0;const second=await api.searchFranceRegister({count:1,page:2});assert.equal(second[0].orgNumber,'000000026');assert.deepEqual(calls,[2]);
});

test('French geographic lists use an active matching local establishment, while employee bands remain company-wide',async()=>{
 globalThis.fetch=async()=>Response.json({results:[company()],total_pages:1});
 const [row]=await api.searchFranceRegister({count:1,location:'75',region:'11'});assert.equal(row.city,'PARIS');assert.equal(row.siret,'00000000100002');assert.equal(row.employeeRange,'10–19');
 globalThis.fetch=async()=>Response.json({results:[company(1,{matching_etablissements:[{...company().matching_etablissements[0],etat_administratif:'F'}]})],total_pages:1});
 assert.deepEqual(await api.searchFranceRegister({count:1,location:'75'}),[]);
});

test('French searches deduplicate SIRENs, exclude existing prospects/customers and enforce bands locally',async()=>{
 globalThis.fetch=async()=>Response.json({results:[company(1),company(1),company(2),company(3,{tranche_effectif_salarie:'12'}),company(4,{etat_administratif:'C'}),company(5,{complements:{est_entrepreneur_individuel:true}})],total_pages:1});
 const rows=await api.searchFranceRegister({count:50,employeeBands:['11'],includeEnk:false},new Set(['000000002']));assert.deepEqual(rows.map(row=>row.orgNumber),['000000001']);
});

test('France continuation retains partial pages and advances past duplicate-only windows',async()=>{
 globalThis.fetch=async(url)=>{const page=Number(url.searchParams.get('page'));return Response.json({results:Array.from({length:25},(_,i)=>company((page-1)*25+i+1)),total_pages:20});};
 const first=await api.searchFranceRegisterPage({count:2});assert.equal(first.rows.length,2);assert.equal(first.nextPage,1);assert.equal(first.hasMore,true);
 const excluded=new Set(Array.from({length:200},(_,i)=>String(i+1).padStart(9,'0')));
 const window=await api.searchFranceRegisterPage({count:25},excluded);assert.equal(window.rows.length,0);assert.equal(window.nextPage,9);assert.equal(window.hasMore,true);
 const continued=await api.searchFranceRegisterPage({count:25,page:window.nextPage},excluded);assert.equal(continued.rows[0].orgNumber,'000000201');assert.equal(continued.nextPage,10);
});

test('France register network, rate-limit and invalid payloads surface controlled errors',async()=>{
 globalThis.fetch=async()=>{throw new TypeError('offline')};await assert.rejects(api.searchFranceRegister({}),error=>error.code==='REGISTER_UNAVAILABLE');
 globalThis.fetch=async()=>new Response('',{status:429});await assert.rejects(api.searchFranceRegister({}),error=>error.code==='REGISTER_RATE_LIMIT');
 globalThis.fetch=async()=>Response.json({results:'wrong'});await assert.rejects(api.searchFranceRegister({}),error=>error.code==='REGISTER_INVALID_RESPONSE');
 globalThis.fetch=async()=>new Response('{bad');await assert.rejects(api.searchFranceRegister({}),error=>error.code==='REGISTER_INVALID_RESPONSE');
});

test('company lookup uses France instead of Norway and returns registry country and employment metadata',async()=>{
 globalThis.fetch=async(url)=>{assert.equal(url.hostname,'recherche-entreprises.api.gouv.fr');assert.equal(url.searchParams.get('q'),'356000000');return Response.json({results:[company(356000000)],total_pages:1});};
 const response=await lookup.GET(new Request('https://noracre.no/api/company-lookup?q=356%20000%20000&country=FR&includeEnk=1'));assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.companies[0].country,'FR');assert.equal(data.companies[0].employees,null);assert.equal(data.companies[0].employeeRange,'10–19');assert.equal(data.companies[0].phone,'');assert.match(data.source,/INSEE/);
 const unsupported=await lookup.GET(new Request('https://noracre.no/api/company-lookup?q=test&country=SE'));assert.equal(unsupported.status,400);
});

test('French import recognizes official names, SIRENs/SIRETs and activity codes without inventing exact counts',()=>{
 const [row]=imports.mapProspectRows([{nom_complet:'Société Française',siren:'356 000 000',activite_principale:'62.01Z',libelle_commune:'PARIS',tranche_effectif_salarie:'11',annee_tranche_effectif_salarie:'2024',adresse:'10 RUE DE PARIS',code_postal:'75001'}]);
 assert.equal(row.name,'Société Française');assert.equal(row.orgNumber,'356000000');assert.equal(row.city,'PARIS');assert.equal(row.industry,'62.01Z');assert.equal(row.employees,null);
 assert.equal(row.employeeRange,'10–19');assert.equal(row.employeeRangeYear,'2024');assert.equal(row.address,'10 RUE DE PARIS');assert.equal(row.postalCode,'75001');
 assert.equal(imports.normalizeRegistryId('356.000.000.00001','FR'),'356000000');assert.equal(imports.normalizeRegistryId('356 000 000','FR'),'356000000');
 assert.equal(imports.normalizeRegistryId('SC001234','FR'),'SC001234');
});

test('France migration preserves existing exact employee counts and adds nullable-independent band/address fields',async()=>{
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE companies(id INTEGER, employees INTEGER); CREATE TABLE call_list_entries(id INTEGER, employees INTEGER); INSERT INTO companies VALUES (1,12),(2,NULL); INSERT INTO call_list_entries VALUES (1,0);");
 db.exec(await readFile(path.join(root,'drizzle/0029_france_register.sql'),'utf8'));
 assert.deepEqual(db.prepare('SELECT employees,employee_range,employee_range_year,address,postal_code FROM companies ORDER BY id').all().map(row=>({...row})),[{employees:12,employee_range:'',employee_range_year:'',address:'',postal_code:''},{employees:null,employee_range:'',employee_range_year:'',address:'',postal_code:''}]);
 assert.equal(db.prepare('SELECT employees FROM call_list_entries').get().employees,0);db.close();
});
