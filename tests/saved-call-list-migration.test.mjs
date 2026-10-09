import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
test('migration preserves existing queue and history and adds safe Norwegian defaults',()=>{
 const sql=new DatabaseSync(':memory:');
 sql.exec("CREATE TABLE organizations(id INTEGER PRIMARY KEY,name TEXT); CREATE TABLE companies(id INTEGER PRIMARY KEY,organization_id INTEGER,name TEXT); CREATE TABLE call_list_entries(id INTEGER PRIMARY KEY,organization_id INTEGER,name TEXT,status TEXT); INSERT INTO organizations VALUES(1,'Existing'),(2,'Empty'); INSERT INTO companies VALUES(1,1,'Customer'); INSERT INTO call_list_entries VALUES(1,1,'Queue','Ny'),(2,1,'History','Kontaktet');");
 sql.exec(readFileSync(new URL('../drizzle/0027_saved_call_lists.sql',import.meta.url),'utf8'));
 assert.deepEqual(sql.prepare('SELECT operating_countries FROM organizations').all().map(r=>r.operating_countries),['["NO"]','["NO"]']);
 const lists=sql.prepare('SELECT * FROM saved_call_lists').all();assert.equal(lists.length,1);assert.equal(lists[0].created_by_membership_id,0);assert.equal(lists[0].name,'Tidligere ringeliste');
 assert.deepEqual(sql.prepare('SELECT status,list_id,country FROM call_list_entries ORDER BY id').all().map(r=>({...r})),[{status:'Ny',list_id:lists[0].id,country:'NO'},{status:'Kontaktet',list_id:lists[0].id,country:'NO'}]);
 assert.equal(sql.prepare('SELECT country FROM companies').get().country,'NO');
 assert.throws(()=>sql.exec("INSERT INTO call_list_assignments(organization_id,list_id,membership_id,assigned_by,created_at) VALUES(1,1,1,'Admin','now'),(1,1,1,'Admin','now')"));
 sql.close();
});
