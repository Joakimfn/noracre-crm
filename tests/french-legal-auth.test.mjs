import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import TestRenderer,{act} from 'react-test-renderer';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..'),dir=await mkdtemp(path.join(tmpdir(),'noracre-french-legal-'));
await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'));
await build({stdin:{contents:"export {default as About,generateMetadata as aboutMetadata} from './app/om/page';export {default as Privacy,generateMetadata as privacyMetadata} from './app/personvern/page';export {default as Terms,generateMetadata as termsMetadata} from './app/vilkar/page';export {default as Dpa,generateMetadata as dpaMetadata} from './app/databehandleravtale/page';export {default as AuthGate} from './app/auth-gate';export {I18nProvider} from './lib/i18n/react';export {translateLegal} from './lib/legal-i18n';",resolveDir:root},bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'test-next',setup(b){b.onResolve({filter:/^next\/(link|headers)$/},args=>({path:args.path,namespace:'test-next'}));b.onLoad({filter:/.*/,namespace:'test-next'},args=>({contents:args.path==='next/link'?"import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{href,...props},children);}":"export const cookies=async()=>({get:()=>({value:globalThis.testLocale??'nb'})});",loader:'js',resolveDir:root}));}}],outfile:path.join(dir,'app.mjs')});
const app=await import(pathToFileURL(path.join(dir,'app.mjs')).href);
const authApp=await import(pathToFileURL(path.join(dir,'app.mjs')).href+'?auth');
after(()=>rm(dir,{recursive:true,force:true}));
const render=(locale,Component)=>renderToStaticMarkup(React.createElement(app.I18nProvider,{locale},React.createElement(Component)));
test('French CRM legal and product pages have translated static copy with unchanged business facts',()=>{
 for(const Component of [app.About,app.Privacy,app.Terms,app.Dpa]){
  const html=render('fr',Component);assert.match(html,/Noracre/);assert.match(html,/href="mailto:jfn@noracre.no"/);assert.doesNotMatch(html,/SIST OPPDATERT|Tilbake til|Opplysninger og registrerte|Formål og behandlingsansvar/);
 }
 const terms=render('fr',app.Terms),dpa=render('fr',app.Dpa),privacy=render('fr',app.Privacy);
 assert.match(terms,/droit norvégien/);assert.match(terms,/trois derniers mois/);assert.match(terms,/90 jours/);assert.match(dpa,/90 jours/);
 assert.match(privacy,/openid, email et gmail.send/);assert.match(privacy,/AES-GCM/);assert.match(privacy,/section id="english" lang="en"/);
 assert.match(render('nb',app.Terms),/Avtalen reguleres av norsk rett/);assert.match(render('en',app.Terms),/Avtalen reguleres av norsk rett/);
});
test('French legal metadata resolves per request and text interpolation remains escaped',async()=>{
 try{globalThis.testLocale='fr';for(const metadata of [app.aboutMetadata,app.privacyMetadata,app.termsMetadata,app.dpaMetadata]){const result=await metadata();assert.ok(result.title);assert.ok(result.description);assert.doesNotMatch(result.title,/Om Noracre|Bruksvilkår|Databehandleravtale|Personvernerklæring/);}
 globalThis.testLocale='nb';assert.equal((await app.termsMetadata()).title,'Bruksvilkår for Noracre CRM');}
 finally{delete globalThis.testLocale;}
 assert.equal(app.translateLegal(' ukjent <script> ','fr'),' ukjent <script> ');assert.equal(app.translateLegal(' og ','fr'),' et ');assert.equal(app.translateLegal(' __proto__ ','fr'),' __proto__ ');
});
test('all French legal copy and metadata is covered without translating the English summary',async()=>{
 const dictionary=JSON.parse(await readFile(path.join(root,'lib/i18n/legal-fr.json'),'utf8'));
 for(const name of ['om','personvern','vilkar','databehandleravtale']){
  const source=await readFile(path.join(root,'app',name,'page.tsx'),'utf8'),ast=ts.createSourceFile('page.tsx',source,99,true,4);
  function visit(node){
   if(ts.isJsxAttribute(node)&&node.name.text==='text'&&ts.isJsxExpression(node.initializer)&&ts.isStringLiteral(node.initializer.expression)){
    const key=node.initializer.expression.text.trim().replace(/\s+/g,' ');assert.ok(Object.hasOwn(dictionary,key),`Missing French legal copy in ${name}: ${key}`);
   }
   ts.forEachChild(node,visit);
  }visit(ast);
 }
});
test('French sign-in offers native language choices and password network failures release the busy state',async()=>{
 const saved=Object.fromEntries(['fetch','document','location','window','localStorage','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,globalThis[key]]));let renderer;
 const stored=new Map();
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 globalThis.document={documentElement:{lang:'nb'},cookie:''};globalThis.location={protocol:'https:',hash:'#type=recovery&access_token=test&refresh_token=test'};
 globalThis.window={location:globalThis.location,history:{replaceState(){}}};globalThis.localStorage={getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)};
 globalThis.fetch=async url=>{if(url==='/api/auth/config')return Response.json({configured:true,url:'https://auth.example.test',anonKey:'public-test'});throw Error('offline');};
 try{
  await act(async()=>{renderer=TestRenderer.create(React.createElement(authApp.I18nProvider,{locale:'fr'},React.createElement(authApp.AuthGate)));});
  const languageButtons=renderer.root.findAllByType('button').filter(b=>['nb','en','fr'].includes(b.props.lang));assert.equal(languageButtons.length,3);assert.equal(languageButtons.find(b=>b.props.lang==='fr').props['aria-pressed'],true);
  await act(async()=>{renderer.root.findAllByType('input').find(i=>i.props.type==='password').props.onChange({target:{value:'secret123'}});});
  await act(async()=>{await renderer.root.findByType('form').props.onSubmit({preventDefault(){}});});
  const submit=renderer.root.findAllByType('button').find(b=>b.props.type==='submit');assert.equal(submit.props.disabled,false);assert.match(JSON.stringify(renderer.toJSON()),/Une erreur/);
  await act(async()=>{languageButtons.find(b=>b.props.lang==='en').props.onClick();});assert.match(globalThis.document.cookie,/noracre-language=en/);assert.equal(globalThis.document.documentElement.lang,'en');
 }finally{await act(async()=>renderer?.unmount());for(const [key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
