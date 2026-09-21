import {pathToFileURL} from 'node:url';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(tmpdir(),'invoice-'));
await build({stdin:{contents:"export * from './lib/invoice-report';export * from './lib/billing-history';",resolveDir:path.resolve('.')},bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'report.mjs')});
const {invoiceReport,invoicePage,billingHistory}=await import(pathToFileURL(path.join(dir,'report.mjs')));
let id=0;
const e=(type,at,extra={})=>({id:++id,organizationId:1,entityType:type,entityId:1,membershipId:1,moduleKey:'markedsforing',label:'Bedrift',active:true,monthlyPrice:type==='user'?499:type==='license'?49:0,eventKind:'activated',occurredAt:at,referenceAt:'',...extra});
const setup=at=>['organization','user','module','license'].map(type=>e(type,at));
const report=(events,now='2026-05-01T12:00:00Z')=>invoiceReport(events,[{id:1,name:'Bedrift'}],new Date(now)).rows[0];
test('499 + 49 activated on day 15 of a 30-day month invoices exactly 274',()=>{
 const r=report(setup('2026-04-15T10:00:00Z'));assert.equal(r.previousOre,27400);assert.equal(r.ytdOre,27400);assert.equal(r.previousComplete,true);
});
test('full months, leap year and January invoice previous December without adding it to YTD',()=>{
 const events=setup('2023-12-31T10:00:00Z');
 assert.equal(report(events,'2024-03-01T12:00:00Z').previousOre,54800);
 assert.equal(report(setup('2024-02-15T10:00:00Z'),'2024-03-01T12:00:00Z').previousOre,26455);
 const january=report(events,'2026-01-01T12:00:00Z');assert.equal(january.previousOre,54800);assert.equal(january.ytdOre,0);
});
test('historic price changes split days and round only once per company/month',()=>{
 const events=setup('2026-03-31T10:00:00Z');events.push(e('user','2026-04-15T10:00:00Z',{monthlyPrice:599}));
 assert.equal(report(events).previousOre,59800);
 const tiny=setup('2026-04-29T10:00:00Z').map(x=>({...x,monthlyPrice:['user','license'].includes(x.entityType)?1:0}));assert.equal(report(tiny).previousOre,7);
});
test('each user and licensed module billed separately, with organization and member gates',()=>{
 const events=setup('2026-03-31T10:00:00Z');events.push(e('user','2026-04-15T10:00:00Z',{entityId:2}),e('license','2026-04-15T10:00:00Z',{entityId:2,membershipId:2}));
 assert.equal(report(events).previousOre,82200);
 events.push(e('organization','2026-04-15T11:00:00Z',{active:false}));assert.equal(report(events).previousOre,27400);
 const member=setup('2026-03-31T10:00:00Z');member.push(e('user','2026-04-15T10:00:00Z',{active:false}));assert.equal(report(member).previousOre,27400);
});
test('module deactivation and reactivation preserve CRM fee, deleted license stops its charge',()=>{
 const events=setup('2026-03-31T10:00:00Z');events.push(e('module','2026-04-10T10:00:00Z',{active:false}),e('module','2026-04-20T10:00:00Z'));
 assert.equal(report(events).previousOre,53167);
 events.push(e('license','2026-04-20T11:00:00Z',{active:false,eventKind:'deleted'}));assert.equal(report(events).previousOre,51533);
});
test('Norwegian date near midnight and DST use calendar days, future events ignored',()=>{
 const events=setup('2026-04-14T22:30:00Z');assert.equal(report(events).previousOre,27400);
 events.push(e('user','2026-06-01T00:00:00Z',{monthlyPrice:999}));assert.equal(report(events).previousOre,27400);
 assert.equal(report(setup('2026-03-15T11:00:00Z'),'2026-04-01T12:00:00Z').previousOre,28284);
});
test('YTD accrues only completed days and does not claim unknown baseline history',()=>{
 const events=setup('2026-04-15T10:00:00Z');assert.equal(report(events,'2026-05-16T12:00:00Z').ytdOre,53916);
 const baseline=events.map(x=>({...x,eventKind:'baseline',referenceAt:'2025-01-01'}));const r=report(baseline);assert.equal(r.previousComplete,false);assert.equal(r.ytdComplete,false);assert.equal(r.ytdOre,27400);
 assert.equal(report(baseline,'2026-06-01T12:00:00Z').previousComplete,true);
});
test('companies never share rates; search paginates at 10 and clamps empty pages',()=>{
 const rows=Array.from({length:23},(_,i)=>({id:i+1,name:`Bedrift ${String(i+1).padStart(2,'0')}`}));
 const r=invoiceReport(setup('2026-03-31T10:00:00Z'),rows,new Date('2026-05-01T12:00:00Z'));
 assert.equal(r.rows[0].previousOre,54800);assert.equal(r.rows[1].previousComplete,false);
 assert.equal(invoicePage(r.rows,'',0).rows.length,10);assert.equal(invoicePage(r.rows,'',1).rows.length,10);assert.equal(invoicePage(r.rows,'',2).rows.length,3);
 assert.equal(invoicePage(r.rows,' BEDRIFT 23 ',9).rows[0].organizationId,23);assert.equal(invoicePage(r.rows,'ukjent',9).page,0);
 const other=setup('2026-03-31T10:00:00Z').map(x=>({...x,organizationId:2,monthlyPrice:x.entityType==='user'?100:0}));assert.equal(invoiceReport([...setup('2026-03-31T10:00:00Z'),...other],rows,new Date('2026-05-01T12:00:00Z')).rows[1].previousOre,10000);
});
process.on('exit',()=>rm(dir,{recursive:true,force:true}));

test('company history preserves lifecycle, user identity, price changes and baseline uncertainty',()=>{
 const events=[e('user','2026-04-01T12:00:00Z',{label:'Ola',eventKind:'baseline'}),e('license','2026-04-02T12:00:00Z'),e('license','2026-04-03T12:00:00Z',{monthlyPrice:79}),e('license','2026-04-04T12:00:00Z',{active:false,monthlyPrice:79}),e('user','2026-04-05T12:00:00Z',{organizationId:2,label:'Other tenant'})];
 const rows=billingHistory(events,1);assert.equal(rows.length,4);assert.equal(rows[0].action,'Deaktivert');assert.equal(rows[1].action,'Pris endret');assert.equal(rows[1].previousPrice,49);assert.equal(rows[2].item,'Markedsføring · Ola');assert.equal(rows[3].action,'Registrert startstatus');assert.equal(events.length,5);
});


test('partner attribution preserves opening subscription state but excludes revenue before assignment',()=>{
 const events=setup('2025-12-31T12:00:00Z');events.push(e('license','2026-04-20T10:00:00Z',{active:false}));
 const rows=invoiceReport(events,[{id:1,name:'Referred company',revenueFrom:'2026-04-15T10:00:00Z'}],new Date('2026-05-01T12:00:00Z')).rows;
 // April 16-20: 548/month; April 21-30: 499/month. Previous months are excluded.
 assert.equal(rows[0].previousOre,25767);assert.equal(rows[0].ytdOre,25767);assert.equal(rows[0].previousComplete,true);
 const baseline=setup('2026-04-01T10:00:00Z').map(x=>({...x,eventKind:'baseline'}));
 const r=invoiceReport(baseline,[{id:1,name:'Referred',revenueFrom:'2026-04-15T10:00:00Z'}],new Date('2026-05-01T12:00:00Z')).rows[0];assert.equal(r.ytdComplete,true);assert.equal(r.ytdOre,27400);
});
