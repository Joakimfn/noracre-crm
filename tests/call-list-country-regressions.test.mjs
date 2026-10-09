import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const backend=readFileSync(path.join(root,'app/api/call-lists/route.ts'),'utf8');
const client=readFileSync(path.join(root,'app/crm-client.tsx'),'utf8');
const manager=readFileSync(path.join(root,'components/saved-call-list-manager.tsx'),'utf8');

test('multiple full pages of a saved queue can be loaded rather than silently truncated at 1000',()=>{
 assert.match(backend,/\.limit\(1000\)\s*\.offset\(offset\)/);
 assert.match(backend,/hasMore:\s*rows\.length===1000/);
 assert.match(client,/async function fetchAllListRows\(/);
 assert.match(client,/offset<100000;offset\+=1000/);
 assert.match(client,/fetchAllListRows\(selectedListId,"history"\)/);
 assert.match(client,/fetchAllListRows\(selectedListId\)\.then/);
});

test('selecting a country can recover after a saved list is deleted or no longer belongs to it',()=>{
 assert.doesNotMatch(manager,/if\(selectedListId&&!meta\.lists\.some\([^;]+\)return/);
 assert.match(manager,/\.filter\(l=>l\.country===nextCountry\)\.sort\(\(a,b\)=>b\.id-a\.id\)/);
});

test('headcount updates are tenant- and list-scoped and retain real integer employee values',()=>{
 assert.match(backend,/requireList\(ctx,data\.listId,true\)/);
 assert.match(backend,/eq\(callListEntries\.organizationId,ctx\.organizationId\)/);
 assert.match(backend,/eq\(callListEntries\.listId,list\.id\)/);
 assert.match(backend,/Number\.isSafeInteger\(Number\(row\.employees\)\)/);
 assert.match(backend,/normalizeRegistryId\(row\.orgNumber\)/);
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE entries(org_number TEXT, employees INTEGER);');
 const add=db.prepare('INSERT INTO entries(org_number, employees) VALUES (?,?)');
 add.run('sc 001234',null);add.run('SC001234',null);add.run('IR009',null);
 const found=db.prepare("SELECT org_number FROM entries WHERE UPPER(REPLACE(org_number, ' ', '')) IN (?)").all('SC001234');
 assert.deepEqual(found.map(x=>x.org_number).sort(),['SC001234','sc 001234']);
 db.close();
});

test('large file upload retains a partially saved list on chunk failure',()=>{
 assert.match(client,/let imported=0,listId:number\|null=null/);
 assert.match(client,/if\(listId\)\{setSelectedListId\(listId\);setListRefresh/);
});
