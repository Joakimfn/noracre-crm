"use client";
import {useCrmApi} from "@/lib/crm-api";
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {toast} from 'sonner';
type Contact={id:number;name:string;title:string;email:string;phone:string};
export function ContactEditor({contact,organizationId,onChanged}:{contact:Contact;organizationId:number;onChanged:()=>Promise<void>}){
 const apiFetch=useCrmApi();

 const [draft,setDraft]=useState<Contact|null>(null),[deleting,setDeleting]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(remove=false){if(!draft||busy)return;setBusy(true);setError('');try{
  const r=await apiFetch(`/api/contacts${remove?`?id=${draft.id}`:''}`,{method:remove?'DELETE':'PATCH',headers:{'content-type':'application/json','x-organization-id':String(organizationId)},...(remove?{}:{body:JSON.stringify(draft)})});const d=await r.json();if(!r.ok)throw Error(d.error||'Kunne ikke endre kontaktpersonen.');
  setDraft(null);setDeleting(false);await onChanged();toast.success(remove?'Kontaktpersonen er slettet':'Kontaktpersonen er oppdatert');
 }catch(e){setError(e instanceof Error?e.message:'Kunne ikke lagre');}finally{setBusy(false);}}
 return <><Button variant="outline" onClick={()=>{setDraft({...contact});setDeleting(false);setError('');}}>Endre kontaktperson</Button><Dialog open={!!draft} onOpenChange={open=>{if(!open&&!busy)setDraft(null);}}><DialogContent><DialogHeader><DialogTitle>{deleting?'Slett kontaktperson?':'Endre kontaktperson'}</DialogTitle><DialogDescription>{deleting?`${draft?.name} fjernes fra kunden. Registrerte aktiviteter beholdes.`:'Oppdater kontaktopplysningene på kundekortet.'}</DialogDescription></DialogHeader>
 {draft&&!deleting&&<form className="contact-edit-form" onSubmit={e=>{e.preventDefault();void save();}}>{(['name','title','phone','email'] as const).map(key=><label key={key}>{{name:'Navn',title:'Stilling / tittel',phone:'Telefon',email:'E-post'}[key]}<Input required={key==='name'} type={key==='email'?'email':key==='phone'?'tel':'text'} maxLength={key==='email'?254:key==='phone'?60:160} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}{error&&<p role="alert">{error}</p>}<Button type="submit" disabled={busy}>{busy?'Lagrer …':'Lagre kontaktperson'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>setDeleting(true)}>Slett kontaktperson</Button></form>}
 {deleting&&<>{error&&<p role="alert">{error}</p>}<Button disabled={busy} onClick={()=>save(true)}>{busy?'Sletter …':'Slett kontaktperson'}</Button><Button variant="outline" disabled={busy} onClick={()=>setDeleting(false)}>Avbryt</Button></>}
 </DialogContent></Dialog></>;
}
