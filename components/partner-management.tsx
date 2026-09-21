"use client";
import {useEffect,useState} from 'react';
import {apiFetch} from '@/lib/api-client';
import {useI18n} from '@/lib/i18n/react';
import {Button} from '@/components/ui/button';
import {Label} from '@/components/ui/label';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
type Company={id:number;name:string;status:string;isPartner:boolean;referredByPartnerId:number|null;partnerAssignedAt:string;scheduledDisableAt:string};
function useDirectory(organizationId:number,refreshKey:number){
 const {t}=useI18n(),[rows,setRows]=useState<Company[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
 useEffect(()=>{let cancelled=false;setLoading(true);setError('');apiFetch('/api/partners',{headers:{'x-organization-id':String(organizationId)}}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||t('partner.directoryError'));if(!cancelled)setRows(d.organizations);}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[organizationId,refreshKey,reload,t]);
 return {rows,error,loading,reload:()=>setReload(n=>n+1)};
}
function ReferrerSelect({rows,value,onChange,disabled=false}:{rows:Company[];value:string;onChange:(v:string)=>void;disabled?:boolean}){
 const {t}=useI18n();
 return <Select value={value||'none'} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={t('partner.referrer')}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">{t('partner.none')}</SelectItem>{rows.filter(r=>r.isPartner&&((r.status==='Aktiv'&&(!r.scheduledDisableAt||r.scheduledDisableAt>new Date().toISOString()))||String(r.id)===value)).map(r=><SelectItem value={String(r.id)} key={r.id}>{r.name}</SelectItem>)}</SelectContent></Select>;
}
export function PartnerPicker({organizationId,refreshKey,value,onChange}:{organizationId:number;refreshKey:number;value:string;onChange:(v:string)=>void}){
 const {t}=useI18n(),directory=useDirectory(organizationId,refreshKey);
 return <><Label>{t('partner.referrer')}</Label><ReferrerSelect rows={directory.rows} value={value} onChange={onChange} disabled={directory.loading||Boolean(directory.error)}/>{directory.error&&<p role="alert">{directory.error} <Button type="button" variant="outline" onClick={directory.reload}>{t('partner.retry')}</Button></p>}</>;
}
export function PartnerManagement({organizationId,refreshKey,onChanged}:{organizationId:number;refreshKey:number;onChanged:()=>void}){
 const {t}=useI18n(),directory=useDirectory(organizationId,refreshKey);
 const [id,setId]=useState(''),[referrer,setReferrer]=useState('none'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const selected=directory.rows.find(r=>String(r.id)===id);
 async function save(){if(!selected||busy)return;setBusy(true);setError('');setSaved(false);try{
 const response=await apiFetch('/api/partners',{method:'POST',headers:{'Content-Type':'application/json','x-organization-id':String(organizationId)},body:JSON.stringify({organizationId:selected.id,isPartner:selected.isPartner,referredByPartnerId:referrer==='none'?null:Number(referrer)})});const data=await response.json();if(!response.ok)throw Error(data.error||t('partner.saveError'));setSaved(true);directory.reload();onChanged();
 }catch(e){setError(e instanceof Error?e.message:t('partner.saveError'));}finally{setBusy(false);}}
 return <div className="organization-form partner-assignment"><p>{t('partner.manageHint')}</p><Label>{t('partner.company')}</Label><Select value={id} disabled={busy||directory.loading} onValueChange={value=>{const row=directory.rows.find(r=>String(r.id)===value)!;setId(value);setReferrer(row.referredByPartnerId?String(row.referredByPartnerId):'none');setError('');setSaved(false);}}><SelectTrigger aria-label={t('partner.company')}><SelectValue placeholder={t('partner.choose')}/></SelectTrigger><SelectContent>{directory.rows.map(r=><SelectItem value={String(r.id)} key={r.id}>{r.name}</SelectItem>)}</SelectContent></Select>
 {selected&&<><Label>{t('partner.referrer')}</Label><ReferrerSelect rows={directory.rows.filter(r=>r.id!==selected.id)} value={referrer} onChange={v=>{setReferrer(v);setSaved(false);}} disabled={busy}/><Button type="button" disabled={busy||directory.loading||referrer===(selected.referredByPartnerId?String(selected.referredByPartnerId):"none")} onClick={save}>{t(busy?'partner.saving':'partner.save')}</Button></>}
 {(error||directory.error)&&<p role="alert">{error||directory.error}</p>}{directory.error&&<Button type="button" variant="outline" onClick={directory.reload}>{t('partner.retry')}</Button>}{saved&&<p role="status">{t('partner.saved')}</p>}
 </div>;
}
