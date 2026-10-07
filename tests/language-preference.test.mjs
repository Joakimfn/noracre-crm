import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=path.resolve(import.meta.dirname,'..'),dir=await mkdtemp(path.join(tmpdir(),'noracre-language-'));
await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'));
await build({stdin:{contents:"export * from './lib/i18n/preference';export {default as RootLayout} from './app/layout';export {useI18n} from './lib/i18n/react';",resolveDir:root},bundle:true,format:'esm',platform:'node',packages:'external',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'isolated-request-cookie',setup(build){build.onResolve({filter:/^next\/headers$/},()=>({path:'next/headers',namespace:'test'}));build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:"export async function cookies(){return {get:()=>globalThis.requestLanguage?{value:globalThis.requestLanguage}:undefined}}",loader:'js'}));}}],outfile:path.join(dir,'app.mjs')});
const app=await import(pathToFileURL(path.join(dir,'app.mjs')));after(()=>rm(dir,{recursive:true,force:true}));
test('language preference survives a simulated reload and is isolated from authentication cookies',()=>{
 const cookie=app.languagePreferenceCookie('en',true);assert.equal(app.readLanguagePreference(cookie),'en');assert.equal(app.readLanguagePreference('session=abc; '+cookie),'en');assert.equal(app.readLanguagePreference('other-noracre-language=en'),'nb');assert.match(cookie,/Path=\/; Max-Age=31536000; SameSite=Lax; Secure$/);assert.doesNotMatch(app.languagePreferenceCookie('nb',false),/Secure/);
 for(const value of [null,'','noracre-language=__proto__','noracre-language=de','noracre-language=en; injected=1'])assert.equal(app.readLanguagePreference(value),value==='noracre-language=en; injected=1'?'en':'nb');
});
test('server HTML language and initial React translation agree on every request',async()=>{
 function Sample(){return React.createElement('p',null,app.useI18n().t('nav.customers'));}
 try{for(const [locale,label] of [['en','Customers'],['nb','Kunder'],['en','Customers'],['__proto__','Kunder'],[undefined,'Kunder']]){globalThis.requestLanguage=locale;const tree=await app.RootLayout({children:React.createElement(Sample)}),html=renderToStaticMarkup(tree);assert.match(html,new RegExp('<html lang="'+(locale==='en'?'en':'nb')+'"'));assert.match(html,new RegExp('<p>'+label+'</p>'));}}finally{delete globalThis.requestLanguage;}
});
