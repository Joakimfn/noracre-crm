import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const dir = await mkdtemp(path.join(tmpdir(), 'outbound-commission-'));
after(() => rm(dir, {recursive: true, force: true}));
await build({entryPoints: ['lib/outbound-commission.ts'], bundle: true, platform: 'node', format: 'esm', outfile: path.join(dir, 'module.mjs')});
const {validateCommissionPolicy, validateReceivedAt, paymentReferenceKey, commissionExpiresAt,
  commissionEligibility, receivedCommission, refundCommission} = await import(pathToFileURL(path.join(dir, 'module.mjs')));

const agreement = {
  customerCompanyId: 9, customerOrganizationId: null,
  subscriptionActivatedAt: '2026-01-15T09:00:00.000Z', subscriptionCancelledAt: '',
  commissionAgreedAt: '2026-01-10T09:00:00.000Z', commissionBps: 5000, commissionMonths: 12,
};

test('commission policy is explicit, bounded and does not invent a rate', () => {
  assert.deepEqual(validateCommissionPolicy(0, 12), {commissionBps: 0, commissionMonths: 12});
  assert.deepEqual(validateCommissionPolicy(10_000, 120), {commissionBps: 10_000, commissionMonths: 120});
  for (const values of [[undefined, 12], [null, 12], ['5000', 12], [-1, 12], [10_001, 12], [5000.5, 12], [5000, 0], [5000, 121], [5000, 1.5]])
    assert.throws(() => validateCommissionPolicy(...values));
});

test('receipt dates are actual past instants, with strict calendar and timezone validation', () => {
  const now = new Date('2026-10-10T17:00:00Z');
  assert.equal(validateReceivedAt('2026-10-10T18:00:00+02:00', now), '2026-10-10T16:00:00.000Z');
  for (const input of ['', null, '2026-10-10', '2026-02-30T10:00:00Z', '2026-10-10T24:00:00Z', '2026-10-10T18:00:00Z', '2026-10-10T10:00:00'])
    assert.throws(() => validateReceivedAt(input, now));
  assert.equal(paymentReferenceKey('  BANK-123  '), paymentReferenceKey('bank-123'));
  assert.equal(paymentReferenceKey('ＢＡＮＫ-１２３'), 'bank-123');
  for (const input of [undefined, '', '12', 'bank\n123', 'x'.repeat(101)]) assert.throws(() => paymentReferenceKey(input));
});

test('acquired customer, activated subscription and an agreed commission are prerequisites', () => {
  const receivedAt = '2026-02-15T09:00:00Z';
  assert.equal(commissionEligibility({...agreement, customerCompanyId: null}, receivedAt, 'Europe/Oslo').reason, 'unlinked_customer');
  assert.equal(commissionEligibility({...agreement, customerCompanyId: null, customerOrganizationId: 5}, receivedAt, 'Europe/Oslo').eligible, true);
  assert.equal(commissionEligibility({...agreement, subscriptionActivatedAt: ''}, receivedAt, 'Europe/Oslo').reason, 'subscription_not_activated');
  assert.equal(commissionEligibility({...agreement, commissionAgreedAt: ''}, receivedAt, 'Europe/Oslo').reason, 'agreement_not_confirmed');
  assert.equal(receivedCommission({...agreement, commissionBps: 0}, 49_900, receivedAt, 'Europe/Oslo').commissionAmountMinor, 0);
});

test('earned commission comes from actual net subscription receipts and uses the frozen deal rate', () => {
  const receivedAt = '2026-02-15T09:00:00Z';
  assert.equal(receivedCommission(agreement, 49_901, receivedAt, 'Europe/Oslo').commissionAmountMinor, 24_951);
  assert.equal(receivedCommission({...agreement, commissionBps: 2500}, 49_901, receivedAt, 'Europe/Oslo').commissionAmountMinor, 12_475);
  assert.equal(receivedCommission(agreement, 10_000_000_000, receivedAt, 'Europe/Oslo').commissionAmountMinor, 5_000_000_000);
  for (const input of [0, -1, 1.5, 10_000_000_001, '100', NaN]) assert.throws(() => receivedCommission(agreement, input, receivedAt, 'Europe/Oslo'));
});

