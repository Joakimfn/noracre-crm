"use client";
import {UiText,useUiTranslation} from '@/lib/i18n/ui';

import {useEffect,useState} from "react";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {DateTimePicker} from "@/components/date-time-picker";
export function DeactivationDialog({target,onClose,onConfirm}:{target:{name:string;kind:string}|null;onClose:()=>void;onConfirm:(date:string)=>Promise<void>}){
 const {ui}=useUiTranslation();
 const [mode,setMode]=useState('now'),[date,setDate]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setMode('now');setDate('');setError(ui(''));},[target]);
 async function submit(){setBusy(true);setError(ui(''));try{await onConfirm(mode==='now'?'':new Date(date).toISOString());}catch(e){setError(ui(e instanceof Error?e.message:'Kunne ikke deaktivere'));}finally{setBusy(false);}}
 return <Dialog open={!!target} onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent><DialogHeader><DialogTitle><UiText text="Deaktiver " />{target?.name}?</DialogTitle><DialogDescription>{target?.kind==='organization'?ui("Alle brukerne i bedriften mister tilgang fra valgt tidspunkt."):ui("Brukeren mister tilgang fra valgt tidspunkt.")}<UiText text=" Dataene slettes ikke." /></DialogDescription></DialogHeader><fieldset className="deactivation-choices"><legend><UiText text="Når skal deaktiveringen gjelde fra?" /></legend><label><input type="radio" name="disable-time" value="now" checked={mode==='now'} onChange={()=>setMode('now')}/><UiText text="Nå" /></label><label><input type="radio" name="disable-time" value="date" checked={mode==='date'} onChange={()=>setMode('date')}/><UiText text="Fra dato" /></label></fieldset>{mode==='date'&&<DateTimePicker label={ui("Deaktiver fra dato og tid")} value={date} onChange={setDate}/>}<p className="form-hint"><UiText text="Tidspunktet følger tidssonen på enheten din." /></p>{error&&<p role="alert">{error}</p>}<div className="followup-actions"><Button variant="outline" disabled={busy} onClick={onClose}><UiText text="Avbryt" /></Button><Button disabled={busy||(mode==='date'&&(!date||new Date(date).getTime()<=Date.now()))} onClick={submit}>{busy?ui("Lagrer …"):mode==='now'?ui("Deaktiver nå"):ui("Planlegg deaktivering")}</Button></div></DialogContent></Dialog>;
}

