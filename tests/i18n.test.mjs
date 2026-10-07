import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=path.resolve(import.meta.dirname,'..'),dir=await mkdtemp(path.join(tmpdir(),'noracre-i18n-'));
await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'),process.platform==='win32'?'junction':'dir');
await build({stdin:{contents:"export * from './lib/i18n';export * from './lib/i18n/react';export {nb} from './lib/i18n/messages/nb';export {en} from './lib/i18n/messages/en';",resolveDir:root},bundle:true,format:'esm',platform:'node',packages:'external',outfile:path.join(dir,'i18n.mjs')});
const app=await import(pathToFileURL(path.join(dir,'i18n.mjs')));
test('published language selection accepts English and Norwegian with a safe fallback',()=>{
 for(const value of ['nb-NO','no','de','__proto__',null])assert.equal(app.resolvePublishedLocale(value),'nb');
 assert.equal(app.resolvePublishedLocale('en-GB'),'en');
 assert.equal(app.resolveLocale('EN-us'),'en');assert.equal(app.resolveLocale('no-NO'),'nb');
});
test('catalogues have matching keys, placeholders and plural structure',()=>{
 assert.deepEqual(Object.keys(app.en).sort(),Object.keys(app.nb).sort());
 const params=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
 for(const key of Object.keys(app.nb)){const nb=app.nb[key],en=app.en[key];assert.equal(typeof en,typeof nb,key);if(typeof nb==='string')assert.deepEqual(params(en),params(nb),key);else{assert.ok(en.other);for(const form of Object.keys(en))assert.deepEqual(params(en[form]),params(nb.other),key);}}
});
test('messages interpolate variables once, support plural forms and reject missing values',()=>{
 const nb=app.createI18n('nb'),en=app.createI18n('en');
 assert.equal(nb.t('common.unsure'),'Usikker');assert.equal(en.t('common.unsure'),'Not sure');
 assert.equal(nb.t('common.days',{count:1}),'1 dag');assert.equal(nb.t('common.days',{count:2}),'2 dager');assert.equal(en.t('common.days',{count:0}),'0 days');
 assert.throws(()=>nb.t('common.days'));assert.throws(()=>nb.t('followup.planned'));
 assert.equal(en.t('followup.planned',{date:'{count} <script>'}),'Follow-up scheduled for {count} <script>');
});
test('locale, currency and time zone are independent and money is never converted',()=>{
 const en=app.createI18n('en'),us=app.createI18n('en',{currency:'USD',timeZone:'America/New_York'});
 assert.equal(en.currency,'NOK');assert.equal(en.number(1234.5),'1,234.5');assert.equal(us.money(12),new Intl.NumberFormat('en-GB',{style:'currency',currency:'USD'}).format(12));
 const moment=new Date('2026-09-15T08:00:00Z');assert.equal(en.date(moment,{hour:'2-digit',minute:'2-digit'}),'10:00');assert.equal(us.date(moment,{hour:'2-digit',minute:'2-digit'}),'04:00');
 assert.equal(en.date(new Date('2026-01-15T08:00:00Z'),{hour:'2-digit',minute:'2-digit'}),'09:00');
 assert.equal(us.calendarDate('2026-09-15'),en.calendarDate('2026-09-15'));assert.throws(()=>en.calendarDate('2026-02-30'));
});
test('React context is request-local and escapes translated values during server rendering',()=>{
 function Sample(){const {t}=app.useI18n();return React.createElement('span',null,t('followup.planned',{date:'<img>'}));}
 const render=locale=>renderToStaticMarkup(React.createElement(app.I18nProvider,{locale},React.createElement(Sample)));
 assert.equal(render('en'),'<span>Follow-up scheduled for &lt;img&gt;</span>');assert.equal(render('nb'),'<span>Planlagt oppfølging &lt;img&gt;</span>');assert.equal(render('en'),'<span>Follow-up scheduled for &lt;img&gt;</span>');
});
test.after(()=>rm(dir,{recursive:true,force:true}));
