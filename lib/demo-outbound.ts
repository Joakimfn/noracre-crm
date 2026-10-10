import { meetingConversionRate } from './outbound-workspace';
import { normalizeOutboundRules, eligibleForOutbound } from './outbound-markets';
import { outboundCompanyKey } from './outbound-identity';
import { validateCommissionPolicy, validateReceivedAt } from './outbound-commission';

type Row = Record<string, any>;
type Source = Row[] | (() => Row[]);
const outcomes = ['Ikke svar', 'Sentralbord', 'Feil nummer', 'Beslutningstaker kontaktet', 'Interessert', 'Ikke interessert', 'Møte booket', 'Reservert mot kontakt'];
const stages = ['Prospekt', 'Demo booket', 'Demo gjennomført', 'Prøveperiode', 'Tilbud', 'Kunde', 'Tapt'];
const integer = (value: unknown, minimum: number, maximum: number) => typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
const isoDate = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) return '';
  const date = value.slice(0, 10), calendar = new Date(date + 'T12:00:00Z');
  return calendar.toISOString().slice(0, 10) === date ? new Date(value).toISOString() : '';
};

/** A private in-memory adapter with the production calling contract and no external effects. */
export function createDemoOutbound(callsSource: Source, membersSource: Source, now: Date, customersSource: Source = []) {
  const calls = () => typeof callsSource === 'function' ? callsSource() : callsSource;
  const members = () => typeof membersSource === 'function' ? membersSource() : membersSource;
  const customers = () => typeof customersSource === 'function' ? customersSource() : customersSource;
  const startedAt = Date.now(), clock = () => now.getTime() + Date.now() - startedAt;
  const timestamp = () => new Date(clock()).toISOString();
  const states = new Map<string, Row>(), events: Row[] = [], deals = new Map<string, Row>(), requests = new Map<string, string>();
  let config = {enabled: true, currency: 'NOK', timezone: 'Europe/Oslo', commissionBps: 0, commissionMonths: 12, pitch: '', country: 'NO', organizationName: 'Fjord Service AS · demo', playbooks: {} as Record<string, any>, marketRules: normalizeOutboundRules({})};
  const json = (value: unknown, status = 200) => Response.json(value, {status, headers: {'Cache-Control': 'private, no-store'}});
  const keyFor = (call: Row) => outboundCompanyKey({id: call.id, country: call.country || 'NO', orgNumber: call.orgNumber || ''});
  const stateFor = (call: Row) => {
    const key = keyFor(call);
    if (!states.has(key)) states.set(key, {entryId: call.id, assignedMembershipId: call.assignedMembershipId ?? 1, attempts: 0,
      pipeline: call.status === 'Møte booket' ? 'Demo booket' : ['Ikke aktuell', 'Lagt til som kunde'].includes(call.status) ? (call.status === 'Ikke aktuell' ? 'Tapt' : 'Kunde') : 'Prospekt',
      nextCallAt: ['Ikke svar', 'Ringte – ikke svar'].includes(call.status) ? new Date(now.getTime() + 48 * 3600000).toISOString() : '',
      lastOutcome: ['Ikke svar', 'Ringte – ikke svar'].includes(call.status) ? 'Ikke svar' : '', lastNote: '',
      doNotContact: false, contactPermission: false, leaseToken: '', leaseUntil: ''});
    return states.get(key)!;
  };
  const publicState = (state: Row): Row => ({...state, leaseToken: ''});
  const leadFor = (call: Row): Row => {
    const state = stateFor(call), entry = {...call, country: call.country || 'NO', orgNumber: call.orgNumber || '', employeeRange: call.employeeRange || '',
      state: publicState(state), assignedMembershipId: state.assignedMembershipId, suppressed: state.doNotContact, lockedUntil: state.leaseUntil};
    const eligibility = eligibleForOutbound(entry, config.marketRules, new Date(clock()), config.timezone);
    return {...entry, eligibility, eligible: eligibility.eligible, eligibilityReason: eligibility.reason};
  };
  const contactAllowed = (call: Row) => leadFor(call).eligibility.eligible;
  const own = (state: Row) => state.assignedMembershipId === 1;
  const error = (message: string, status = 400) => json({error: message}, status);
  return (url: URL, method: string, body: Row): Response => {
    try {
      const common = {settings: config, actorMembershipId: 1, canManage: true};
      if (method === 'GET') {
        if (!config.enabled) return json({...common, rows: [], metrics: null, deals: [], payments: [], members: [], hasMore: false});
        if (url.searchParams.has('entryId')) {
          const call = calls().find(entry => entry.id === Number(url.searchParams.get('entryId')));
          if (!call) return error('Fant ikke demobedriften.', 404);
          const offset = Number(url.searchParams.get('historyOffset') || 0);
          if (!integer(offset, 0, 100000)) return error('Ugyldig side.');
          const history = events.filter(event => event.companyKey === keyFor(call)).slice().reverse().map(({companyKey, ...event}) => event);
          return json({...common, history: history.slice(offset, offset + 150), historyHasMore: history.length > offset + 150, historyNextOffset: offset + Math.min(150, Math.max(0, history.length - offset))});
        }
        const offset = Number(url.searchParams.get('offset') || 0), mode = url.searchParams.get('queue') || 'all';
        if (!integer(offset, 0, 100000) || !['all', 'ready', 'due', 'fresh'].includes(mode)) return error('Ugyldig side eller ringekø.');
        const identities = new Set<string>();
        const rows = calls().filter(call => {const key = keyFor(call); if (identities.has(key)) return false; identities.add(key); return true;}).map(leadFor);
        const queue = rows.filter(lead => {
          if (mode === 'all') return true;
          if (lead.suppressed || ['Kunde', 'Tapt'].includes(lead.state.pipeline)) return false;
          const scheduled = Date.parse(lead.state.nextCallAt);
          if (mode === 'ready') return lead.eligibility.eligible &&
            (Number.isFinite(scheduled) && scheduled <= clock() || !lead.state.nextCallAt && lead.state.pipeline === 'Prospekt' && lead.state.lastOutcome !== 'Feil nummer');
          return mode === 'due' ? Number.isFinite(scheduled) && scheduled <= clock() : !lead.state.nextCallAt && lead.state.pipeline === 'Prospekt' && lead.state.lastOutcome !== 'Feil nummer';
        }).sort((a, b) => {
          const rank = (lead: Row) => lead.state.nextCallAt ? Date.parse(lead.state.nextCallAt) <= clock() ? 0 : 2 : 1;
          return rank(a) - rank(b) || a.state.nextCallAt.localeCompare(b.state.nextCallAt) || b.id - a.id;
        });
        const weekAgo = clock() - 7 * 86400000, callsLogged = events.filter(event => outcomes.includes(event.outcome) && Date.parse(event.createdAt) >= weekAgo);
        const conversations = callsLogged.filter(event => ['Beslutningstaker kontaktet', 'Interessert', 'Ikke interessert', 'Møte booket'].includes(event.outcome));
        const meetings = callsLogged.filter(event => event.outcome === 'Møte booket').length, dealRows = [...deals.values()];
        const attendedDemos = dealRows.filter(deal => deal.demoAttendedAt).length, trials = dealRows.filter(deal => deal.trialActivatedAt).length;
        return json({...common, rows: queue.slice(offset, offset + 150), lists: [{id: 1, name: 'Eksempelbedrifter', country: 'NO'}],
          hasMore: queue.length > offset + 150, nextOffset: offset + Math.min(150, Math.max(0, queue.length - offset)),
          members: members().filter(member => member.active !== false).map(member => ({...member, active: true, canCall: true})),
          metrics: {attempts: callsLogged.length, uniqueCalled: new Set(callsLogged.map(event => event.companyKey)).size, conversations: conversations.length, meetings,
            meetingRate: meetingConversionRate(meetings, conversations.length), conversationRate: callsLogged.length ? Math.round(conversations.length / callsLogged.length * 1000) / 10 : 0,
            attendedDemos, demosAttended: attendedDemos, trials, trialsActivated: trials, payingCustomers: 0, weekly: true,
            stages: Object.fromEntries(stages.map(stage => [stage, dealRows.filter(deal => deal.pipeline === stage).length]))},
          customers: customers().map(customer => ({id: customer.id, name: customer.name})), deals: dealRows, payments: [], paymentTotals: [], byMember: members().map(member => ({membershipId: member.id, name: member.name,
            attempts: callsLogged.filter(event => event.membershipId === member.id).length, conversations: conversations.filter(event => event.membershipId === member.id).length,
            meetings: callsLogged.filter(event => event.membershipId === member.id && event.outcome === 'Møte booket').length,
            won: dealRows.filter(deal => deal.membershipId === member.id && deal.pipeline === 'Kunde').length, commissionsByCurrency: {}}))});
      }
      if (method !== 'POST') return error('Handlingen støttes ikke i demoen.', 403);
      if (body.type === 'settings') {
        if (typeof body.enabled !== 'boolean' || typeof body.currency !== 'string' || !/^[A-Z]{3}$/.test(body.currency) || typeof body.timezone !== 'string' || typeof body.pitch !== 'string' || body.pitch.length > 8000) return error('Ugyldig innstilling.');
        const policy = validateCommissionPolicy(body.commissionBps, body.commissionMonths ?? config.commissionMonths);
        new Intl.DateTimeFormat('en', {timeZone: body.timezone}).format(now);
        new Intl.NumberFormat('en', {style: 'currency', currency: body.currency}).format(0);
        const books = body.playbooks ?? config.playbooks;
        if (!books || typeof books !== 'object' || Array.isArray(books) || Object.keys(books).length > 249 || JSON.stringify(books).length > 80000) return error('Ugyldig salgsbibliotek.');
        for (const [country, content] of Object.entries(books)) if (!/^[A-Z]{2}$/.test(country) || !content || typeof content !== 'object' || Array.isArray(content) || Object.values(content).some(value => typeof value !== 'string' || value.length > 8000)) return error('Ugyldig salgsbibliotek.');
        config = {...config, enabled: body.enabled, currency: body.currency, timezone: body.timezone, pitch: body.pitch, ...policy,
          playbooks: structuredClone(books), marketRules: normalizeOutboundRules(body.marketRules ?? body.contactRules ?? config.marketRules)};
        return json({settings: config});
      }
      if (body.type === 'payment' || body.type === 'refund') return error('Ekte betalingsregistrering er deaktivert i demoen.', 403);
      if (!config.enabled) return error('Outbound er ikke aktivert for demobedriften.', 403);
      if (body.type === 'assign') {
        const reps = Array.isArray(body.membershipIds) ? body.membershipIds : [body.membershipId];
        if (!reps.length || reps.length > 30 || reps.some(id => !integer(id, 1, Number.MAX_SAFE_INTEGER) || !members().some(member => member.id === id && member.active !== false))) return error('Velg aktive demoselgere.');
        let selected: Row[];
        if (Array.isArray(body.entryIds)) {
          if (!body.entryIds.length || body.entryIds.length > 50 || body.entryIds.some(id => !integer(id, 1, Number.MAX_SAFE_INTEGER) || !calls().some(call => call.id === id))) return error('Velg gyldige demobedrifter.');
          selected = body.entryIds.map(id => calls().find(call => call.id === id)!);
        } else {
          if (!integer(body.count ?? 50, 1, 150) || !['unassigned', 'all'].includes(body.mode ?? 'unassigned')) return error('Velg antall og en gyldig fordeling.');
          selected = calls().filter(call => (body.mode === 'all' || !stateFor(call).assignedMembershipId) && !stateFor(call).doNotContact);
        }
        const identities = new Set<string>();
        selected = selected.filter(call => {const key = keyFor(call); if (identities.has(key)) return false; identities.add(key); return true;}).slice(0, body.entryIds ? 50 : body.count ?? 50);
        selected.forEach((call, index) => Object.assign(stateFor(call), {assignedMembershipId: reps[index % reps.length], leaseToken: '', leaseUntil: ''}));
        return json({assigned: selected.length});
      }
      const call = calls().find(entry => entry.id === Number(body.entryId));
      if (!call) return error('Velg en gyldig demobedrift.', 404);
      const state = stateFor(call), companyKey = keyFor(call);
      if (body.type === 'permission') {
        if (typeof body.permission !== 'boolean' || body.permission && (typeof body.note !== 'string' || !body.note.trim())) return error('Dokumenter grunnlaget for at kontakt er tillatt.');
        if (state.doNotContact) return error('Kontaktreservasjon kan ikke fjernes ved å bekrefte kontaktgrunnlag.', 409);
        state.contactPermission = body.permission; state.lastNote = String(body.note || state.lastNote).slice(0, 500);
        events.push({id: events.length + 1, companyKey, entryId: call.id, membershipId: 1, name: members()[0]?.name || '', outcome: body.permission ? 'Kontaktgrunnlag bekreftet' : 'Kontaktgrunnlag fjernet', note: String(body.note || '').slice(0, 500), nextCallAt: '', createdAt: timestamp()});
        return json({ok: true, lead: publicState(state)});
      }
      if (body.type === 'callback') {
        if (state.doNotContact) return error('Reserverte bedrifter kan ikke følges opp.', 409);
        const nextCallAt = isoDate(body.nextCallAt); if (!nextCallAt) return error('Oppgi en gyldig dato for neste samtale.');
        state.nextCallAt = nextCallAt; return json({lead: publicState(state)});
      }
      if (body.type === 'acquire') {
        if (!own(state)) return error('Tildel demobedriften til deg før du ringer.', 403);
        if (!contactAllowed(call)) return error('Kontaktreglene tillater ikke oppringing.', 409);
        const proposed = typeof body.leaseToken === 'string' && /^[a-zA-Z0-9_-]{20,100}$/.test(body.leaseToken) ? body.leaseToken : crypto.randomUUID();
        if (state.leaseToken && Date.parse(state.leaseUntil) > clock() && state.leaseToken !== proposed) return error('Leadet er åpent i en annen fane.', 409);
        state.leaseToken = proposed; state.leaseUntil = new Date(clock() + 120000).toISOString();
        return json({leaseToken: state.leaseToken, expiresAt: state.leaseUntil, membershipId: 1});
      }
      if (body.type === 'release') {
        if (!own(state)) return error('Dette leadet tilhører en annen selger.', 403);
        if (!body.leaseToken) return error('Ringeøkten mangler referanse.');
        if (state.leaseToken === body.leaseToken) {state.leaseToken = ''; state.leaseUntil = '';}
        return json({ok: true});
      }
      if (body.type === 'dial') {
        if (!outcomes.includes(body.outcome) || typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_-]{20,100}$/.test(body.requestId) || typeof body.note !== 'string' || body.note.length > 1500) return error('Ugyldig samtaleresultat, notat eller referanse.');
        if (requests.has(body.requestId)) return requests.get(body.requestId) === companyKey ? json({lead: publicState(state), duplicate: true}) : error('Samtalereferansen tilhører en annen registrering.', 409);
        if (!own(state)) return error('Dette leadet tilhører en annen selger.', 403);
        if (!body.leaseToken || state.leaseToken !== body.leaseToken || Date.parse(state.leaseUntil) <= clock()) return error('Åpne bedriften i ringemodus før du registrerer samtalen.', 409);
        if (body.outcome !== 'Reservert mot kontakt' && !contactAllowed(call)) return error('Kontaktreglene tillater ikke oppringing.', 409);
        const closed = body.outcome === 'Reservert mot kontakt', stopped = closed || ['Feil nummer', 'Ikke interessert'].includes(body.outcome);
        let nextCallAt = body.nextCallAt ? isoDate(body.nextCallAt) : '';
        if (body.nextCallAt && !nextCallAt) return error('Ugyldig dato for neste samtale.');
        if (!nextCallAt && ['Ikke svar', 'Sentralbord', 'Interessert', 'Beslutningstaker kontaktet'].includes(body.outcome)) nextCallAt = new Date(clock() + 48 * 3600000).toISOString();
        if (stopped) nextCallAt = '';
        Object.assign(state, {attempts: state.attempts + 1, lastOutcome: body.outcome, lastNote: body.note, nextCallAt, contactName: body.contactName || state.contactName || '', contactPhone: body.contactPhone || state.contactPhone || '',
          doNotContact: closed || state.doNotContact, pipeline: body.outcome === 'Møte booket' ? 'Demo booket' : closed || body.outcome === 'Ikke interessert' ? 'Tapt' : state.pipeline, leaseToken: '', leaseUntil: ''});
        events.push({id: events.length + 1, companyKey, entryId: call.id, membershipId: 1, outcome: body.outcome, note: body.note, nextCallAt, createdAt: timestamp(), name: members().find(member => member.id === 1)?.name || ''});
        requests.set(body.requestId, companyKey);
        for (const copy of calls().filter(copy => keyFor(copy) === companyKey)) copy.status = closed || body.outcome === 'Ikke interessert' ? 'Ikke aktuell' : body.outcome === 'Møte booket' ? 'Møte booket' : body.outcome === 'Ikke svar' ? 'Ringte – ikke svar' : 'Kontaktet';
        const old = deals.get(companyKey);
        if (closed || body.outcome === 'Ikke interessert') {if (old) old.pipeline = 'Tapt';}
        if (body.outcome === 'Møte booket') deals.set(companyKey, {...old, id: old?.id ?? call.id, entryId: old?.entryId ?? call.id, membershipId: old?.membershipId ?? 1, pipeline: 'Demo booket', monthlyAmountMinor: old?.monthlyAmountMinor ?? 0,
          currency: old?.currency ?? config.currency, commissionBps: old?.commissionBps ?? config.commissionBps, commissionMonths: old?.commissionMonths ?? config.commissionMonths,
          subscriptionActivatedAt: old?.subscriptionActivatedAt ?? '', subscriptionCancelledAt: old?.subscriptionCancelledAt ?? '', commissionAgreedAt: old?.commissionAgreedAt ?? '', note: old?.note ?? ''});
        return json({lead: publicState(state)});
      }
      if (body.type === 'stage') {
        if (!stages.includes(body.pipeline) || !integer(body.monthlyAmountMinor ?? 0, 0, 10000000000)) return error('Ugyldig salgsfase eller kontraktsverdi.');
        if (state.doNotContact && body.pipeline !== 'Tapt') return error('Reserverte bedrifter kan ikke kontaktes.', 409);
        const old = deals.get(companyKey), policy = validateCommissionPolicy(body.commissionBps ?? old?.commissionBps ?? config.commissionBps, body.commissionMonths ?? old?.commissionMonths ?? config.commissionMonths);
        if (body.customerCompanyId != null && (!integer(body.customerCompanyId, 1, Number.MAX_SAFE_INTEGER) || !customers().some(customer => customer.id === body.customerCompanyId))) return error('Velg en gyldig demokunde.');
        const commissionAgreedAt = body.commissionAgreedAt ? validateReceivedAt(body.commissionAgreedAt, new Date(clock())) : body.agreementConfirmed ? timestamp() : old?.commissionAgreedAt ?? '';
        const activated = body.subscriptionActivatedAt === undefined ? old?.subscriptionActivatedAt ?? '' : body.subscriptionActivatedAt ? validateReceivedAt(body.subscriptionActivatedAt, new Date(clock())) : '';
        const cancelled = body.subscriptionCancelledAt === undefined ? old?.subscriptionCancelledAt ?? '' : body.subscriptionCancelledAt ? isoDate(body.subscriptionCancelledAt) : '';
        if (body.subscriptionCancelledAt && !cancelled || cancelled && (!activated || cancelled < activated)) return error('Ugyldig oppsigelsesdato.');
        state.pipeline = body.pipeline;
        deals.set(companyKey, {...old, id: old?.id ?? call.id, entryId: old?.entryId ?? call.id, membershipId: old?.membershipId ?? state.assignedMembershipId ?? 1, pipeline: body.pipeline,
          monthlyAmountMinor: body.monthlyAmountMinor ?? old?.monthlyAmountMinor ?? 0, currency: old?.currency ?? config.currency, ...policy,
          customerCompanyId: body.customerCompanyId ?? old?.customerCompanyId ?? null,
          subscriptionActivatedAt: activated, subscriptionCancelledAt: cancelled, commissionAgreedAt,
          demoAttendedAt: old?.demoAttendedAt || (body.pipeline === 'Demo gjennomført' ? timestamp() : ''), trialActivatedAt: old?.trialActivatedAt || (body.pipeline === 'Prøveperiode' ? timestamp() : ''), note: String(body.note ?? old?.note ?? '').slice(0, 1000)});
        if (['Kunde', 'Tapt'].includes(body.pipeline)) state.nextCallAt = '';
        for (const copy of calls().filter(copy => keyFor(copy) === companyKey)) copy.status = body.pipeline === 'Kunde' ? 'Lagt til som kunde' : body.pipeline === 'Tapt' ? 'Ikke aktuell' : 'Kontaktet';
        return json({ok: true});
      }
      return error('Handlingen støttes ikke i demoen.', 403);
    } catch (failure) {return error(failure instanceof Error ? failure.message : 'Ugyldige demodata.');}
  };
}
