import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(path.join(tmpdir(),'noracre-demo-'));
after(()=>rm(dir,{recursive:true,force:true}));
await build({entryPoints:['lib/demo-crm.ts'],bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'demo.mjs')});
const {createDemoRuntime}=await import(pathToFileURL(path.join(dir,'demo.mjs')));
const runtime=()=>createDemoRuntime(new Date('2026-09-21T10:00:00Z')).request;
const body=(method,data)=>({method,body:JSON.stringify(data)});
const read=async(request,path)=>await(await request(path)).json();

test('demo has consistent linked customers, history, follow-ups, employees without the partner model',async()=>{
 const request=runtime(),{companies}=await read(request,'/api/companies'),{activities}=await read(request,'/api/activities');
 assert.equal(companies.length,36);assert.equal(companies.reduce((n,c)=>n+c.searchContacts.length,0),72);
 assert.equal(activities.length,132);assert.equal(activities.filter(a=>!a.completedAt).length,24);
 assert.ok(activities.every(a=>companies.some(c=>c.id===a.companyId)));
 assert.ok(activities.some(a=>a.completedAt.startsWith('2026-09-21')));
 const session=await read(request,'/api/session');
 assert.equal(session.role,'Administrator');assert.ok(session.organizations.every(o=>!o.isPartner));
 const admin=await read(request,'/api/admin');assert.equal(admin.role,'Administrator');assert.equal(admin.members.length,6);assert.ok(admin.members.every(m=>m.role!=='Partner'));
 assert.equal((await request('/api/partners')).status,403);
 assert.equal((await read(request,'/api/call-lists')).entries.length,18);
 assert.equal((await read(request,'/api/marketing')).posts.length,12);
});

test('edits and new follow-ups stay inside one demo session and completing a task refreshes the customer',async()=>{
 const a=runtime(),b=runtime();
 await a('/api/companies',body('PATCH',{id:1,name:'Endret demokunde'}));
 assert.equal((await read(a,'/api/companies')).companies[0].name,'Endret demokunde');
 assert.equal((await read(b,'/api/companies')).companies[0].name,'Fjellheim Elektro AS');
 const response=await a('/api/activities',body('POST',{companyId:36,isTask:true,kind:'Møte',note:'Demooppfølging',dueAt:'2026-09-22T10:00:00',reminderMinutes:[1440,15]}));
 const {activity}=await response.json();assert.equal(activity.completedAt,'');
 assert.equal((await read(a,'/api/companies')).companies.find(c=>c.id===36).nextAction,'Demooppfølging');
 await a('/api/activities',body('PATCH',{id:activity.id,completedAt:'2026-09-21T12:00:00'}));
 assert.equal((await read(a,'/api/companies')).companies.find(c=>c.id===36).nextActionDate,'');
 await a('/api/contacts',body('PATCH',{id:1,name:'Demo Kontakt',email:'demo@example.com'}));
 assert.equal((await read(a,'/api/contacts?companyId=1')).contacts[0].name,'Demo Kontakt');
 await a('/api/companies?id=1',{method:'DELETE'});
 assert.equal((await read(a,'/api/contacts?companyId=1')).contacts.length,0);
 assert.equal((await read(a,'/api/activities?companyId=1')).activities.length,0);
 assert.equal((await read(runtime(),'/api/companies')).companies.length,36);
});

test('meeting bookings are reflected in demo follow-ups',async()=>{
 const request=runtime();
 assert.equal((await request('/api/call-lists',body('POST',{type:'status',id:1,status:'Møte booket',meetingAt:'2026-09-25T10:00:00',meetingNote:'Gjennomgang',reminderMinutes:[1440,15]}))).status,200);
 assert.ok((await read(request,'/api/activities?companyId=1')).activities.some(a=>a.kind==='Møte'&&a.note==='Gjennomgang'&&!a.completedAt));
 assert.equal((await read(request,'/api/call-lists')).entries.length,17);
});

test('demo never calls the network and blocks external effects and unrecognized operations',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw Error('Network forbidden');};
 try{
  const request=runtime();
  for(const url of ['/api/email','/api/email/connect','/api/social/publish','/api/social/connect','/api/superadmin','/api/import','/api/partner-payments','/api/attachments','/api/unknown','https://crm.noracre.no/api/companies']){
   assert.equal((await request(url,body('POST',{id:1}))).status,403,url);
  }
  const member=await request('/api/admin',body('POST',{type:'member',name:'Demo',email:'demo@example.com'}));
  assert.equal((await member.json()).invitationSent,false);
  await request('/api/companies',body('POST',{name:'Kun lokalt'}));
  assert.equal(calls,0);
 }finally{globalThis.fetch=original;}
});
