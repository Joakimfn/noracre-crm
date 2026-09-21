import { partnerCommissionOverview, paymentCommission, norwegianToday } from './partner-payments';
export function examplePartnerReport(now = new Date()) {
    const today = norwegianToday(now), year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
    const previousMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7), assignedAt = previousMonth + '-01T10:00:00Z', basisPoints = 4000;
    const examples = [
        { id: 1, name: 'Nordlys Elektro AS', userCount: 6, active: true },
        { id: 2, name: 'Vestland Regnskap AS', userCount: 4, active: true },
        { id: 3, name: 'Fjord Bygg AS', userCount: 0, previousUsers: 3, active: false },
        { id: 4, name: 'Solsiden Renhold AS', userCount: 2, active: true },
        { id: 5, name: 'Havblikk Eiendom AS', userCount: 8, active: true },
        { id: 6, name: 'Lind Blomster AS', userCount: 1, active: true },
        { id: 7, name: 'Midtbyen Bilservice AS', userCount: 5, active: true },
        { id: 8, name: 'Berg Transport AS', userCount: 10, active: true },
        { id: 9, name: 'Kysten Arkitekter AS', userCount: 3, active: true },
        { id: 10, name: 'Fjell IT AS', userCount: 7, active: true },
        { id: 11, name: 'Eik Interiør AS', userCount: 9, active: true },
        { id: 12, name: 'Sørland Ventilasjon AS', userCount: 4, active: true },
        { id: 13, name: 'Nordmarka Catering AS', userCount: 2, active: true },
        { id: 14, name: 'Strand Foto AS', userCount: 0, previousUsers: 2, active: false }
    ];
    const payments = examples.flatMap(company => {
        const amountOre = (company.active ? company.userCount : company.previousUsers!) * 54800;
        const payment = { organizationId: company.id, companyName: company.name, amountOre, basisPoints, commissionOre: paymentCommission(amountOre, basisPoints), voidedAt: '' };
        return [{ ...payment, id: company.id * 2, reference: 'DEMO-' + company.id + '-FORRIGE', paidOn: previousMonth + '-15' }, ...(company.active ? [{ ...payment, id: company.id * 2 + 1, reference: 'DEMO-' + company.id + '-NA', paidOn: today.slice(0, 8) + String(Math.min(12, Number(today.slice(8, 10)))).padStart(2, '0') }] : [])];
    });
    const report = partnerCommissionOverview(examples.map(company => ({ ...company, assignedAt })), payments, now);
    return { ...report, commissionBps: basisPoints, rows: report.rows.map(row => ({ ...row, userCount: examples.find(company => company.id === row.id)!.userCount })) };
}