test('only cash received during activation and the agreed duration earns commission', () => {
  assert.equal(commissionEligibility(agreement, '2026-01-15T08:59:59Z', 'Europe/Oslo').reason, 'received_before_activation');
  assert.equal(commissionEligibility(agreement, agreement.subscriptionActivatedAt, 'Europe/Oslo').eligible, true);
  assert.equal(commissionEligibility(agreement, '2027-01-15T08:59:59Z', 'Europe/Oslo').eligible, true);
  const ended = receivedCommission(agreement, 49_900, '2027-01-15T09:00:00Z', 'Europe/Oslo');
  assert.equal(ended.reason, 'commission_period_ended');
  assert.equal(ended.commissionAmountMinor, 0);
  const cancelled = {...agreement, subscriptionCancelledAt: '2026-03-12T10:00:00Z'};
  assert.equal(commissionEligibility(cancelled, '2026-03-12T09:59:59Z', 'Europe/Oslo').eligible, true);
  assert.equal(receivedCommission(cancelled, 49_900, cancelled.subscriptionCancelledAt, 'Europe/Oslo').commissionAmountMinor, 0);
});

test('calendar duration preserves local time through DST and clamps month ends and leap days', () => {
  assert.equal(commissionExpiresAt('2026-01-31T09:00:00Z', 1, 'Europe/Oslo'), '2026-02-28T09:00:00.000Z');
  assert.equal(commissionExpiresAt('2024-02-29T09:00:00Z', 12, 'Europe/Oslo'), '2025-02-28T09:00:00.000Z');
  assert.equal(commissionExpiresAt('2026-01-15T09:00:00Z', 3, 'Europe/Oslo'), '2026-04-15T08:00:00.000Z');
  assert.equal(commissionExpiresAt('2026-03-15T05:00:00Z', 1, 'America/New_York'), '2026-04-15T05:00:00.000Z');
  assert.equal(commissionExpiresAt('2020-02-29T01:30:00Z', 1, 'Europe/Oslo'), '2020-03-29T01:30:00.000Z');
  assert.equal(commissionExpiresAt('2026-03-01T04:00:00Z', 1, 'America/New_York'), '2026-03-29T03:00:00.000Z');
  assert.throws(() => commissionExpiresAt('2026-02-29T09:00:00Z', 12, 'UTC'));
});

test('partial refunds reverse the original commission without rounding drift or stealing seller attribution', () => {
  const original = {paidAmountMinor: 3, commissionAmountMinor: 1, refundPaymentId: null};
  const refunds = [];
  for (let i = 0; i < 3; i++) refunds.push(refundCommission(original, refunds, 1));
  assert.equal(refunds.reduce((sum, refund) => sum + refund.paidAmountMinor, 0), -3);
  assert.equal(refunds.reduce((sum, refund) => sum + refund.commissionAmountMinor, 0), -1);
  assert.deepEqual(refunds.map(refund => refund.commissionAmountMinor), [0, -1, 0]);
  assert.throws(() => refundCommission(original, refunds, 1), /overstige/);
  assert.throws(() => refundCommission({...original, refundPaymentId: 5}, [], 1));
  assert.deepEqual(refundCommission({paidAmountMinor: 10_000_000_000, commissionAmountMinor: 3_333_333_333}, [], 10_000_000_000),
    {paidAmountMinor: -10_000_000_000, commissionAmountMinor: -3_333_333_333});
  assert.deepEqual(refundCommission({paidAmountMinor: 100, commissionAmountMinor: 0}, [], 100), {paidAmountMinor: -100, commissionAmountMinor: 0});
});

test('payment ledger preserves frozen commission and rejects duplicate references across display variants', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE organizations(id INTEGER PRIMARY KEY, name TEXT); CREATE TABLE call_list_entries(id INTEGER PRIMARY KEY);');
  db.exec(await readFile('drizzle/0030_outbound_workspace.sql', 'utf8'));
  db.exec(await readFile('drizzle/0031_outbound_safety_and_commission.sql', 'utf8'));
  const insert = db.prepare('INSERT INTO outbound_deal_payments(organization_id,entry_id,membership_id,payment_reference,payment_reference_key,paid_amount_minor,currency,commission_bps,commission_amount_minor,received_at,created_at,created_by_membership_id,refund_payment_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const payment = receivedCommission(agreement, 49_901, '2026-02-15T09:00:00Z', 'Europe/Oslo');
  insert.run(1, 7, 12, 'BANK-123', paymentReferenceKey('BANK-123'), 49_901, 'NOK', 5000, payment.commissionAmountMinor, '2026-02-15T09:00:00Z', '2026-10-10T17:00:00Z', 8, null);
  assert.throws(() => insert.run(1, 7, 13, ' bank-123 ', paymentReferenceKey(' bank-123 '), 49_901, 'NOK', 1000, 4990, '2026-02-15T09:00:00Z', '2026-10-10T17:00:00Z', 8, null), /UNIQUE/);
  const refund = refundCommission({paidAmountMinor: 49_901, commissionAmountMinor: payment.commissionAmountMinor}, [], 49_901);
  insert.run(1, 7, 12, 'REFUND-123', paymentReferenceKey('REFUND-123'), refund.paidAmountMinor, 'NOK', 5000, refund.commissionAmountMinor, '2026-09-01T09:00:00Z', '2026-10-10T17:00:00Z', 8, 1);
  const total = db.prepare('SELECT membership_id, SUM(paid_amount_minor) AS received, SUM(commission_amount_minor) AS earned FROM outbound_deal_payments GROUP BY membership_id').get();
  assert.equal(total.membership_id, 12);
  assert.equal(total.received, 0);
  assert.equal(total.earned, 0);
  db.close();
});

