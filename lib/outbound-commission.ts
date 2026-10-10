/** Commission is earned from received subscription cash, never a pipeline value. */
export type OutboundCommissionAgreement = {
  customerCompanyId?: number | null;
  customerOrganizationId?: number | null;
  subscriptionActivatedAt: string;
  subscriptionCancelledAt: string;
  commissionAgreedAt: string;
  commissionBps: number;
  commissionMonths: number;
};

export type OutboundCommissionEligibility = {
  eligible: boolean;
  reason: 'eligible' | 'unlinked_customer' | 'subscription_not_activated' | 'agreement_not_confirmed' |
    'received_before_activation' | 'subscription_cancelled' | 'commission_period_ended';
  expiresAt: string;
};

const MAX_AMOUNT_MINOR = 10_000_000_000;
const integer = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;

export function validateCommissionPolicy(commissionBps: unknown, commissionMonths: unknown) {
  if (!integer(commissionBps, 0, 10_000) || !integer(commissionMonths, 1, 120))
    throw new Error('Avtal provisjon fra 0 til 100 prosent og en varighet fra 1 til 120 måneder.');
  return { commissionBps, commissionMonths };
}

function strictTimestamp(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new Error('Oppgi et gyldig tidspunkt med tidssone.');
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  calendar.setUTCHours(0, 0, 0, 0);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day ||
      Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59)
    throw new Error('Oppgi et gyldig tidspunkt med tidssone.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Oppgi et gyldig tidspunkt med tidssone.');
  return date.toISOString();
}

export function validateReceivedAt(value: unknown, now = new Date()): string {
  const receivedAt = strictTimestamp(value);
  if (Date.parse(receivedAt) > now.getTime()) throw new Error('Mottatt betaling kan ikke dateres i fremtiden.');
  return receivedAt;
}

/** Use the same key for display variants of a bank/invoice reference. */
export function paymentReferenceKey(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Oppgi en betalingsreferanse på 3–100 tegn.');
  const reference = value.normalize('NFKC').trim();
  if (reference.length < 3 || reference.length > 100 || /[\u0000-\u001f\u007f]/.test(reference))
    throw new Error('Oppgi en betalingsreferanse på 3–100 tegn.');
  return reference.toLowerCase();
}

type WallTime = { year: number; month: number; day: number; hour: number; minute: number; second: number; millisecond: number };

function wallTime(date: Date, timezone: string): WallTime {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, Number(part.value)]));
  return { year: values.year, month: values.month, day: values.day, hour: values.hour,
    minute: values.minute, second: values.second, millisecond: date.getUTCMilliseconds() };
}

function wallMilliseconds(parts: WallTime) {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, parts.millisecond);
  return date.getTime();
}

/** Calendar months follow the organisation's timezone, with month-end clamping. */
export function commissionExpiresAt(activatedAt: string, months: number, timezone: string): string {
  validateCommissionPolicy(0, months);
  const activated = new Date(strictTimestamp(activatedAt));
  const local = wallTime(activated, timezone);
  const monthIndex = local.year * 12 + local.month - 1 + months;
  const year = Math.floor(monthIndex / 12), month = monthIndex % 12 + 1;
  const endOfMonth = new Date(0);
  endOfMonth.setUTCFullYear(year, month, 0);
  const target = { ...local, year, month, day: Math.min(local.day, endOfMonth.getUTCDate()) };
  const wanted = wallMilliseconds(target);
  let guess = wanted;
  const candidates = new Set<number>();
  for (let i = 0; i < 6; i++) {
    candidates.add(guess);
    const shown = wallMilliseconds(wallTime(new Date(guess), timezone));
    if (shown === wanted) return new Date(guess).toISOString();
    guess += wanted - shown;
  }
  // A DST spring gap has no matching wall clock time. Move forward by that gap.
  const after = [...candidates].filter(candidate => wallMilliseconds(wallTime(new Date(candidate), timezone)) >= wanted)
    .sort((a, b) => a - b);
  if (!after.length) throw new Error('Provisjonsperioden kunne ikke beregnes i valgt tidssone.');
  return new Date(after[0]).toISOString();
}

