import {test, after, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {act, create} from 'react-test-renderer';
import {build} from 'esbuild';
import {writeFile, unlink} from 'node:fs/promises';
const output = new URL('./.outbound-ui-runtime.mjs', import.meta.url);
const compiled = await build({
  entryPoints: ['components/outbound-sales-desk.tsx'], bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external', loader: {'.css': 'empty'}, write: false,
  plugins: [{name: 'workspace-test-runtime', setup(builder) {
    builder.onResolve({filter: /\/lib\/crm-api$|\/lib\/i18n\/react$|^sonner$|\/components\/ui\/(button|input|textarea)$/}, args => ({path: args.path, namespace: 'test-runtime'}));
    builder.onLoad({filter: /.*/, namespace: 'test-runtime'}, args => {
      if (args.path.endsWith('/lib/crm-api')) return {contents: 'export const useCrmApi=()=>globalThis.outboundTestApi; export const useDemoMode=()=>!!globalThis.outboundTestDemo;', loader: 'js'};
      if (args.path.endsWith('/lib/i18n/react')) return {contents: 'export const useI18n=()=>({locale:globalThis.outboundTestLocale??"en"});', loader: 'js'};
      if (args.path === 'sonner') return {contents: 'export const toast={success:message=>globalThis.outboundTestToasts.push(message),error:message=>globalThis.outboundTestToasts.push(message)};', loader: 'js'};
      const name = args.path.split('/').at(-1);
      const capital = name[0].toUpperCase() + name.slice(1);
      return {contents: `import React from 'react';export function ${capital}({children,variant,...props}){return React.createElement('${name}',props,children);}`, loader: 'js', resolveDir: process.cwd()};
    });
  }}],
});
await writeFile(output, compiled.outputFiles[0].text);
const {OutboundSalesDesk} = await import(output.href);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let renderer;
let posts;
let enabled;
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : (node?.children ?? []).map(text).join('');
const button = label => renderer.root.findAllByType('button').find(node => text(node) === label);
const labelNode = label => renderer.root.findAllByType('label').find(node => text(node).startsWith(label));
const input = label => labelNode(label).findByType('input');
const click = async label => {const node = button(label); assert.ok(node, `Missing button: ${label}`); assert.notEqual(node.props.disabled, true); await act(async () => node.props.onClick());};
const change = async (node, value) => act(async () => node.props.onChange({target: {value}}));
const checkbox = async (node, checked) => act(async () => node.props.onChange({target: {checked}}));
const iso = () => new Date(Date.now() + 120000).toISOString();
function row(id, overrides = {}) {
  return {id, name: `Company ${id}`, country: 'FR', orgNumber: String(100000000 + id), city: 'Paris', industry: 'Software', employees: 10, employeeRange: '', phone: '+33100000000', website: 'example.fr', email: 'hello@example.fr', status: 'Ny', assignedMembershipId: 1, suppressed: false, state: {assignedMembershipId: 1, attempts: 0, pipeline: 'Prospekt', nextCallAt: id === 1 ? new Date(Date.now() - 60000).toISOString() : '', lastOutcome: '', lastNote: '', contactName: '', contactPhone: '', doNotContact: false}, ...overrides};
}
function fixture(overrides = {}) {
  return {settings: {enabled: true, currency: 'EUR', timezone: 'Europe/Paris', commissionBps: 2500, commissionMonths: 12, pitch: '', playbooks: {}, marketRules: {blockedCountries: [], blockedIndustries: [], blockedRegions: [], requireContactPermission: false, contactHours: null}}, rows: [row(1), row(2)], hasMore: false, metrics: {attempts: 120, conversations: 34, meetings: 7, conversationRate: 28.3, meetingRate: 20.6, stages: {}}, deals: [], payments: [], members: [{id: 1, name: 'Seller One', active: true}, {id: 2, name: 'Seller Two', active: true}], canManage: true, actorMembershipId: 1, customers: [{id: 10, name: 'Saved customer'}], ...overrides};
}
async function mount(data = fixture(), overrideApi, props = {}) {
  posts = []; enabled = []; globalThis.outboundTestToasts = []; globalThis.outboundTestDemo = false; globalThis.outboundTestLocale = 'en';
  globalThis.outboundTestApi = overrideApi ?? (async (url, options = {}) => {
    const query = new URL(url, 'https://crm.test');
    if (options.method !== 'POST') {
      if (query.searchParams.has('entryId')) return Response.json({history: [], historyHasMore: false});
      return Response.json(structuredClone(data));
    }
    const body = JSON.parse(options.body); posts.push(body);
    if (body.type === 'acquire') return Response.json({lease: {entryId: body.entryId, token: `lease-${body.entryId}`, expiresAt: iso()}});
    if (body.type === 'settings') {data.settings = {...data.settings, ...body}; delete data.settings.type;}
    if (body.type === 'dial') {const lead = data.rows.find(lead => lead.id === body.entryId); lead.state.nextCallAt = body.nextCallAt || new Date(Date.now() + 172800000).toISOString(); lead.state.attempts++;}
    return Response.json({ok: true});
  });
  await act(async () => {renderer = create(React.createElement(OutboundSalesDesk, {organizationId: 1, selectedListId: null, onShowLegacy() {}, onEnabledChange: value => enabled.push(value), ...props}));});
}
afterEach(async () => {if (renderer) await act(async () => renderer.unmount()); renderer = null;});
after(async () => {await unlink(output); delete globalThis.outboundTestApi; delete globalThis.outboundTestToasts; delete globalThis.outboundTestLocale; delete globalThis.outboundTestDemo;});

test('a call reserves exactly one company, sends the lease and a unique retry id, then moves to the next company', async () => {
  await mount();
  assert.equal(posts.filter(post => post.type === 'acquire').length, 1);
  assert.equal(posts.find(post => post.type === 'acquire').entryId, 1);
  await change(input('Next contact'), '2026-12-12T09:00');
  await click('Log and continue');
  const dial = posts.find(post => post.type === 'dial');
  assert.equal(dial.entryId, 1); assert.equal(dial.leaseToken, 'lease-1'); assert.ok(dial.requestId.length > 10);
  assert.equal(dial.nextCallAt, '2026-12-12T08:00:00.000Z');
  assert.match(text(renderer.root), /Company 2/);
  assert.ok(posts.some(post => post.type === 'release' && post.entryId === 1));
  assert.ok(posts.some(post => post.type === 'acquire' && post.entryId === 2));
});
test('a failed reservation blocks calling without hiding the prospect and allows an explicit retry', async () => {
  const data = fixture(); let attempts = 0;
  await mount(data, async (url, options = {}) => {
    if (options.method !== 'POST') return Response.json(String(url).includes('entryId=') ? {history: []} : data);
    const body = JSON.parse(options.body); posts.push(body);
    if (body.type === 'acquire' && ++attempts === 1) return Response.json({error: 'Another seller is calling'}, {status: 409});
    return Response.json({lease: {entryId: body.entryId, token: 'recovered', expiresAt: iso()}});
  });
  assert.equal(button('Log and continue').props.disabled, true);
  assert.match(text(renderer.root), /Another seller is calling/);
  await click('Reserve again');
  assert.equal(button('Log and continue').props.disabled, false);
});
test('automatic distribution submits selected sellers and count without relying on only loaded lead ids', async () => {
  await mount();
  const distribution = renderer.root.findByProps({className: 'outbound-distribution'});
  const boxes = distribution.findAllByType('input').filter(node => node.props.type === 'checkbox');
  await checkbox(boxes[0], true); await checkbox(boxes[1], true);
  await click('Distribute leads automatically');
  const assign = posts.find(post => post.type === 'assign');
  assert.deepEqual(assign.membershipIds, [1, 2]); assert.equal(assign.count, 50); assert.equal(assign.mode, 'unassigned'); assert.equal(assign.entryIds, undefined);
});
test('disabled organizations expose an administrator opt-in and save before opening the workspace', async () => {
  const data = fixture(); data.settings.enabled = false;
  await mount(data);
  assert.ok(button('Enable outbound'));
  await checkbox(input('Our company uses outbound sales'), true);
  await click('Enable outbound');
  assert.equal(posts.find(post => post.type === 'settings').enabled, true);
  assert.ok(enabled.includes(true)); assert.ok(button('Calls'));
});
test('standard-list mode stays compact and never reserves a prospect', async () => {
  await mount(fixture(), undefined, {legacyVisible: true});
  assert.match(text(renderer.root), /Each organization/);
  assert.equal(renderer.root.findAllByProps({className: 'outbound-layout'}).length, 0);
  assert.equal(posts.filter(post => post.type === 'acquire').length, 0);
});
test('dashboard displays meeting conversion and salesperson views omit administrator controls', async () => {
  await mount(fixture({canManage: false, members: [{id: 1, name: 'Seller One', active: true}]}));
  assert.equal(button('Settings'), undefined);
  assert.equal(button('Distribute leads automatically'), undefined);
  await click('Performance');
  assert.match(text(renderer.root), /Meetings \/ conversations20.6%/);
});
test('financial forms require actual received dates and agreed terms are not silently overwritten', async () => {
  const data = fixture({deals: [{id: 1, entryId: 1, pipeline: 'Kunde', membershipId: 1, monthlyAmountMinor: 1200, currency: 'JPY', commissionBps: 2500, commissionMonths: 12, note: '', customerCompanyId: 10, subscriptionActivatedAt: '2026-09-01T08:00:00Z', commissionAgreedAt: '2026-09-01T08:00:00Z'}]});
  await mount(data); await click('Pipeline');
  await change(input('Contracted monthly revenue'), '1300');
  await click('Save stage');
  const stage = posts.find(post => post.type === 'stage');
  assert.equal(stage.monthlyAmountMinor, 1300); assert.equal(stage.customerCompanyId, 10); assert.equal(stage.commissionBps, undefined); assert.equal(stage.commissionAgreedAt, undefined);
  await change(input('Invoice/payment reference'), 'payment-100');
  await change(input('Confirmed receipts'), '1400');
  await change(input('Actual payment date'), '2026-10-01T10:00');
  await checkbox(input('I verified that this payment was received'), true);
  await click('Record confirmed payment');
  const payment = posts.find(post => post.type === 'payment');
  assert.equal(payment.paidAmountMinor, 1400); assert.equal(payment.receivedAt, '2026-10-01T08:00:00.000Z'); assert.equal(payment.confirmed, true);
});
test('contact-basis edits send the required explicit permission contract', async () => {
  await mount(); await click('Pipeline');
  await checkbox(input('The contact basis has been verified'), true);
  const area = labelNode('Evidence or source').findByType('textarea');
  await change(area, 'Customer requested a product call');
  await click('Save contact basis');
  const permission = posts.find(post => post.type === 'permission');
  assert.equal(posts.find(post => post.type === 'stage')?.customerCompanyId, undefined);
  assert.equal(permission.permission, true); assert.equal(permission.note, 'Customer requested a product call');
});
test('an unavailable data load shows its error and a working retry instead of an endless spinner', async () => {
  let calls = 0;
  await mount(fixture(), async url => {
    if (String(url).includes('entryId=')) return Response.json({history: []});
    if (++calls === 1) return Response.json({error: 'Temporarily unavailable'}, {status: 503});
    return Response.json(fixture());
  });
  assert.match(text(renderer.root), /Temporarily unavailable/);
  await click('Retry');
  assert.match(text(renderer.root), /Company 1/);
});
test('changing organizations cannot reveal a late previous organization response', async () => {
  let resolveOld;
  await mount(fixture(), async (url, options = {}) => {
    const org = options.headers?.['x-organization-id'];
    if (options.method === 'POST') return Response.json({lease: {entryId: 7, token: 'tenant2', expiresAt: iso()}});
    if (String(url).includes('entryId=')) return Response.json({history: []});
    if (org === '1') return new Promise(resolve => {resolveOld = resolve;});
    return Response.json(fixture({rows: [row(7, {name: 'Second organization lead'})]}));
  });
  await act(async () => renderer.update(React.createElement(OutboundSalesDesk, {organizationId: 2, selectedListId: null, onShowLegacy() {}, onEnabledChange() {}})));
  assert.match(text(renderer.root), /Second organization lead/);
  await act(async () => resolveOld(Response.json(fixture({rows: [row(9, {name: 'Private previous organization'})]}))));
  assert.doesNotMatch(text(renderer.root), /Private previous organization/);
});
test('French users receive localized outcomes, controls, scripts and reporting labels', async () => {
  await mount(); globalThis.outboundTestLocale = 'fr';
  await act(async () => renderer.update(React.createElement(OutboundSalesDesk, {organizationId: 1, selectedListId: null, onShowLegacy() {}, onEnabledChange() {}})));
  assert.ok(button('Sans réponse')); assert.ok(button('Enregistrer et continuer')); assert.ok(button('Performances'));
  assert.match(text(renderer.root), /Bonjour/);
  assert.doesNotMatch(text(renderer.root), /ansatte|Velg selger|Samtalenotat/);
});

test('creating a real customer from the pipeline confirms the returned record, selects it and refreshes CRM data without recording finances', async () => {
  const data = fixture(); let customerRequest; let refreshed = 0;
  await mount(data, async (url, options = {}) => {
    if (options.method !== 'POST') return Response.json(String(url).includes('entryId=') ? {history: []} : data);
    const body = JSON.parse(options.body);
    if (url === '/api/companies') {customerRequest = {body, headers: options.headers}; data.customers.push({id: 42, name: body.name}); return Response.json({company: {id: 42, name: body.name}}, {status: 201});}
    posts.push(body);
    if (body.type === 'acquire') return Response.json({leaseToken: '012345678901234567890', expiresAt: iso()});
    return Response.json({ok: true});
  }, {onDataChanged: async () => {refreshed++;}});
  await click('Pipeline'); await click('Create customer record');
  assert.equal(customerRequest.body.name, 'Company 1'); assert.equal(customerRequest.body.country, 'FR'); assert.equal(customerRequest.body.source, 'Ringeliste'); assert.equal(customerRequest.headers['x-organization-id'], '1');
  assert.equal(refreshed, 1); assert.equal(button('Create customer record'), undefined);
  await click('Save stage'); assert.equal(posts.find(post => post.type === 'stage').customerCompanyId, 42);
  assert.equal(posts.some(post => ['payment', 'refund'].includes(post.type)), false);
});
test('saving an existing agreement preserves its exact original subscription instant including seconds', async () => {
  const data = fixture({deals: [{id: 1, entryId: 1, pipeline: 'Prøveperiode', membershipId: 1, monthlyAmountMinor: 49900, currency: 'EUR', commissionBps: 2500, commissionMonths: 12, note: '', customerCompanyId: 10, subscriptionActivatedAt: '2026-09-01T08:00:59.531Z', commissionAgreedAt: '2026-09-01T07:00:00.000Z'}]});
  await mount(data); await click('Pipeline'); await click('Save stage');
  const stage = posts.find(post => post.type === 'stage');
  assert.equal(stage.subscriptionActivatedAt, undefined); assert.equal(stage.subscriptionCancelledAt, undefined); assert.equal(stage.commissionAgreedAt, undefined);
});
test('a slow previous-company history response cannot overwrite the current company history', async () => {
  const data = fixture(); let resolvePrevious;
  await mount(data, async (url, options = {}) => {
    if (options.method === 'POST') {const body = JSON.parse(options.body); posts.push(body); return Response.json({leaseToken: '012345678901234567890', expiresAt: iso()});}
    if (String(url).includes('entryId=1')) return new Promise(resolve => {resolvePrevious = resolve;});
    if (String(url).includes('entryId=2')) return Response.json({history: [{id: 2, entryId: 2, membershipId: 1, name: 'Seller One', outcome: 'Interessert', note: 'Current company history', nextCallAt: '', createdAt: '2026-10-01T08:00:00Z'}]});
    return Response.json(data);
  });
  await click('Next company');
  assert.match(text(renderer.root), /Current company history/);
  await act(async () => resolvePrevious(Response.json({history: [{id: 1, entryId: 1, membershipId: 1, outcome: 'Interessert', note: 'Previous company history', nextCallAt: '', createdAt: '2026-10-01T08:00:00Z'}]})));
  assert.match(text(renderer.root), /Current company history/); assert.doesNotMatch(text(renderer.root), /Previous company history/);
});

test('a late paginated history response is discarded after moving to another company', async () => {
  const data = fixture(); let resolvePage;
  const log = note => ({id: 1, entryId: 1, membershipId: 1, name: 'Seller One', outcome: 'Interessert', note, nextCallAt: '', createdAt: '2026-10-01T08:00:00Z'});
  await mount(data, async (url, options = {}) => {
    if (options.method === 'POST') return Response.json({leaseToken: '012345678901234567890', expiresAt: iso()});
    if (String(url).includes('entryId=1') && String(url).includes('historyOffset=1')) return new Promise(resolve => {resolvePage = resolve;});
    if (String(url).includes('entryId=1')) return Response.json({history: [log('First company log')], historyHasMore: true});
    if (String(url).includes('entryId=2')) return Response.json({history: [{...log('Current company page'), id: 2, entryId: 2}], historyHasMore: false});
    return Response.json(data);
  });
  await click('Older calls'); await click('Next company');
  await act(async () => resolvePage(Response.json({history: [log('Stale previous company page')], historyHasMore: false})));
  assert.match(text(renderer.root), /Current company page/); assert.doesNotMatch(text(renderer.root), /Stale previous company page/);
});

test('the workspace opens a recipient country contact window as time advances despite a different organization zone', async () => {
  const realNow = Date.now;
  const realSetInterval = globalThis.setInterval;
  const realClearInterval = globalThis.clearInterval;
  const timers = [];
  let instant = Date.parse('2026-10-12T07:59:00Z');
  Date.now = () => instant;
  globalThis.setInterval = (callback, period) => {const id = {callback, period}; timers.push(id); return id;};
  globalThis.clearInterval = id => {if (!timers.includes(id)) realClearInterval(id);};
  try {
    const data = fixture({rows: [row(1, {country: 'NG', eligible: false, eligibility: {eligible: false, reason: 'outside_contact_hours'}})]});
    data.settings.timezone = 'Asia/Tokyo';
    data.settings.marketRules.contactHours = {weekdays: [1, 2, 3, 4, 5], start: '09:00', end: '17:00'};
    await mount(data, async (url, options = {}) => {
      if (options.method === 'POST') {const body = JSON.parse(options.body); posts.push(body); return Response.json({leaseToken: '012345678901234567890', expiresAt: iso()});}
      if (String(url).includes('entryId=')) return Response.json({history: []});
      return Response.json({...data, rows: instant < Date.parse('2026-10-12T08:00:00Z') ? [] : data.rows});
    });
    assert.equal(button('Log and continue'), undefined); assert.equal(posts.some(post => post.type === 'acquire'), false);
    instant = Date.parse('2026-10-12T08:00:00Z');
    await act(async () => timers.find(timer => timer.period === 30000).callback());
    assert.equal(button('Log and continue').props.disabled, false);
    assert.ok(posts.some(post => post.type === 'acquire'));
    instant = Date.parse('2026-10-12T16:00:00Z');
    await act(async () => timers.find(timer => timer.period === 30000).callback());
    assert.equal(button('Log and continue'), undefined);
    await act(async () => renderer.unmount()); renderer = null;
  } finally {Date.now = realNow; globalThis.setInterval = realSetInterval; globalThis.clearInterval = realClearInterval;}
});

test('server queue scopes follow dial filters and pipeline tabs without resetting the selected tab', async () => {
  const requests = [];
  await mount(fixture(), async (url, options = {}) => {
    if (options.method === 'POST') return Response.json({leaseToken: '012345678901234567890', expiresAt: iso()});
    if (String(url).includes('entryId=')) return Response.json({history: []});
    requests.push(new URL(url, 'https://crm.test'));
    return Response.json(fixture());
  });
  assert.equal(requests.at(-1).searchParams.get('queue'), 'ready');
  await change(renderer.root.findByProps({'aria-label': 'Callback'}), 'due');
  assert.equal(requests.at(-1).searchParams.get('queue'), 'due');
  await click('Pipeline');
  assert.equal(requests.at(-1).searchParams.get('queue'), 'all');
  assert.equal(button('Pipeline').props['aria-current'], 'page');
  assert.ok(button('Save stage'));
  await click('Calls');
  assert.equal(requests.at(-1).searchParams.get('queue'), 'due');
  await change(renderer.root.findByProps({'aria-label': 'Callback'}), 'all');
  assert.equal(requests.at(-1).searchParams.get('queue'), 'all');
  assert.equal(button('Calls').props['aria-current'], 'page');
});
test('loading another filtered queue page preserves the raw server cursor rather than using the visible row count', async () => {
  const requests = [];
  await mount(fixture(), async (url, options = {}) => {
    if (options.method === 'POST') return Response.json({leaseToken: '012345678901234567890', expiresAt: iso()});
    if (String(url).includes('entryId=')) return Response.json({history: []});
    const parsed = new URL(url, 'https://crm.test'); requests.push(parsed);
    const offset = Number(parsed.searchParams.get('offset'));
    return Response.json(fixture({rows: [row(offset ? 2 : 1)], hasMore: !offset, nextOffset: offset ? 355 : 201}));
  });
  await click('Load more');
  assert.equal(requests.at(-1).searchParams.get('offset'), '201');
  assert.equal(requests.at(-1).searchParams.get('queue'), 'ready');
  assert.match(text(renderer.root), /Company 1/); assert.match(text(renderer.root), /Company 2/);
});

test('logging a call resets contact, phone and call link to the next company rather than retaining the previous contact', async () => {
  const data = fixture();
  data.rows[0].state.contactName = 'First-company contact';
  data.rows[0].state.contactPhone = '+33111111111';
  data.rows[1].state.contactName = 'Second-company contact';
  data.rows[1].state.contactPhone = '+33222222222';
  await mount(data);
  await change(input('Contact person'), 'Edited first-company contact');
  await change(input('Decision-maker phone'), '+33333333333');
  await click('Log and continue');
  assert.equal(input('Contact person').props.value, 'Second-company contact');
  assert.equal(input('Decision-maker phone').props.value, '+33222222222');
  assert.equal(renderer.root.findAllByType('a').find(node => String(node.props.href).startsWith('tel:')).props.href, 'tel:+33222222222');
  await click('Log and continue');
  const calls = posts.filter(post => post.type === 'dial');
  assert.equal(calls[0].contactName, 'Edited first-company contact');
  assert.equal(calls[0].contactPhone, '+33333333333');
  assert.equal(calls[1].entryId, 2); assert.equal(calls[1].contactName, 'Second-company contact'); assert.equal(calls[1].contactPhone, '+33222222222');
});
test('contact drafts follow the recipient market language while controls retain the selected UI language', async () => {
  await mount(); globalThis.outboundTestLocale = 'nb';
  await act(async () => renderer.update(React.createElement(OutboundSalesDesk, {organizationId: 1, selectedListId: null, onShowLegacy() {}, onEnabledChange() {}})));
  assert.ok(button('Logg og gå videre')); assert.match(text(renderer.root), /Bonjour/);
  await click('Salgsverktøy');
  assert.match(text(renderer.root), /Bonjour/);
  const market = labelNode('Marked').findByType('select');
  await change(market, 'NO'); assert.match(text(renderer.root), /Hei/);
  await change(labelNode('Marked').findByType('select'), 'GB'); assert.match(text(renderer.root), /Hello/);
  assert.ok(button('Salgsverktøy'));
});