async function ledger() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE organizations(id INTEGER PRIMARY KEY, name TEXT); CREATE TABLE call_list_entries(id INTEGER PRIMARY KEY);');
  db.exec(await readFile('drizzle/0030_outbound_workspace.sql', 'utf8'));
  db.exec(await readFile('drizzle/0031_outbound_safety_and_commission.sql', 'utf8'));
  const stmt = db.prepare('INSERT INTO outbound_deal_payments(organization_id,entry_id,membership_id,payment_reference,payment_reference_key,paid_amount_minor,currency,commission_bps,commission_amount_minor,received_at,created_at,refund_payment_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  const insert = (reference, amount, commission, refundPaymentId = null, overrides = {}) => {
    const values = {org: 1, entry: 7, seller: 12, currency: 'NOK', bps: 3333, received: '2026-09-01T09:00:00.000Z', ...overrides};
    return stmt.run(values.org, values.entry, values.seller, reference, paymentReferenceKey(reference), amount,
      values.currency, values.bps, commission, values.received, '2026-10-10T17:00:00.000Z', refundPaymentId);
  };
  return {db, insert};
}

test('database serializes stale refund attempts and requires their earned amount to reconcile', async () => {
  const {db, insert} = await ledger();
  insert('ORIGINAL', 3, 1);
  // Two sessions both read an empty refund history and propose the same rounded result.
  const original = {paidAmountMinor: 3, commissionAmountMinor: 1};
  const stale = refundCommission(original, [], 1);
  insert('REFUND-A', stale.paidAmountMinor, stale.commissionAmountMinor, 1);
  assert.throws(() => insert('REFUND-B', stale.paidAmountMinor, stale.commissionAmountMinor, 1), /reload before retrying/);
  const refreshed = refundCommission(original, [stale], 1);
  insert('REFUND-B', refreshed.paidAmountMinor, refreshed.commissionAmountMinor, 1);
  const last = refundCommission(original, [stale, refreshed], 1);
  insert('REFUND-C', last.paidAmountMinor, last.commissionAmountMinor, 1);
  assert.throws(() => insert('REFUND-D', -1, 0, 1), /remaining balance/);
  assert.deepEqual({...db.prepare('SELECT SUM(paid_amount_minor) AS received, SUM(commission_amount_minor) AS earned FROM outbound_deal_payments').get()}, {received: 0, earned: 0});
  db.close();
});

test('database refuses refunds against another tenant, seller, currency, prior date or refund row', async () => {
  const {db, insert} = await ledger();
  insert('ORIGINAL', 10_000, 3333);
  for (const change of [{org: 2}, {entry: 8}, {seller: 13}, {currency: 'EUR'}, {bps: 5000}, {received: '2026-08-31T09:00:00.000Z'}])
    assert.throws(() => insert('REFUND-X', -100, -33, 1, change), /original payment attribution/);
  assert.throws(() => insert('REFUND-X', -100, -33, 999), /original payment attribution/);
  insert('REFUND-VALID', -100, -33, 1);
  assert.throws(() => insert('REFUND-X', -100, -33, 2), /original payment attribution/);
  assert.throws(() => insert('NEGATIVE-CASH', -100, -33), /requires an original refund/);
  assert.throws(() => insert('EXPECTED-ONLY', 0, 0), /invalid received/);
  assert.throws(() => insert('TOO-MUCH-COMMISSION', 100, 101), /invalid received/);
  db.close();
});

test('database refund ratios remain exact for amounts exceeding safe floating-point multiplication', async () => {
  const {db, insert} = await ledger();
  const original = {paidAmountMinor: 10_000_000_000, commissionAmountMinor: 3_333_333_333};
  insert('ORIGINAL', original.paidAmountMinor, original.commissionAmountMinor);
  const refunds = [];
  for (const amount of [1, 999_999_999, 3_333_333_333, 5_666_666_667]) {
    const refund = refundCommission(original, refunds, amount);
    insert(`REFUND-${refunds.length}`, refund.paidAmountMinor, refund.commissionAmountMinor, 1);
    refunds.push(refund);
  }
  assert.deepEqual({...db.prepare('SELECT SUM(paid_amount_minor) AS received, SUM(commission_amount_minor) AS earned FROM outbound_deal_payments').get()}, {received: 0, earned: 0});
  db.close();
});
