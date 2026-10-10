import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'..'),dir=await mkdtemp(path.join(tmpdir(),'noracre-french-public-'));
await build({stdin:{contents:"export * from './lib/public-site';export * from './lib/public-site-i18n';export * from './lib/enquiry-options';",resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'app.mjs')});
const app=await import(pathToFileURL(path.join(dir,'app.mjs')).href);
after(()=>rm(dir,{recursive:true,force:true}));
const routes=['/','/crm','/moduler','/om-noracre','/kontakt','/demo','/bli-kunde','/bli-partner','/personvern','/missing'];
const visible=s=>s.replace(/<script[^>]*>[\s\S]*?<\/script>/g,'');
const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
test('every public page, metadata and accessibility label renders in French',async()=>{
 for(const route of routes){
  const response=app.publicWebsite(route,'/nettside',{},'fr'),html=await response.text();
  assert.match(html,/<html lang="fr" dir="ltr">/);assert.equal(response.headers.get('Content-Language'),'fr');
  assert.match(html,/Aller au contenu/);assert.match(html,/aria-label="Navigation principale"/);assert.match(html,/aria-label="Langue"/);
  assert.match(html,/href="\/nettside\/crm\?lang=fr"/);assert.match(html,/hreflang="fr"/);assert.match(html,/href="\/nettside[^\"]*\?lang=fr" lang="fr" hreflang="fr" aria-label="Français" aria-current="true"/);
  assert.doesNotMatch(visible(html),/Hopp til innhold|Book en demo|Bli kunde|Bygget for gode kunderelasjoner|Velg modell|Personvern|Illustrasjon av kundeoppfølging/);
  assert.match(html,/rel="canonical" href="https:\/\/noracre\.no[^\"]*\?lang=fr"/);
  assert.match(html,/hreflang="nb" href="https:\/\/noracre\.no[^\"]*\?lang=nb"/);
  assert.match(html,/<title>[^<]+ \| Noracre<\/title>/);assert.doesNotMatch(html,/&amp;amp;/);
 }
});
test('French form translation retains values and carries localized async messages',async()=>{
 for(const route of ['/demo','/bli-kunde','/bli-partner']){
  const html=await app.publicWebsite(route,'',{},'fr').text();
  assert.match(html,/name="company"/);assert.match(html,/name="email"/);assert.match(html,/Entreprise/);
  const messages=JSON.parse(decode(html.match(/data-messages="([^"]+)"/)[1]));
  assert.equal(messages.sending,'Envoi …');assert.match(messages.success,/Merci !/);assert.match(messages.timeout,/confirmation/);
  if(route==='/bli-partner'){assert.match(html,/value="referral">Recommander Noracre/);assert.match(html,/value="sales">Vendez Noracre/);assert.match(messages.success,/partenariat/);}
  else for(const {value} of app.enquiryUserCounts)assert.ok(html.includes(`value="${value}"`));
 }
});
test('explicit language is preserved before fragments and assets retain their URL',async()=>{
 const html=await app.publicWebsite('/','',{},'fr').text();
 assert.match(html,/href="\/moduler\?lang=fr#ringelister"/);assert.match(html,/href="\/moduler\?lang=fr#markedsforing"/);
 assert.doesNotMatch(html,/#(?:ringelister|markedsforing)\?lang=/);assert.match(html,/href="\/favicon.svg"/);
 assert.equal(app.localizePublicHtml('<a href="/crm?view=compact#test">Kunder</a>','fr',''),'<a href="/crm?view=compact&lang=fr#test">Clients</a>');
 for(const locale of ['nb','en','fr']){
  const page=await app.publicWebsite('/','',{},locale).text();
  assert.match(page,new RegExp('href="https://crm\\.noracre\\.no/\\?lang='+locale+'"'));
 }
});
test('scripts, styles, input data and unknown text are not translated or escaped twice',()=>{
 const html='<script>"Kunder"</script><style>.Kunder{color:red}</style><input value="Kunder" name="Kunder"><p>ACME &amp; Co</p><p>Tilbud &amp; e-post</p>';
 const result=app.localizePublicHtml(html,'fr','');
 assert.match(result,/<script>"Kunder"<\/script>/);assert.match(result,/<style>\.Kunder\{color:red\}<\/style>/);assert.match(result,/value="Kunder" name="Kunder"/);
 assert.match(result,/ACME &amp; Co/);assert.match(result,/Devis et e-mails/);assert.doesNotMatch(result,/&amp;amp;/);
 assert.equal(app.localizePublicHtml('<p>__proto__</p>','fr',''),'<p>__proto__</p>');
});
test('dynamic industry stories and every public API error have French copy',async()=>{
 const catalog=app.publicClientTranslations('fr');
 for(const key of ['RÅDGIVNING & TJENESTER · EKSEMPEL','En god relasjon varer lenger enn prosjektet.','HANDEL & LEVERANDØRER · EKSEMPEL','Lukk meny','Vest Kaffe AS · Ansvarlig: Ingrid · Tirsdag'])assert.notEqual(catalog[key],key);
 const source=await readFile(path.join(root,'lib/public-enquiries.ts'),'utf8');
 for(const [_,key] of source.matchAll(/fail\('([^']+)'/g)){assert.ok(catalog[key],`Missing French public error: ${key}`);assert.notEqual(catalog[key],key);}
 const en=JSON.parse(await readFile(path.join(root,'lib/i18n/site-en.json'),'utf8')),fr=JSON.parse(await readFile(path.join(root,'lib/i18n/site-fr.json'),'utf8'));
 for(const key of Object.keys(en))assert.ok(fr[key],`Missing French public copy: ${key}`);
});
test('manual French preference is stored and interactive examples remain French',async()=>{
 const source=await readFile(path.join(root,'public/website/site.js'),'utf8');let cookie='';const handlers=new Map(),output=[];
 const item={dataset:{industry:'tjenester'},setAttribute(){},addEventListener(event,fn){handlers.set(event,fn)}};
 const panel={dataset:{},querySelectorAll(){return ['heading','body','task','detail'].map(key=>({dataset:{story:key},set textContent(value){output.push(value)}}));}};
 const document={get cookie(){return cookie},set cookie(value){cookie=value},getElementById(id){return id==='site-translations'?{textContent:JSON.stringify(app.publicClientTranslations('fr'))}:null},querySelector(selector){return selector==='[data-industry-panel]'?panel:null},querySelectorAll(){return [item]}};
 vm.runInNewContext(source,{document,location:{href:'https://noracre.no/?lang=fr',protocol:'https:'},URL});
 assert.match(cookie,/^noracre-language=fr; Path=\/; Max-Age=31536000; SameSite=Lax; Secure$/);
 handlers.get('click')();assert.ok(output.every(Boolean));assert.match(output[0],/Une bonne relation/);assert.match(output[3],/Responsable : Sara · Lundi/);
});
