import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const dir=await mkdtemp(path.join(tmpdir(),'noracre-maintenance-'));
await build({entryPoints:[fileURLToPath(new URL('../worker/maintenance.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'worker.mjs')});
const {applyScheduledDeactivations,refreshBrregBatch,osloSchedule}=await import(pathToFileURL(path.join(dir,'worker.mjs')));
function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(`CREATE TABLE team_members(id INTEGER PRIMARY KEY,organization_id INTEGER,email TEXT,active INTEGER);CREATE TABLE memberships(id INTEGER PRIMARY KEY,active INTEGER,scheduled_disable_at TEXT DEFAULT '',organization_id INTEGER,email TEXT);
 CREATE TABLE organizations(id INTEGER PRIMARY KEY,status TEXT,scheduled_disable_at TEXT DEFAULT '',deactivated_at TEXT DEFAULT '',retain_until TEXT DEFAULT '');
 CREATE TABLE companies(id INTEGER PRIMARY KEY,organization_id INTEGER,customer_type TEXT DEFAULT 'Bedrift',org_number TEXT,name TEXT,industry TEXT,city TEXT,employees INTEGER,synced_at TEXT DEFAULT '',note TEXT DEFAULT 'Private note',phone TEXT DEFAULT 'Private phone');
 CREATE TABLE background_jobs(key TEXT PRIMARY KEY,day TEXT DEFAULT '',cursor INTEGER DEFAULT 0,completed_at TEXT DEFAULT '',lease_until TEXT DEFAULT '',failures INTEGER DEFAULT 0);
 INSERT INTO organizations(id,status) VALUES(1,'Aktiv');`);
 const db={prepare(query){let params=[];const statement={bind(...p){params=p;return statement;},async run(){return sql.prepare(query).run(...params)},async first(){return sql.prepare(query).get(...params)??null},async all(){return {results:sql.prepare(query).all(...params)}}};return statement;},async batch(statements){sql.exec('BEGIN');try{const r=[];for(const statement of statements)r.push(await statement.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 return {sql,db};
}
test('03:30 Oslo follows winter and summer time',()=>{
 assert.equal(osloSchedule(new Date('2027-01-01T02:29Z')).ready,false);
 assert.equal(osloSchedule(new Date('2027-01-01T02:30Z')).ready,true);
 assert.equal(osloSchedule(new Date('2027-07-01T01:29Z')).ready,false);
 assert.equal(osloSchedule(new Date('2027-07-01T01:30Z')).ready,true);
});
test('deactivation applies only due entries and retains organization data for 90 days',async()=>{
 const {sql,db}=fixture();sql.exec("INSERT INTO memberships(id,active,scheduled_disable_at) VALUES(1,1,'2027-01-01T00:00:00.000Z'),(2,1,'2027-01-02T00:00:00.000Z');UPDATE organizations SET scheduled_disable_at='2027-01-01T00:00:00.000Z'");
 await applyScheduledDeactivations(db,'2027-01-01T00:00:00.000Z');
 assert.equal(sql.prepare('SELECT active FROM memberships WHERE id=1').get().active,0);
 assert.equal(sql.prepare('SELECT active FROM memberships WHERE id=2').get().active,1);
 const org=sql.prepare('SELECT * FROM organizations').get();assert.equal(org.status,'Deaktivert');assert.equal(org.retain_until,'2027-04-01T00:00:00.000Z');
 await applyScheduledDeactivations(db,'2027-01-01T00:01:00.000Z');assert.equal(sql.prepare('SELECT retain_until FROM organizations').get().retain_until,org.retain_until);sql.close();
});
test('Brreg updates at most ten customers per tick, preserves private fields and records failures',async()=>{
 const {sql,db}=fixture();for(let id=1;id<=12;id++)sql.prepare('INSERT INTO companies(id,organization_id,org_number,name) VALUES(?,1,?,?)').run(id,String(100000000+id),'Old');
 let calls=0;const fetcher=async url=>{calls++;const org=String(url).split('/').at(-1);if(org==='100000002')return new Response('',{status:503});return Response.json({organisasjonsnummer:org,navn:'Updated',antallAnsatte:8});};
 await refreshBrregBatch(db,new Date('2027-01-01T02:29Z'),fetcher);assert.equal(calls,0);
 await refreshBrregBatch(db,new Date('2027-01-01T02:30Z'),fetcher);assert.equal(calls,10);
 assert.equal(sql.prepare('SELECT count(*) n FROM companies WHERE name=\'Updated\'').get().n,9);
 assert.equal(sql.prepare('SELECT name FROM companies WHERE id=2').get().name,'Old');
 assert.equal(sql.prepare('SELECT note,phone FROM companies WHERE id=1').get().note,'Private note');
 await refreshBrregBatch(db,new Date('2027-01-01T02:31Z'),fetcher);assert.equal(calls,12);
 const job=sql.prepare('SELECT * FROM background_jobs').get();assert.ok(job.completed_at);assert.equal(job.failures,1);
 await refreshBrregBatch(db,new Date('2027-01-01T02:32Z'),fetcher);assert.equal(calls,12);
 await refreshBrregBatch(db,new Date('2027-01-02T02:30Z'),fetcher);assert.equal(calls,22);sql.close();
});
test('new migration applies to populated existing tables without overwriting old columns',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec("CREATE TABLE memberships(id INTEGER PRIMARY KEY,active INTEGER);CREATE TABLE organizations(id INTEGER PRIMARY KEY,status TEXT);INSERT INTO memberships VALUES(1,1);INSERT INTO organizations VALUES(1,'Aktiv');");
 sql.exec(await readFile(new URL('../drizzle/0017_scheduled_maintenance.sql',import.meta.url),'utf8'));
 assert.equal(sql.prepare('SELECT scheduled_disable_at,active FROM memberships').get().active,1);
 assert.equal(sql.prepare('SELECT scheduled_disable_at FROM organizations').get().scheduled_disable_at,'');sql.close();
});
test.after(()=>rm(dir,{recursive:true,force:true}));
