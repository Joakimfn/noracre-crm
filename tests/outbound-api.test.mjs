// API tests use real SQLite and D1-style atomic batches, never production data.
import { after, beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const dir = await mkdtemp(path.join(tmpdir(), 'noracre-outbound-'));
await build({
  stdin: { contents: "export * as route from './app/api/outbound/route'; export * as schema from './db/schema';", resolveDir: root },
  bundle: true, platform: 'node', format: 'esm', outfile: path.join(dir, 'route.mjs'), packages: 'external',
  plugins: [{ name: 'test-runtime', setup(builder) {
    builder.onResolve({filter:/^@\/db$/},()=>({path:'db',namespace:'test'}));
    builder.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));
    builder.onResolve({filter:/^next\//},args=>({path:args.path,namespace:'test'}));
    builder.onLoad({filter:/.*/,namespace:'test'},({path:p})=>({contents:p==='db'?'export const getDb=()=>globalThis.testDb':p==='env'?'export const env={SUPABASE_URL:"https://auth.test",SUPABASE_ANON_KEY:"public"}':'export const redirect=()=>{};'}));
  }}], nodePaths: [path.join(root, 'node_modules')],
});
await symlink(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
const { route, schema } = await import(pathToFileURL(path.join(dir, 'route.mjs')));
const safetyMigration=await readFile(path.join(root,'drizzle/0031_outbound_safety_and_commission.sql'),'utf8');
const paymentTrigger=safetyMigration.match(/^CREATE TRIGGER outbound_payment_insert_guard\b[\s\S]*?^END;/m)?.[0];
assert.ok(paymentTrigger,'The real payment-ledger guard must be installed in the API fixture');
const financialTrigger=safetyMigration.match(/^CREATE TRIGGER outbound_deal_financial_terms_guard\b[\s\S]*?END;/m)?.[0];
assert.ok(financialTrigger,'The real financial-terms guard must be installed in the API fixture');
const lookupMigration=await readFile(path.join(root,'drizzle/0032_outbound_canonical_lookup.sql'),'utf8');
const realFetch = globalThis.fetch;
let sql;
let queryHook;
const now = () => new Date().toISOString();
const add = (table, values) => {
  if (table === 'outbound_call_logs' && getTableConfig(schema.outboundCallLogs).columns.some(column => column.name === 'request_id')) values = { request_id:randomUUID(), ...values };
  const keys = Object.keys(values);
  sql.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(values));
};
const entry = (id, values = {}) => add('call_list_entries', {
  id, organization_id: 1, list_id: 1, country: 'NO', org_number: String(900000000 + id), name: `Lead ${id}`,
  created_at: now(), updated_at: now(), ...values,
});
const company = (id, values = {}) => add('companies',{id,organization_id:1,country:'NO',org_number:String(900000000+id),name:`CRM customer ${id}`,assigned_to:'User 2',...values});
const state = (entryId, owner = 2, values = {}) => add('outbound_lead_state', {
  organization_id: 1, entry_id: entryId, assigned_membership_id: owner, created_at: now(), updated_at: now(), ...values,
});
const ownership = (country, orgNumber, owner = 2, values = {}) => add('outbound_company_ownership', {
  organization_id: 1, country, org_number: orgNumber, assigned_membership_id: owner, updated_at: now(), ...values,
});
const req = (user = 1, org = 1, body, query = '') => new Request(`https://crm.test/api/outbound${query}`, {
  method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${user}`, 'x-organization-id': String(org), 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const get = async (user = 1, query = '', org = 1) => {
  const response = await route.GET(req(user, org, undefined, query));
  const json = await response.json();
  assert.equal(response.status, 200, JSON.stringify(json));
  return json;
};
const post = async (user, body, status = 200, org = 1) => {
  const response = await route.POST(req(user, org, body));
  const json = await response.json();
  assert.equal(response.status, status, JSON.stringify(json));
  return json;
};
const acquire = (user, entryId, status = 200) => post(user, { type:'acquire', entryId }, status);
const dial = async (user, entryId, values = {}, status = 200) => {
  const lock = await acquire(user, entryId);
  return post(user, { type:'dial', entryId, leaseToken:lock.leaseToken, requestId:randomUUID(), outcome:'Ikke svar', note:'', ...values }, status);
};
const wonDeal=async(id=1,values={})=>{
  entry(id);state(id,2);ownership('NO',String(900000000+id),2);company(id);
  await post(1,{type:'stage',entryId:id,pipeline:'Kunde',monthlyAmountMinor:49000,customerCompanyId:id,commissionBps:3333,commissionMonths:12,commissionAgreedAt:'2026-01-01T12:00:00.000Z',subscriptionActivatedAt:'2026-01-02T12:00:00.000Z',...values});
  return sql.prepare('SELECT * FROM outbound_deals WHERE entry_id=?').get(id);
};
const payment=(entryId=1,values={})=>({type:'payment',entryId,reference:'Bank payment 001',paidAmountMinor:49000,receivedAt:'2026-02-01T12:00:00.000Z',confirmed:true,...values});
const refund=(paymentId,values={})=>({type:'refund',paymentId,reference:'Refund 001',refundAmountMinor:49000,receivedAt:'2026-02-02T12:00:00.000Z',confirmed:true,...values});
const count = table => sql.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;

beforeEach(() => {
  sql = new DatabaseSync(':memory:');
  queryHook=null;
  for (const table of Object.values(schema)) {
    const config = getTableConfig(table);
    const columns = config.columns.map(column => `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}${column.notNull ? ' NOT NULL' : ''}${column.default !== undefined ? ' DEFAULT ' + (typeof column.default === 'string' ? "'" + column.default.replaceAll("'", "''") + "'" : Number(column.default)) : ''}`);
    sql.exec(`CREATE TABLE "${config.name}" (${columns.join(',')})`);
    for (const index of config.indexes) {
      const columns = index.config.columns;
      if (columns.every(column => typeof column.name === 'string')) sql.exec(`CREATE ${index.config.unique ? 'UNIQUE ' : ''}INDEX "${index.config.name}" ON "${config.name}" (${columns.map(column => `"${column.name}"`).join(',')})`);
    }
  }
  // This partial index is part of migration 0031 and is essential for racing retries.
  if (getTableConfig(schema.outboundCallLogs).columns.some(column => column.name === 'request_id')) sql.exec("CREATE UNIQUE INDEX IF NOT EXISTS outbound_call_request_unique ON outbound_call_logs(organization_id,request_id) WHERE request_id <> ''");
  sql.exec("CREATE UNIQUE INDEX IF NOT EXISTS outbound_payment_key_unique ON outbound_deal_payments(organization_id,payment_reference_key) WHERE payment_reference_key <> ''");
  sql.exec(paymentTrigger);
  sql.exec(financialTrigger);
  sql.exec(lookupMigration);
  globalThis.testDb = drizzle(async (query, params, method) => {
    assert.ok(params.length<=100, `D1 accepts at most 100 bind parameters; this query has ${params.length}`);
    if(queryHook)await queryHook(query,params,method);
    const statement = sql.prepare(query);
    statement.setReturnArrays(true);
    return { rows: method === 'run' ? (statement.run(...params), []) : method === 'get' ? statement.get(...params) : statement.all(...params) };
  });
  let batchTail=Promise.resolve();
  globalThis.testDb.batch = statements => {
    const transaction=batchTail.then(async()=>{
      sql.exec('BEGIN');
      try {
        const result = [];
        for (const statement of statements) result.push(await statement);
        sql.exec('COMMIT');
        return result;
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    });
    batchTail=transaction.catch(()=>{});
    return transaction;
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://auth.test/auth/v1/user', 'Outbound must not send email or access payment services');
    const id = options.headers.Authorization.replace('Bearer ', '');
    if (id === 'invalid') return new Response('', { status: 401 });
    return Response.json({ id, email: `${id}@test.no`, email_confirmed_at: '2026-01-01' });
  };
  for (const id of [1, 2]) add('organizations', { id, name: `Org ${id}`, outbound_enabled: 1, created_at: '2026-01-01' });
  for (const [id, org, role] of [[1,1,'Administrator'],[2,1,'Bruker'],[3,1,'Bruker'],[4,2,'Administrator'],[5,1,'Bruker']]) add('memberships', {
    id, organization_id: org, user_id: String(id), email: `${id}@test.no`, name: `User ${id}`, role, created_at: '2026-01-01',
  });
  for (const [id, org, owner] of [[1,1,1],[2,1,1],[3,2,4]]) add('saved_call_lists', { id, organization_id: org, name: `List ${id}`, country: 'NO', created_by_membership_id: owner, created_at: '2026-01-01', updated_at: '2026-01-01' });
  add('organization_modules', { organization_id:1, module_key:'ringelister', activated_at:'2026-01-01' });
  for (const id of [1,2,3]) {
    add('module_licenses', { organization_id:1, membership_id:id, module_key:'ringelister', activated_at:'2026-01-01' });
    for (const listId of [1,2]) add('call_list_assignments', { organization_id:1, list_id:listId, membership_id:id, assigned_by:'Admin', created_at:'2026-01-01' });
  }
});
afterEach(() => { sql.close(); delete globalThis.testDb; globalThis.fetch = realFetch; });
after(async () => { await rm(dir, { recursive:true, force:true }); });

test('tenant headers never grant outbound access to another organization', async () => {
  entry(1); state(1,2); entry(1000,{organization_id:2,list_id:3});
  for (const user of [1,2,3]) assert.equal((await route.GET(req(user,2))).status,403);
  for (const type of ['dial','stage','assign']) await post(1,{type,entryId:1000,entryIds:[1000],membershipId:2,outcome:'Interessert',note:'',pipeline:'Kunde'},404);
  assert.equal(count('outbound_call_logs'),0);
  assert.equal(count('outbound_deals'),0);
  assert.equal(sql.prepare('SELECT status FROM call_list_entries WHERE id=1000').get().status,'Ny');
});

test('outbound is explicitly enabled per organization and still returns administrator capability', async () => {
  sql.exec('UPDATE organizations SET outbound_enabled=0 WHERE id=1');
  const admin = await get(1), seller = await get(2);
  assert.equal(admin.settings.enabled,false); assert.equal(admin.canManage,true);
  assert.equal(seller.canManage,false); assert.deepEqual(admin.rows,[]);
  await post(2,{type:'settings',enabled:true,currency:'EUR',timezone:'Europe/Paris',commissionBps:1000,pitch:'Pitch'},403);
  await post(1,{type:'settings',enabled:true,currency:'EUR',timezone:'Europe/Paris',commissionBps:1000,pitch:'Pitch'});
  const saved=await get(1); assert.equal(saved.settings.enabled,true); assert.equal(saved.settings.currency,'EUR'); assert.equal(saved.settings.timezone,'Europe/Paris');
  assert.equal(sql.prepare('SELECT outbound_currency FROM organizations WHERE id=2').get().outbound_currency,'NOK');
});

test('seller requires ring-list license, while administrator can configure outbound without it', async () => {
  sql.exec('UPDATE module_licenses SET active=0 WHERE membership_id=2');
  assert.equal((await route.GET(req(2))).status,403);
  await post(2,{type:'dial',entryId:1,outcome:'Interessert',note:''},403);
  assert.equal((await get(1)).canManage,true);
});

test('sellers see and mutate only leads assigned to them', async () => {
  for (const id of [1,2,3]) entry(id);
  state(1,2); state(2,3);
  ownership('NO','900000001',2); ownership('NO','900000002',3);
  const seller=await get(2), admin=await get(1);
  assert.deepEqual(seller.rows.map(row=>row.id),[1]);
  assert.deepEqual(new Set(admin.rows.map(row=>row.id)),new Set([1,2,3]));
  assert.deepEqual(seller.members.map(member=>member.id),[2]);
  await post(2,{type:'dial',entryId:2,outcome:'Interessert',note:''},403);
  await post(2,{type:'stage',entryId:2,pipeline:'Kunde'},403);
  await post(2,{type:'dial',entryId:3,outcome:'Interessert',note:''},403);
  assert.equal(count('outbound_call_logs'),0);
});

test('round-robin count distribution assigns canonical companies across all list copies', async () => {
  entry(1,{country:'FR',org_number:'552100554'});
  entry(2,{country:'FR',org_number:'55210055400013',list_id:2});
  entry(3,{country:'FR',org_number:'55210055400021',list_id:2});
  for (let id=4;id<=7;id++) entry(id);
  await post(1,{type:'assign',membershipIds:[2,3],count:5,mode:'unassigned'});
  const owners=sql.prepare('SELECT country,org_number,assigned_membership_id FROM outbound_company_ownership ORDER BY country,org_number').all();
  assert.equal(owners.length,5);
  assert.deepEqual(owners.filter(owner=>owner.country==='FR').map(owner=>owner.org_number),['552100554']);
  const assignments=owners.map(owner=>owner.assigned_membership_id);
  assert.equal(assignments.filter(id=>id===2).length,3);
  assert.equal(assignments.filter(id=>id===3).length,2);
  const french=sql.prepare('SELECT assigned_membership_id FROM outbound_lead_state WHERE entry_id IN (1,2,3)').all();
  assert.ok(french.length>=1); assert.equal(new Set(french.map(row=>row.assigned_membership_id)).size,1);
  const copiedList=await get(2,'?listId=2');
  assert.deepEqual(copiedList.rows.map(row=>[row.country,row.assignedMembershipId]),[['FR',2]],'Assignment grants the same owner access to establishment copies in another list');
  const second=await post(1,{type:'assign',membershipIds:[3],count:5,mode:'unassigned'});
  assert.equal(sql.prepare('SELECT count(*) AS n FROM outbound_company_ownership').get().n,5);
  assert.equal(second.assigned,0);
});

test('invalid assignment batches cannot partially reassign earlier valid leads', async () => {
  entry(1);state(1,2);ownership('NO','900000001',2);
  entry(2);state(2,2);ownership('NO','900000002',2);
  await post(1,{type:'assign',entryIds:[1,999999],membershipId:3},404);
  assert.deepEqual(sql.prepare('SELECT assigned_membership_id FROM outbound_lead_state ORDER BY entry_id').all().map(row=>row.assigned_membership_id),[2,2]);
  assert.equal(sql.prepare("SELECT assigned_membership_id FROM outbound_company_ownership WHERE org_number='900000001'").get().assigned_membership_id,2);
  assert.equal(count('outbound_call_logs'),0);
  await post(1,{type:'assign',membershipIds:[2,4],count:2,mode:'all'},400);
  await post(1,{type:'assign',membershipIds:[5],count:2,mode:'all'},400);
});

test('France SIRET reassignment updates all copies and does not touch the same identifier in another country', async () => {
  entry(1,{country:'FR',org_number:'552100554'});entry(2,{country:'FR',org_number:'55210055400013',list_id:2});
  entry(3,{country:'NO',org_number:'552100554'});
  for(const id of [1,2,3])state(id,2);
  ownership('FR','552100554',2);ownership('NO','552100554',2);
  await post(1,{type:'assign',entryIds:[2],membershipId:3});
  assert.deepEqual(sql.prepare('SELECT assigned_membership_id FROM outbound_lead_state ORDER BY entry_id').all().map(row=>row.assigned_membership_id),[3,3,2]);
  assert.deepEqual((await get(2)).rows.map(row=>row.id),[3]);
  assert.equal((await get(3)).rows.length,1,'Queue must not show duplicate businesses');
  assert.equal((await get(3)).rows[0].assignedMembershipId,3);
  await post(2,{type:'acquire',entryId:2},403);
});

test('due callbacks precede new leads even when older than the first 150 entries', async () => {
  const dueAt=new Date(Date.now()-60000).toISOString(),futureAt=new Date(Date.now()+86400000).toISOString();
  entry(1);state(1,2,{next_call_at:dueAt,last_outcome:'Ikke svar',attempts:1});ownership('NO','900000001',2);
  entry(2);state(2,2,{next_call_at:futureAt,last_outcome:'Ikke svar',attempts:1});ownership('NO','900000002',2);
  for(let id=3;id<=170;id++){entry(id);state(id,2);ownership('NO',String(900000000+id),2);}
  const all=await get(2),due=await get(2,'?queue=due'),fresh=await get(2,'?queue=fresh');
  assert.equal(all.rows.length,150);assert.equal(all.rows[0].id,1);assert.equal(all.hasMore,true);
  assert.deepEqual(due.rows.map(row=>row.id),[1]);
  assert.equal(fresh.rows.length,150);assert.ok(fresh.rows.every(row=>row.id>2));
});

test('future callbacks, terminal leads and opt-outs never reappear as new leads', async () => {
  for(const id of [1,2,3,4,5]){entry(id);state(id,2);ownership('NO',String(900000000+id),2);}
  sql.prepare("UPDATE outbound_lead_state SET next_call_at=?,attempts=1,last_outcome='Ikke svar' WHERE entry_id=1").run(new Date(Date.now()+86400000).toISOString());
  sql.exec("UPDATE outbound_lead_state SET pipeline='Kunde' WHERE entry_id=2; UPDATE outbound_lead_state SET pipeline='Tapt' WHERE entry_id=3; UPDATE outbound_lead_state SET do_not_contact=1 WHERE entry_id=4;");
  assert.deepEqual((await get(2,'?queue=fresh')).rows.map(row=>row.id),[5]);
  await post(2,{type:'callback',entryId:4,nextCallAt:now()},409);
});

test('canonical opt-out blocks every French establishment copy in GET and write actions', async () => {
  entry(1,{country:'FR',org_number:'552100554'});entry(2,{country:'FR',org_number:'55210055400013',list_id:2});entry(3,{country:'NO',org_number:'552100554'});
  for(const id of [1,2,3])state(id,2);
  ownership('FR','552100554',2);ownership('NO','552100554',2);
  await dial(2,1,{outcome:'Reservert mot kontakt',note:'Please remove us'});
  assert.equal(count('outbound_suppression'),1);
  const visible=(await get(2)).rows;
  assert.ok(visible.filter(row=>row.country==='FR').every(row=>row.suppressed));
  assert.deepEqual((await get(2,'?queue=fresh')).rows.map(row=>row.id),[3]);
  await post(2,{type:'acquire',entryId:2},409);
  await post(2,{type:'callback',entryId:2,nextCallAt:now()},409);
  await post(2,{type:'stage',entryId:2,pipeline:'Prøveperiode'},409);
  const unchanged=sql.prepare('SELECT pipeline FROM outbound_lead_state WHERE entry_id=2').get();
  assert.notEqual(unchanged.pipeline,'Prøveperiode');
});

test('calling lease rejects another tab, renews only with its token and releases explicitly', async () => {
  entry(1);state(1,2);ownership('NO','900000001',2);
  const lock=await acquire(2,1);
  assert.equal(typeof lock.leaseToken,'string');assert.ok(lock.leaseToken.length>=16);assert.ok(Date.parse(lock.expiresAt)>Date.now());
  await acquire(2,1,409);
  await post(2,{type:'acquire',entryId:1,leaseToken:'wrong-token'},409);
  const renewed=await post(2,{type:'acquire',entryId:1,leaseToken:lock.leaseToken});
  assert.equal(renewed.leaseToken,lock.leaseToken);
  await post(2,{type:'dial',entryId:1,requestId:randomUUID(),leaseToken:'wrong-token',outcome:'Interessert',note:''},409);
  await post(2,{type:'release',entryId:1,leaseToken:'wrong-token'},409);
  await post(2,{type:'release',entryId:1,leaseToken:lock.leaseToken});
  const next=await acquire(2,1);assert.notEqual(next.leaseToken,lock.leaseToken);
});

test('logging repeat calls preserves the full attempt history, author and follow-up timestamp', async () => {
  entry(1);state(1,2);ownership('NO','900000001',2);
  const callback=new Date(Date.now()+172800000).toISOString();
  await dial(2,1,{outcome:'Ikke svar',note:'First attempt',nextCallAt:callback});
  await dial(2,1,{outcome:'Sentralbord',note:'Asked for manager',nextCallAt:callback});
  const result=await get(2,'?entryId=1');
  assert.equal(result.history.length,2);
  assert.deepEqual(new Set(result.history.map(row=>row.note)),new Set(['First attempt','Asked for manager']));
  assert.ok(result.history.every(row=>row.membershipId===2&&row.nextCallAt===callback&&Number.isFinite(Date.parse(row.createdAt))));
  assert.equal(sql.prepare('SELECT attempts FROM outbound_lead_state WHERE entry_id=1').get().attempts,2);
  assert.equal(sql.prepare('SELECT status FROM call_list_entries WHERE id=1').get().status,'Kontaktet');
});

test('history is available beyond queue pagination and remains seller and tenant scoped', async () => {
  entry(1);state(1,2);ownership('NO','900000001',2);
  entry(2);state(2,3);ownership('NO','900000002',3);
  for(let id=0;id<160;id++)add('outbound_call_logs',{organization_id:1,entry_id:1,membership_id:2,outcome:'Ikke svar',note:`Attempt ${id}`,created_at:new Date(Date.now()-id*1000).toISOString()});
  add('outbound_call_logs',{organization_id:1,entry_id:1,membership_id:3,outcome:'Interessert',note:'Other seller',created_at:now()});
  add('outbound_call_logs',{organization_id:2,entry_id:1,membership_id:4,outcome:'Interessert',note:'Other tenant',created_at:now()});
  const first=await get(2,'?entryId=1&historyOffset=0'),second=await get(2,'?entryId=1&historyOffset=150');
  assert.equal(first.history.length,150);assert.equal(second.history.length,11);
  const history=[...first.history,...second.history];
  assert.equal(history.filter(row=>row.membershipId===2).length,160);
  assert.equal(history.filter(row=>row.note==='Other seller').length,1,'Own leads retain the full prior salesperson history');
  assert.ok(history.every(row=>row.note!=='Other tenant'));
  assert.equal((await route.GET(req(2,1,undefined,'?entryId=2'))).status,403);
  assert.equal((await get(1,'?entryId=1')).history.length,150);
});

test('call-log failure rolls back ownership, attempt state, legacy status and suppression together', async (t) => {
  t.mock.method(console,'error',()=>{});
  entry(1,{country:'FR',org_number:'552100554'});state(1,2);ownership('FR','552100554',2);
  const lock=await acquire(2,1);
  sql.exec("CREATE TRIGGER fail_attempt BEFORE INSERT ON outbound_call_logs BEGIN SELECT RAISE(ABORT,'test atomic failure'); END");
  await post(2,{type:'dial',entryId:1,requestId:randomUUID(),leaseToken:lock.leaseToken,outcome:'Reservert mot kontakt',note:'Atomic'},500);
  assert.equal(count('outbound_call_logs'),0);assert.equal(count('outbound_suppression'),0);assert.equal(count('outbound_deals'),0);
  const saved=sql.prepare('SELECT attempts,last_outcome,last_note,do_not_contact FROM outbound_lead_state WHERE entry_id=1').get();
  assert.deepEqual({...saved},{attempts:0,last_outcome:'',last_note:'',do_not_contact:0});
  assert.equal(sql.prepare('SELECT status FROM call_list_entries WHERE id=1').get().status,'Ny');
  assert.equal(sql.prepare('SELECT lease_token FROM outbound_company_ownership').get().lease_token,lock.leaseToken,'A failed save must keep its lease so the browser can retry');
  entry(2);state(2,2);ownership('NO','900000002',2);
  const bookingLock=await acquire(2,2);
  await post(2,{type:'dial',entryId:2,requestId:randomUUID(),leaseToken:bookingLock.leaseToken,outcome:'Møte booket',note:'Atomic booking'},500);
  assert.equal(count('outbound_deals'),0);
  assert.equal(sql.prepare('SELECT attempts FROM outbound_lead_state WHERE entry_id=2').get().attempts,0);
  assert.equal(sql.prepare('SELECT status FROM call_list_entries WHERE id=2').get().status,'Ny');
});

test('a retried request records one call and cannot be reused for another entry', async () => {
  for(const id of [1,2]){entry(id);state(id,2);ownership('NO',String(900000000+id),2);}
  const lock=await acquire(2,1),requestId=randomUUID();
  const body={type:'dial',entryId:1,requestId,leaseToken:lock.leaseToken,outcome:'Møte booket',note:'One booking'};
  await post(2,body);await post(2,body);
  assert.equal(count('outbound_call_logs'),1);assert.equal(count('outbound_deals'),1);
  assert.equal(sql.prepare('SELECT attempts FROM outbound_lead_state WHERE entry_id=1').get().attempts,1);
  const otherLock=await acquire(2,2);
  await post(2,{...body,entryId:2,leaseToken:otherLock.leaseToken},409);
  assert.equal(sql.prepare('SELECT attempts FROM outbound_lead_state WHERE entry_id=2').get().attempts,0);
});

test('outbound metrics report meetings per conversation and each seller sees only their own results', async () => {
  entry(1);state(1,2);ownership('NO','900000001',2);
  for(const [member,outcome,n] of [[2,'Ikke svar',4],[2,'Beslutningstaker kontaktet',2],[2,'Møte booket',1],[3,'Møte booket',4]])for(let i=0;i<n;i++)add('outbound_call_logs',{organization_id:1,entry_id:1,membership_id:member,outcome,created_at:now()});
  const mine=await get(2),all=await get(1);
  assert.equal(mine.metrics.attempts,7);assert.equal(mine.metrics.conversations,3);assert.equal(mine.metrics.meetings,1);assert.equal(mine.metrics.meetingRate,33.3);
  assert.equal(all.metrics.attempts,11);assert.equal(all.metrics.conversations,7);assert.equal(all.metrics.meetings,5);assert.equal(all.metrics.meetingRate,71.4);
  assert.deepEqual(mine.byMember.map(row=>row.membershipId),[2]);
  assert.equal(mine.byMember[0].meetingRate,33.3);
});

test('simultaneous tabs cannot acquire separate leases for the same French company', async () => {
  entry(1,{country:'FR',org_number:'552100554'});entry(2,{country:'FR',org_number:'55210055400013',list_id:2});
  state(1,2);state(2,2);ownership('FR','552100554',2);
  const responses=await Promise.all([route.POST(req(2,1,{type:'acquire',entryId:1})),route.POST(req(2,1,{type:'acquire',entryId:2}))]);
  assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM outbound_company_ownership WHERE lease_token != ?').get('').n,1);
});

test('expired leases can be acquired again without waiting for a stale browser tab', async () => {
  entry(1);state(1,2);ownership('NO','900000001',2);
  const first=await acquire(2,1);
  sql.exec("UPDATE outbound_company_ownership SET lease_until='2000-01-01T00:00:00.000Z'; UPDATE outbound_lead_state SET lease_until='2000-01-01T00:00:00.000Z'");
  const second=await acquire(2,1);
  assert.notEqual(first.leaseToken,second.leaseToken);
  await post(2,{type:'dial',entryId:1,requestId:randomUUID(),leaseToken:first.leaseToken,outcome:'Interessert',note:''},409);
  assert.equal(count('outbound_call_logs'),0);
});

test('callback scheduling is tenant scoped, owned and never changes the historic attempt log', async () => {
  entry(1);state(1,2);ownership('NO','900000001',2);
  const nextCallAt=new Date(Date.now()+86400000).toISOString();
  await dial(2,1,{note:'Initial',nextCallAt});
  const revised=new Date(Date.now()+3*86400000).toISOString();
  await post(2,{type:'callback',entryId:1,nextCallAt:revised});
  assert.equal(sql.prepare('SELECT next_call_at FROM outbound_lead_state WHERE entry_id=1').get().next_call_at,revised);
  assert.equal(sql.prepare('SELECT next_call_at FROM outbound_call_logs WHERE entry_id=1').get().next_call_at,nextCallAt);
  await post(3,{type:'callback',entryId:1,nextCallAt:revised},403);
  await post(2,{type:'callback',entryId:1,nextCallAt:'not-a-date'},400);
  assert.equal(count('outbound_call_logs'),1);
});

test('administrator can claim unassigned leads but must reassign another seller lead before calling', async () => {
  entry(1);entry(2);state(2,2);ownership('NO','900000002',2);
  const lock=await acquire(1,1);
  assert.equal(lock.membershipId,1);
  assert.equal(sql.prepare('SELECT assigned_membership_id FROM outbound_company_ownership WHERE org_number=?').get('900000001').assigned_membership_id,1);
  await acquire(1,2,403);
  await post(1,{type:'assign',entryIds:[2],membershipId:1});
  assert.equal((await acquire(1,2)).membershipId,1);
});

test('simultaneous retries of one call cannot double-count attempts or booked meetings', async () => {
  entry(1);state(1,2);ownership('NO','900000001',2);
  const lock=await acquire(2,1);
  const body={type:'dial',entryId:1,requestId:randomUUID(),leaseToken:lock.leaseToken,outcome:'Møte booket',note:'Concurrent retry'};
  const responses=await Promise.all([route.POST(req(2,1,body)),route.POST(req(2,1,body))]);
  assert.ok(responses.every(response=>[200,409].includes(response.status)),responses.map(response=>response.status).join(','));
  assert.equal(count('outbound_call_logs'),1);assert.equal(count('outbound_deals'),1);
  assert.equal(sql.prepare('SELECT attempts FROM outbound_lead_state WHERE entry_id=1').get().attempts,1);
});

test('no-answer logging creates automatic follow-up and keeps it out of the fresh queue until due', async () => {
  entry(1);state(1,2);ownership('NO','900000001',2);
  const start=Date.now();
  await dial(2,1,{outcome:'Ikke svar',note:'Try later'});
  const saved=sql.prepare('SELECT next_call_at,attempts FROM outbound_lead_state WHERE entry_id=1').get();
  assert.equal(saved.attempts,1);assert.ok(Date.parse(saved.next_call_at)>start);
  assert.equal(sql.prepare('SELECT status FROM call_list_entries WHERE id=1').get().status,'Ringte – ikke svar');
  assert.deepEqual((await get(2,'?queue=fresh')).rows,[]);
  assert.deepEqual((await get(2,'?queue=due')).rows,[]);
  sql.prepare('UPDATE outbound_lead_state SET next_call_at=? WHERE entry_id=1').run(new Date(start-60000).toISOString());
  assert.deepEqual((await get(2,'?queue=due')).rows.map(row=>row.id),[1]);
});

test('invalid call input does not alter the call state, queue or legacy ring-list status', async () => {
  entry(1);state(1,2);ownership('NO','900000001',2);
  const lock=await acquire(2,1);
  for(const invalid of [{outcome:'Unsupported'},{note:'x'.repeat(1501)},{nextCallAt:'invalid date'},{requestId:''}]) await post(2,{type:'dial',entryId:1,leaseToken:lock.leaseToken,requestId:randomUUID(),outcome:'Interessert',note:'',...invalid},400);
  const saved=sql.prepare('SELECT attempts,last_outcome,next_call_at FROM outbound_lead_state WHERE entry_id=1').get();
  assert.deepEqual({...saved},{attempts:0,last_outcome:'',next_call_at:''});
  assert.equal(count('outbound_call_logs'),0);assert.equal(count('outbound_deals'),0);
  assert.equal(sql.prepare('SELECT status FROM call_list_entries WHERE id=1').get().status,'Ny');
});

test('organization market exclusions are enforced before calling across country, industry and region', async () => {
  const rules={blockedCountries:['FR'],blockedIndustries:['advokat'],blockedRegions:['Nordland'],requireContactPermission:false,contactHours:null};
  sql.prepare('UPDATE organizations SET outbound_market_rules=? WHERE id=1').run(JSON.stringify(rules));
  entry(1,{country:'FR',org_number:'552100554'});entry(2,{industry:'Advokatvirksomhet'});entry(3,{city:'Nordland'});entry(4,{industry:'Bygg',city:'Oslo'});
  for(const id of [1,2,3,4])state(id,2);
  ownership('FR','552100554',2);for(const id of [2,3,4])ownership('NO',String(900000000+id),2);
  for(const id of [1,2,3])await acquire(2,id,409);
  assert.deepEqual((await get(2,'?queue=fresh')).rows.map(row=>row.id),[4]);
  assert.equal((await acquire(2,4)).membershipId,2);
  assert.equal(count('outbound_call_logs'),0);
});

test('contact-permission policy prevents calling without a recorded permission', async () => {
  sql.prepare('UPDATE organizations SET outbound_market_rules=? WHERE id=1').run(JSON.stringify({requireContactPermission:true}));
  entry(1);state(1,2);ownership('NO','900000001',2);
  await acquire(2,1,409);
  sql.exec('UPDATE outbound_lead_state SET contact_permission=1 WHERE entry_id=1');
  assert.equal((await acquire(2,1)).membershipId,2);
});

test('full company history follows French establishment copies and remains available after reassignment', async () => {
  entry(1,{country:'FR',org_number:'552100554'});entry(2,{country:'FR',org_number:'55210055400013',list_id:2});
  state(1,2);state(2,2);ownership('FR','552100554',2);
  add('outbound_call_logs',{organization_id:1,entry_id:1,membership_id:2,outcome:'Ikke svar',note:'Earlier salesperson attempt',created_at:now()});
  await post(1,{type:'assign',entryIds:[2],membershipId:3});
  const current=await get(3,'?entryId=2');
  assert.equal(current.history.length,1);assert.equal(current.history[0].membershipId,2);assert.equal(current.history[0].note,'Earlier salesperson attempt');
  assert.equal((await route.GET(req(2,1,undefined,'?entryId=1'))).status,403);
});

test('customer links require tenant access and the same canonical company identity', async () => {
  entry(1,{country:'FR',org_number:'552100554'});state(1,2);ownership('FR','552100554',2);
  company(11,{country:'FR',org_number:'55210055400013'});company(12,{country:'NO',org_number:'552100554'});
  company(13,{country:'FR',org_number:'123456789'});company(14,{organization_id:2,country:'FR',org_number:'552100554'});
  company(15,{country:'FR',org_number:'123456788',assigned_to:'User 3'});ownership('FR','123456788',3);
  await post(1,{type:'stage',entryId:1,pipeline:'Kunde',customerCompanyId:14},404);
  await post(2,{type:'stage',entryId:1,pipeline:'Kunde',customerCompanyId:15},404);
  for(const id of [12,13])await post(1,{type:'stage',entryId:1,pipeline:'Kunde',customerCompanyId:id},400);
  await post(1,{type:'stage',entryId:1,pipeline:'Kunde',customerOrganizationId:2},403);
  assert.equal(count('outbound_deals'),0);
  await post(2,{type:'stage',entryId:1,pipeline:'Kunde',customerCompanyId:11});
  assert.equal(sql.prepare('SELECT customer_company_id FROM outbound_deals').get().customer_company_id,11);
});

test('only administrators may confirm subscription activation and commission agreements', async () => {
  entry(1);state(1,2);ownership('NO','900000001',2);company(1);
  for(const fields of [{subscriptionActivatedAt:'2026-01-02T12:00:00.000Z'},{commissionBps:5000},{commissionMonths:12},{commissionAgreedAt:'2026-01-01T12:00:00.000Z'}])await post(2,{type:'stage',entryId:1,pipeline:'Kunde',customerCompanyId:1,...fields},403);
  assert.equal(count('outbound_deals'),0);
  await post(2,{type:'stage',entryId:1,pipeline:'Kunde',customerCompanyId:1});
  await post(2,payment(),403);
  await post(1,payment(),400);
  assert.equal(count('outbound_deal_payments'),0);
  await post(1,{type:'stage',entryId:1,pipeline:'Kunde',customerCompanyId:1,commissionBps:5000,commissionMonths:12,commissionAgreedAt:'2026-01-01T12:00:00.000Z',subscriptionActivatedAt:'2026-01-02T12:00:00.000Z'});
  const receipt=await post(1,payment());
  assert.equal(receipt.commissionAmountMinor,24500);assert.equal(receipt.commissionEligible,true);
  const saved=sql.prepare('SELECT * FROM outbound_deal_payments').get();
  assert.equal(saved.membership_id,2);assert.equal(saved.created_by_membership_id,1);assert.equal(saved.paid_amount_minor,49000);
});

test('real cash receipts require explicit confirmation and normalized references cannot be recorded twice', async () => {
  await wonDeal();
  for(const change of [{confirmed:false},{paidAmountMinor:0},{paidAmountMinor:-1},{paidAmountMinor:1.5},{reference:'x'},{receivedAt:'2026-02-01'},{receivedAt:new Date(Date.now()+86400000).toISOString()}])await post(1,payment(1,change),400);
  assert.equal(count('outbound_deal_payments'),0);
  const first=await post(1,payment(1,{reference:'  INVOICE-001  '}));
  assert.equal(first.commissionAmountMinor,16332);
  await post(1,payment(1,{reference:'invoice-001'}),409);
  await post(1,payment(1,{reference:'ＩＮＶＯＩＣＥ-001'}),409);
  assert.equal(count('outbound_deal_payments'),1);
  const total=await get(2);
  assert.equal(total.paymentTotals[0].paidMinor,49000);assert.equal(total.paymentTotals[0].commissionMinor,16332);
  assert.equal((await get(3)).payments.length,0);
});

test('commission attribution and currency remain frozen after cash has been recorded', async () => {
  await wonDeal();await post(1,payment());
  for(const policy of [{commissionBps:5000},{commissionMonths:24},{commissionAgreedAt:'2026-01-02T12:00:00.000Z'}])await post(1,{type:'stage',entryId:1,pipeline:'Kunde',...policy},409);
  await post(1,{type:'stage',entryId:1,pipeline:'Kunde',subscriptionActivatedAt:'2026-01-03T12:00:00.000Z'},409);
  await post(1,{type:'settings',enabled:true,currency:'EUR',timezone:'Europe/Paris',commissionBps:5000,commissionMonths:24,pitch:'Updated'});
  await post(1,{type:'assign',entryIds:[1],membershipId:3});
  await post(1,payment(1,{reference:'Bank payment 002',receivedAt:'2026-03-01T12:00:00.000Z'}));
  const rows=sql.prepare('SELECT membership_id,currency,commission_bps,commission_amount_minor FROM outbound_deal_payments ORDER BY id').all();
  assert.deepEqual(rows.map(row=>({...row})),Array.from({length:2},()=>({membership_id:2,currency:'NOK',commission_bps:3333,commission_amount_minor:16332})));
  assert.equal((await get(2)).payments.length,2);assert.equal((await get(3)).payments.length,0);
});

test('partial refunds reconcile the original commission and prevent duplicate or excessive refunds', async () => {
  await wonDeal(1,{commissionBps:5000});await post(1,payment(1,{paidAmountMinor:3}));
  const receipt=sql.prepare('SELECT id FROM outbound_deal_payments').get().id;
  await post(2,refund(receipt,{refundAmountMinor:1}),403);
  await post(4,refund(receipt,{refundAmountMinor:1}),404,2);
  await post(1,refund(receipt,{refundAmountMinor:1,reference:'Refund 1'}));
  await post(1,refund(receipt,{refundAmountMinor:1,reference:'refund 1'}),409);
  for(let i=2;i<=3;i++)await post(1,refund(receipt,{refundAmountMinor:1,reference:`Refund ${i}`}));
  const refunds=sql.prepare('SELECT paid_amount_minor,commission_amount_minor FROM outbound_deal_payments WHERE refund_payment_id=? ORDER BY id').all(receipt);
  assert.deepEqual(refunds.map(row=>({...row})),[{paid_amount_minor:-1,commission_amount_minor:-1},{paid_amount_minor:-1,commission_amount_minor:0},{paid_amount_minor:-1,commission_amount_minor:-1}]);
  await post(1,refund(receipt,{refundAmountMinor:1,reference:'Extra refund'}),400);
  assert.equal(sql.prepare('SELECT sum(paid_amount_minor) AS cash,sum(commission_amount_minor) AS commission FROM outbound_deal_payments').get().cash,0);
  assert.equal(sql.prepare('SELECT sum(commission_amount_minor) AS commission FROM outbound_deal_payments').get().commission,0);
  assert.equal((await get(2)).metrics.payingCustomers,0);
});

test('racing refunds are constrained by the production database guard', async () => {
  await wonDeal(1,{commissionBps:5000});await post(1,payment(1,{paidAmountMinor:100}));
  const receipt=sql.prepare('SELECT id FROM outbound_deal_payments').get().id;
  const responses=await Promise.all([route.POST(req(1,1,refund(receipt,{refundAmountMinor:75,reference:'Race refund A'}))),route.POST(req(1,1,refund(receipt,{refundAmountMinor:75,reference:'Race refund B'})))]);
  assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);
  const totals=sql.prepare('SELECT sum(paid_amount_minor) AS cash,sum(commission_amount_minor) AS commission FROM outbound_deal_payments').get();
  assert.deepEqual({...totals},{cash:25,commission:12});assert.equal(count('outbound_deal_payments'),2);
});

test('refund attribution uses the original seller and policy even after reassignment or organization changes', async () => {
  await wonDeal(1,{commissionBps:5000});await post(1,payment(1,{paidAmountMinor:10000}));
  const receipt=sql.prepare('SELECT id FROM outbound_deal_payments').get().id;
  await post(1,{type:'assign',entryIds:[1],membershipId:3});
  await post(1,{type:'settings',enabled:true,currency:'EUR',timezone:'Europe/Paris',commissionBps:1000,commissionMonths:24,pitch:''});
  await post(1,refund(receipt,{refundAmountMinor:4000}));
  const saved=sql.prepare('SELECT membership_id,currency,commission_bps,paid_amount_minor,commission_amount_minor FROM outbound_deal_payments WHERE refund_payment_id=?').get(receipt);
  assert.deepEqual({...saved},{membership_id:2,currency:'NOK',commission_bps:5000,paid_amount_minor:-4000,commission_amount_minor:-2000});
});

test('dashboard keeps attended-demo and activated-trial milestones after a sale and counts actual net-paying customers', async () => {
  await wonDeal();
  await post(2,{type:'stage',entryId:1,pipeline:'Demo gjennomført'});await post(2,{type:'stage',entryId:1,pipeline:'Prøveperiode'});await post(2,{type:'stage',entryId:1,pipeline:'Kunde'});
  const before=await get(2);assert.equal(before.metrics.demosAttended,1);assert.equal(before.metrics.trialsActivated,1);assert.equal(before.metrics.payingCustomers,0);
  assert.equal(before.byMember[0].demosAttended,1);assert.equal(before.byMember[0].trialsActivated,1);assert.equal(before.byMember[0].payingCustomers,0);
  await post(1,payment(1,{paidAmountMinor:10000}));
  const paid=await get(2);assert.equal(paid.metrics.payingCustomers,1);assert.equal(paid.byMember[0].payingCustomers,1);
  const receipt=sql.prepare('SELECT id FROM outbound_deal_payments').get().id;
  await post(1,refund(receipt,{refundAmountMinor:10000}));
  const after=await get(2);assert.equal(after.metrics.payingCustomers,0);assert.equal(after.metrics.demosAttended,1);assert.equal(after.metrics.trialsActivated,1);
});

test('receipts after cancellation or the agreed commission period retain cash but earn no commission', async () => {
  await wonDeal(1,{commissionMonths:1});
  const expired=await post(1,payment(1,{receivedAt:'2026-02-03T12:00:00.000Z',reference:'Expired policy receipt'}));
  assert.equal(expired.commissionEligible,false);assert.equal(expired.commissionReason,'commission_period_ended');assert.equal(expired.commissionAmountMinor,0);
  await wonDeal(2,{subscriptionCancelledAt:'2026-02-01T12:00:00.000Z'});
  const cancelled=await post(1,payment(2,{receivedAt:'2026-02-02T12:00:00.000Z',reference:'Cancelled subscription receipt'}));
  assert.equal(cancelled.commissionEligible,false);assert.equal(cancelled.commissionReason,'subscription_cancelled');assert.equal(cancelled.commissionAmountMinor,0);
  const result=await get(2);assert.equal(result.paymentTotals[0].paidMinor,98000);assert.equal(result.paymentTotals[0].commissionMinor,0);
});

test('a legacy customerId cannot silently link a lead to an unrelated seller customer', async () => {
  entry(1,{customer_id:15});state(1,2);ownership('NO','900000001',2);
  company(15,{org_number:'999999999',assigned_to:'User 3'});ownership('NO','999999999',3);
  const response=await route.POST(req(2,1,{type:'stage',entryId:1,pipeline:'Kunde'}));
  assert.ok([200,400,404].includes(response.status));
  if(response.status===200)assert.equal(sql.prepare('SELECT customer_company_id FROM outbound_deals').get().customer_company_id,null);
  else assert.equal(count('outbound_deals'),0);
});

test('count distribution deduplicates companies before applying its limit despite many establishment copies', async () => {
  for(let id=1;id<=100;id++)entry(id,{country:'FR',org_number:id===1?'552100554':'552100554'+String(id).padStart(5,'0'),list_id:id%2?1:2});
  for(let id=101;id<=103;id++)entry(id);
  const result=await post(1,{type:'assign',membershipIds:[2,3],count:3,mode:'unassigned'});
  assert.equal(result.assigned,3);assert.equal(count('outbound_company_ownership'),3);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM outbound_company_ownership WHERE country='FR' AND org_number='552100554'").get().n,1);
  assert.deepEqual(result.distribution.map(row=>row.assigned),[2,1]);
});

test('contact-permission audit records remain in history without inflating call-attempt statistics', async () => {
  entry(1);state(1,2);ownership('NO','900000001',2);
  await post(2,{type:'permission',entryId:1,permission:true,note:'Corporate permission recorded'});
  await post(1,{type:'permission',entryId:1,permission:false,note:'Permission withdrawn'});
  await post(2,{type:'permission',entryId:1,permission:true,note:'New permission recorded'});
  const before=await get(2);assert.equal(before.metrics.attempts,0);assert.equal(before.metrics.uniqueCalled,0);assert.equal(before.byMember[0].attempts,0);
  const audit=await get(2,'?entryId=1');assert.equal(audit.history.length,3);
  await dial(2,1,{outcome:'Ikke svar',note:'Actual call'});
  const after=await get(2);assert.equal(after.metrics.attempts,1);assert.equal(after.metrics.uniqueCalled,1);assert.equal(after.byMember[0].attempts,1);
  assert.equal((await get(2,'?entryId=1')).history.length,4);
});

test('network retries compare normalized call payloads and preserve one recorded attempt', async () => {
  entry(1);state(1,2);ownership('NO','900000001',2);
  const lock=await acquire(2,1),nextCallAt=new Date(Date.now()+86400000).toISOString();
  const body={type:'dial',entryId:1,leaseToken:lock.leaseToken,requestId:randomUUID(),outcome:'Interessert',note:'  Requested a follow-up  ',nextCallAt,contactName:'  Casey  ',contactPhone:'  12345678  '};
  await post(2,body);
  assert.equal((await post(2,body)).duplicate,true);
  assert.equal((await post(2,{...body,note:'Requested a follow-up',nextCallAt:nextCallAt.replace(/Z$/,'+00:00'),contactName:'Casey',contactPhone:'12345678'})).duplicate,true);
  assert.equal(count('outbound_call_logs'),1);
  assert.equal(sql.prepare('SELECT attempts FROM outbound_lead_state WHERE entry_id=1').get().attempts,1);
  assert.match(sql.prepare('SELECT request_fingerprint FROM outbound_call_logs').get().request_fingerprint,/^[a-f0-9]{64}$/);
});

test('one call request UUID cannot conceal changed results, notes, callback times or contact details', async () => {
  entry(1);state(1,2);ownership('NO','900000001',2);
  const lock=await acquire(2,1),nextCallAt=new Date(Date.now()+86400000).toISOString();
  const body={type:'dial',entryId:1,leaseToken:lock.leaseToken,requestId:randomUUID(),outcome:'Interessert',note:'Original note',nextCallAt,contactName:'Casey',contactPhone:'12345678'};
  await post(2,body);
  for(const changed of [{outcome:'Møte booket'},{outcome:'Reservert mot kontakt'},{note:'Changed note'},{nextCallAt:new Date(Date.parse(nextCallAt)+86400000).toISOString()},{contactName:'Someone else'},{contactPhone:'87654321'}])await post(2,{...body,...changed},409);
  assert.equal(count('outbound_call_logs'),1);assert.equal(count('outbound_deals'),0);assert.equal(count('outbound_suppression'),0);
  const saved=sql.prepare('SELECT attempts,last_outcome,last_note,next_call_at,contact_name,contact_phone FROM outbound_lead_state WHERE entry_id=1').get();
  assert.deepEqual({...saved},{attempts:1,last_outcome:'Interessert',last_note:'Original note',next_call_at:nextCallAt,contact_name:'Casey',contact_phone:'12345678'});
});

test('accented market exclusions apply before fresh and due queue pagination', async () => {
  sql.prepare('UPDATE organizations SET outbound_market_rules=? WHERE id=1').run(JSON.stringify({blockedIndustries:['etudes'],blockedRegions:['evreux']}));
  entry(1);state(1,2);ownership('NO','900000001',2);
  entry(2);state(2,2,{next_call_at:new Date(Date.now()-60000).toISOString()});ownership('NO','900000002',2);
  const earlier=new Date(Date.now()-120000).toISOString();
  for(let id=3;id<=154;id++){
    entry(id,id%2?{industry:'Études Lyon'}:{city:'ÉVREUX'});
    state(id,2);ownership('NO',String(900000000+id),2);
  }
  const fresh=await get(2,'?queue=fresh');
  sql.prepare('UPDATE outbound_lead_state SET next_call_at=? WHERE entry_id>=3').run(earlier);
  const due=await get(2,'?queue=due');
  assert.deepEqual(fresh.rows.map(row=>row.id),[1]);assert.deepEqual(due.rows.map(row=>row.id),[2]);
  assert.ok([...fresh.rows,...due.rows].every(row=>row.eligibility.eligible===true));
  assert.equal(fresh.hasMore,false);assert.equal(due.hasMore,false);
});

test('default outbound pagination keeps ready leads ahead of over 150 closed, blocked or unscheduled demo leads', async () => {
  sql.prepare('UPDATE organizations SET outbound_market_rules=? WHERE id=1').run(JSON.stringify({blockedIndustries:['etudes']}));
  entry(1);state(1,2);ownership('NO','900000001',2);
  entry(2);state(2,2,{next_call_at:new Date(Date.now()-60000).toISOString()});ownership('NO','900000002',2);
  const earlier=new Date(Date.now()-120000).toISOString();
  for(let id=3;id<=182;id++){
    entry(id,id%5===3?{industry:'Études Lyon'}:{});
    state(id,2,{next_call_at:id%5===4?'':earlier,...(id%5===0?{pipeline:'Kunde'}:id%5===1?{pipeline:'Tapt'}:id%5===2?{do_not_contact:1}:id%5===4?{pipeline:'Demo booket'}:{})});
    ownership('NO',String(900000000+id),2);
  }
  const first=await get(2);
  assert.equal(first.rows.length,150);
  const ready=first.rows.filter(row=>row.eligibility.eligible&&!['Kunde','Tapt','Demo booket'].includes(row.state?.pipeline));
  assert.deepEqual(ready.map(row=>row.id),[2,1]);assert.equal(first.hasMore,true);
  const later=await get(2,'?offset=150');assert.equal(later.rows.length,32);
  assert.equal(new Set([...first.rows,...later.rows].map(row=>row.id)).size,182);
  add('outbound_call_logs',{organization_id:1,entry_id:182,membership_id:2,outcome:'Ikke svar',note:'Archived attempt remains accessible',created_at:now()});
  assert.equal((await get(2,'?entryId=182')).history[0].note,'Archived attempt remains accessible');
});

test('production trigger freezes paid-deal financial terms while cancellation remains editable', async () => {
  await wonDeal();await post(1,payment());
  const protectedChanges={organization_id:2,entry_id:2,membership_id:3,customer_company_id:null,customer_organization_id:2,currency:'EUR',commission_bps:5000,commission_months:24,commission_agreed_at:'2026-01-02T12:00:00.000Z',subscription_activated_at:'2026-01-03T12:00:00.000Z'};
  const before={...sql.prepare('SELECT * FROM outbound_deals WHERE entry_id=1').get()};
  for(const [column,value] of Object.entries(protectedChanges))assert.throws(()=>sql.prepare(`UPDATE outbound_deals SET ${column}=? WHERE id=?`).run(value,before.id),/financial terms are frozen/);
  assert.deepEqual({...sql.prepare('SELECT * FROM outbound_deals WHERE entry_id=1').get()},before);
  company(2,{org_number:'900000001'});
  await post(1,{type:'stage',entryId:1,pipeline:'Kunde',customerCompanyId:2},409);
  await post(1,{type:'stage',entryId:1,pipeline:'Kunde',subscriptionCancelledAt:'2026-02-15T12:00:00.000Z'});
  assert.equal(sql.prepare('SELECT subscription_cancelled_at FROM outbound_deals').get().subscription_cancelled_at,'2026-02-15T12:00:00.000Z');
});

test('a payment cannot use a commission snapshot changed between reading and inserting', async () => {
  await wonDeal();let changed=false;
  queryHook=query=>{
    if(/^insert into "outbound_deal_payments"/i.test(query)){
      queryHook=null;changed=true;
      sql.exec('UPDATE outbound_deals SET commission_bps=5000 WHERE entry_id=1');
    }
  };
  await post(1,payment(),409);
  assert.equal(changed,true);assert.equal(count('outbound_deal_payments'),0);
  const retry=await post(1,payment());
  assert.equal(retry.commissionAmountMinor,24500);
  assert.equal(sql.prepare('SELECT commission_bps FROM outbound_deal_payments').get().commission_bps,5000);
});

test('bounded eligibility scanning returns a raw cursor that reaches valid leads after more than 1500 blocked rows', async () => {
  sql.prepare('UPDATE organizations SET outbound_market_rules=? WHERE id=1').run(JSON.stringify({blockedIndustries:['etudes']}));
  entry(1,{org_number:''});state(1,2);
  for(let id=2;id<=1503;id++){entry(id,{org_number:'',industry:'Études Lyon'});state(id,2);}
  const first=await get(2,'?queue=fresh');
  assert.deepEqual(first.rows,[]);assert.equal(first.hasMore,true);assert.equal(first.nextOffset,1500);
  const next=await get(2,`?queue=fresh&offset=${first.nextOffset}`);
  assert.deepEqual(next.rows.map(row=>row.id),[1]);assert.equal(next.hasMore,false);assert.equal(next.nextOffset,1503);
  assert.equal(next.rows[0].eligibility.eligible,true);
});

test('ready queue returns both due callbacks and fresh leads after more than 150 accented exclusions', async () => {
  sql.prepare('UPDATE organizations SET outbound_market_rules=? WHERE id=1').run(JSON.stringify({blockedIndustries:['etudes'],blockedRegions:['evreux']}));
  entry(1,{org_number:''});state(1,2);
  entry(2,{org_number:''});state(2,2,{next_call_at:new Date(Date.now()-60000).toISOString()});
  const earlier=new Date(Date.now()-120000).toISOString();
  for(let id=3;id<=153;id++){
    entry(id,{org_number:'',...(id%2?{industry:'Études Lyon'}:{city:'ÉVREUX'})});
    state(id,2,{next_call_at:earlier});
  }
  const result=await get(2,'?queue=ready');
  assert.deepEqual(result.rows.map(row=>row.id),[2,1]);assert.equal(result.hasMore,false);
  assert.ok(result.rows.every(row=>row.eligibility.eligible===true));
});

test('actual outbound queue SQL uses the production canonical lookup index for French company copies', async () => {
  entry(1,{country:'FR',org_number:'552100554'});state(1,2);ownership('FR','552100554',2);
  entry(2,{country:'FR',org_number:'552 100 554 00013',list_id:2});
  entry(3,{country:'FR',org_number:'552.100.554-00021',list_id:2});
  entry(4,{country:'FR',org_number:'732829320'});state(4,3);ownership('FR','732829320',3);
  const plans=[];
  queryHook=(query,params)=>{
    if(query.includes('"outbound_copy"')&&query.includes('"outbound_state_copy"')){
      plans.push(sql.prepare(`EXPLAIN QUERY PLAN ${query}`).all(...params).map(row=>row.detail));
    }
  };
  const result=await get(2,'?queue=ready');
  assert.deepEqual(result.rows.map(row=>row.id),[1]);
  assert.ok(plans.length>0,'The test must explain the actual outbound queue query');
  for(const plan of plans){
    const lookups=plan.filter(detail=>detail.includes('outbound_entry_canonical_lookup')&&detail.includes('<expr>=?'));
    assert.ok(lookups.length>=2,`Both company-state and duplicate-copy lookups must use the canonical expression index: ${JSON.stringify(plan)}`);
    assert.ok(plan.some(detail=>/SEARCH outbound_state_copy .*outbound_lead_entry_updated \(organization_id=\? AND entry_id=\?\)/.test(detail)),`The state subquery must look up canonical entry IDs instead of scanning the organization's states: ${JSON.stringify(plan)}`);
    assert.ok(!plan.some(detail=>/SEARCH outbound_state_copy .*\(organization_id=\?\)$/.test(detail)),`The state subquery must not scan all tenant states: ${JSON.stringify(plan)}`);
  }
});

test('indexed ready queue paginates 1000 unique companies without losing or duplicating leads', async () => {
  for(let id=1;id<=1000;id++){
    entry(id);state(id,2);ownership('NO',String(900000000+id),2);
  }
  const ids=[];
  let offset=0;
  for(let page=0;page<7;page++){
    const result=await get(2,`?queue=ready&offset=${offset}`);
    assert.equal(result.rows.length,page===6?100:150);
    assert.equal(result.hasMore,page!==6);
    assert.ok(result.rows.every(row=>row.assignedMembershipId===2&&row.eligibility.eligible));
    ids.push(...result.rows.map(row=>row.id));
    assert.equal(result.nextOffset,offset+result.rows.length);
    offset=result.nextOffset;
  }
  assert.equal(offset,1000);
  assert.deepEqual(ids,Array.from({length:1000},(_,index)=>1000-index));
});
