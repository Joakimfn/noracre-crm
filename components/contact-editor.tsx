"use client";
import {UiText,useUiTranslation} from '@/lib/i18n/ui';

import {useCrmApi} from "@/lib/crm-api";
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {toast} from 'sonner';
type Contact={id:number;name:string;title:string;email:string;phone:string};
export function ContactEditor({contact,organizationId,onChanged}:{contact:Contact;organizationId:number;onChanged:()=>Promise<void>}){
 const {ui}=useUiTranslation();
 const apiFetch=useCrmApi();

 const [draft,setDraft]=useState<Contact|null>(null),[deleting,setDeleting]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(remove=false){if(!draft||busy)return;setBusy(true);setError(ui(''));try{
  const r=await apiFetch(`/api/contacts${remove?`?id=${draft.id}`:''}`,{method:remove?'DELETE':'PATCH',headers:{'content-type':'application/json','x-organization-id':String(organizationId)},...(remove?{}:{body:JSON.stringify(draft)})});const d=await r.json();if(!r.ok)throw Error(d.error||'Kunne ikke endre kontaktpersonen.');
  setDraft(null);setDeleting(false);await onChanged();toast.success(ui(remove?'Kontaktpersonen er slettet':'Kontaktpersonen er oppdatert'));
 }catch(e){setError(ui(e instanceof Error?e.message:'Kunne ikke lagre'));}finally{setBusy(false);}}
 return <><Button variant="outline" onClick={()=>{setDraft({...contact});setDeleting(false);setError(ui(''));}}><UiText text="Endre kontaktperson" /></Button><Dialog open={!!draft} onOpenChange={open=>{if(!open&&!busy)setDraft(null);}}><DialogContent><DialogHeader><DialogTitle>{deleting?ui("Slett kontaktperson?"):<UiText text="Endre kontaktperson" />}</DialogTitle><DialogDescription>{deleting?ui("{0} fjernes fra kunden. Registrerte aktiviteter beholdes.",{"0":draft?.name}):ui("Oppdater kontaktopplysningene på kundekortet.")}</DialogDescription></DialogHeader>
 {draft&&!deleting&&<form className="contact-edit-form" onSubmit={e=>{e.preventDefault();void save();}}>{(['name','title','phone','email'] as const).map(key=><label key={key}>{{name:ui("Navn"),title:ui("Stilling / tittel"),phone:ui("Telefon"),email:ui("E-post")}[key]}<Input required={key==='name'} type={key==='email'?'email':key==='phone'?'tel':'text'} maxLength={key==='email'?254:key==='phone'?60:160} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}{error&&<p role="alert">{error}</p>}<Button type="submit" disabled={busy}>{busy?ui("Lagrer …"):ui("Lagre kontaktperson")}</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>setDeleting(true)}><UiText text="Slett kontaktperson" /></Button></form>}
 {deleting&&<>{error&&<p role="alert">{error}</p>}<Button disabled={busy} onClick={()=>save(true)}>{busy?ui("Sletter …"):<UiText text="Slett kontaktperson" />}</Button><Button variant="outline" disabled={busy} onClick={()=>setDeleting(false)}><UiText text="Avbryt" /></Button></>}
 </DialogContent></Dialog></>;
}

