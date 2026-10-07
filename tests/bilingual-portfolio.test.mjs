import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,symlink,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..'),dir=await mkdtemp(path.join(tmpdir(),'noracre-bilingual-'));
await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'));
 await build({stdin:{contents:"export {publicWebsite} from './lib/public-site';export {enquiryUserCounts} from './lib/enquiry-options';export {I18nProvider,useI18n} from './lib/i18n/react';export {translateUi,UiText} from './lib/i18n/ui';export {ModuleShowcase} from './components/module-showcase';export {ReminderFields} from './components/reminder-fields';export {default as Portfolio} from './app/portfolio/portfolio';",resolveDir:root},bundle:true,format:'esm',platform:'node',packages:'external',jsx:'automatic',loader:{'.css':'empty'},outfile:path.join(dir,'app.mjs')});
const app=await import(pathToFileURL(path.join(dir,'app.mjs')));
after(()=>rm(dir,{recursive:true,force:true}));
const render=(locale,Component,props={})=>renderToStaticMarkup(React.createElement(app.I18nProvider,{locale},React.createElement(Component,props)));
test('English website translates every public route and maintains explicit language links',async()=>{
 for(const route of ['/','/crm','/moduler','/om-noracre','/kontakt','/demo','/bli-kunde','/personvern','/missing']){
  const response=app.publicWebsite(route,'/nettside',{},'en'),html=await response.text();
  assert.match(html,/<html lang="en"/);assert.match(html,/Skip to content/);assert.match(html,/English/);
  assert.match(html,new RegExp('/nettside'+route.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\?lang=nb'));
  assert.match(html,/href="\/nettside\/crm\?lang=en"/);assert.equal(response.headers.get('Content-Language'),'en');assert.equal(response.headers.get('Vary'),'Cookie');
  assert.doesNotMatch(html.replace(/<script[^>]*>[\s\S]*?<\/script>/g,''),/Hopp til innhold|Book en demo|Bygget for gode kunderelasjoner|Hva ønsker du å se/);
 }
});
test('English enquiry form keeps wire identifiers and carries English async messages',async()=>{
 const html=await app.publicWebsite('/demo','',{},'en').text();
 assert.match(html,/name="type" value="demo"/);assert.match(html,/name="users"/);for(const {value} of app.enquiryUserCounts)assert.ok(html.includes(`value="${value}"`));
 assert.match(html,/Company name/);assert.match(html,/Request a demo/);assert.doesNotMatch(html,/&amp;amp;/);
 const match=html.match(/data-messages="([^"]+)"/);const messages=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&'));
 assert.equal(messages.sending,'Sending …');assert.match(messages.success,/Thank you/);
});
test('request-local rendering cannot leak a locale and does not convert subscription prices',async()=>{
 const en=await app.publicWebsite('/crm','',{},'en').text(),nb=await app.publicWebsite('/crm','',{},'nb').text(),enAgain=await app.publicWebsite('/crm','',{},'en').text();
 assert.equal(en,enAgain);assert.match(nb,/Kunder & oppfølging/);assert.match(en,/Customers &amp; follow-up/);
 const props={moduleKey:'ringelister',role:'Administrator',price:49,onPurchase:()=>{throw Error('Unexpected purchase')}};
 assert.match(render('en',app.ModuleShowcase,props),/More good conversations/);assert.match(render('en',app.ModuleShowcase,props),/49 kr/);
 assert.match(render('nb',app.ModuleShowcase,props),/Flere gode samtaler/);
 assert.doesNotMatch(render('en',app.ModuleShowcase,{...props,role:'Bruker'}),/Select users and activate/);
});
test('translated notification labels retain the same submitted minute values',()=>{
 for(const locale of ['nb','en']){const html=render(locale,app.ReminderFields,{value:[15],onChange:()=>{throw Error('Unexpected mutation')}});assert.match(html,/<option value="15" selected=""/);assert.match(html,/<option value="1440"/);assert.match(html,/value="custom"/);assert.match(html,locale==='en'?/15 minutes before/:/15 minutter før/);}
});
test('copy escapes variables once and leaves unknown strings and special property names intact',()=>{
 function Sample(){return React.createElement(app.UiText,{text:'Kunder'});}
 assert.equal(render('en',Sample),'Customers');
 assert.equal(app.translateUi('Hele Norge','en'),'All of Norway');assert.equal(app.translateUi('Hele Norge','nb'),'Hele Norge');
 assert.equal(app.translateUi('Ingen innlegg eller e-poster inneholder «{0}». Prøv et annet søk eller bytt fane.','en',{'0':'<img>{0}'}),'No posts or emails contain “<img>{0}”. Try a different search or switch tabs.');
 assert.equal(app.translateUi('Acme & Co','en'),'Acme & Co');assert.equal(app.translateUi('__proto__','en'),'__proto__');assert.equal(app.translateUi(undefined,'en'),'');
});
test('public portfolio presents the real project without fetching customer data',()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('Portfolio must not fetch production data')};try{const html=renderToStaticMarkup(React.createElement(app.Portfolio));assert.match(html,/Joakim Ferdinand Nygård/);assert.match(html,/AI-assisted development/);assert.match(html,/Fictional customers/);assert.match(html,/Explore the working demo/);assert.doesNotMatch(html,/sb_secret_|Bearer |access_token|Fjellheim Elektro/);}finally{globalThis.fetch=original;}
});
test('language changes cannot translate role checks or the canonical activity choices',async()=>{
 const source=await readFile(path.join(root,'app/crm-client.tsx'),'utf8'),ast=ts.createSourceFile('crm-client.tsx',source,99,true,4);
 function visit(n){if(ts.isBinaryExpression(n)&&[ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(n.operatorToken.kind)&&/\.(role|status|stage|customerType)|rolePreview/.test(n.getText(ast)))assert.doesNotMatch(n.getText(ast),/\bui\(/,'Data comparisons must use canonical identifiers');ts.forEachChild(n,visit);}visit(ast);
 assert.match(source,/\["Telefon", "E-post", "Møte", "Annet"\]\.map/);assert.doesNotMatch(source,/\[ui\("Telefon"\)/);
});
