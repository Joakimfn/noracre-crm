"use client";
import {partnerCommissionOverview,paymentCommission,norwegianToday} from '@/lib/partner-payments';
import {Building2,LayoutDashboard,UsersRound,CalendarCheck2,BarChart3,Phone,Megaphone,Settings} from 'lucide-react';
import {PartnerReportView,type PartnerReport} from './partner-overview';
import {Button} from '@/components/ui/button';
import {useI18n} from '@/lib/i18n/react';
import type {MessageKey} from '@/lib/i18n';
/** Synthetic presentation only. Never changes a role, tenant, subscription or customer record. */
function exampleReport():PartnerReport{
 const now=new Date(),today=norwegianToday(now),year=Number(today.slice(0,4)),month=Number(today.slice(5,7));
 const previousMonth=new Date(Date.UTC(year,month-2,1)).toISOString().slice(0,7),assignedAt=previousMonth+'-01T10:00:00Z',basisPoints=4000;
 const examples=[
 {id:1,name:'Nordlys Elektro AS',userCount:6,active:true},
 {id:2,name:'Vestland Regnskap AS',userCount:4,active:true},
 {id:3,name:'Fjord Bygg AS',userCount:0,previousUsers:3,active:false},
 {id:4,name:'Solsiden Renhold AS',userCount:2,active:true},
 {id:5,name:'Havblikk Eiendom AS',userCount:8,active:true},
 {id:6,name:'Lind Blomster AS',userCount:1,active:true},
 {id:7,name:'Midtbyen Bilservice AS',userCount:5,active:true},
 {id:8,name:'Berg Transport AS',userCount:10,active:true},
 {id:9,name:'Kysten Arkitekter AS',userCount:3,active:true},
 {id:10,name:'Fjell IT AS',userCount:7,active:true},
 {id:11,name:'Eik Interiør AS',userCount:9,active:true},
 {id:12,name:'Sørland Ventilasjon AS',userCount:4,active:true},
 {id:13,name:'Nordmarka Catering AS',userCount:2,active:true},
 {id:14,name:'Strand Foto AS',userCount:0,previousUsers:2,active:false}];
 const payments=examples.flatMap(company=>{
 const amountOre=(company.active?company.userCount:company.previousUsers!)*54800;
 const payment={organizationId:company.id,companyName:company.name,amountOre,basisPoints,commissionOre:paymentCommission(amountOre,basisPoints),voidedAt:''};
 return [{...payment,id:company.id*2,reference:'DEMO-'+company.id+'-FORRIGE',paidOn:previousMonth+'-15'},...(company.active?[{...payment,id:company.id*2+1,reference:'DEMO-'+company.id+'-NA',paidOn:today.slice(0,8)+String(Math.min(12,Number(today.slice(8,10)))).padStart(2,'0')}]:[])];
 });
 const report=partnerCommissionOverview(examples.map(company=>({...company,assignedAt})),payments,now);
 return {...report,commissionBps:basisPoints,rows:report.rows.map(row=>({...row,userCount:examples.find(company=>company.id===row.id)!.userCount}))};
}
export function PartnerPreview({onClose}:{onClose:()=>void}){
 const {t}=useI18n();
 const items:[MessageKey,typeof Building2][]=[['nav.overview',LayoutDashboard],['nav.customers',UsersRound],['nav.followup',CalendarCheck2],['nav.reports',BarChart3],['nav.calllists',Phone],['nav.marketing',Megaphone],['nav.admin',Settings]];
 return <main className="app-shell signature-shell partner-preview">
 <aside className="sidebar"><div className="brand"><img className="brand-wordmark brand-wordmark-light" src="/noracre-logo-primary.svg" alt="Noracre"/><img className="brand-wordmark brand-wordmark-dark" src="/noracre-logo-dark.svg" alt="Noracre"/><img className="brand-icon brand-icon-sidebar" src="/noracre-app-icon.svg" alt="Noracre"/></div>
 <nav aria-label={t('nav.main')}>{items.map(([key,Icon])=><button type="button" disabled key={key}><Icon size={20}/><span className="nav-label">{t(key)}</span></button>)}</nav>
 <div className="sidebar-bottom"><nav className="super-nav" aria-label={t('nav.partner')}><button type="button" className="active" aria-current="page"><Building2 size={20}/><span className="nav-label">{t('nav.partner')}</span></button></nav><div className="sidebar-foot"><div className="avatar">EP</div><div><strong>{t('partner.previewAccount')}</strong><span>Partner</span></div></div></div></aside>
 <section className="workspace view-partner"><header className="topbar"><div><p className="eyebrow">NORACRE CRM</p><h1>{t('nav.partner')}</h1></div><Button variant="outline" onClick={onClose}>{t('partner.previewClose')}</Button></header>
 <div className="partner-preview-notice" role="status"><strong>{t('partner.previewLabel')}</strong><p>{t('partner.previewHint')}</p></div>
 <PartnerReportView report={exampleReport()}/></section></main>;
}
