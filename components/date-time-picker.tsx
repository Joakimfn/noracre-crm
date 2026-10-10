"use client";
import {locales} from '@/lib/i18n/config';
import {useI18n} from '@/lib/i18n/react';
import {UiText,useUiTranslation} from '@/lib/i18n/ui';

import { useState } from "react";
import { nb,enGB,fr } from "date-fns/locale";
import { CalendarDays, Clock3, ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const pad=(n:number)=>String(n).padStart(2,"0");
const localValue=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dateText=(d:Date)=>`${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
function parseDate(text:string){
  const m=/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);if(!m)return;
  const d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),12);
  if(d.getFullYear()===Number(m[3])&&d.getMonth()===Number(m[2])-1&&d.getDate()===Number(m[1]))return d;
}
export function DateTimePicker({value="",onChange,label,showNow=false}:{value?:string;onChange:(value:string)=>void;label:string;showNow?:boolean}){
 const {locale}=useI18n();
 const {ui}=useUiTranslation();
  const [open,setOpen]=useState(false),[date,setDate]=useState(""),[hour,setHour]=useState("09"),[minute,setMinute]=useState("00"),[month,setMonth]=useState(new Date());
  const current=value?new Date(value):undefined,validCurrent=current&&!Number.isNaN(current.getTime())?current:undefined;
  const selected=parseDate(date),validTime=/^\d{1,2}$/.test(hour)&&Number(hour)<24&&/^\d{1,2}$/.test(minute)&&Number(minute)<60;
  function choose(d:Date){setDate(dateText(d));setMonth(d);}
  function openPicker(next:boolean){if(next){const d=validCurrent??new Date();choose(d);setHour(validCurrent?pad(d.getHours()):"09");setMinute(validCurrent?pad(d.getMinutes()):"00");}setOpen(next);}
  function apply(){if(!selected||!validTime)return;selected.setHours(Number(hour),Number(minute),0,0);onChange(localValue(selected));setOpen(false);}
  return <div className="noracre-datetime">
    <Popover modal open={open} onOpenChange={openPicker}>
      <PopoverTrigger asChild><Button type="button" variant="outline" className="noracre-datetime-trigger" aria-label={`${label}: ${validCurrent?validCurrent.toLocaleString(locales[locale].intl):ui("Velg dato og tid")}`}>
        <span className="noracre-date-icon"><CalendarDays size={20}/></span>
        <span className="noracre-date-caption"><strong>{validCurrent?validCurrent.toLocaleDateString(locales[locale].intl,{day:"numeric",month:"long",year:"numeric"}):ui("Velg dato")}</strong><span><Clock3 size={13}/>{validCurrent?`${ui("kl.")} ${pad(validCurrent.getHours())}:${pad(validCurrent.getMinutes())}`:ui("og klokkeslett")}</span></span><ChevronDown size={16}/>
      </Button></PopoverTrigger>
      <PopoverContent collisionPadding={12} align="start" className="noracre-date-panel" aria-label={label}>
        <div className="noracre-date-shortcuts">{[0,1].map(offset=><Button type="button" key={offset} variant="secondary" size="sm" onClick={()=>{const d=new Date();d.setDate(d.getDate()+offset);choose(d);}}>{offset?ui("I morgen"):<UiText text="I dag" />}</Button>)}</div>
        <div className="noracre-date-fields"><label><UiText text="Dato" /><Input aria-label={ui("Dato, dag.måned.år")} value={date} placeholder={ui("dd.mm.åååå")} onChange={e=>{setDate(e.target.value);const d=parseDate(e.target.value);if(d)setMonth(d);}}/></label><fieldset><legend><UiText text="Klokkeslett" /></legend><div><Input aria-label={ui("Time")} inputMode="numeric" maxLength={2} value={hour} onChange={e=>setHour(e.target.value.replace(/\D/g,""))}/><span>:</span><Input aria-label={ui("Minutt")} inputMode="numeric" maxLength={2} value={minute} onChange={e=>setMinute(e.target.value.replace(/\D/g,""))}/></div></fieldset></div>
        <Calendar mode="single" locale={locale==='fr'?fr:locale==='en'?enGB:nb} weekStartsOn={1} selected={selected} month={month} onMonthChange={setMonth} onSelect={d=>{if(d)choose(d);}} className="noracre-calendar"/>
        {(!selected||!validTime)&&<p className="noracre-date-error" role="status"><UiText text="Skriv en gyldig dato og et klokkeslett mellom 00:00 og 23:59." /></p>}
        <div className="noracre-date-footer"><Button type="button" variant="ghost" onClick={()=>{onChange("");setOpen(false);}}><UiText text="Fjern tidspunkt" /></Button><Button type="button" disabled={!selected||!validTime} onClick={apply}><UiText text="Velg tidspunkt" /></Button></div>
      </PopoverContent>
    </Popover>
    {showNow&&<Button type="button" variant="secondary" className="noracre-now" onClick={()=>{onChange(localValue(new Date()));setOpen(false);}}><UiText text="Nå" /></Button>}
  </div>;
}

