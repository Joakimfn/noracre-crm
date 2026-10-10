import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const migration=readFileSync(path.join(root,'drizzle/0030_outbound_workspace.sql'),'utf8');
const schema=readFileSync(path.join(root,'db/schema.ts'),'utf8');
const api=readFileSync(path.join(root,'app/api/outbound/route.ts'),'utf8');
const ui=readFileSync(path.join(root,'components/outbound-sales-desk.tsx'),'utf8');
const create=readFileSync(path.join(root,'app/api/admin/route.ts'),'utf8');
const crm=readFileSync(path.join(root,'app/crm-client.tsx'),'utf8');

test('outbound migration applies to a pre-existing company database without losing existing CRM data',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE organizations (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO organizations(id,name) VALUES (1,'Existing CRM customer');");
 db.exec(migration);
 const row=db.prepare('SELECT * FROM organizations WHERE id=1').get();
 assert.equal(row.name,'Existing CRM customer');
 assert.equal(row.outbound_enabled,0);
 assert.equal(row.outbound_currency,'NOK');
 assert.equal(row.outbound_commission_bps,0);
 db.close();
});
test('same registered company cannot be claimed by two sellers in the same tenant and country',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE organizations (id INTEGER PRIMARY KEY, name TEXT);');db.exec(migration);
 const insert=db.prepare("INSERT INTO outbound_company_ownership(organization_id,country,org_number,assigned_membership_id,updated_at) VALUES (?,?,?,?,?)");
 insert.run(1,'GB','SC000123',17,'2026-10-10');
 assert.throws(()=>insert.run(1,'GB','SC000123',18,'2026-10-10'),/UNIQUE/);
 insert.run(2,'GB','SC000123',29,'2026-10-10');
 insert.run(1,'IE','SC000123',20,'2026-10-10');
 db.close();
});
test('call log is append-only and can record repeated calls for the same company',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE organizations (id INTEGER PRIMARY KEY, name TEXT);');db.exec(migration);
 const add=db.prepare("INSERT INTO outbound_call_logs(organization_id,entry_id,membership_id,outcome,created_at) VALUES (1,70,5,?,'2026-10-10')");
 add.run('Ikke svar');add.run('Sentralbord');add.run('Interessert');
 assert.equal(db.prepare('SELECT COUNT(*) AS count FROM outbound_call_logs WHERE entry_id=70').get().count,3);
 db.close();
});
test('payments cannot be credited twice for the same reference in the same tenant',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE organizations(id INTEGER PRIMARY KEY,name TEXT);');db.exec(migration);
 const add=db.prepare("INSERT INTO outbound_deal_payments(organization_id,entry_id,membership_id,payment_reference,paid_amount_minor,currency,commission_bps,created_at) VALUES(?,?,?,?,?,?,?,?)");
 add.run(1,4,9,'invoice-101',49900,'NOK',2500,'2026-10-10');
 assert.throws(()=>add.run(1,4,9,'invoice-101',49900,'NOK',2500,'2026-10-10'),/UNIQUE/);
 add.run(2,4,9,'invoice-101',49900,'NOK',2500,'2026-10-10');
 assert.equal(db.prepare('SELECT paid_amount_minor*commission_bps/10000 AS cents FROM outbound_deal_payments WHERE organization_id=1').get().cents,12475);
 db.close();
});
test('suppression entries are tenant scoped, country scoped and unique',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE organizations(id INTEGER PRIMARY KEY,name TEXT);');db.exec(migration);
 const add=db.prepare("INSERT INTO outbound_suppression(organization_id,country,org_number,created_by_membership_id,created_at) VALUES(1,?,?,6,'2026-10-10')");
 add.run('FR','123456789');assert.throws(()=>add.run('FR','123456789'),/UNIQUE/);
 add.run('GB','123456789');db.close();
});
test('call logging is permissioned and suppresses opt-out, while payments require admin confirmation',()=>{
 assert.match(api,/requireTenant\(request\)/);
 assert.match(api,/requireModuleAccess\(ctx.organizationId,ctx.membershipId,'ringelister'\)/);
 assert.match(api,/await requireList\(ctx,entry.listId\)/);
 assert.match(api,/outboundSuppression/);
 assert.match(api,/if\(blocked.length&&outcome!=='Reservert mot kontakt'\)/);
 assert.match(api,/body.confirmed!==true/);
 assert.match(api,/onConflictDoNothing\(\)\.returning/);
 assert.match(api,/eq\(outboundCallLogs.organizationId,ctx.organizationId\)/);
});
test('outbound access is opt-in for each customer and existing standard CRM remains selectable',()=>{
 assert.match(create,/outboundEnabled: data.outboundEnabled === true/);
 assert.match(crm,/OutboundSalesDesk organizationId=\{organizationId\}/);
 assert.match(crm,/\(!outboundEnabled\|\|showStandard\)/);
 assert.match(schema,/outboundEnabled: integer\("outbound_enabled"/);
 assert.match(ui,/languages=\{/);
 assert.match(ui,/lang==="fr"/);
 assert.match(ui,/nextCallAt/);
});
