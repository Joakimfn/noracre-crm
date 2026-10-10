import {test, beforeEach, afterEach, after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {drizzle} from 'drizzle-orm/sqlite-proxy';
import {getTableConfig} from 'drizzle-orm/sqlite-core';
import {mkdtemp, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const dir = await mkdtemp(path.join(tmpdir(), 'outbound-company-access-'));
await build({
  stdin: {contents: "export * as companies from './app/api/companies/route';export * as contacts from './app/api/contacts/route';export * as activities from './app/api/activities/route';export * as attachments from './app/api/attachments/route';export * as imports from './app/api/import/route';export * as exports from './app/api/export/route';export * as companyAccess from './lib/outbound-company-access';export {requireTenant} from './lib/tenant';export * as schema from './db/schema';export {actorRef} from './lib/actor-names';", resolveDir: root},
  bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: path.join(dir, 'runtime.mjs'),
  plugins: [{name: 'isolated-runtime', setup(builder) {
    builder.onResolve({filter: /^@\/db$/}, () => ({path: 'db', namespace: 'isolated'}));
    builder.onResolve({filter: /^cloudflare:workers$/}, () => ({path: 'env', namespace: 'isolated'}));
    builder.onResolve({filter: /^next\//}, args => ({path: args.path, namespace: 'isolated'}));
    builder.onLoad({filter: /.*/, namespace: 'isolated'}, ({path: name}) => ({contents: name === 'db' ? 'export const getDb=()=>globalThis.testDb' : name === 'env' ? 'export const env={SUPABASE_URL:"https://auth.test",SUPABASE_ANON_KEY:"public",get BUCKET(){return globalThis.testBucket}}' : 'export const redirect=()=>{}'}));
  }}], nodePaths: [path.join(root, 'node_modules')],
});
await symlink(path.join(root, 'node_modules'), path.join(dir, 'node_modules'));
const runtime = await import(pathToFileURL(path.join(dir, 'runtime.mjs')));
const realFetch = globalThis.fetch;
let sql, queries, bucketCalls;

function insert(table, data) {
  const columns = Object.keys(data);
  sql.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...Object.values(data));
}
function request(user = 2, body, query = '', method = body === undefined ? 'GET' : 'POST') {
  return new Request(`https://crm.test/api/resource${query}`, {method, headers: {authorization: `Bearer ${user}`, 'x-organization-id': '1', 'content-type': 'application/json'}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
}

beforeEach(() => {
  sql = new DatabaseSync(':memory:');
  queries=[];bucketCalls=[];
  for (const table of Object.values(runtime.schema)) {
    const config = getTableConfig(table);
    sql.exec(`CREATE TABLE "${config.name}" (${config.columns.map(column => `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}${column.notNull ? ' NOT NULL' : ''}${column.default !== undefined ? ' DEFAULT ' + (typeof column.default === 'string' ? "'" + column.default.replaceAll("'", "''") + "'" : Number(column.default)) : ''}`).join(',')})`);
    for (const index of config.indexes) if (index.config.columns.every(column => typeof column.name === 'string'))
      sql.exec(`CREATE ${index.config.unique ? 'UNIQUE ' : ''}INDEX "${index.config.name}" ON "${config.name}" (${index.config.columns.map(column => `"${column.name}"`).join(',')})`);
  }
  globalThis.testDb = drizzle(async (query, params, method) => {
    assert.ok(params.length<=100,`D1 accepts at most 100 bound parameters; got ${params.length}`);
    queries.push({query,params});
    const statement = sql.prepare(query); statement.setReturnArrays(true);
    return {rows: method === 'run' ? (statement.run(...params), []) : method === 'get' ? statement.get(...params) : statement.all(...params)};
  });
  globalThis.testDb.batch = async statements => {
    sql.exec('BEGIN');
    try {const result = []; for (const statement of statements) result.push(await statement); sql.exec('COMMIT'); return result;}
    catch (error) {sql.exec('ROLLBACK'); throw error;}
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://auth.test/auth/v1/user');
    const id = options.headers.Authorization.replace('Bearer ', '');
    return Response.json({id, email: `${id}@test.no`, email_confirmed_at: '2026-01-01', user_metadata: {full_name: `User ${id}`}});
  };
  globalThis.testBucket={get:async key=>{bucketCalls.push(['get',key]);return {body:'private file'};},put:async key=>{bucketCalls.push(['put',key]);},delete:async key=>{bucketCalls.push(['delete',key]);}};
  for (const id of [1, 2]) insert('organizations', {id, name: `Org ${id}`, outbound_enabled: 1, created_at: '2026-01-01'});
  for (const id of [1, 2, 3]) insert('memberships', {id, organization_id: 1, user_id: String(id), email: `${id}@test.no`, name: `User ${id}`, role: id === 1 ? 'Administrator' : 'Bruker', created_at: '2026-01-01'});
  for (const [id, org, country, number, assignment] of [
    [1,1,'NO','111111111',runtime.actorRef({id:'2',displayName:'Old display name'})],
    [2,1,'NO','222222222',runtime.actorRef({id:'3',displayName:'User 3'})],
    [3,2,'NO','333333333',runtime.actorRef({id:'2',displayName:'User 2'})],
    [4,1,'FR','55210055400013',runtime.actorRef({id:'3',displayName:'User 3'})],
    [5,1,'FR','55210055500013',runtime.actorRef({id:'2',displayName:'User 2'})],
    [6,1,'NO','666666666','User 2'],
  ]) {
    insert('companies', {id, organization_id: org, country, org_number: number, name: `Customer ${id}`, assigned_to: assignment});
    insert('contacts', {id, organization_id: org, company_id: id, name: `Contact ${id}`, email: `${id}@customer.test`, created_at: '2026-01-01'});
    insert('activities', {id, organization_id: org, company_id: id, company_name: `Customer ${id}`, kind: 'Notat', note: `Private ${id}`, created_at: '2026-01-01'});
    insert('attachments',{id,organization_id:org,company_id:id,filename:`private-${id}.txt`,object_key:`files/${id}`,content_type:'text/plain',size:12,uploaded_by:'User 2',created_at:'2026-01-01'});
  }
  for (const [number, owner] of [['552100554',2], ['552100555',3]]) insert('outbound_company_ownership', {organization_id: 1, country: 'FR', org_number: number, assigned_membership_id: owner, updated_at: '2026-01-01'});
});
afterEach(() => {sql.close(); delete globalThis.testDb;delete globalThis.testBucket; globalThis.fetch = realFetch;});
after(() => rm(dir, {recursive: true, force: true}));

test('company lists use stable seller identity and canonical French ownership without leaking peer contacts', async () => {
  const response = await runtime.companies.GET(request());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(new Set(data.companies.map(company => company.id)), new Set([1,4,6]));
  assert.ok(data.companies.every(company => company.searchContacts.every(contact => contact.companyId === company.id)));
  assert.ok(!JSON.stringify(data.companies).includes('Contact 2'));
  const admin = await (await runtime.companies.GET(request(1))).json();
  assert.deepEqual(new Set(admin.companies.map(company => company.id)), new Set([1,2,4,5,6]));
});

test('contact reading, updating and deleting reject another seller and another tenant', async () => {
  for (const companyId of [2,3,5]) {
    assert.equal((await runtime.contacts.GET(request(2, undefined, `?companyId=${companyId}`))).status, 404);
    assert.equal((await runtime.contacts.POST(request(2, {companyId, name:'Attempted contact'}))).status, 404);
    assert.equal((await runtime.contacts.PATCH(request(2, {id:companyId, name:'Attempted edit'}, '', 'PATCH'))).status, 404);
    assert.equal((await runtime.contacts.DELETE(request(2, undefined, `?id=${companyId}`, 'DELETE'))).status, 404);
  }
  assert.equal(sql.prepare('SELECT name FROM contacts WHERE id=2').get().name, 'Contact 2');
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM contacts').get().n, 6);
  const own = await runtime.contacts.PATCH(request(2, {id:1, name:'Updated own contact'}, '', 'PATCH'));
  assert.equal(own.status, 200);
});

test('activities and full exports include only the seller owned company set', async () => {
  const activities = await (await runtime.activities.GET(request())).json();
  assert.deepEqual(new Set(activities.activities.map(activity => activity.companyId)), new Set([1,4,6]));
  assert.deepEqual((await (await runtime.activities.GET(request(2, undefined, '?companyId=2'))).json()).activities, []);
  const exported = await (await runtime.exports.GET(request())).json();
  for (const key of ['companies','contacts','activities']) assert.deepEqual(new Set(exported[key].map(row => row.companyId ?? row.id)), new Set([1,4,6]));
  assert.equal((await runtime.activities.POST(request(2, {companyId:2, note:'Unauthorized activity'}))).status, 404);
  assert.equal((await runtime.activities.PATCH(request(2, {id:2, note:'Unauthorized edit'}, '', 'PATCH'))).status, 404);
  assert.equal((await runtime.activities.DELETE(request(2, undefined, '?id=2', 'DELETE'))).status, 404);
  assert.equal(sql.prepare('SELECT note FROM activities WHERE id=2').get().note, 'Private 2');
});

test('a namesake cannot adopt ambiguous legacy assignments and sellers cannot assign a company to a peer', async () => {
  sql.exec("UPDATE memberships SET name='User 2' WHERE id=3");
  const rows = await (await runtime.companies.GET(request())).json();
  assert.deepEqual(new Set(rows.companies.map(company => company.id)), new Set([1,4]));
  assert.equal((await runtime.companies.POST(request(2, {name:'New company',assignedTo:'User 3'}))).status, 403);
  assert.equal((await runtime.companies.PATCH(request(2, {id:1,name:'Company 1',assignedTo:'User 3'}, '', 'PATCH'))).status, 403);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM companies').get().n, 6);
});

test('disabling outbound restores ordinary shared CRM visibility within the same tenant', async () => {
  sql.exec('UPDATE organizations SET outbound_enabled=0 WHERE id=1');
  const data = await (await runtime.companies.GET(request())).json();
  assert.deepEqual(new Set(data.companies.map(company => company.id)), new Set([1,2,4,5,6]));
  assert.equal((await runtime.contacts.GET(request(2, undefined, '?companyId=2'))).status, 200);
});

test('legacy email and profile name collisions cannot grant another sellers customer access',async()=>{
  insert('user_profiles',{user_id:'3',display_name:'USER 2',updated_at:'2026-01-01'});
  let result=await (await runtime.companies.GET(request())).json();
  assert.deepEqual(new Set(result.companies.map(company=>company.id)),new Set([1,4]));
  sql.exec("DELETE FROM user_profiles WHERE user_id='3';UPDATE memberships SET email='User 2' WHERE id=3");
  result=await (await runtime.companies.GET(request())).json();
  assert.deepEqual(new Set(result.companies.map(company=>company.id)),new Set([1,4]));
  // A peer's changed profile must never affect a canonical registry owner.
  assert.equal((await runtime.contacts.GET(request(2,undefined,'?companyId=4'))).status,200);
});

test('ownership keys distinguish tenant, country and meaningful foreign registration letters',async()=>{
  insert('companies',{id:7,organization_id:1,country:'NO',org_number:'552100555',name:'Norwegian same number',assigned_to:runtime.actorRef({id:'2',displayName:'User 2'})});
  insert('companies',{id:8,organization_id:1,country:'GB',org_number:'SC 000123',name:'Scottish company',assigned_to:runtime.actorRef({id:'3',displayName:'User 3'})});
  insert('companies',{id:9,organization_id:1,country:'GB',org_number:'000123',name:'Different English registration',assigned_to:runtime.actorRef({id:'3',displayName:'User 3'})});
  insert('outbound_company_ownership',{organization_id:1,country:'GB',org_number:'SC000123',assigned_membership_id:2,updated_at:'now'});
  insert('outbound_company_ownership',{organization_id:2,country:'NO',org_number:'666666666',assigned_membership_id:3,updated_at:'now'});
  const rows=await (await runtime.companies.GET(request())).json();
  assert.deepEqual(new Set(rows.companies.map(c=>c.id)),new Set([1,4,6,7,8]));
  assert.equal((await runtime.contacts.GET(request(2,undefined,'?companyId=5'))).status,404);
});

test('large owned customer sets use subqueries and stay within D1 parameter limits',async()=>{
  for(let id=100;id<280;id++){
    insert('companies',{id,organization_id:1,name:`Own ${id}`,assigned_to:runtime.actorRef({id:'2',displayName:'User 2'})});
    insert('activities',{id,organization_id:1,company_id:id,kind:'Notat',note:`Own activity ${id}`,created_at:'2026-01-01'});
    insert('contacts',{id,organization_id:1,company_id:id,name:`Own contact ${id}`,created_at:'2026-01-01'});
  }
  queries=[];
  const response=await runtime.activities.GET(request());assert.equal(response.status,200);
  assert.equal((await response.json()).activities.length,183);
  const exportResponse=await runtime.exports.GET(request());assert.equal(exportResponse.status,200);
  const exported=await exportResponse.json();
  for(const key of ['companies','contacts','activities'])assert.equal(exported[key].length,183);
  const related=queries.filter(q=>/from "(activities|contacts)"/.test(q.query)&&/in \(select "id"/.test(q.query));
  assert.ok(related.length>=3,'Related records must use a scoped company subquery');
  assert.ok(related.every(q=>q.params.length<100));
  assert.ok(!exported.activities.some(row=>[2,3,5].includes(row.companyId)));
});

test('administrator and explicitly consented support retain full tenant CRM access only',async()=>{
  insert('memberships',{id:9,organization_id:2,user_id:'9',email:'9@test.no',name:'Support agent',role:'Superadmin',created_at:'2026-01-01'});
  assert.equal((await runtime.companies.GET(request(9))).status,403);
  insert('support_sessions',{organization_id:1,support_user_id:'9',expires_at:'2099-12-31T00:00:00.000Z',created_at:'now'});
  const ctx=await runtime.requireTenant(request(9));assert.equal(ctx.role,'Support');assert.equal(ctx.membershipId,0);
  const support=await (await runtime.companies.GET(request(9))).json();
  const admin=await (await runtime.companies.GET(request(1))).json();
  assert.deepEqual(new Set(support.companies.map(c=>c.id)),new Set(admin.companies.map(c=>c.id)));
  assert.equal(support.companies.length,5);
  assert.equal((await runtime.contacts.GET(request(9,undefined,'?companyId=2'))).status,200);
  sql.exec("UPDATE support_sessions SET revoked_at='now'");
  assert.equal((await runtime.companies.GET(request(9))).status,403);
});

test('attachment listing, downloads, uploads and deletes check ownership before storage access',async()=>{
  for(const id of [2,3,5]){
    assert.equal((await runtime.attachments.GET(request(2,undefined,`?companyId=${id}`))).status,404);
    assert.equal((await runtime.attachments.GET(request(2,undefined,`?id=${id}`))).status,404);
    assert.equal((await runtime.attachments.DELETE(request(2,undefined,`?id=${id}`,'DELETE'))).status,404);
    const form=new FormData();form.set('companyId',String(id));form.set('file',new File(['hello'],'test.txt',{type:'text/plain'}));
    assert.equal((await runtime.attachments.POST(new Request('https://crm.test/api/attachments',{method:'POST',headers:{authorization:'Bearer 2','x-organization-id':'1'},body:form}))).status,404);
  }
  assert.deepEqual(bucketCalls,[]);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM attachments').get().n,6);
  const own=await runtime.attachments.GET(request(2,undefined,'?id=1'));
  assert.equal(own.status,200);assert.equal(await own.text(),'private file');
  assert.deepEqual(bucketCalls,[['get','files/1']]);
});

const importRequest=(mode,rows)=>request(2,{mode,source:'Private import',requestId:crypto.randomUUID()+'-0',rows});
test('imports reject references to another seller before modifying customer, contact or history data',async()=>{
  for(const [mode,rows] of [
    ['customers',[{name:'Attempted duplicate',country:'FR',orgNumber:'55210055500099',externalId:'attempt'}]],
    ['contacts',[{companyReference:'Customer 2',contactName:'Unauthorized contact'}]],
    ['activities',[{companyReference:'Customer 2',note:'Unauthorized history'}]],
  ])assert.equal((await runtime.imports.POST(importRequest(mode,rows))).status,404);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM companies').get().n,6);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM contacts').get().n,6);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM activities').get().n,6);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM data_imports').get().n,0);
  const own=await runtime.imports.POST(importRequest('contacts',[{companyReference:'Customer 1',contactName:'Own new contact'}]));
  assert.equal(own.status,201);
});

test('new customers cannot duplicate registered leads assigned to another seller',async()=>{
  insert('outbound_company_ownership',{organization_id:1,country:'FR',org_number:'123456789',assigned_membership_id:3,updated_at:'now'});
  const direct=await runtime.companies.POST(request(2,{name:'Blocked direct company',country:'FR',orgNumber:'12345678900002'}));
  assert.equal(direct.status,403);
  const imported=await runtime.imports.POST(importRequest('customers',[{name:'Blocked imported company',country:'FR',orgNumber:'12345678900002'}]));
  assert.equal(imported.status,403);
  const patched=await runtime.companies.PATCH(request(2,{id:1,name:'Own customer',country:'FR',orgNumber:'12345678900002'},'','PATCH'));
  assert.equal(patched.status,403);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM companies').get().n,6);
  assert.equal(sql.prepare('SELECT org_number FROM companies WHERE id=1').get().org_number,'111111111');
});

test('partial customer edits preserve canonical registry identity and seller visibility',async()=>{
  const before=sql.prepare('SELECT country,org_number,assigned_to FROM companies WHERE id=4').get();
  const changed=await runtime.companies.PATCH(request(2,{id:4,name:'Updated French customer'},'','PATCH'));
  assert.equal(changed.status,200);
  const after=sql.prepare('SELECT country,org_number,assigned_to FROM companies WHERE id=4').get();
  assert.deepEqual(after,before);
  const rows=await (await runtime.companies.GET(request())).json();
  assert.ok(rows.companies.some(company=>company.id===4&&company.name==='Updated French customer'));
  // Supplying a SIRET without repeating the country still uses the preserved FR country.
  const renormalized=await runtime.companies.PATCH(request(2,{id:4,name:'French customer',orgNumber:'55210055400099'},'','PATCH'));
  assert.equal(renormalized.status,200);
  assert.equal(sql.prepare('SELECT org_number FROM companies WHERE id=4').get().org_number,'552100554');
  assert.equal((await runtime.contacts.GET(request(2,undefined,'?companyId=4'))).status,200);
});

test('company bulk creation stays under D1 limits and rolls back every batch on a later failure',async()=>{
  const response=await runtime.companies.POST(request(1,{companies:Array.from({length:160},(_,i)=>({name:`Bulk ${i}`}))}));
  assert.equal(response.status,201);
  assert.equal((await response.json()).companies.length,160);
  const before=sql.prepare('SELECT COUNT(*) AS n FROM companies').get().n;
  sql.exec("CREATE TRIGGER reject_later_company BEFORE INSERT ON companies WHEN NEW.name='Rejected fourth' BEGIN SELECT RAISE(ABORT, 'expected batch failure'); END");
  const oldError=console.error;
  console.error=error=>{if(error?.cause?.message!=='expected batch failure')oldError(error);};
  try{
    const rejected=await runtime.companies.POST(request(1,{companies:[{name:'Accepted first'},{name:'Accepted second'},{name:'Accepted third'},{name:'Rejected fourth'},{name:'Accepted fifth'}]}));
    assert.equal(rejected.status,500);
  }finally{console.error=oldError;}
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM companies').get().n,before);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM companies WHERE name LIKE 'Accepted %'").get().n,0);
});
