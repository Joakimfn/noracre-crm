import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(path.join(tmpdir(),'noracre-report-'));
await build({entryPoints:['lib/operations-report.ts'],bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'report.mjs')});
const {operationsReport}=await import(pathToFileURL(path.join(dir,'report.mjs')));
const migration=await readFile('drizzle/0016_billing_history.sql','utf8');
test('ledger captures baseline and every lifecycle change atomically without no-op duplicates',()=>{
 const db=new DatabaseSync(':memory:');db.exec(`
 CREATE TABLE organizations(id INTEGER PRIMARY KEY,name TEXT,status TEXT,created_at TEXT);
 CREATE TABLE memberships(id INTEGER PRIMARY KEY,organization_id INTEGER,name TEXT,email TEXT,active INTEGER,created_at TEXT);
 CREATE TABLE organization_modules(id INTEGER PRIMARY KEY,organization_id INTEGER,module_key TEXT,active INTEGER,price_per_user INTEGER,activated_at TEXT);
 CREATE TABLE module_licenses(id INTEGER PRIMARY KEY,organization_id INTEGER,membership_id INTEGER,module_key TEXT,active INTEGER,price_per_user INTEGER,activated_at TEXT);
 INSERT INTO organizations VALUES(1,'Bedrift','Aktiv','2026-01-01');
 INSERT INTO memberships VALUES(1,1,'Bruker','test@example.no',1,'2026-02-01');
 `);db.exec(migration);
 assert.equal(db.prepare('select count(*) n from billing_events').get().n,2);
 assert.equal(db.prepare("select reference_at from billing_events where entity_type='user'").get().reference_at,'2026-02-01');
 db.exec('UPDATE memberships SET active=1 WHERE id=1');assert.equal(db.prepare('select count(*) n from billing_events').get().n,2);
 db.exec("UPDATE memberships SET active=0 WHERE id=1; UPDATE memberships SET active=1 WHERE id=1; INSERT INTO organization_modules VALUES(1,1,'markedsforing',1,49,'2026-09-11'); INSERT INTO module_licenses VALUES(1,1,1,'markedsforing',1,49,'2026-09-11'); UPDATE module_licenses SET active=0 WHERE id=1; UPDATE module_licenses SET active=1 WHERE id=1; DELETE FROM module_licenses WHERE id=1;");
 assert.deepEqual(db.prepare("select event_kind from billing_events where entity_type='license' order by id").all().map(x=>x.event_kind),['activated','deactivated','activated','deleted']);
 const count=db.prepare('select count(*) n from billing_events').get().n;
 db.exec('BEGIN; UPDATE memberships SET active=0 WHERE id=1; ROLLBACK;');assert.equal(db.prepare('select count(*) n from billing_events').get().n,count);
 db.exec("UPDATE organizations SET status='Deaktivert' WHERE id=1");assert.equal(db.prepare('select active from billing_events order by id desc limit 1').get().active,0);db.close();
});
test('MRR uses month-end lifecycle, paid licenses and active organization/member/module gates',()=>{
 let id=0;const e=(type,entity,at,active=true,extra={})=>({id:++id,organizationId:1,entityType:type,entityId:entity,membershipId:1,moduleKey:'markedsforing',label:'Test',active,monthlyPrice:type==='user'?399:type==='license'?49:0,eventKind:'activated',occurredAt:at,referenceAt:'',...extra});
 const events=[e('organization',1,'2026-07-01T00:00:00.000Z'),e('user',1,'2026-07-02T00:00:00.000Z'),e('module',1,'2026-07-03T00:00:00.000Z'),e('license',1,'2026-07-04T00:00:00.000Z'),e('user',1,'2026-08-01T00:00:00.000Z',false),e('user',1,'2026-09-01T00:00:00.000Z'),e('license',1,'2026-09-02T00:00:00.000Z',true,{monthlyPrice:79})];
 let report=operationsReport(events,new Date('2026-09-11T12:00:00Z'));
 assert.equal(report.months.find(m=>m.month==='2026-06').available,false);
 assert.equal(report.months.find(m=>m.month==='2026-07').mrr,448);
 assert.equal(report.months.find(m=>m.month==='2026-08').mrr,0);
 assert.equal(report.months.at(-1).mrr,478);assert.equal(report.months.at(-1).licenses,1);
 events.push(e('module',1,'2026-09-03T00:00:00.000Z',false));assert.equal(operationsReport(events,new Date('2026-09-11')).months.at(-1).mrr,399);
 events.push(e('organization',1,'2026-09-04T00:00:00.000Z',false));report=operationsReport(events,new Date('2026-09-11'));assert.equal(report.months.at(-1).mrr,0);assert.equal(report.months.at(-1).users,0);assert.equal(report.months.at(-1).organizations,0);
});
test('baseline does not invent historical MRR from old creation dates',()=>{
 const events=[{id:1,entityType:'organization',entityId:1,organizationId:1,active:true,monthlyPrice:0,eventKind:'baseline',occurredAt:'2026-09-11T12:00:00.000Z',referenceAt:'2025-01-01'}];
 const report=operationsReport(events,new Date('2026-09-11T13:00:00Z'));assert.equal(report.months.at(-2).available,false);assert.equal(report.months.at(-1).partial,true);
});
process.on('exit',()=>{rm(dir,{recursive:true,force:true});});
