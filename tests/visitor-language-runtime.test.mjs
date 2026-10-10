import {test,after,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';

const root=path.resolve(import.meta.dirname,'..'),dir=await mkdtemp(path.join(tmpdir(),'noracre-visitor-language-'));
await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'));
await build({stdin:{contents:"export * from './lib/i18n/react';export * from './lib/i18n/preference';export {default as AuthGate} from './app/auth-gate';",resolveDir:root},bundle:true,format:'esm',platform:'node',packages:'external',jsx:'automatic',outfile:path.join(dir,'app.mjs'),plugins:[{name:'isolated-login',setup(b){
 b.onResolve({filter:/^\.\/crm-client$|^@\/lib\/api-client$|^@\/components\/ui\/dialog$/},a=>({path:a.path,namespace:'test'}));
 b.onLoad({filter:/.*/,namespace:'test'},a=>{
  if(a.path==='./crm-client')return {contents:"import React,{useEffect} from 'react';import {useI18n} from './lib/i18n/react';export default function CRM(){const i=useI18n();useEffect(()=>i.applyOrganizationLocale(globalThis.testCompanyLanguage,41),[]);return React.createElement('p',null,i.t('nav.customers'));}",loader:'js',resolveDir:root};
  if(a.path==='@/lib/api-client')return {contents:"export const supabaseSessionKey='isolated-session';export async function apiFetch(){return new Response('{}',{status:globalThis.testAuthenticated?200:401});}",loader:'js'};
  return {contents:"export const Dialog=()=>null;export const DialogContent=()=>null;export const DialogTitle=()=>null;export const DialogDescription=()=>null;export const DialogHeader=()=>null;export const DialogTrigger=()=>null;export const DialogClose=()=>null;",loader:'js'};
 });
}}]});
const app=await import(pathToFileURL(path.join(dir,'app.mjs')));
after(()=>rm(dir,{recursive:true,force:true}));
const keys=['document','location','window','localStorage','fetch','IS_REACT_ACT_ENVIRONMENT','testAuthenticated','testCompanyLanguage'];
const original=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
let tree,current,cookies,saved;
const text=node=>typeof node==='string'?node:(node?.children??[]).map(text).join('');
function environment({url='https://crm.noracre.no/',cookie='',storage=[],blocked=false}={}){
 cookies=new Map(cookie.split(';').map(x=>x.trim().split('=')).filter(x=>x[0]));saved=new Map(storage);
 const location=new URL(url);
 Object.defineProperty(globalThis,'location',{value:location,configurable:true});
 Object.defineProperty(globalThis,'window',{value:{location,history:{state:null,replaceState(_state,_title,value){location.href=new URL(value,location.href).href;}}},configurable:true});
 Object.defineProperty(globalThis,'document',{value:{documentElement:{lang:''},get cookie(){return [...cookies].map(([k,v])=>k+'='+v).join('; ');},set cookie(value){const [k,v]=value.split(';')[0].split('=');cookies.set(k,v);}},configurable:true});
 Object.defineProperty(globalThis,'localStorage',{value:{getItem(k){if(blocked)throw Error('blocked');return saved.get(k)??null;},setItem(k,v){if(blocked)throw Error('blocked');saved.set(k,v);}},configurable:true});
 Object.defineProperty(globalThis,'fetch',{value:async url=>{if(String(url)==='/api/auth/config')return Response.json({configured:true,url:'https://auth.example.test',anonKey:'test-key'});globalThis.testAuthenticated=true;return Response.json({access_token:'isolated-test-token'});},configurable:true});
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.testAuthenticated=false;globalThis.testCompanyLanguage='nb';
}
function Harness(){current=app.useI18n();return React.createElement('p',null,current.t('nav.customers'));}
async function mount(locale='en',child=React.createElement(Harness)){
 await act(async()=>{tree=create(React.createElement(app.I18nProvider,{locale},child));});
}
afterEach(async()=>{if(tree)await act(()=>tree.unmount());tree=undefined;for(const [key,descriptor] of Object.entries(original)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});

test('a manual choice on the actual login form survives authentication and organisation loading',async()=>{
 environment({storage:[['noracre-language:org:41','nb']]});
 await mount('nb',React.createElement(app.AuthGate));
 const english=tree.root.findAllByType('button').find(b=>b.props.lang==='en');
 await act(()=>english.props.onClick());
 await act(()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
 assert.equal(text(tree.toJSON()),'Customers');assert.equal(document.documentElement.lang,'en');
 assert.equal(saved.get('noracre-language:org:41'),'en');
 assert.equal(cookies.get(app.LANGUAGE_COOKIE),'en');assert.equal(cookies.get(app.ACTIVE_LANGUAGE_COOKIE),'en');
});
test('public-site language handoff outranks an older CRM preference and survives reload',async()=>{
 environment({url:'https://crm.noracre.no/?lang=en',cookie:'noracre-language=fr',storage:[['noracre-language:org:41','fr']]});
 globalThis.testAuthenticated=true;
 await mount('en',React.createElement(app.AuthGate));
 assert.equal(text(tree.toJSON()),'Customers');assert.equal(saved.get('noracre-language:org:41'),'en');
 await act(()=>tree.unmount());tree=undefined;location.href='https://crm.noracre.no/';
 await mount();await act(()=>current.applyOrganizationLocale('fr',41));
 assert.equal(current.locale,'en');
});
test('manual preferences remain isolated across organisation switches and automatic defaults do not replace the saved cookie',async()=>{
 environment();await mount();
 await act(()=>current.applyOrganizationLocale('nb',41));
 assert.equal(current.locale,'nb');assert.equal(cookies.has(app.LANGUAGE_COOKIE),false);
 await act(()=>current.setLocale('fr'));
 await act(()=>current.applyOrganizationLocale('en',42));assert.equal(current.locale,'en');
 assert.equal(cookies.get(app.LANGUAGE_COOKIE),'fr');assert.equal(cookies.get(app.ACTIVE_LANGUAGE_COOKIE),'en');
 await act(()=>current.applyOrganizationLocale('nb',41));assert.equal(current.locale,'fr');
});
test('a saved legacy preference is respected at first login and stays stable on subsequent data refreshes',async()=>{
 environment({cookie:'noracre-language=en'});await mount();
 await act(()=>current.applyOrganizationLocale('nb',41));assert.equal(current.locale,'en');
 await act(()=>current.applyOrganizationLocale('nb',41));assert.equal(current.locale,'en');
});
test('an existing per-organisation manual preference wins over a fallback cookie',async()=>{
 environment({cookie:'noracre-language=en',storage:[['noracre-language:org:41','fr']]});await mount();
 await act(()=>current.applyOrganizationLocale('nb',41));assert.equal(current.locale,'fr');
});
test('new manual choices remove stale language queries while preserving organisation and fragment',async()=>{
 environment({url:'https://crm.noracre.no/?organization=41&lang=nb#settings'});await mount('nb');
 await act(()=>current.setLocale('en'));
 assert.equal(location.href,'https://crm.noracre.no/?organization=41#settings');
 await act(()=>current.applyOrganizationLocale('nb',41));assert.equal(current.locale,'en');
});
test('blocked browser storage does not erase a manual choice during data refresh or organisation switches',async()=>{
 environment({blocked:true});await mount();
 await act(()=>current.applyOrganizationLocale('nb',41));await act(()=>current.setLocale('en'));
 await act(()=>current.applyOrganizationLocale('nb',41));assert.equal(current.locale,'en');
 await act(()=>current.applyOrganizationLocale('fr',42));assert.equal(current.locale,'fr');
 await act(()=>current.applyOrganizationLocale('nb',41));assert.equal(current.locale,'en');
});
