import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=path.resolve(import.meta.dirname,'..'),dir=await mkdtemp(path.join(tmpdir(),'noracre-showcase-'));
await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'),process.platform==='win32'?'junction':'dir');
await build({stdin:{contents:"export {ModuleShowcase} from './components/module-showcase';export {canViewAdministration} from './lib/roles';",resolveDir:root},bundle:true,format:'esm',platform:'node',packages:'external',jsx:'automatic',outfile:path.join(dir,'showcase.mjs')});
const {ModuleShowcase,canViewAdministration}=await import(pathToFileURL(path.join(dir,'showcase.mjs')));
after(()=>rm(dir,{recursive:true,force:true}));
const render=(moduleKey,role,price=49)=>renderToStaticMarkup(React.createElement(ModuleShowcase,{moduleKey,role,price,onPurchase:()=>{throw Error('Unexpected purchase');}}));
for(const moduleKey of ['ringelister','markedsforing']){
 test(`${moduleKey}: employees see the preview and administrator guidance without purchase controls`,()=>{
  const html=render(moduleKey,'Bruker');assert.match(html,/Ta kontakt med administratoren/);assert.match(html,/Eksempeldata/);assert.doesNotMatch(html,/Velg brukere og aktiver|per bruker \/ måned|bekrefter/);
 });
 test(`${moduleKey}: only recognized administrators see priced activation`,()=>{
  for(const role of ['Administrator','Partner','Superadmin']){const html=render(moduleKey,role);assert.match(html,/Velg brukere og aktiver/);assert.match(html,/49 kr/);assert.doesNotMatch(html,/Du ser totalprisen/);assert.doesNotMatch(html,/Ta kontakt med administratoren/);}
  const unknown=render(moduleKey,'unknown');assert.doesNotMatch(unknown,/Velg brukere og aktiver/);
  assert.match(render(moduleKey,'Administrator',null),/disabled=""/);
 });
}
test('administration is available only to customer administrators, partners and superadmins',()=>{
 for(const role of ['Bruker','','unknown'])assert.equal(canViewAdministration(role),false);
 for(const role of ['Administrator','Partner','Superadmin'])assert.equal(canViewAdministration(role),true);
});

test('paused AI search is absent from module previews',()=>assert.doesNotMatch(render('ringelister','Bruker'),/AI-SØK|med AI|module-preview-ai/));
