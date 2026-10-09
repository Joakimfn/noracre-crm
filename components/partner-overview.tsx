"use client";
import {useUiTranslation} from '@/lib/i18n/ui';

import {useCrmApi} from "@/lib/crm-api";
import {PartnerCustomerCreate} from "./partner-customer-create";
import {PartnerCommission,type CommissionReport} from "./partner-commission";
import {useEffect,useState} from 'react';
import {useI18n} from '@/lib/i18n/react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
type Row={userCount?:number;id:number;name:string;active:boolean;assignedAt:string;currentOre:number;previousOre:number;ytdOre:number;historical:boolean};
export type PartnerReport={commissionBps:number|null;commission:CommissionReport;rows:Row[];year:number;previousMonth:string;throughDate:string};
export function PartnerOverview({organizationId}:{organizationId:number}){
 const {ui}=useUiTranslation();
 const apiFetch=useCrmApi();

 const {t}=useI18n();
 const [report,setReport]=useState<PartnerReport|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{let cancelled=false;setReport(null);setError(ui(''));apiFetch('/api/partners',{headers:{'x-organization-id':String(organizationId)}}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||t('partner.error'));if(!cancelled)setReport(data);}).catch(e=>{if(!cancelled)setError(ui(e.message));});return()=>{cancelled=true;};},[organizationId,reload,t]);
 if(error)return <div className="page-pad"><p role="alert">{error}</p><Button onClick={()=>setReload(n=>n+1)}>{t('partner.retry')}</Button></div>;
 if(!report)return <div className="page-pad" role="status">{t('partner.loading')}</div>;
 return <><div className="page-pad"><PartnerCustomerCreate organizationId={organizationId} onCreated={()=>setReload(n=>n+1)}/></div><PartnerReportView report={report}/></>;
}
export function PartnerReportView({report}:{report:PartnerReport}){
 const {t,money,date,calendarDate,number}=useI18n();
 const [query,setQuery]=useState('');
 const amount=(ore:number)=>money(ore/100);
 const rows=report.rows.filter(r=>r.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const sum=(key:'currentOre'|'previousOre'|'ytdOre')=>report.rows.reduce((sum,r)=>sum+r[key],0);
 const stats=[[t('partner.customers'),number(report.rows.length)],[t('partner.monthly'),amount(sum('currentOre'))],[t('partner.previous'),amount(sum('previousOre'))],[t('partner.ytd'),amount(sum('ytdOre'))]];
 return <div className="page-pad partner-overview">
 <p>{t('partner.intro')}</p>
 {report.commission&&<PartnerCommission report={report.commission} basisPoints={report.commissionBps}/>}
 <h2 className="partner-revenue-heading">{t('partner.revenueHeading')}</h2>
 <div className="partner-stats">{stats.map(([label,value])=><div key={label} className="partner-stat"><span>{label}</span><strong>{value}</strong></div>)}</div>
 <p className="form-hint">{t('partner.basis',{date:calendarDate(report.throughDate,{day:'numeric',month:'long',year:'numeric'})})}</p>
 {report.rows.length>0&&<Input className="partner-search" aria-label={t('partner.search')} placeholder={t('partner.search')} value={query} onChange={e=>setQuery(e.target.value)}/>}
 {!report.rows.length?<p className="partner-empty">{t('partner.empty')}</p>:!rows.length?<p>{t('partner.noMatches')}</p>:<div className="partner-customers">{rows.map(row=><article className="partner-customer" key={row.id}>
 <header><div><h2>{row.name}</h2>{row.assignedAt&&<small>{t('partner.since',{date:date(new Date(row.assignedAt),{day:'numeric',month:'long',year:'numeric'})})}</small>}</div><span className={row.active?'stage stage-green':'stage stage-gray'}>{t(row.historical?'partner.historical':row.active?'partner.active':'partner.inactive')}</span></header>
 {row.userCount!=null&&<p className="form-hint">{t('partner.activeUsers',{count:number(row.userCount)})}</p>}
 <dl>{[[t('partner.monthly'),amount(row.currentOre)],[t('partner.previous'),amount(row.previousOre)],[t('partner.ytd'),amount(row.ytdOre)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
 </article>)}</div>}
 </div>;
}

