'use client';
import {UiText,useUiTranslation} from '@/lib/i18n/ui';

import {useState} from 'react';
import {nb,enGB,fr} from 'date-fns/locale';
import {useI18n} from '@/lib/i18n/react';
import {CalendarDays} from 'lucide-react';
import {Calendar} from '@/components/ui/calendar';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {isoDate,norwegianDate} from '@/lib/norwegian-search';
export function NorwegianDateInput({id,label,value,onChange}:{id:string;label:string;value:string;onChange:(v:string)=>void}){
 const {locale}=useI18n();
 const {ui}=useUiTranslation();
 const [open,setOpen]=useState(false),[month,setMonth]=useState(new Date());
 let selected:Date|undefined;
 try{if(value)selected=new Date(isoDate(value)+'T12:00:00');}catch{}
 return <div className="norwegian-date-input"><Input id={id} aria-label={label} value={norwegianDate(value)} placeholder={ui("DD.MM.ÅÅÅÅ")} maxLength={10} onChange={e=>{const text=e.target.value;if(!text)return onChange('');try{onChange(isoDate(text));}catch{onChange(text);}}}/><Popover open={open} onOpenChange={next=>{if(next)setMonth(selected??new Date());setOpen(next);}}><PopoverTrigger asChild><Button type="button" variant="ghost" aria-label={ui("Velg dato: ")+label}><CalendarDays size={16}/></Button></PopoverTrigger><PopoverContent className="noracre-date-panel" align="end"><Calendar mode="single" locale={locale==='fr'?fr:locale==='en'?enGB:nb} weekStartsOn={1} selected={selected} month={month} onMonthChange={setMonth} onSelect={d=>{if(d){onChange(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);setOpen(false);}}} className="noracre-calendar"/><Button variant="ghost" onClick={()=>{onChange('');setOpen(false);}}><UiText text="Fjern dato" /></Button></PopoverContent></Popover></div>;
}
