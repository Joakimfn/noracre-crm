import type { CrmRequest } from './crm-api';
import catalog from './call-list-catalog.json';
import {organizationForms} from './call-list-options';
import {parseCallListFilters,expandLocations,matchesCallListCompany} from './call-list-filters';
import { norwegianToday } from './partner-payments';
// This module has no network client, credentials, browser storage or database imports.
// Every demo mount owns a separate in-memory store. Unknown operations fail closed.
type Row = Record<string, any>;
export function createDemoRuntime(now = new Date()) {
    const today = norwegianToday(now), stamp = now.toISOString();
    let serial = 10000;
    const at = (days: number, hour = 10) => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10) + 'T' + String(hour).padStart(2, '0') + ':00:00'; };
    const members: Row[] = ['Ingrid Berg', 'Martin Dahl', 'Sara Lund', 'Emil Strand', 'Nora Vik', 'Andreas Solheim'].map((name, i) => ({ id: i + 1, name, email: 'medarbeider' + (i + 1) + '@example.com', phone: '00 00 00 00', role: i === 0 ? 'Administrator' : 'Bruker', active: true, createdAt: at(-90) }));
    const names = ['Fjellheim Elektro AS', 'Kystlinje Regnskap AS', 'Solenga Bygg AS', 'Nordvik Transport AS', 'Eikeblad Interiør AS', 'Havbris Eiendom AS', 'Bergtun Renhold AS', 'Lunden Arkitekter AS', 'Solsiden Catering AS', 'Fjordglimt Bilservice AS', 'Nordstjerne IT AS', 'Strandvik Blomster AS', 'Varde Ventilasjon AS', 'Tind Mekaniske AS', 'Granli Trykkeri AS', 'Lysaker Design AS', 'Brekka Maskin AS', 'Knausen Hotell AS', 'Vesttun Hage AS', 'Åsheim Rørservice AS', 'Skoglia Møbler AS', 'Kystbyen Kontor AS', 'Fossheim Mat AS', 'Storvik Logistikk AS', 'Bjørk Media AS', 'Havnås Konsulent AS', 'Dalheim Verksted AS', 'Elvebredd Bakeri AS', 'Utsikten Prosjekt AS', 'Vikenga Sikkerhet AS', 'Nordenga Energi AS', 'Lien Service AS', 'Solstad Reiseliv AS', 'Fjellro Tekstil AS', 'Havtun Teknikk AS', 'Berglia Handel AS'];
    const cities = ['Tromsø', 'Bergen', 'Trondheim', 'Bodø', 'Kristiansand', 'Stavanger', 'Oslo', 'Ålesund'];
    const industries = ['Elektro og installasjon', 'Regnskap og rådgivning', 'Bygg og håndverk', 'Transport og logistikk', 'Interiør og handel', 'Eiendom', 'Renhold og service', 'Arkitektur', 'Catering', 'Bilservice', 'IT og teknologi', 'Blomsterhandel', 'Ventilasjon', 'Mekanisk industri', 'Trykkeri', 'Design', 'Maskiner', 'Hotell', 'Hage og landskap', 'Rørlegger', 'Møbelhandel', 'Kontorutstyr', 'Matproduksjon', 'Logistikk', 'Media', 'Rådgivning', 'Verksted', 'Bakeri', 'Prosjektledelse', 'Sikkerhet', 'Energi', 'Service', 'Reiseliv', 'Tekstil', 'Tekniske tjenester', 'Varehandel'];
    const cityCodes = ['5501','4601','5001','1804','4204','1103','0301','1508'];
    const industryCodes = ['43.210','69.201','41.200','49.410','47.599','68.209','81.210','71.111','56.210','45.200','62.010','47.761','43.220','25.620','18.120','74.102','46.610','55.101','81.300','43.220','47.591','46.650','10.890','52.290','73.110','70.220','45.200','10.710','71.129','80.100','35.119','81.100','79.110','13.920','71.129','46.900'];
    const stages = ['Ny kunde', 'Kontaktet', 'Møte avtalt', 'Tilbud sendt', 'Vunnet', 'Vunnet', 'Vunnet', 'Tapt'];
    let companies: Row[] = names.map((name, i) => ({ id: i + 1, organizationId: -1, name, customerType: 'Bedrift', orgNumber: '', contactName: ['Ida Nilsen', 'Thomas Hansen', 'Anne Larsen', 'Ole Johansen'][i % 4], phone: '00 00 ' + String(i + 1).padStart(2, '0') + ' 00', email: 'bedrift' + (i + 1) + '@example.com', stage: stages[i % 8], nextAction: i < 24 ? ['Avklar behov og neste steg', 'Følg opp tilbudet', 'Gjennomgå serviceavtalen', 'Planlegg oppstart'][i % 4] : '', nextActionDate: i < 24 ? at(i < 4 ? -2 : i < 10 ? 0 : 1 + (i % 12), 9 + i % 7) : '', nextContactId: null, note: ['Interessert i en langsiktig serviceavtale. Ønsker ett fast kontaktpunkt.', 'Planlegger utvidelse til høsten. Behov for levering og oppfølging på to lokasjoner.', 'Sammenligner løsninger. Legg vekt på responstid, kvalitet og enkel oppstart.', 'Eksisterende kunde. Følg opp tilfredshet og mulighet for utvidet samarbeid.'][i % 4], city: cities[i % 8], industry: industries[i], address: 'Eksempelveien ' + (i + 1), postalCode: '0000', employees: 3 + i % 28, revenue: 1200000 + i * 250000, source: 'Demodata', assignedTo: members[i % 6].name, lastContactAt: at(-(i % 12)), createdAt: at(-90 + i), updatedAt: stamp }));
    const prospects: Row[] = companies.map((c,i)=>({...c,municipalityCode:cityCodes[i%8],industryCode:industryCodes[i],organizationForm:i%5===0?'ENK':'AS',name:i%5===0?c.name.replace(/ AS$/,''):c.name,establishedAt:String(2010+i%15)+'-04-15',demoCompanyId:c.id}));
    let contacts: Row[] = companies.flatMap((c, i) => [0, 1].map(j => ({ id: i * 2 + j + 1, companyId: c.id, name: j ? ['Marius Olsen', 'Hanne Berg', 'Lars Vik', 'Sofie Dahl'][i % 4] : c.contactName, title: j ? 'Prosjektleder' : 'Daglig leder', phone: c.phone, email: 'kontakt' + (i * 2 + j + 1) + '@example.com', isPrimary: j === 0 })));
    let activities: Row[] = companies.flatMap((c, i) => [
        ...[0, 1, 2].map(j => ({ id: i * 4 + j + 1, companyId: c.id, contactId: i * 2 + 1, companyName: c.name, kind: ['Telefon', 'Møte', 'E-post'][j], note: ['Innledende samtale. Kartlagt behov, omfang og ønsket fremdrift.', 'Gjennomgang av leveransen med daglig leder. Avtalt å sende et konkret forslag.', 'Sendt oversikt over anbefalt løsning og priser. Kunden tar dette opp i neste ledermøte.'][j], dueAt: '', completedAt: at(j === 2 ? -(i % 7) : -21 + j * 6 - (i % 5)), createdAt: at(j === 2 ? -(i % 7) : -21 + j * 6 - (i % 5)), createdBy: members[i % 6].name, reminderMinutes: '[]' })),
        ...(c.nextActionDate ? [{ id: i * 4 + 4, companyId: c.id, contactId: i * 2 + 1, companyName: c.name, kind: i % 3 === 0 ? 'Møte' : 'Telefon', note: c.nextAction, dueAt: c.nextActionDate, completedAt: '', createdAt: at(-3), createdBy: members[i % 6].name, reminderMinutes: '[1440,15]' }] : [])
    ]);
    let calls: Row[] = companies.slice(0, 24).map((c, i) => ({ ...c, id: i + 1, status: i < 18 ? 'Ny' : i % 2 ? 'Ikke svar' : 'Møte booket', handledBy: i < 18 ? '' : members[i % 6].name, contactName: c.contactName, contactEmail: c.email, contactPhone: c.phone, website: '', meetingAt: i < 18 ? '' : at(i % 6 + 1), customerId: i < 18 ? null : c.id }));
    let posts: Row[] = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, organizationId: -1, content: ['God oppfølging starter med en god samtale. Denne uken besøker vi kunder for å planlegge høstens leveranser.', 'Møt teamet vårt! Vi hjelper lokale bedrifter med smidig drift og tett oppfølging.', 'Et vellykket prosjekt er levert. Takk til kunden for godt samarbeid fra planlegging til ferdig leveranse.', 'Tre tips til en enklere arbeidshverdag: planlegg neste steg, samle informasjon og følg opp det du lover.'][i % 4], platforms: JSON.stringify(i % 2 ? ['Instagram'] : ['Facebook']), scheduledAt: at(i < 5 ? i + 1 : -i), publishedAt: i >= 8 ? at(-i) : '', status: i >= 8 ? 'Publisert' : i < 5 ? 'Planlagt' : 'Kladd', createdAt: at(-14), updatedAt: stamp, createdBy: members[i % 6].name, images: [], deliveries: [], files: [], kind: 'post', canManage: true }));
    let templates: Row[] = [{ id: 1, name: 'Serviceavtale', subject: 'Tilbud til {{bedrift}}', body: 'Hei {{kontaktperson}},\n\nTakk for en hyggelig samtale. Her er vårt forslag til service og oppfølging.\nOmfang: [beskriv leveransen]\nPris: [avtalt beløp]\nOppstart: [dato]\n\nVennlig hilsen\nIngrid Berg' }, { id: 2, name: 'Prosjektleveranse', subject: 'Forslag til samarbeid – {{bedrift}}', body: 'Hei,\n\nVi tilbyr planlegging, gjennomføring og oppfølging av prosjektet.\n\nLeveranse: [avtalt omfang]\nFremdrift: [milepæler]\nPris: [beløp]\n\nVennlig hilsen\nFjord Service' }];
    let profile: Row = { displayName: members[0].name, contactEmail: members[0].email, theme: 'light', avatarKey: '', avatarX: 50, avatarY: 50, avatarZoom: 100, browserNotifications: false };
    const licenses: Record<string, number[]> = { ringelister: [1, 2, 3], markedsforing: [1, 3, 5] };
    const json = (data: unknown, status = 200) => Response.json(data, { status });
    const blocked = () => json({ error: 'Dette er et demomiljø. Sending, publisering, kontotilkobling og eksterne oppslag er deaktivert.' }, 403);
    const companyRows = () => companies.map(c => ({ ...c, searchContacts: contacts.filter(p => p.companyId === c.id) }));
    const refreshNext = (companyId: number) => { const c = companies.find(c => c.id === companyId); if (!c)
        return; const next = activities.filter(a => a.companyId === companyId && !a.completedAt && a.dueAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]; Object.assign(c, { nextAction: next?.note ?? '', nextActionDate: next?.dueAt ?? '', nextContactId: next?.contactId ?? null }); };
    const request: CrmRequest = async (input, init = {}) => {
        if (init.signal?.aborted)
            throw new DOMException('Aborted', 'AbortError');
        const url = new URL(input instanceof Request ? input.url : String(input), 'https://demo.invalid');
        const path = url.pathname, method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (url.origin !== 'https://demo.invalid')
            return blocked();
        let data: Row = {};
        try {
            if (typeof init.body === 'string')
                data = JSON.parse(init.body);
            else if (init.body instanceof FormData)
                data = Object.fromEntries(init.body.entries());
        }
        catch {
            return json({ error: 'Ugyldige demodata.' }, 400);
        }
        const id = Number(data.id ?? url.searchParams.get('id')), companyId = Number(data.companyId ?? url.searchParams.get('companyId'));
        if (path === '/api/session' && ['GET', 'POST'].includes(method))
            return json({ user: { id: 'demo', displayName: profile.displayName, email: profile.contactEmail }, currentOrganizationId: -1, role: 'Administrator', organizations: [{ id: -1, name: 'Fjord Service AS · demo', isPartner: false }], acceptedTermsAt: stamp, acceptedTermsVersion: '2026-09-09', completedOnboardingAt: stamp });
        if (path === '/api/profile' && ['GET', 'POST'].includes(method)) {
            if (method === 'POST') {
                if (data.avatar)
                    return blocked();
                profile = { ...profile, ...data, avatarKey: '', browserNotifications: false };
            }
            return json({ profile });
        }
        if (path === '/api/partners' && method === 'GET')
            return blocked();
        if (path === '/api/companies') {
            if (method === 'GET')
                return json({ companies: companyRows() });
            if (method === 'DELETE') {
                companies = companies.filter(c => c.id !== id);
                contacts = contacts.filter(c => c.companyId !== id);
                activities = activities.filter(a => a.companyId !== id);
                return json({ ok: true });
            }
            if (method === 'POST') {
                const company = { ...data, id: ++serial, organizationId: -1, createdAt: stamp, updatedAt: stamp };
                companies.unshift(company);
                return json({ company }, 201);
            }
            if (method === 'PATCH') {
                const company = companies.find(c => c.id === id);
                if (!company)
                    return json({ error: 'Fant ikke demokunden.' }, 404);
                Object.assign(company, data, { id, organizationId: -1, updatedAt: stamp });
                if (Object.hasOwn(data, 'nextActionDate')) {
                    let task = activities.find(a => a.companyId === id && !a.completedAt && a.dueAt);
                    if (data.nextActionDate) {
                        if (!task) {
                            task = { id: ++serial, companyId: id, companyName: company.name, kind: 'Telefon', completedAt: '', createdBy: profile.displayName, createdAt: stamp, reminderMinutes: '[15]' };
                            activities.unshift(task);
                        }
                        Object.assign(task, { dueAt: data.nextActionDate, note: data.nextAction, contactId: data.nextContactId ?? null });
                    }
                    else if (task)
                        activities = activities.filter(a => a.id !== task!.id);
                }
                return json({ company });
            }
        }
        if (path === '/api/contacts') {
            if (method === 'GET')
                return json({ contacts: contacts.filter(c => c.companyId === companyId) });
            if (method === 'DELETE') {
                contacts = contacts.filter(c => c.id !== id);
                return json({ ok: true });
            }
            if (method === 'POST') {
                const contact = { ...data, id: ++serial, isPrimary: false };
                contacts.push(contact);
                return json({ contact }, 201);
            }
            if (method === 'PATCH') {
                const contact = contacts.find(c => c.id === id);
                if (!contact)
                    return json({ error: 'Fant ikke kontakten.' }, 404);
                Object.assign(contact, data);
                return json({ contact });
            }
        }
        if (path === '/api/activities') {
            if (method === 'GET')
                return json({ activities: companyId ? activities.filter(a => a.companyId === companyId) : activities });
            if (method === 'DELETE') {
                const found = activities.find(a => a.id === id);
                activities = activities.filter(a => a.id !== id);
                if (found)
                    refreshNext(found.companyId);
                return json({ ok: true });
            }
            if (method === 'PATCH') {
                const activity = activities.find(a => a.id === id);
                if (!activity)
                    return json({ error: 'Fant ikke oppfølgingen.' }, 404);
                Object.assign(activity, data);
                refreshNext(activity.companyId);
                return json({ activity });
            }
            if (method === 'POST') {
                const company = companies.find(c => c.id === companyId);
                if (!company)
                    return json({ error: 'Velg demokunde.' }, 400);
                const activity: Row = { completedAt: data.isTask ? '' : stamp, dueAt: '', ...data, id: ++serial, companyName: company.name, createdBy: profile.displayName, createdAt: stamp, reminderMinutes: JSON.stringify(data.reminderMinutes ?? [15]) };
                activities.unshift(activity);
                let followup: Row | null = null;
                if (data.nextActionDate) {
                    followup = { ...activity, id: ++serial, kind: data.followupKind ?? activity.kind, note: data.nextAction, dueAt: data.nextActionDate, completedAt: '' };
                    activities.unshift(followup);
                }
                refreshNext(companyId);
                return json({ activity, followup }, 201);
            }
        }
        if (path === '/api/admin') {
            if (method === 'GET')
                return json({ role: 'Administrator', membershipId: 1, members, pricing: { crmPrice: 499, ringPrice: 49, marketingPrice: 49 }, memberModuleCosts: Object.fromEntries(members.map(m => [m.id, Object.values(licenses).filter(ids => ids.includes(m.id)).length * 49])), modules: Object.fromEntries(Object.entries(licenses).map(([k, ids]) => [k, { active: ids.length > 0, currentUserActive: ids.includes(1), pricePerUser: 49, licensedMemberIds: ids }])), audit: [], supportRequests: [], activeSupport: false });
            if (method !== 'POST')
                return blocked();
            if (data.type === 'member') {
                const member = { ...data, id: ++serial, active: true, phone: '', email: data.email, role: data.role === 'Administrator' ? 'Administrator' : 'Bruker' };
                members.push(member);
                return json({ member, monthlyPrice: 499, invitationSent: false }, 201);
            }
            if (data.type === 'memberStatus') {
                const member = members.find(m => m.id === id);
                if (!member)
                    return json({ error: 'Ukjent demobruker.' }, 404);
                Object.assign(member, { active: data.active, scheduledDisableAt: data.effectiveAt ?? '' });
                return json({ member });
            }
            if (data.type === 'moduleStatus' && Object.hasOwn(licenses, data.moduleKey)) {
                licenses[data.moduleKey] = data.membershipIds;
                return json({ ok: true, currentUserActive: licenses[data.moduleKey].includes(1) });
            }
            return blocked();
        }
        if (path === '/api/offers') {
            if (method === 'GET')
                return json({ templates });
            if (method === 'DELETE') {
                templates = templates.filter(t => t.id !== id);
                return json({ ok: true });
            }
            if (!['POST', 'PATCH'].includes(method))
                return blocked();
            const template = method === 'PATCH' ? templates.find(t => t.id === id) : { id: ++serial };
            if (!template)
                return json({ error: 'Ukjent mal.' }, 404);
            Object.assign(template, data);
            if (method === 'POST')
                templates.push(template);
            return json({ template }, method === 'POST' ? 201 : 200);
        }
        if (path === '/api/call-list-options' && method === 'GET')
            return json({...catalog, organizationForms});
        if (path === '/api/call-lists') {
            if (method === 'GET')
                return json({ entries: calls.filter(c => url.searchParams.get('view') === 'history' ? c.status !== 'Ny' : c.status === 'Ny') });
            if (method === 'POST' && data.type === 'generate') {
                const parsed = parseCallListFilters(data);
                if (!parsed.success) return json({error:parsed.error.issues[0]?.message ?? 'Ugyldige filtre.'},400);
                const filters=parsed.data;
                let locations:string[];
                try { locations=expandLocations(filters.locationCodes,catalog.municipalities); }
                catch { return json({error:'Velg et gyldig sted.'},400); }
                const selected=prospects.filter(c=>filters.organizationForms.includes(c.organizationForm)&&(!filters.requirePhone||!!c.phone)&&(!filters.requireEmail||!!c.email)&&matchesCallListCompany({antallAnsatte:c.employees,stiftelsesdato:c.establishedAt,naeringskode1:{kode:c.industryCode},forretningsadresse:{kommunenummer:c.municipalityCode}},filters,locations)).slice(0,filters.count);
                calls=[...calls.filter(c=>c.status!=='Ny'),...selected.map(c=>({...c,id:++serial,status:'Ny',handledBy:'',customerId:null,contactEmail:c.email,contactPhone:c.phone,website:'',meetingAt:'',createdAt:stamp,updatedAt:stamp}))];
                return json({entries:calls.filter(c=>c.status==='Ny'),added:selected.length});
            }
            if (method === 'POST' && data.type === 'import') {
                if(!Array.isArray(data.rows)||data.rows.length>1000)return json({error:'Ugyldig import.'},400);
                const entries=data.rows.filter((c:Row)=>typeof c.name==='string'&&c.name.trim()).map((c:Row)=>({name:c.name.trim(),orgNumber:String(c.orgNumber??''),industry:String(c.industry??''),city:String(c.city??''),employees:Number(c.employees)||null,phone:String(c.phone??''),email:String(c.email??''),website:String(c.website??''),id:++serial,status:'Ny',handledBy:'',customerId:null,createdAt:stamp,updatedAt:stamp}));
                calls.unshift(...entries);
                return json({entries,added:entries.length});
            }
            if (method === 'POST' && ['status','addCustomer'].includes(data.type)) {
                const entry = calls.find(c => c.id === id);
                if (!entry)
                    return json({ error: 'Ukjent bedrift.' }, 404);
                Object.assign(entry, data, { status:data.type==='addCustomer'?'Lagt til som kunde':data.status,handledBy: profile.displayName, updatedAt: stamp });
                let company = companies.find(c => c.id === (entry.demoCompanyId ?? entry.customerId ?? entry.id));
                if(!company&&['Lagt til som kunde','Møte booket','Tilbud sendt'].includes(entry.status)) {
                    company={...entry,id:++serial,organizationId:-1,customerType:'Bedrift',stage:entry.status==='Møte booket'?'Møte avtalt':entry.status==='Tilbud sendt'?'Tilbud sendt':'Ny kunde',assignedTo:profile.displayName,nextAction:'',nextActionDate:'',note:'',source:'Demodata'};
                    companies.push(company);
                }
                if(company)entry.customerId=company.id;
                if (data.status === 'Møte booket' && company) {
                    activities.unshift({ id: ++serial, companyId: company.id, companyName: company.name, kind: 'Møte', note: data.meetingNote || 'Avtalt møte', dueAt: data.meetingAt, completedAt: '', createdAt: stamp, createdBy: profile.displayName, reminderMinutes: JSON.stringify(data.reminderMinutes ?? [15]) });
                    refreshNext(company.id);
                }
                return json({ entry, company });
            }
            return blocked();
        }
        if (path === '/api/marketing' || path === '/api/content-plan') {
            if (method === 'DELETE') {
                posts = posts.filter(p => p.id !== id);
                return json({ ok: true });
            }
            if (method === 'POST' && path === '/api/marketing') {
                if (data.images)
                    return blocked();
                const post = { id: ++serial, content: data.content, platforms: data.platforms || '[]', scheduledAt: data.scheduledAt || '', status: data.scheduledAt ? 'Planlagt' : 'Kladd', createdAt: stamp, createdBy: profile.displayName, images: [], files: [], deliveries: [], kind: 'post', canManage: true };
                posts.unshift(post);
                return json({ post }, 201);
            }
            if (method !== 'GET')
                return blocked();
            const view = url.searchParams.get('view'), q = (url.searchParams.get('q') ?? '').toLowerCase();
            const all = posts.filter(p => (!view || (view === 'history' ? p.status === 'Publisert' : p.status !== 'Publisert')) && p.content.toLowerCase().includes(q));
            const pages = Math.max(1, Math.ceil(all.length / 5)), page = Math.min(pages, Math.max(1, Number(url.searchParams.get('page')) || 1));
            return json({ posts: view ? all.slice((page - 1) * 5, page * 5) : all, pagination: { page, pages, pageSize: 5, total: all.length }, counts: { upcoming: posts.filter(p => p.status !== 'Publisert').length, history: posts.filter(p => p.status === 'Publisert').length }, stats: { published: 4 }, connections: [] });
        }
        if (path === '/api/social/connections' && method === 'GET')
            return json({ ready: true, providers: { meta: false, linkedin: false }, connections: [{ id: 1, platform: 'Facebook', accountId: 'demo-facebook', accountName: 'Fjord Service · demo', expired: false }, { id: 2, platform: 'Instagram', accountId: 'demo-instagram', accountName: 'fjordservice_demo', expired: false }] });
        if (path === '/api/social/insights' && method === 'GET')
            return json({ entries: posts.filter(p => p.status === 'Publisert').map((p, i) => ({ id: p.id, platform: JSON.parse(p.platforms)[0], views: { value: 860 + i * 315, reason: null }, engagement: { value: 42 + i * 13, reason: null } })), nextCursor: null, until: stamp });
        if (path === '/api/email' && method === 'GET')
            return json({ configured: true, from: profile.contactEmail, replyTo: profile.contactEmail });
        if (path === '/api/email/account' && method === 'GET')
            return json({ account: { email: profile.contactEmail, provider: 'google' }, providers: { google: false, microsoft: false } });
        if (path === '/api/attachments' && method === 'GET' && !url.searchParams.has('id'))
            return json({ attachments: [] });
        if (path === '/api/prospects' && method === 'GET')
            return json({ prospects: [] });
        return blocked();
    };
    return { request };
}
