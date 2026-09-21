"use client";
import {partnerCommissionOverview} from '@/lib/partner-payments';
import {Building2,LayoutDashboard,UsersRound,CalendarCheck2,BarChart3,Phone,Megaphone} from 'lucide-react';
import {PartnerReportView,type PartnerReport} from './partner-overview';
import {Button} from '@/components/ui/button';
import {useI18n} from '@/lib/i18n/react';
import type {MessageKey} from '@/lib/i18n';
/** Synthetic presentation only. Never changes a role, tenant, subscription or customer record. */
function exampleReport():PartnerReport{
 const now=new Date(),year=now.getUTCFullYear(),previousMonth=new Date(Date.UTC(year,now.getUTCMonth()-1,1)).toISOString().slice(0,7);
 const assignedAt=previousMonth+'-01T10:00:00Z';
 return {commissionBps:2000,...partnerCommissionOverview([
 {id:1,name:'Nordlys Elektro AS',active:true,assignedAt},
 {id:2,name:'Vestland Regnskap AS',active:true,assignedAt},
 {id:3,name:'Fjord Bygg AS',active:false,assignedAt}],
 [{id:1,organizationId:1,companyName:'Nordlys Elektro AS',reference:'DEMO-101',paidOn:previousMonth+'-15',amountOre:274000,basisPoints:2000,commissionOre:54800,voidedAt:''},
 {id:2,organizationId:2,companyName:'Vestland Regnskap AS',reference:'DEMO-102',paidOn:previousMonth+'-20',amountOre:164400,basisPoints:2000,commissionOre:32880,voidedAt:''}],now)};
}
export function PartnerPreview({onClose}:{onClose:()=>void}){
 const {t}=useI18n();
 const items:[MessageKey,typeof Building2][]=[['nav.overview',LayoutDashboard],['nav.customers',UsersRound],['nav.followup',CalendarCheck2],['nav.reports',BarChart3],['nav.calllists',Phone],['nav.marketing',Megaphone]];
 return <main className="app-shell signature-shell partner-preview">
 <aside className="sidebar"><div className="brand"><img className="brand-wordmark brand-wordmark-light" src="/noracre-logo-primary.svg" alt="Noracre"/><img className="brand-wordmark brand-wordmark-dark" src="/noracre-logo-dark.svg" alt="Noracre"/><img className="brand-icon brand-icon-sidebar" src="/noracre-app-icon.svg" alt="Noracre"/></div>
 <nav aria-label={t('nav.main')}>{items.map(([key,Icon])=><button type="button" disabled key={key}><Icon size={20}/><span className="nav-label">{t(key)}</span></button>)}</nav>
 <div className="sidebar-bottom"><nav className="super-nav" aria-label={t('nav.partner')}><button type="button" className="active" aria-current="page"><Building2 size={20}/><span className="nav-label">{t('nav.partner')}</span></button></nav><div className="sidebar-foot"><div className="avatar">EP</div><div><strong>{t('partner.previewAccount')}</strong><span>Partner</span></div></div></div></aside>
 <section className="workspace view-partner"><header className="topbar"><div><p className="eyebrow">NORACRE CRM</p><h1>{t('nav.partner')}</h1></div><Button variant="outline" onClick={onClose}>{t('partner.previewClose')}</Button></header>
 <div className="partner-preview-notice" role="status"><strong>{t('partner.previewLabel')}</strong><p>{t('partner.previewHint')}</p></div>
 <PartnerReportView report={exampleReport()}/></section></main>;
}
