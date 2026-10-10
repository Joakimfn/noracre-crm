/** Display and input helpers for the outbound workspace, independent of device time zone. */
export type OutboundQueueLead = {
  id: number;
  name: string;
  country: string;
  orgNumber: string;
  city?: string;
  industry?: string;
  suppressed?: boolean;
  eligible?: boolean;
  assignedMembershipId: number;
  state: {pipeline: string; nextCallAt: string; lastOutcome?: string; doNotContact?: boolean} | null;
};

export {utcToLocalDateTime as dateTimeInZone} from './outbound-markets';
import {localDateTimeToUtc, eligibleForOutbound} from './outbound-markets';
export function dateTimeToUtc(value: string, timeZone: string): string {
  if (!value) return '';
  try {return localDateTimeToUtc(value, timeZone);} catch {return '';}
}

/** A recipient's contact window changes with the clock; permanent server rejections do not. */
export function liveOutboundEligibility(
  lead: Parameters<typeof eligibleForOutbound>[0] & {eligible?: boolean; eligibility?: {eligible: boolean; reason?: string}},
  rules: unknown, now: number,
): {eligible: boolean; reason: string} {
  const serverRejected = lead.eligible === false || lead.eligibility?.eligible === false;
  if (serverRejected && lead.eligibility?.reason !== 'outside_contact_hours') {
    return {eligible: false, reason: lead.eligibility?.reason ?? 'server_restricted'};
  }
  // Country/recipient time zone is also the backend's authority for contact hours.
  return eligibleForOutbound(lead, rules, now);
}

export function safeOutboundWebsite(value: string): string {
  if (!value.trim() || (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value))) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function outboundQueue<T extends OutboundQueueLead>(
  rows: T[], {now, query = '', membershipId = 0, mode = 'ready'}:
  {now: number; query?: string; membershipId?: number; mode?: 'ready' | 'due' | 'all'},
): T[] {
  const term = query.trim().toLocaleLowerCase();
  const identities = new Set<string>();
  return rows.filter(lead => {
    if (lead.suppressed || lead.eligible === false || lead.state?.doNotContact) return false;
    const stage = lead.state?.pipeline ?? 'Prospekt';
    if (['Kunde', 'Tapt'].includes(stage)) return false;
    if (lead.state?.lastOutcome === 'Feil nummer' && !lead.state.nextCallAt) return false;
    if (membershipId && lead.assignedMembershipId !== membershipId) return false;
    const scheduled = Date.parse(lead.state?.nextCallAt ?? '');
    const due = Number.isFinite(scheduled) && scheduled <= now;
    if (mode === 'due' && !due) return false;
    if (mode !== 'all' && Number.isFinite(scheduled) && !due) return false;
    if (mode !== 'all' && ['Demo booket', 'Demo gjennomført', 'Prøveperiode', 'Tilbud'].includes(stage) && !due) return false;
    if (term && ![lead.name, lead.orgNumber, lead.city, lead.industry].some(value => String(value ?? '').toLocaleLowerCase().includes(term))) return false;
    const canonical = lead.orgNumber.replace(/\s+/g, '').toUpperCase();
    const key = canonical ? `${lead.country.toUpperCase()}:${lead.country.toUpperCase() === 'FR' && /^\d{14}$/.test(canonical) ? canonical.slice(0, 9) : canonical}` : `entry:${lead.id}`;
    if (identities.has(key)) return false;
    identities.add(key);
    return true;
  }).sort((a, b) => {
    const left = Date.parse(a.state?.nextCallAt ?? '');
    const right = Date.parse(b.state?.nextCallAt ?? '');
    const priority = (value: number) => !Number.isFinite(value) ? 1 : value <= now ? 0 : 2;
    return priority(left) - priority(right) || (Number.isFinite(left) && Number.isFinite(right) ? left - right : 0) || b.id - a.id;
  });
}

export function meetingConversionRate(meetings: number, conversations: number): number {
  return conversations > 0 ? Math.round(meetings / conversations * 1000) / 10 : 0;
}

export function currencyScale(currency = 'NOK'): number {
  try { return 10 ** (new Intl.NumberFormat('en', {style: 'currency', currency}).resolvedOptions().maximumFractionDigits ?? 2); }
  catch { return 100; }
}

export function parseMinorAmount(value: string, currency = 'NOK'): number | null {
  const scale = currencyScale(currency);
  const digits = Math.round(Math.log10(scale));
  const expression = digits ? new RegExp('^\\d+(?:[.,]\\d{1,' + digits + '})?$') : /^\d+$/;
  if (!expression.test(value.trim())) return null;
  const [major, decimals = ''] = value.trim().replace(',', '.').split('.');
  const amount = Number(major) * scale + Number(decimals.padEnd(digits, '0'));
  return Number.isSafeInteger(amount) && amount >= 0 && amount <= 10000000000 ? amount : null;
}
