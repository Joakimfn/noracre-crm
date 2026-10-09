"use client";
import {useState} from 'react';
import {useCrmApi} from '@/lib/crm-api';
import {type RegisterCountry} from '@/lib/operating-countries';
import {OperatingCountryPicker} from './operating-country-picker';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';
import {toast} from 'sonner';
export function PartnerCustomerCreate({organizationId,onCreated}:{organizationId:number;onCreated:()=>void}){
 const api=useCrmApi(),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[countries,setCountries]=useState<RegisterCountry[]>(['NO']),[form,setForm]=useState({name:'',orgNumber:'',adminName:'',adminEmail:'',adminPhone:'',crmPrice:'',ringPrice:'',marketingPrice:''});
 async function save(){setBusy(true);try{const r=await api('/api/admin',{method:'POST',headers:{'content-type':'application/json','x-organization-id':String(organizationId)},body:JSON.stringify({type:'organization',...form,operatingCountries:countries,adminRole:'Administrator'})}),d=await r.json();if(!r.ok)throw Error(d.error||'Kunne ikke opprette bedriften');toast.success(d.invitationSent?'Bedriften er opprettet og invitasjonen er sendt':'Bedriften er opprettet. Invitasjonen kunne ikke sendes; del crm.noracre.no med kontaktpersonen.');setOpen(false);setForm({name:'',orgNumber:'',adminName:'',adminEmail:'',adminPhone:'',crmPrice:'',ringPrice:'',marketingPrice:''});onCreated();}catch(e){toast.error(e instanceof Error?e.message:'Kunne ikke opprette bedriften');}finally{setBusy(false);}}
 return <><Button onClick={()=>setOpen(true)}>Opprett kundebedrift</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Opprett kundebedrift</DialogTitle><DialogDescription>Bedriften knyttes til deg som partner. Kontaktpersonen får administratorrollen.</DialogDescription></DialogHeader>{([['name','Bedriftsnavn'],['orgNumber','Organisasjonsnummer'],['adminName','Kontaktperson'],['adminEmail','Kontaktpersonens e-post'],['adminPhone','Kontaktpersonens telefon'],['crmPrice','Avtalt CRM-pris per bruker / måned (NOK)'],['ringPrice','Avtalt ringelistepris per bruker / måned (NOK)'],['marketingPrice','Avtalt markedsføringspris per bruker / måned (NOK)']] as const).map(([key,label])=><label key={key}>{label}<Input value={form[key]} type={key==='adminEmail'?'email':key.endsWith('Price')?'number':'text'} min={0} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<OperatingCountryPicker value={countries} onChange={setCountries}/><Button disabled={busy||!countries.length} onClick={save}>Opprett bedrift</Button></DialogContent></Dialog></>;
}
