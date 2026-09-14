"use client";
import {ReminderFields} from "@/components/reminder-fields";
import {reminderMinutes} from "@/lib/followup-reminder";
import {useEffect,useState} from "react";
import {CalendarCheck2,Plus,Check,Trash2,Pencil} from "lucide-react";
import {toast} from "sonner";
import {apiFetch} from "@/lib/api-client";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {DateTimePicker} from "@/components/date-time-picker";
type Task={id:number;companyId:number;note:string;dueAt:string;createdBy:string;contactId:number|null;completedAt:string;reminderMinutes?:string};
type Contact={id:number;name:string};
const blank={id:0,note:"",dueAt:"",contactId:null as number|null,reminderMinutes:[15] as number[]};
export function CustomerFollowups({company,contacts,organizationId,onChanged,revision}:{company:{id:number;name:string};contacts:Contact[];organizationId:number;onChanged:()=>Promise<void>;revision:readonly unknown[]}){
 const [tasks,setTasks]=useState<Task[]>([]),[draft,setDraft]=useState<typeof blank|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const headers={"x-organization-id":String(organizationId),"content-type":"application/json"};
 async function load(){const r=await apiFetch(`/api/activities?companyId=${company.id}`,{headers});if(!r.ok)throw Error();const d=await r.json();setTasks(d.activities.filter((a:Task)=>a.companyId===company.id&&!a.completedAt).sort((a:Task,b:Task)=>a.dueAt.localeCompare(b.dueAt)));}
 useEffect(()=>{setTasks([]);setDraft(null);setError("");},[company.id,organizationId]);
 useEffect(()=>{let cancelled=false;apiFetch(`/api/activities?companyId=${company.id}`,{headers}).then(async r=>{if(!r.ok)throw Error();const d=await r.json();if(!cancelled)setTasks(d.activities.filter((a:Task)=>!a.completedAt).sort((a:Task,b:Task)=>a.dueAt.localeCompare(b.dueAt)));}).catch(()=>{if(!cancelled)setError("Oppfølgingene kunne ikke hentes.");});return()=>{cancelled=true;};},[company.id,organizationId,revision]);
 async function change(method:string,body:Record<string,unknown>,id?:number){setBusy(true);try{const r=await apiFetch(`/api/activities${method==='DELETE'?`?id=${id}`:''}`,{method,headers,...(method==='DELETE'?{}:{body:JSON.stringify(body)})});const d=await r.json();if(!r.ok)throw Error(d.error||"Kunne ikke lagre oppfølgingen");await load();await onChanged();setDraft(null);setError("");}catch(e){toast.error(e instanceof Error?e.message:"Kunne ikke lagre oppfølgingen");}finally{setBusy(false);}}
 return <details className="compact-section" open><summary><span><CalendarCheck2 size={18}/>Neste oppfølging</span><strong>{tasks[0]?.dueAt?new Date(tasks[0].dueAt).toLocaleString('nb-NO'):"Ingen planlagt oppfølging"}</strong></summary><div className="compact-body followup-list">
 {error&&<p role="alert">{error}</p>}
 {tasks.map(t=><div className="followup-item" key={t.id}><strong>{t.note||"Følg opp"}</strong><span>{t.dueAt?new Date(t.dueAt).toLocaleString('nb-NO'):"Ingen dato"}</span><span>{contacts.find(c=>c.id===t.contactId)?.name||"Ingen valgt kontakt"}</span><small>Registrert av {t.createdBy||"Ukjent bruker"}</small><div className="followup-actions"><Button variant="outline" size="sm" disabled={busy} onClick={()=>setDraft({id:t.id,note:t.note,dueAt:t.dueAt,contactId:t.contactId,reminderMinutes:reminderMinutes(t.reminderMinutes)})}><Pencil/>Endre</Button><Button variant="outline" size="sm" disabled={busy} onClick={()=>change('PATCH',{id:t.id,completedAt:new Date().toISOString()})}><Check/>Utført</Button><Button variant="ghost" size="sm" disabled={busy} onClick={()=>change('DELETE',{},t.id)} aria-label={`Slett oppfølging: ${t.note}`}><Trash2/></Button></div></div>)}
 {draft?<form className="followup-editor" onSubmit={e=>{e.preventDefault();if(!draft.note.trim()||!draft.dueAt)return;void change(draft.id?'PATCH':'POST',{...draft,companyId:company.id,companyName:company.name,isTask:true,kind:'Annet'});}}><label>Hva skal gjøres?<Input required value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/></label><label>Hvem skal kontaktes?<select value={draft.contactId??''} onChange={e=>setDraft({...draft,contactId:e.target.value?Number(e.target.value):null})}><option value="">Ingen valgt kontakt</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><DateTimePicker label="Dato og tid" value={draft.dueAt} onChange={dueAt=>setDraft({...draft,dueAt})}/><ReminderFields value={draft.reminderMinutes} onChange={reminderMinutes=>setDraft({...draft,reminderMinutes})}/><div className="followup-actions"><Button type="submit" disabled={busy||!draft.dueAt||!draft.note.trim()}>{busy?'Lagrer …':'Lagre oppfølging'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>setDraft(null)}>Avbryt</Button></div></form>:<Button variant="outline" onClick={()=>setDraft({...blank})}><Plus/>Legg til oppfølging</Button>}
 </div></details>;
}
