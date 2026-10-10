import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';

const dir = await mkdtemp(path.join(tmpdir(), 'outbound-demo-'));
after(() => rm(dir, {recursive: true, force: true}));
await build({stdin: {contents: "export {createDemoRuntime} from './lib/demo-crm'; export {createDemoOutbound} from './lib/demo-outbound';", resolveDir: path.resolve('.')},
  bundle: true, platform: 'node', format: 'esm', outfile: path.join(dir, 'demo.mjs')});
const {createDemoRuntime, createDemoOutbound} = await import(pathToFileURL(path.join(dir, 'demo.mjs')));
const now = new Date('2026-10-10T17:00:00Z');
const runtime = () => createDemoRuntime(now).request;
const body = data => ({method: 'POST', body: JSON.stringify(data)});
const get = async (request, query = '') => {
  const response = await request('/api/outbound' + query);
  const json = await response.json(); assert.equal(response.status, 200, JSON.stringify(json)); return json;
};
const post = async (request, data, status = 200) => {
  const response = await request('/api/outbound', body(data));
  const json = await response.json(); assert.equal(response.status, status, JSON.stringify(json)); return json;
};
const acquire = (request, entryId, values = {}, status = 200) => post(request, {type: 'acquire', entryId, ...values}, status);
const dial = async (request, entryId, values = {}, status = 200) => {
  const lease = await acquire(request, entryId);
  return post(request, {type: 'dial', entryId, leaseToken: lease.leaseToken, requestId: randomUUID(), outcome: 'Ikke svar', note: '', ...values}, status);
};
const settings = (data = {}) => ({type: 'settings', enabled: true, currency: 'NOK', timezone: 'Europe/Oslo', commissionBps: 0, commissionMonths: 12, pitch: '', marketRules: {}, ...data});

test('outbound demo exposes the production queue/history contract and keeps future callbacks out of fresh leads', async () => {
  const request = runtime(), all = await get(request), fresh = await get(request, '?queue=fresh'), due = await get(request, '?queue=due');
  assert.equal(all.actorMembershipId, 1); assert.equal(all.canManage, true);
  assert.equal(all.rows.length, 24); assert.equal(fresh.rows.length, 18); assert.deepEqual(due.rows, []);
  assert.equal(all.nextOffset, 24); assert.equal(all.metrics.attempts, 0); assert.equal(all.metrics.payingCustomers, 0);
  assert.equal(all.customers.length, 36);
  assert.ok(all.rows.every(lead => lead.state.leaseToken === '' && typeof lead.eligibility.eligible === 'boolean'));
  const history = await get(request, '?entryId=1');
  assert.deepEqual(history.history, []); assert.equal(history.historyNextOffset, 0);
  assert.equal((await request('/api/outbound?queue=unknown')).status, 400);
  assert.equal((await request('/api/outbound?offset=-1')).status, 400);
});

test('ready queue includes fresh leads and due positive follow-ups while excluding future calls and opt-outs', async () => {
  const request = runtime();
  assert.equal((await get(request, '?queue=ready')).rows.length, 18);
  await dial(request, 1);
  await dial(request, 2, {outcome:'Interessert',nextCallAt:'2026-10-09T09:00:00Z'});
  await dial(request, 3, {outcome:'Reservert mot kontakt'});
  const ready = await get(request, '?queue=ready');
  assert.equal(ready.rows[0].id, 2);
  assert.ok(!ready.rows.some(lead => lead.id === 1 || lead.id === 3));
  assert.ok((await get(request, '?queue=all')).rows.some(lead => lead.id === 3 && lead.suppressed));
  await post(request, settings({marketRules:{requireContactPermission:true}}));
  assert.deepEqual((await get(request, '?queue=ready')).rows, []);
});

test('demo calling leases prevent a second tab and call retries do not duplicate history or attempts', async () => {
  const request = runtime(), lease = await acquire(request, 1);
  await acquire(request, 1, {}, 409);
  const renewed = await acquire(request, 1, {leaseToken: lease.leaseToken});
  assert.equal(renewed.leaseToken, lease.leaseToken);
  await post(request, {type: 'release', entryId: 1, leaseToken: 'wrong-token'});
  await acquire(request, 1, {}, 409);
  assert.equal((await get(request)).rows.find(lead => lead.id === 1).state.leaseToken, '');
  const input = {type: 'dial', entryId: 1, leaseToken: lease.leaseToken, requestId: randomUUID(), outcome: 'Interessert', note: 'Wants a demo'};
  await post(request, input);
  assert.equal((await post(request, input)).duplicate, true);
  await post(request, {...input, entryId: 2}, 409);
  const data = await get(request), history = await get(request, '?entryId=1');
  assert.equal(data.metrics.attempts, 1); assert.equal(data.metrics.conversations, 1); assert.equal(history.history.length, 1);
  assert.equal(history.history[0].name, 'Ingrid Berg'); assert.equal(history.history[0].note, 'Wants a demo');
  await post(request, {...input, requestId: randomUUID()}, 409);
});

