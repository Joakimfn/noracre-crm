import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
test('partner migration preserves existing companies and enforces referral foreign keys',()=>{
 const db=new DatabaseSync(':memory:');db.exec("PRAGMA foreign_keys=ON; CREATE TABLE organizations(id INTEGER PRIMARY KEY,name TEXT,status TEXT,created_at TEXT); CREATE TABLE memberships(id INTEGER PRIMARY KEY,organization_id INTEGER,name TEXT,email TEXT,active INTEGER,created_at TEXT); CREATE TABLE organization_modules(id INTEGER PRIMARY KEY,organization_id INTEGER,module_key TEXT,active INTEGER,price_per_user INTEGER,activated_at TEXT); CREATE TABLE module_licenses(id INTEGER PRIMARY KEY,organization_id INTEGER,membership_id INTEGER,module_key TEXT,active INTEGER,price_per_user INTEGER,activated_at TEXT); INSERT INTO organizations VALUES(1,'Existing','Aktiv','2026-01-01');");
 db.exec(readFileSync('drizzle/0016_billing_history.sql','utf8'));
 const count=db.prepare('SELECT COUNT(*) n FROM billing_events').get().n;
 db.exec(readFileSync('drizzle/0025_partners.sql','utf8'));
 const org=db.prepare('SELECT * FROM organizations WHERE id=1').get();assert.equal(org.name,'Existing');assert.equal(org.is_partner,0);assert.equal(org.referred_by_partner_id,null);assert.equal(org.partner_assigned_at,'');
 db.exec("INSERT INTO organizations(id,name,status,created_at,is_partner) VALUES(2,'Partner','Aktiv','2026-09-21',1); UPDATE organizations SET referred_by_partner_id=2,partner_assigned_at='2026-09-21' WHERE id=1;");
 assert.equal(db.prepare('SELECT COUNT(*) n FROM billing_events').get().n,count+1);
 assert.throws(()=>db.exec('UPDATE organizations SET referred_by_partner_id=999 WHERE id=1'),/FOREIGN KEY/);
 db.exec('DELETE FROM organizations WHERE id=2');assert.equal(db.prepare('SELECT referred_by_partner_id p FROM organizations WHERE id=1').get().p,null);db.close();
});
