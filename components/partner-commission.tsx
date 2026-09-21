"use client";
import {useState} from 'react';import {useI18n} from '@/lib/i18n/react';import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';import type {paymentCommissionReport} from '@/lib/partner-payments';
export type CommissionReport=ReturnType<typeof paymentCommissionReport>;
export function PartnerCommission({report,basisPoints}:{report:CommissionReport;basisPoints:number|null}){
 const {t,money,number,calendarDate}=useI18n(),[chosen,setChosen]=useState(report.previousMonth);
 const month=report.months.find(m=>m.month===chosen)??report.months[0];const rate=(bps:number)=>number(bps/10000,{style:'percent',maximumFractionDigits:2});
 return <section className="partner-commission"><header><div><h2>{t('commission.title')}</h2><p>{basisPoints==null?t('commission.unset'):t('commission.rate',{rate:rate(basisPoints)})}</p></div><Select value={month?.month??chosen} onValueChange={setChosen}><SelectTrigger aria-label={t('commission.month')}><SelectValue/></SelectTrigger><SelectContent>{report.months.map(m=><SelectItem key={m.month} value={m.month}>{calendarDate(m.month+'-01',{month:'long',year:'numeric'})}</SelectItem>)}</SelectContent></Select></header>
 {month&&<><div className="commission-total"><span>{t(month.closed?'commission.invoice':'commission.pending')}</span><strong>{money(month.commissionOre/100)}</strong></div><p className="form-hint">{t('commission.basis')}</p>
 {!month.entries.length?<p>{t('commission.empty')}</p>:<div className="commission-entries">{month.entries.map(p=><article key={p.id}><div><strong>{p.companyName}</strong><small>{calendarDate(p.paidOn,{day:'numeric',month:'short',year:'numeric'})} · {p.reference}</small></div><dl><div><dt>{t('commission.received')}</dt><dd>{money(p.amountOre/100)}</dd></div><div><dt>{t('commission.amount')} · {rate(p.basisPoints)}</dt><dd>{money(p.commissionOre/100)}</dd></div></dl></article>)}</div>}</>}
 </section>;
}