test('callbacks return when due, validate calendar dates and stay outside fresh leads', async () => {
  const request = runtime();
  const logged = await dial(request, 1);
  assert.ok(Date.parse(logged.lead.nextCallAt) >= now.getTime() + 48 * 3600000);
  assert.ok(!(await get(request, '?queue=fresh')).rows.some(lead => lead.id === 1));
  await post(request, {type: 'callback', entryId: 1, nextCallAt: '2026-10-09T09:00:00Z'});
  assert.deepEqual((await get(request, '?queue=due')).rows.map(lead => lead.id), [1]);
  await post(request, {type: 'callback', entryId: 1, nextCallAt: '2026-02-30T09:00:00Z'}, 400);
  await post(request, {type: 'callback', entryId: 1, nextCallAt: '2026-10-11T09:00'}, 400);
  await dial(request, 1, {outcome: 'Feil nummer'});
  assert.ok(!(await get(request, '?queue=fresh')).rows.some(lead => lead.id === 1));
});

test('round-robin assignment is validated before mutation and keeps prior deal attribution', async () => {
  const request = runtime();
  await post(request, {type: 'stage', entryId: 1, pipeline: 'Demo booket', monthlyAmountMinor: 49900});
  const assigned = await post(request, {type: 'assign', membershipIds: [2,3], count: 5, mode: 'all'});
  assert.equal(assigned.assigned, 5);
  const data = await get(request), selected = data.rows.filter(lead => lead.id <= 5).sort((a,b) => a.id - b.id);
  assert.deepEqual(selected.map(lead => lead.assignedMembershipId), [2,3,2,3,2]);
  assert.equal(data.deals[0].membershipId, 1);
  await acquire(request, 1, {}, 403);
  await post(request, {type: 'assign', entryIds: [1,999999], membershipId: 1}, 400);
  assert.equal((await get(request)).rows.find(lead => lead.id === 1).assignedMembershipId, 2);
  await post(request, {type: 'assign', membershipIds: [1,999], count: 2, mode: 'all'}, 400);
});

test('canonical French copies share ownership, calling locks, history and irreversible contact reservation', async () => {
  const entries = [
    {id:1, country:'FR', orgNumber:'552100554', name:'Company', status:'Ny'},
    {id:2, country:'FR', orgNumber:'55210055400013', name:'Establishment', status:'Ny'},
    {id:3, country:'NO', orgNumber:'552100554', name:'Other market', status:'Ny'},
  ];
  const outbound = createDemoOutbound(entries, [{id:1,name:'Demo seller',active:true}, {id:2,name:'Other seller',active:true}], now);
  const request = async (input, init = {}) => outbound(new URL(input, 'https://demo.invalid'), init.method || 'GET', init.body ? JSON.parse(init.body) : {});
  assert.equal((await get(request)).rows.length, 2);
  const lease = await acquire(request, 1); await acquire(request, 2, {}, 409);
  await post(request, {type:'dial',entryId:2,leaseToken:lease.leaseToken,requestId:randomUUID(),outcome:'Reservert mot kontakt',note:'Opted out'});
  assert.equal((await get(request, '?entryId=1')).history.length, 1);
  assert.equal((await get(request)).rows.find(lead => lead.country === 'FR').suppressed, true);
  assert.deepEqual((await get(request, '?queue=fresh')).rows.map(lead => lead.id), [3]);
  await acquire(request, 1, {}, 409);
  await post(request, {type:'permission',entryId:2,permission:true,note:'Pretend permission'}, 409);
  await post(request, {type:'callback',entryId:2,nextCallAt:'2026-10-11T09:00:00Z'}, 409);
  await post(request, {type:'stage',entryId:2,pipeline:'Prøveperiode',monthlyAmountMinor:0}, 409);
});

