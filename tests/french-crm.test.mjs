import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,symlink,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {create,act} from 'react-test-renderer';
const root=path.resolve(import.meta.dirname,'..'),dir=await mkdtemp(path.join(tmpdir(),'noracre-french-crm-'));
await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'));
await build({stdin:{contents:`export * from './lib/i18n';export * from './lib/i18n/react';export * from './lib/i18n/preference';export * from './lib/i18n/ui';export {matchesEmployeeCount,employeeRangeText} from './lib/employee-count';export {HomeCountryPicker} from './components/home-country-picker';export {OperatingCountryPicker} from './components/operating-country-picker';export {Calendar} from './components/ui/calendar';export {ReminderFields} from './components/reminder-fields';`,resolveDir:root},bundle:true,format:'esm',platform:'node',packages:'external',jsx:'automatic',outfile:path.join(dir,'app.mjs')});
const app=await import(pathToFileURL(path.join(dir,'app.mjs')));
after(()=>rm(dir,{recursive:true,force:true}));
const render=(Component,props={})=>renderToStaticMarkup(React.createElement(app.I18nProvider,{locale:'fr'},React.createElement(Component,props)));
test('French catalogues match every English key and preserve interpolation tokens',async()=>{
 const en=JSON.parse(await readFile(path.join(root,'lib/i18n/ui-en.json'),'utf8')),fr=JSON.parse(await readFile(path.join(root,'lib/i18n/ui-fr.json'),'utf8'));
 assert.deepEqual(Object.keys(fr).sort(),Object.keys(en).sort());
 const tokens=s=>[...s.matchAll(/\{(\d+)\}/g)].map(m=>m[1]).sort();
 for(const [key,value] of Object.entries(en)){assert.ok(fr[key].trim(),key);assert.deepEqual(tokens(fr[key]),tokens(value),key);}
 assert.equal(app.createI18n('fr').t('nav.customers'),'Clients');
 assert.equal(app.createI18n('fr').t('common.days',{count:2}),'2 jours');
 assert.equal(app.createI18n('fr').calendarDate('2026-10-10',{day:'numeric',month:'long',year:'numeric'}),'10 octobre 2026');
 assert.equal(app.createI18n('fr').currency,'NOK');
});
test('French employee intervals overlap numeric filters without pretending to be exact counts',()=>{
 assert.equal(app.matchesEmployeeCount({employees:null,employeeRange:'10–19'},'15','30'),true);
 assert.equal(app.matchesEmployeeCount({employees:null,employeeRange:'10–19'},'20','30'),false);
 assert.equal(app.matchesEmployeeCount({employees:null,employeeRange:'1,000–1,999'},'1200','1300'),true);
 assert.equal(app.matchesEmployeeCount({employees:null,employeeRange:'10,000+'},'20000',''),true);
 assert.equal(app.matchesEmployeeCount({employees:0},'0','0'),true);
 assert.equal(app.matchesEmployeeCount({employees:null},'1','50'),false);
 assert.equal(app.matchesEmployeeCount({employees:null},'1','50',true),true);
 assert.equal(app.matchesEmployeeCount({employees:10,employeeRange:'20–49'},'20','49'),false);
 assert.equal(app.matchesEmployeeCount({employeeRange:'10–19'},'30','20'),false);
 assert.equal(app.employeeRangeText('1,000–1,999',app.createI18n('fr').number),'1\u202f000–1\u202f999');
});
test('French copy interpolates once and leaves customer content and prototype strings intact',()=>{
 assert.equal(app.translateUi('Kunder','fr'),'Clients');
 assert.equal(app.translateUi('Behandlet av {0}','fr',{'0':'<img>{1}'}),'Traité par <img>{1}');
 assert.equal(app.translateUi('Acme & Co','fr'),'Acme & Co');
 assert.equal(app.translateUi('__proto__','fr'),'__proto__');
 assert.equal(app.translateUi('Bedriftsregisteret svarte med HTTP 429. Prøv igjen senere.','fr'),'Le registre des entreprises a renvoyé le code HTTP 429. Réessayez plus tard.');
 const html=render(()=>React.createElement(app.UiText,{text:'Kunder'}));assert.equal(html,'Clients');
});
test('French language choice survives reload and stays isolated by organisation',async()=>{
 const originals=Object.fromEntries(['document','localStorage','location','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),saved=new Map();let current,tree;
 try{
  const cookies=new Map();
  Object.defineProperty(globalThis,'document',{value:{get cookie(){return [...cookies].map(([k,v])=>k+'='+v).join('; ');},set cookie(value){const [k,v]=value.split(';')[0].split('=');cookies.set(k,v);},documentElement:{lang:''}},configurable:true});
  Object.defineProperty(globalThis,'localStorage',{value:{setItem:(k,v)=>saved.set(k,v),getItem:k=>saved.get(k)??null},configurable:true});
  Object.defineProperty(globalThis,'location',{value:{protocol:'https:'},configurable:true});
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  function Harness(){current=app.useI18n();return React.createElement('span',null,current.t('nav.customers'));}
  const mount=()=>act(()=>{tree=create(React.createElement(app.I18nProvider,{locale:'en'},React.createElement(Harness)));});
  await mount();await act(()=>current.applyOrganizationLocale('en',41));await act(()=>current.setLocale('fr'));
  assert.equal(current.locale,'fr');assert.equal(document.documentElement.lang,'fr');assert.equal(saved.get('noracre-language:org:41'),'fr');assert.equal(app.readLanguagePreference(document.cookie),'fr');
  await act(()=>current.applyOrganizationLocale('nb',42));assert.equal(current.locale,'nb');assert.equal(app.storedLanguagePreference(document.cookie,app.ACTIVE_LANGUAGE_COOKIE),'nb');assert.equal(app.readLanguagePreference(document.cookie),'fr');
  await act(()=>current.applyOrganizationLocale('en',41));assert.equal(current.locale,'fr');assert.equal(app.readLanguagePreference(document.cookie),'fr');
  await act(()=>tree.unmount());tree=null;
  await mount();await act(()=>current.applyOrganizationLocale('en',41));assert.equal(current.locale,'fr');assert.equal(app.readLanguagePreference(document.cookie),'fr');
 }finally{if(tree)await act(()=>tree.unmount());for(const [key,descriptor]of Object.entries(originals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
test('customer-authored drafts are not passed through the UI translator',async()=>{
 const source=await readFile(path.join(root,'app/crm-client.tsx'),'utf8');
 assert.doesNotMatch(source,/setMessage\(ui\(e\.target\.value\)\)/);
 assert.match(source,/setMessage\(e\.target\.value\)/);
 assert.ok(source.includes('first?.subject ?? ui("Tilbud til {0}"'));
});
test('French country names, calendar navigation and reminders render with canonical input values',()=>{
 const home=render(app.HomeCountryPicker,{value:'FR',onChange:()=>{}});assert.match(home,/Pays d’origine|Pays de l’entreprise/);assert.match(home,/<option value="FR" selected="">France<\/option>/);assert.match(home,/Royaume-Uni/);
 const countries=render(app.OperatingCountryPicker,{value:['FR'],onChange:()=>{}});assert.match(countries,/France/);assert.match(countries,/checked=""/);assert.doesNotMatch(countries,/Land bedriften opererer i/);
 const calendar=render(app.Calendar,{month:new Date(2026,9,1),mode:'single',selected:new Date(2026,9,10),onSelect:()=>{}});assert.match(calendar,/octobre 2026/);assert.match(calendar,/Mois suivant/);assert.match(calendar,/Mois précédent/);assert.doesNotMatch(calendar,/Go to next month|Today,/);
 const reminders=render(app.ReminderFields,{value:[15],onChange:()=>{}});assert.match(reminders,/<option value="15" selected=""/);assert.match(reminders,/15 minutes avant/);
});
