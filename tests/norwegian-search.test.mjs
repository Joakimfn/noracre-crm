import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(path.join(tmpdir(),'noracre-search-'));
await build({stdin:{contents:`export * from './lib/norwegian-search';export * from './lib/call-list-ai';export {default as catalog} from './lib/call-list-catalog.json';export {organizationForms} from './lib/call-list-options';`,resolveDir:path.resolve(import.meta.dirname,'..')},outfile:path.join(dir,'search.mjs'),bundle:true,platform:'node',format:'esm'});
const m=await import(pathToFileURL(path.join(dir,'search.mjs')));const today='2026-09-14';
const options={...m.catalog,organizationForms:m.organizationForms};
const base={count:20,minEmployees:1,maxEmployees:15,organizationForms:['AS'],locationCodes:[],industryCodes:[],establishedFrom:'',establishedTo:'',requirePhone:false,requireEmail:false,clarifications:[]};
for(const [prompt,from,to] of [
 ['etablert 2024-2025','2024-01-01','2025-12-31'],
 ['stiftet mellom 01.02.2024 og 2026','2024-02-01',today],
 ['stiftet 2024 til 2026','2024-01-01',today],
 ['nyetablerte bedrifter','2025-09-14',today],
 ['nystartede bedrifter på Sørlandet','2025-09-14',today],
 ['bedrifter etablert i 2026','2026-01-01',today],
 ['bedrifter etablert i fjor','2025-01-01','2025-12-31'],
 ['bedrifter etablert hittil i år','2026-01-01',today],
 ['stiftet fra 1. januar 2024 til 31. desember 2025','2024-01-01','2025-12-31'],
 ['fra 2024 til 2025','2024-01-01','2025-12-31'],
 ['etablert etter 2024','2025-01-01',today],
 ['etablert før 2025','','2024-12-31'],
 ['etablert de siste 365 dager','2025-09-14',today],
 ['etablert siste året','2025-09-14',today],
 ['etablert siste 6 måneder','2026-03-14',today],
 ['etablert siste to år','2024-09-14',today],
 ['stiftet 01.01.2024–31.12.2025','2024-01-01','2025-12-31'],
 ['etablert 2025 eller 2026','2025-01-01',today],
 ['etablert 2025-01-01 til 2026-12-31','2025-01-01',today],
 ['etablert 29.02.2024','2024-02-29','2024-02-29'],
])test('Norwegian dates: '+prompt,()=>assert.deepEqual(m.norwegianSearchDates(prompt,today),{establishedFrom:from,establishedTo:to}));
for(const [prompt,codes]of [
 ['Sørlandet',['42']],['Østlandet',['03','31','32','33','34','39','40']],['Vestlandet',['11','15','46']],['Nord-Norge',['18','55','56']],['Nordnorge',['18','55','56']],['Midt Norge',['15','50']],['Trøndelag',['50']],['Viken',['31','32','33']],['på Sørlandet og Vestlandet',['42','11','15','46']],['Sør-Norge',['03','11','15','31','32','33','34','39','40','42','46','50']],
])test('Norwegian region: '+prompt,()=>assert.deepEqual(m.norwegianRegions(prompt),codes.map(x=>'county:'+x)));
test('Norwegian dates validate actual calendar days, year bounds and local midnight',()=>{
 assert.equal(m.norwegianDate('2026-09-14'),'14.09.2026');assert.equal(m.isoDate('1.2.2025'),'2025-02-01');
 assert.throws(()=>m.isoDate('31.02.2025'),/gyldig dato/);assert.throws(()=>m.norwegianSearchDates('stiftet 31.02.2025',today),/gyldig dato/);
 assert.throws(()=>m.norwegianSearchDates('etablert 2027',today),/Startdatoen/);
 assert.equal(m.norwegianSearchDates('20 bedrifter med 1-15 ansatte',today),null);
 assert.equal(m.norwegianSearchDates('bedrifter med 2024-2025 ansatte',today),null);
 assert.equal(m.osloToday(new Date('2026-09-13T22:30:00Z')),today);
});
test('deterministic date and region conventions override incorrect model guesses',()=>{
 const f=m.validateCallListAIResponse({...base,establishedFrom:'2027-01-01',establishedTo:'2027-12-31',locationCodes:['county:18'],clarifications:[{kind:'location',phrase:'Sørlandet'}]},options,'20 bedrifter på Sørlandet etablert 2024-2025',today);
 assert.deepEqual(f.locationCodes,['county:42']);assert.equal(f.establishedFrom,'2024-01-01');assert.equal(f.establishedTo,'2025-12-31');
});
test('real unsupported requirements need literal evidence; invented model reasons never reach the UI',()=>{
 const prompt='20 bedrifter på Sørlandet etablert 2024-2025';
 assert.doesNotThrow(()=>m.validateCallListAIResponse({...base,clarifications:[{kind:'country',phrase:'timer og minutter'},{kind:'location',phrase:'2024-2025'}]},options,prompt,today));
 assert.throws(()=>m.validateCallListAIResponse({...base,clarifications:[{kind:'country',phrase:'Sverige'}]},options,'bedrifter i Sverige',today),/dekker Norge/);
 assert.throws(()=>m.validateCallListAIResponse({...base,clarifications:[{kind:'revenue',phrase:'omsetning over 1000000'}]},options,'bedrifter med omsetning over 1000000',today),/Omsetning/);
 assert.throws(()=>m.validateCallListAIResponse({...base,locationCodes:['county:99']},options,'bedrifter på ukjent sted',today),/gyldig fylke/);
});
after(async()=>{assert.equal(path.dirname(dir),path.resolve(tmpdir()));assert.ok(path.basename(dir).startsWith('noracre-search-'));await rm(dir,{recursive:true,force:true});});

test('unsupported criteria cannot silently become an unrestricted Norwegian search',()=>{
 for(const prompt of ['10 bedrifter i Sverige','10 bedrifter i Danmark','10 bedrifter i Polen','10 bedrifter med omsetning over 1000000'])assert.throws(()=>m.validateCallListAIResponse(base,options,prompt,today),/dekker Norge|Omsetning/);
 for(const prompt of ['10 bedrifter på Sørlandet','10 bedrifter i Nord-Norge','bedrifter i Ås','bedrifter uten krav til omsetning'])assert.doesNotThrow(()=>m.checkSearchScope(prompt));
});

test('everyday trades and spelling variants work in Midt-Norge',()=>{
 for(const word of ['håndtverk','håndverk','handverk','håndverkere']){
 const prompt='Jeg ønsker en liste over 10 bedrifter som driver med '+word+' i midt-norge';
 const f=m.validateCallListAIResponse({...base,count:10,clarifications:[{kind:'industry',phrase:word}]},options,prompt,today);
 assert.equal(f.count,10);assert.deepEqual(f.locationCodes,['county:15','county:50']);
 for(const code of ['43.210','43.221','43.320','43.910','43.340'])assert.ok(f.industryCodes.includes(code));
 }
});

test('simple trade searches avoid inference without silently dropping extra requirements',()=>{
 const f=m.simpleCallListSearch('Jeg ønsker en liste over 10 bedrifter som driver med håndtverk i midt-norge',options,today);assert.equal(f.count,10);assert.deepEqual(f.locationCodes,['county:15','county:50']);assert.ok(f.industryCodes.includes('43.221'));
 assert.equal(m.simpleCallListSearch('10 håndverkere i Midt-Norge med over 5 millioner i omsetning',options,today),null);
 assert.equal(m.simpleCallListSearch('Finn 10 snekkere i Midt-Norge med 5 ansatte',options,today),null);
});
