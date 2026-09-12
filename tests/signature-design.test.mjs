import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,symlink,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import postcss from 'postcss';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const css=postcss.parse(await readFile('app/globals.css','utf8'));
function palette(dark){const vars={};css.walkRules(rule=>{if(rule.selector===':root'||(dark&&rule.selector==='.dark'))rule.walkDecls(d=>{if(d.prop.startsWith('--'))vars[d.prop]=d.value;});});return vars;}
function rgb(value,vars){if(value.startsWith('var('))return rgb(vars[value.slice(4,-1)],vars);let h=value.slice(1);if(h.length===3)h=h.split('').map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);}
function luminance(c){return c.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);}
for(const dark of [false,true])test(`${dark?'dark':'light'}: primary text and controls meet 4.5:1 contrast`,()=>{
 const vars=palette(dark);for(const [ink,paper] of [['--foreground','--background'],['--foreground','--card'],['--muted-foreground','--background'],['--muted-foreground','--card'],['--primary-foreground','--primary'],['--secondary-foreground','--secondary'],['--foreground','--control-background'],['--muted-foreground','--control-background'],['--danger-ink','--card'],['--success-ink','--card']]){
 const [a,b]=[luminance(rgb(vars[ink],vars)),luminance(rgb(vars[paper],vars))].sort((a,b)=>b-a);assert.ok((a+.05)/(b+.05)>=4.5,`${ink} on ${paper}: ${((a+.05)/(b+.05)).toFixed(2)}`);
 }
});
const dir=await mkdtemp(path.join(tmpdir(),'noracre-signature-'));await symlink(path.resolve('node_modules'),path.join(dir,'node_modules'));
await build({stdin:{contents:(await readFile('app/crm-client.tsx','utf8'))+'\nexport {Customers,Nav};',resolveDir:path.resolve('app'),loader:'tsx'},bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',outfile:path.join(dir,'ui.mjs')});
const ui=await import(pathToFileURL(path.join(dir,'ui.mjs')));
test('customer book retains accessible selection and exposes a no-results state without losing the record',()=>{
 const company={id:1,name:'EnBedriftMedEtLangtNavn'.repeat(8),stage:'Ny kunde',customerType:'Bedrift',orgNumber:'123456789',note:'Et lagret notat',nextActionDate:'',lastContactAt:''};
 const props={list:[company],selected:company,query:'',setQuery(){},select(){},update(){},contact(){},contacts:[],selectedContactId:0,selectContact(){},addContact(){},history:[],removeHistory(){},attachments:[],upload(){},uploading:false,download(){},removeAttachment(){},organizationId:1,add(){},onFollowupsChanged:async()=>{},activityRevision:[]};
 const html=renderToStaticMarkup(React.createElement(ui.Customers,props));assert.match(html,/aria-pressed="true"/);assert.ok(html.includes(company.name));assert.match(html,/Et lagret notat/);assert.match(html,/aria-label="Kundekort:/);
 const empty=renderToStaticMarkup(React.createElement(ui.Customers,{...props,list:[],query:'ukjent'}));assert.match(empty,/Ingen kunder passer søket ditt/);assert.match(empty,/Et lagret notat/);
});
test('compact navigation keeps an accessible name and current page state',()=>{
 const html=renderToStaticMarkup(React.createElement(ui.Nav,{a:true,text:'Markedsføring',click(){},ico:null}));assert.match(html,/aria-current="page"/);assert.match(html,/aria-label="Markedsføring"/);
});
process.on('exit',()=>{rm(dir,{recursive:true,force:true});});
