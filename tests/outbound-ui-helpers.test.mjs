import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {writeFile, unlink} from 'node:fs/promises';
const output = new URL('./.outbound-ui-helpers.mjs', import.meta.url);
const compiled = await build({entryPoints: ['lib/outbound-workspace.ts'], bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false});
await writeFile(output, compiled.outputFiles[0].text);
const helpers = await import(output.href);
after(() => unlink(output));

const now = Date.parse('2026-10-10T12:00:00Z');
const lead = (id, nextCallAt = '', overrides = {}) => ({id, name: `Business ${id}`, country: 'FR', orgNumber: String(100000000 + id), city: 'Paris', industry: 'Software', assignedMembershipId: 7, suppressed: false, state: {pipeline: 'Prospekt', nextCallAt}, ...overrides});

test('due callbacks sort before new prospects; future callbacks wait until their actual due date', () => {
  const rows = [lead(1), lead(2, '2026-10-11T09:00:00Z'), lead(3, '2026-10-09T09:00:00Z'), lead(4, '2026-10-10T09:00:00Z')];
  assert.deepEqual(helpers.outboundQueue(rows, {now}).map(row => row.id), [3, 4, 1]);
  assert.deepEqual(helpers.outboundQueue(rows, {now: Date.parse('2026-10-12T09:00:00Z')}).map(row => row.id), [3, 4, 2, 1]);
  assert.deepEqual(helpers.outboundQueue(rows, {now, mode: 'due'}).map(row => row.id), [3, 4]);
  assert.deepEqual(helpers.outboundQueue(rows, {now, mode: 'all'}).map(row => row.id), [3, 4, 1, 2]);
});
test('the queue excludes suppressed, closed, ineligible, wrong-number and duplicate companies', () => {
  const rows = [lead(1), lead(2, '', {orgNumber: '10000000100025'}), lead(3, '', {suppressed: true}), lead(4, '', {eligible: false}), lead(5, '', {state: {pipeline: 'Kunde', nextCallAt: ''}}), lead(6, '', {state: {pipeline: 'Prospekt', nextCallAt: '', lastOutcome: 'Feil nummer'}})];
  assert.deepEqual(helpers.outboundQueue(rows, {now}).map(row => row.id), [1]);
  const otherCountry = lead(7, '', {country: 'GB', orgNumber: '100000001'});
  assert.equal(helpers.outboundQueue([...rows, otherCountry], {now}).length, 2);
});
test('salesperson and text filters apply before showing a call queue', () => {
  const rows = [lead(1), lead(2, '', {assignedMembershipId: 8}), lead(3, '', {city: 'Lyon'})];
  assert.deepEqual(helpers.outboundQueue(rows, {now, membershipId: 7, query: 'paris'}).map(row => row.id), [1]);
});
test('callback input respects organization timezone, including half-hour zones and daylight-saving transitions', () => {
  assert.equal(helpers.dateTimeToUtc('2026-10-12T09:00', 'Europe/Oslo'), '2026-10-12T07:00:00.000Z');
  assert.equal(helpers.dateTimeToUtc('2026-10-12T09:00', 'Asia/Kolkata'), '2026-10-12T03:30:00.000Z');
  assert.equal(helpers.dateTimeToUtc('2026-03-29T02:30', 'Europe/Oslo'), '');
  assert.equal(helpers.dateTimeToUtc('2026-10-25T02:30', 'Europe/Oslo'), '2026-10-25T00:30:00.000Z');
  assert.equal(helpers.dateTimeToUtc('2026-02-30T09:00', 'Europe/Oslo'), '');
  assert.equal(helpers.dateTimeInZone('2026-10-12T07:00:00.000Z', 'Europe/Oslo'), '2026-10-12T09:00');
});
test('money input keeps minor units exact for zero, two and three decimal currencies', () => {
  assert.equal(helpers.parseMinorAmount('499,95', 'NOK'), 49995);
  assert.equal(helpers.parseMinorAmount('1234', 'JPY'), 1234);
  assert.equal(helpers.parseMinorAmount('1234.50', 'JPY'), null);
  assert.equal(helpers.parseMinorAmount('12.345', 'BHD'), 12345);
  assert.equal(helpers.parseMinorAmount('12.3456', 'BHD'), null);
  assert.equal(helpers.parseMinorAmount('1e3', 'NOK'), null);
  assert.equal(helpers.parseMinorAmount('-4', 'NOK'), null);
  assert.equal(helpers.parseMinorAmount('', 'NOK'), null);
});
test('conversion rate uses meetings divided by conversations and handles a zero denominator', () => {
  assert.equal(helpers.meetingConversionRate(7, 34), 20.6);
  assert.equal(helpers.meetingConversionRate(0, 0), 0);
});
test('company links only allow HTTP websites and never script URLs or embedded credentials', () => {
  assert.equal(helpers.safeOutboundWebsite('example.fr'), 'https://example.fr/');
  assert.equal(helpers.safeOutboundWebsite('https://example.fr/contact'), 'https://example.fr/contact');
  assert.equal(helpers.safeOutboundWebsite('javascript:alert(1)'), '');
  assert.equal(helpers.safeOutboundWebsite('data:text/html,hello'), '');
  assert.equal(helpers.safeOutboundWebsite('https://secret@evil.invalid'), '');
});

test('contact windows reopen using the recipient country zone while permanent server rejections remain blocked', () => {
  const rules = {blockedCountries: [], blockedIndustries: [], blockedRegions: [], requireContactPermission: false, contactHours: {weekdays: [1, 2, 3, 4, 5], start: '09:00', end: '17:00'}};
  const recipient = lead(1, '', {country: 'NG', eligible: false, eligibility: {eligible: false, reason: 'outside_contact_hours'}});
  assert.equal(helpers.liveOutboundEligibility(recipient, rules, Date.parse('2026-10-12T07:59:00Z')).eligible, false);
  assert.equal(helpers.liveOutboundEligibility(recipient, rules, Date.parse('2026-10-12T08:00:00Z')).eligible, true);
  assert.equal(helpers.liveOutboundEligibility(recipient, rules, Date.parse('2026-10-12T16:00:00Z')).eligible, false);
  assert.equal(helpers.liveOutboundEligibility({...recipient, eligibility: {eligible: false, reason: 'permission_required'}}, rules, Date.parse('2026-10-12T08:00:00Z')).eligible, false);
  assert.equal(helpers.liveOutboundEligibility({...recipient, eligibility: {eligible: false, reason: 'country_blocked'}}, rules, Date.parse('2026-10-12T08:00:00Z')).eligible, false);
});
