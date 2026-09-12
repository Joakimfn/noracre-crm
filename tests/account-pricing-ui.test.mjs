import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const dir=await mkdtemp(path.join(tmpdir(),'noracre-price-ui-'));
await symlink(path.resolve('node_modules'),path.join(dir,'node_modules'));
await build({stdin:{contents:(await readFile('app/crm-client.tsx','utf8'))+'\nexport {Overview,CallLists,Marketing,NegotiatedPrices};',resolveDir:path.resolve('app'),loader:'tsx'},bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',outfile:path.join(dir,'ui.mjs')});
const ui=await import(pathToFileURL(path.join(dir,'ui.mjs')));
test('overview greets the actual user, including names without spaces',()=>{
 const name='NavnUtenMellomrom'.repeat(12);
 const html=renderToStaticMarkup(React.createElement(ui.Overview,{displayName:name,companies:[],overdue:[],today:[],upcoming:[],go(){},complete(){},select(){}}));
 assert.ok(html.includes(name));assert.ok(!html.includes('God dag, Joakim'));
});
test('module purchase views show only supplied company prices and handle no agreement',()=>{
 for(const [Component,price] of [[ui.CallLists,29],[ui.Marketing,69]]) {
   const props={agreedPrice:price,active:false,role:'Administrator',members:[],organizationId:1,currentMembershipId:1,companies:[],onActivated(){},onDataChanged:async()=>{},onGoToCustomer(){}};
   const html=renderToStaticMarkup(React.createElement(Component,props));
   assert.ok(html.includes(`${price} kr per valgt bruker`));assert.ok(!html.includes('49 kr'));
   const missing=renderToStaticMarkup(React.createElement(Component,{...props,agreedPrice:null}));
   assert.ok(missing.includes('Kontakt Noracre for avtalt pris'));assert.match(missing,/<button[^>]*disabled/);
 }
});
test('price editor preserves explicit zero separately from an unconfigured module',()=>{
 const html=renderToStaticMarkup(React.createElement(ui.NegotiatedPrices,{values:{crmPrice:'199',ringPrice:'0',marketingPrice:''},change(){}}));
 assert.ok(html.includes('value="0"'));assert.ok(html.includes('value=""'));assert.ok(html.includes('Avtalte priser'));
});
process.on('exit',()=>{rm(dir,{recursive:true,force:true});});
