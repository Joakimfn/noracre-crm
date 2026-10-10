import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
const root=path.resolve(import.meta.dirname,'..'),dir=await mkdtemp(path.join(tmpdir(),'noracre-company-flow-'));
await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'));
await build({stdin:{contents:"export {createConfirmedCustomer} from './lib/customer-create';export {useRegistryLookup} from './hooks/use-registry-lookup';export {useSearchPage} from './hooks/use-search-page';",resolveDir:root},bundle:true,format:'esm',platform:'node',packages:'external',outfile:path.join(dir,'flow.mjs')});
const app=await import(pathToFileURL(path.join(dir,'flow.mjs')));
after(()=>rm(dir,{recursive:true,force:true}));
const draft={id:123456789,name:'Entreprise française',country:'FR',orgNumber:'552100554',employeeRange:'10–19',employeeRangeYear:'2024'};
test('customer creation uses only confirmed persisted data and retains the draft after rejected or broken responses',async()=>{
 for(const response of [Response.json({error:'Accès refusé'},{status:403}),Response.json({error:'Indisponible'},{status:502}),Response.json({company:{id:0,name:draft.name}}),Response.json({company:{id:41}}),new Response('not JSON')]){
  const previous={...draft};await assert.rejects(app.createConfirmedCustomer(async()=>response,draft));assert.deepEqual(draft,previous);
 }
 await assert.rejects(app.createConfirmedCustomer(async()=>{throw new TypeError('Failed to fetch');},draft),/Kunne ikke legge til kunden/);
 const saved=await app.createConfirmedCustomer(async(url,init)=>{assert.equal(url,'/api/companies');assert.equal(init.method,'POST');assert.equal(JSON.parse(init.body).country,'FR');return Response.json({company:{id:41,name:'Entreprise française SAS'}});},draft);
 assert.equal(saved.id,41);assert.equal(saved.name,'Entreprise française SAS');assert.equal(saved.country,'FR');assert.equal(saved.employeeRange,'10–19');assert.equal(draft.id,123456789);
});
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};}
test('registry lookups discard stale country, query and tenant responses including late failures',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;let view,tree;const calls=[];
 const request=(url,init)=>{const call=deferred();calls.push({url,init,...call});return call.promise;};
 function Harness(props){view=app.useRegistryLookup(request,props.country,props.query,props.organizationId,true);return null;}
 const props={country:'NO',query:'Acme',organizationId:41};
 const update=async next=>act(()=>{if(tree)tree.update(React.createElement(Harness,next));else tree=create(React.createElement(Harness,next));});
 try{
  await update(props);let norwegian;await act(()=>{norwegian=view.search();});assert.equal(view.busy,true);
  await update({...props,country:'FR'});assert.equal(view.busy,false);assert.deepEqual(view.results,[]);
  let french;await act(()=>{french=view.search();});assert.match(calls[1].url,/country=FR/);assert.match(calls[1].url,/includeEnk=1/);
  await act(async()=>{calls[0].resolve(Response.json({companies:[{name:'Norwegian hit'}]}));assert.equal(await norwegian,false);});assert.deepEqual(view.results,[]);assert.equal(view.busy,true);
  await act(async()=>{calls[1].resolve(Response.json({companies:[{name:'French hit'}]}));assert.equal(await french,true);});assert.deepEqual(view.results,[{name:'French hit'}]);
  await update({...props,country:'FR',query:'New query'});assert.deepEqual(view.results,[]);assert.equal(view.searched,false);
  let oldQuery;await act(()=>{oldQuery=view.search();});await update({...props,country:'FR',query:'New query',organizationId:42});
  await act(async()=>{calls[2].reject(new Error('Late network error'));assert.equal(await oldQuery,false);});assert.deepEqual(view.results,[]);assert.equal(view.busy,false);
  let missing;await act(()=>{missing=view.search();});await act(async()=>{calls[3].resolve(Response.json({error:'Lookup unavailable'},{status:502}));await assert.rejects(missing,/Lookup unavailable/);});assert.equal(view.busy,false);assert.deepEqual(view.results,[]);
  let offline;await act(()=>{offline=view.search();});await act(async()=>{calls[4].reject(new TypeError('Failed to fetch'));await assert.rejects(offline,/Kunne ikke søke i foretaksregisteret/);});assert.equal(view.busy,false);assert.deepEqual(view.results,[]);
 }finally{if(tree)await act(()=>tree.unmount());delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
test('new search criteria reset register pagination while explicit start pages and continuation pages remain usable',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;let page,setPage,tree;
 function Harness({criteria}){[page,setPage]=app.useSearchPage(JSON.stringify(criteria));return null;}
 const initial={country:'FR',query:'Acme',location:'75',industry:'J',region:'11',bands:['11']};
 const update=criteria=>act(()=>{if(tree)tree.update(React.createElement(Harness,{criteria}));else tree=create(React.createElement(Harness,{criteria}));});
 try{
  await update(initial);assert.equal(page,1);await act(()=>setPage(12));assert.equal(page,12);await update({...initial});assert.equal(page,12);
  for(const changed of [{query:'Different'},{location:'69'},{industry:'F'},{region:'84'},{bands:['12']},{country:'NO'}]){await act(()=>setPage(20));await update({...initial,...changed});assert.equal(page,1);await update(initial);}
  await act(()=>setPage(400));assert.equal(page,400);await act(()=>setPage(21));assert.equal(page,21);
 }finally{if(tree)await act(()=>tree.unmount());delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
