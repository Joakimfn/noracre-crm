"use client";
import {useEffect,useState} from "react";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {DateTimePicker} from "@/components/date-time-picker";
export function DeactivationDialog({target,onClose,onConfirm}:{target:{name:string;kind:string}|null;onClose:()=>void;onConfirm:(date:string)=>Promise<void>}){
 const [mode,setMode]=useState('now'),[date,setDate]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setMode('now');setDate('');setError('');},[target]);
 async function submit(){setBusy(true);setError('');try{await onConfirm(mode==='now'?'':new Date(date).toISOString());}catch(e){setError(e instanceof Error?e.message:'Kunne ikke deaktivere');}finally{setBusy(false);}}
 return <Dialog open={!!target} onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent><DialogHeader><DialogTitle>Deaktiver {target?.name}?</DialogTitle><DialogDescription>{target?.kind==='organization'?'Alle brukerne i bedriften mister tilgang fra valgt tidspunkt.':'Brukeren mister tilgang fra valgt tidspunkt.'} Dataene slettes ikke.</DialogDescription></DialogHeader><fieldset className="deactivation-choices"><legend>Når skal deaktiveringen gjelde fra?</legend><label><input type="radio" name="disable-time" value="now" checked={mode==='now'} onChange={()=>setMode('now')}/>Nå</label><label><input type="radio" name="disable-time" value="date" checked={mode==='date'} onChange={()=>setMode('date')}/>Fra dato</label></fieldset>{mode==='date'&&<DateTimePicker label="Deaktiver fra dato og tid" value={date} onChange={setDate}/>}<p className="form-hint">Tidspunktet følger tidssonen på enheten din.</p>{error&&<p role="alert">{error}</p>}<div className="followup-actions"><Button variant="outline" disabled={busy} onClick={onClose}>Avbryt</Button><Button disabled={busy||(mode==='date'&&(!date||new Date(date).getTime()<=Date.now()))} onClick={submit}>{busy?'Lagrer …':mode==='now'?'Deaktiver nå':'Planlegg deaktivering'}</Button></div></DialogContent></Dialog>;
}