test('market settings and documented contact basis apply without inflating calling metrics', async () => {
  const request = runtime();
  await post(request, settings({currency:'EUR', timezone:'Europe/Paris', commissionBps:2500, commissionMonths:6,
    playbooks:{FR:{phoneScript:'Bonjour',emailSubject:'Contact',emailBody:'Bonjour',productInfo:'Approved facts'}}, marketRules:{requireContactPermission:true}}));
  await acquire(request, 1, {}, 409);
  await post(request, {type:'permission',entryId:1,permission:true,note:''}, 400);
  await post(request, {type:'permission',entryId:1,permission:true,note:'Existing customer request'});
  assert.equal((await get(request)).metrics.attempts, 0);
  const lease = await acquire(request, 1); await post(request, {type:'release',entryId:1,leaseToken:lease.leaseToken});
  assert.equal((await get(request, '?entryId=1')).history[0].outcome, 'Kontaktgrunnlag bekreftet');
  const config = (await get(request)).settings;
  assert.equal(config.currency, 'EUR'); assert.equal(config.playbooks.FR.productInfo, 'Approved facts');
  await post(request, settings({marketRules:{blockedIndustries:['Elektro']}})); await acquire(request, 1, {}, 409);
  await post(request, settings({timezone:'Invalid/Zone'}), 400);
  assert.equal((await get(request)).settings.timezone, 'Europe/Oslo');
});

test('demo sales milestones survive progression and real payments and refunds remain disabled', async () => {
  const request = runtime();
  await post(request, {type:'stage',entryId:1,pipeline:'Demo gjennomført',monthlyAmountMinor:0});
  await post(request, {type:'stage',entryId:1,pipeline:'Prøveperiode',monthlyAmountMinor:0});
  await post(request, {type:'stage',entryId:1,pipeline:'Kunde',monthlyAmountMinor:49900});
  const data = await get(request);
  assert.equal(data.metrics.attendedDemos, 1); assert.equal(data.metrics.trials, 1); assert.equal(data.metrics.payingCustomers, 0);
  assert.equal(data.metrics.stages.Kunde, 1); assert.equal(data.deals[0].commissionBps, 0); assert.equal(data.deals[0].commissionAgreedAt, '');
  await post(request, {type:'stage',entryId:1,pipeline:'Kunde',monthlyAmountMinor:49900,customerCompanyId:1,subscriptionActivatedAt:'2026-10-01T09:00:00Z',commissionBps:5000,commissionMonths:12,commissionAgreedAt:'2026-10-01T09:00:00Z'});
  const agreed = (await get(request)).deals[0];
  assert.equal(agreed.customerCompanyId, 1); assert.equal(agreed.commissionBps, 5000); assert.equal(agreed.commissionAgreedAt, '2026-10-01T09:00:00.000Z');
  await post(request, {type:'payment',entryId:1,paidAmountMinor:49900,reference:'BANK-1',confirmed:true,receivedAt:now.toISOString()}, 403);
  await post(request, {type:'refund',paymentId:1,refundAmountMinor:49900,reference:'REFUND-1',confirmed:true,receivedAt:now.toISOString()}, 403);
  assert.deepEqual((await get(request)).payments, []);
});

test('outbound follows regenerated/imported lists, and remounting resets all private demo state', async () => {
  const first = runtime(), second = runtime();
  const imported = await (await first('/api/call-lists', body({type:'import',rows:[{name:'New isolated demo lead',country:'FR'}]}))).json();
  assert.ok((await get(first)).rows.some(lead => lead.id === imported.entries[0].id));
  assert.ok(!(await get(second)).rows.some(lead => lead.name === 'New isolated demo lead'));
  const generated = await (await first('/api/call-lists', body({type:'generate',count:1,organizationForms:['AS']}))).json();
  assert.ok((await get(first)).rows.some(lead => lead.id === generated.entries[0].id));
  assert.ok(!(await get(first)).rows.some(lead => lead.id === 1));
  await post(first, settings({currency:'EUR',timezone:'Europe/Paris'}));
  assert.equal((await get(second)).settings.currency, 'NOK');
  assert.equal((await get(runtime())).rows.length, 24);
});

test('long call histories paginate with actual offsets and no network access', async () => {
  const originalFetch = globalThis.fetch; let networkCalls = 0;
  globalThis.fetch = () => {networkCalls++; throw Error('No external effects allowed');};
  try {
    const request = runtime();
    for (let index=0;index<151;index++) await dial(request, 1, {outcome:'Beslutningstaker kontaktet',note:`Attempt ${index}`});
    const first = await get(request, '?entryId=1'), second = await get(request, '?entryId=1&historyOffset=150');
    assert.equal(first.history.length, 150); assert.equal(first.historyHasMore, true); assert.equal(first.historyNextOffset, 150);
    assert.equal(second.history.length, 1); assert.equal(second.historyNextOffset, 151); assert.equal(second.history[0].note, 'Attempt 0');
    assert.equal((await get(request)).metrics.attempts, 151); assert.equal(networkCalls, 0);
    assert.equal((await request('/api/outbound?entryId=1&historyOffset=-1')).status, 400);
  } finally {globalThis.fetch = originalFetch;}
});
