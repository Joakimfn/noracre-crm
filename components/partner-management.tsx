"use client";
import {useEffect,useState} from 'react';
import {apiFetch} from '@/lib/api-client';
import {useI18n} from '@/lib/i18n/react';
import {Button} from '@/components/ui/button';
import {Label} from '@/components/ui/label';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
export type PartnerCompany={id:number;name:string;status:string;isPartner:boolean;referredByPartnerId:number|null;partnerAssignedAt:string;scheduledDisableAt:string};
function useDirectory(organizationId:number,refreshKey:number){
 const {t}=useI18n(),[rows,setRows]=useState<PartnerCompany[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
 useEffect(()=>{let cancelled=false;setLoading(true);setError('');apiFetch('/api/partners',{headers:{'x-organization-id':String(organizationId)}}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||t('partner.directoryError'));if(!cancelled)setRows(d.organizations);}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[organizationId,refreshKey,reload,t]);
 return {rows,error,loading,reload:()=>setReload(n=>n+1)};
}
export function ReferrerSelect({rows,value,onChange,disabled=false}:{rows:PartnerCompany[];value:string;onChange:(v:string)=>void;disabled?:boolean}){
 const {t}=useI18n();
 return <Select value={value||'none'} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={t('partner.referrer')}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">{t('partner.none')}</SelectItem>{rows.filter(r=>r.isPartner&&((r.status==='Aktiv'&&(!r.scheduledDisableAt||r.scheduledDisableAt>new Date().toISOString()))||String(r.id)===value)).map(r=><SelectItem value={String(r.id)} key={r.id}>{r.name}</SelectItem>)}</SelectContent></Select>;
}
export function PartnerPicker({organizationId,refreshKey,value,onChange}:{organizationId:number;refreshKey:number;value:string;onChange:(v:string)=>void}){
 const {t}=useI18n(),directory=useDirectory(organizationId,refreshKey);
 return <><Label>{t('partner.referrer')}</Label><ReferrerSelect rows={directory.rows} value={value} onChange={onChange} disabled={directory.loading||Boolean(directory.error)}/>{directory.error&&<p role="alert">{directory.error} <Button type="button" variant="outline" onClick={directory.reload}>{t('partner.retry')}</Button></p>}</>;
}
