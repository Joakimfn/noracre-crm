"use client";
import {UiText,useUiTranslation} from '@/lib/i18n/ui';
import {useRef,useState} from 'react';
import {useCrmApi} from '@/lib/crm-api';
import {HomeCountryPicker} from './home-country-picker';
import {registerCountries,type RegisterCountry} from '@/lib/operating-countries';
import {OperatingCountryPicker} from './operating-country-picker';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';
import {toast} from 'sonner';
export function PartnerCustomerCreate({organizationId,onCreated}:{organizationId:number;onCreated:()=>void}){
 const {ui}=useUiTranslation();
 const creating=useRef(false);
 const [outboundEnabled,setOutboundEnabled]=useState(false);
 const api=useCrmApi(),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[homeCountry,setHomeCountry]=useState('NO'),[countries,setCountries]=useState<RegisterCountry[]>(['NO']),[form,setForm]=useState({name:'',orgNumber:'',adminName:'',adminEmail:'',adminPhone:'',crmPrice:'',ringPrice:'',marketingPrice:''});
 async function save(){if(creating.current)return;creating.current=true;setBusy(true);try{const r=await api('/api/admin',{method:'POST',headers:{'content-type':'application/json','x-organization-id':String(organizationId)},body:JSON.stringify({type:'organization',...form,homeCountry,operatingCountries:countries,outboundEnabled,adminRole:'Administrator'})}),d=await r.json();if(!r.ok)throw Error(d.error||'Kunne ikke opprette bedriften');toast.success(ui(d.invitationSent?'Bedriften er opprettet og invitasjonen er sendt':'Bedriften er opprettet. Invitasjonen kunne ikke sendes; del crm.noracre.no med kontaktpersonen.'));setOpen(false);setOutboundEnabled(false);setForm({name:'',orgNumber:'',adminName:'',adminEmail:'',adminPhone:'',crmPrice:'',ringPrice:'',marketingPrice:''});onCreated();}catch(e){toast.error(ui(e instanceof Error?e.message:'Kunne ikke opprette bedriften'));}finally{creating.current=false;setBusy(false);}}
 return <><Button onClick={()=>setOpen(true)}><UiText text="Opprett kundebedrift" /></Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle><UiText text="Opprett kundebedrift" /></DialogTitle><DialogDescription><UiText text="Bedriften knyttes til deg som partner. Kontaktpersonen får administratorrollen." /></DialogDescription></DialogHeader>{([['name','Bedriftsnavn'],['orgNumber','Organisasjonsnummer'],['adminName','Kontaktperson'],['adminEmail','Kontaktpersonens e-post'],['adminPhone','Kontaktpersonens telefon'],['crmPrice','Avtalt CRM-pris per bruker / måned (NOK)'],['ringPrice','Avtalt ringelistepris per bruker / måned (NOK)'],['marketingPrice','Avtalt markedsføringspris per bruker / måned (NOK)']] as const).map(([key,label])=><label key={key}>{ui(label)}<Input value={form[key]} type={key==='adminEmail'?'email':key.endsWith('Price')?'number':'text'} min={0} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<HomeCountryPicker value={homeCountry} onChange={country=>{setHomeCountry(country);setCountries(registerCountries.some(c=>c.code===country)?[country as RegisterCountry]:[]);}}/><OperatingCountryPicker value={countries} onChange={setCountries}/><label className="form-hint" style={{display:"flex",alignItems:"center",gap:10}}><input type="checkbox" checked={outboundEnabled} disabled={busy} onChange={e=>setOutboundEnabled(e.target.checked)}/><UiText text="Denne kunden driver med outbound sales og skal ha salgsarbeidsflaten" /></label><Button disabled={busy||!countries.length} onClick={save}><UiText text="Opprett bedrift" /></Button></DialogContent></Dialog></>;
}