export function commissionEligibility(deal: OutboundCommissionAgreement, receivedAt: string, timezone: string): OutboundCommissionEligibility {
  validateCommissionPolicy(deal.commissionBps, deal.commissionMonths);
  const received = Date.parse(strictTimestamp(receivedAt));
  const result = (reason: OutboundCommissionEligibility['reason'], expiresAt = '') => ({ eligible: reason === 'eligible', reason, expiresAt });
  if (!integer(deal.customerCompanyId, 1, Number.MAX_SAFE_INTEGER) && !integer(deal.customerOrganizationId, 1, Number.MAX_SAFE_INTEGER))
    return result('unlinked_customer');
  if (!deal.subscriptionActivatedAt) return result('subscription_not_activated');
  if (!deal.commissionAgreedAt) return result('agreement_not_confirmed');
  strictTimestamp(deal.commissionAgreedAt);
  const activated = Date.parse(strictTimestamp(deal.subscriptionActivatedAt));
  const expiresAt = commissionExpiresAt(deal.subscriptionActivatedAt, deal.commissionMonths, timezone);
  if (received < activated) return result('received_before_activation', expiresAt);
  if (deal.subscriptionCancelledAt && received >= Date.parse(strictTimestamp(deal.subscriptionCancelledAt)))
    return result('subscription_cancelled', expiresAt);
  if (received >= Date.parse(expiresAt)) return result('commission_period_ended', expiresAt);
  return result('eligible', expiresAt);
}

function roundedRatio(numerator: bigint, denominator: bigint): number {
  return Number((numerator * BigInt(2) + denominator) / (denominator * BigInt(2)));
}

export function receivedCommission(deal: OutboundCommissionAgreement, amountMinor: number, receivedAt: string, timezone: string) {
  if (!integer(amountMinor, 1, MAX_AMOUNT_MINOR)) throw new Error('Oppgi et gyldig mottatt beløp eks. mva.');
  const eligibility = commissionEligibility(deal, receivedAt, timezone);
  return { ...eligibility, commissionAmountMinor: eligibility.eligible ? roundedRatio(BigInt(amountMinor) * BigInt(deal.commissionBps), BigInt(10_000)) : 0 };
}

type CommissionCash = { paidAmountMinor: number; commissionAmountMinor: number };

/** Reverse the original earned amount proportionally, so partial refunds reconcile exactly. */
export function refundCommission(original: CommissionCash & { refundPaymentId?: number | null }, existingRefunds: CommissionCash[], refundAmountMinor: number) {
  if (original.refundPaymentId != null || !integer(original.paidAmountMinor, 1, MAX_AMOUNT_MINOR) ||
      !integer(original.commissionAmountMinor, 0, original.paidAmountMinor) || !integer(refundAmountMinor, 1, MAX_AMOUNT_MINOR))
    throw new Error('Velg en opprinnelig innbetaling og et gyldig refusjonsbeløp.');
  let refundedAmount = 0, reversedCommission = 0;
  for (const refund of existingRefunds) {
    if (!integer(-refund.paidAmountMinor, 1, original.paidAmountMinor) ||
        !integer(-refund.commissionAmountMinor, 0, original.commissionAmountMinor))
      throw new Error('Refusjonsgrunnlaget er ugyldig.');
    refundedAmount -= refund.paidAmountMinor;
    reversedCommission -= refund.commissionAmountMinor;
  }
  if (refundedAmount + refundAmountMinor > original.paidAmountMinor) throw new Error('Refusjonene kan ikke overstige den mottatte betalingen.');
  const cumulativeCommission = roundedRatio(BigInt(refundedAmount + refundAmountMinor) * BigInt(original.commissionAmountMinor), BigInt(original.paidAmountMinor));
  if (reversedCommission > cumulativeCommission) throw new Error('Refusjonsgrunnlaget er ugyldig.');
  return { paidAmountMinor: -refundAmountMinor, commissionAmountMinor: -(cumulativeCommission - reversedCommission) || 0 };
}
