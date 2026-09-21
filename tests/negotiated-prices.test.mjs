import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
test('all migrations apply and negotiated prices update only the selected company and preserve history',()=>{
 const db=new DatabaseSync(':memory:');
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()) db.exec(readFileSync('drizzle/'+file,'utf8'));
 const org=db.prepare("INSERT INTO organizations(name,created_at,crm_price,ring_price,marketing_price) VALUES(?,?,?,?,?) RETURNING id");
 const a=Number(org.get('Price A','2026-09-12',199,29,69).id),b=Number(org.get('Price B','2026-09-12',299,59,99).id);
 const add=db.prepare("INSERT INTO memberships(organization_id,user_id,email,name,created_at) VALUES(?,?,?,?,?) RETURNING id");
 const user=Number(add.get(a,'a','a@example.test','A','2026-09-12').id);add.get(b,'b','b@example.test','B','2026-09-12');
 assert.equal(db.prepare("SELECT monthly_price FROM billing_events WHERE entity_type='user' AND entity_id=? ORDER BY id DESC LIMIT 1").get(user).monthly_price,199);
 for(const [key,price] of [['ringelister',29],['markedsforing',69]]) {
  db.prepare("INSERT INTO organization_modules(organization_id,module_key,price_per_user,activated_at) VALUES(?,?,?,?)").run(a,key,price,'2026-09-12');
  db.prepare("INSERT INTO module_licenses(organization_id,membership_id,module_key,price_per_user,activated_at) VALUES(?,?,?,?,?)").run(a,user,key,price,'2026-09-12');
 }
 db.prepare('UPDATE organizations SET is_partner=1 WHERE id=?').run(a);
 db.prepare("UPDATE memberships SET role='Partner' WHERE id=?").run(user);
 const oldEvents=db.prepare('SELECT * FROM billing_events ORDER BY id').all();
 db.prepare('UPDATE organizations SET crm_price=209,ring_price=39,marketing_price=79 WHERE id=?').run(a);
 assert.deepEqual(db.prepare('SELECT * FROM billing_events WHERE id<=? ORDER BY id').all(oldEvents.at(-1).id),oldEvents);
 assert.deepEqual(db.prepare('SELECT price_per_user FROM module_licenses WHERE organization_id=? ORDER BY module_key').all(a).map(x=>x.price_per_user),[79,39]);
 assert.equal(db.prepare('SELECT crm_price FROM organizations WHERE id=?').get(b).crm_price,299);
 assert.equal(db.prepare("SELECT monthly_price FROM billing_events WHERE entity_type='user' AND entity_id=? ORDER BY id DESC LIMIT 1").get(user).monthly_price,209);
 db.prepare('UPDATE memberships SET active=0 WHERE id=?').run(user);db.prepare('UPDATE memberships SET active=1 WHERE id=?').run(user);
 assert.equal(db.prepare("SELECT monthly_price FROM billing_events WHERE entity_type='user' AND entity_id=? ORDER BY id DESC LIMIT 1").get(user).monthly_price,209);
 const count=db.prepare('SELECT count(*) n FROM billing_events').get().n;
 db.prepare('UPDATE organizations SET crm_price=209,ring_price=39,marketing_price=79 WHERE id=?').run(a);
 assert.equal(db.prepare('SELECT count(*) n FROM billing_events').get().n,count);
 db.prepare('UPDATE organizations SET crm_price=0,ring_price=0,marketing_price=0 WHERE id=?').run(a);
 assert.equal(db.prepare('SELECT SUM(price_per_user) amount FROM module_licenses WHERE organization_id=?').get(a).amount,0);
 assert.throws(()=>db.prepare('UPDATE organizations SET crm_price=-1 WHERE id=?').run(a));
 db.close();
});
