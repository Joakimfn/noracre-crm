'use client';
import {useState} from 'react';
import {nb} from 'date-fns/locale';
import {CalendarDays} from 'lucide-react';
import {Calendar} from '@/components/ui/calendar';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {isoDate,norwegianDate} from '@/lib/norwegian-search';
export function NorwegianDateInput({id,label,value,onChange}:{id:string;label:string;value:string;onChange:(v:string)=>void}){
 const [open,setOpen]=useState(false),[month,setMonth]=useState(new Date());
 let selected:Date|undefined;
 try{if(value)selected=new Date(isoDate(value)+'T12:00:00');}catch{}
 return <div className="norwegian-date-input"><Input id={id} aria-label={label} value={norwegianDate(value)} placeholder="DD.MM.ÅÅÅÅ" maxLength={10} onChange={e=>{const text=e.target.value;if(!text)return onChange('');try{onChange(isoDate(text));}catch{onChange(text);}}}/><Popover open={open} onOpenChange={next=>{if(next)setMonth(selected??new Date());setOpen(next);}}><PopoverTrigger asChild><Button type="button" variant="ghost" aria-label={'Velg dato: '+label}><CalendarDays size={16}/></Button></PopoverTrigger><PopoverContent className="noracre-date-panel" align="end"><Calendar mode="single" locale={nb} weekStartsOn={1} selected={selected} month={month} onMonthChange={setMonth} onSelect={d=>{if(d){onChange(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);setOpen(false);}}} className="noracre-calendar"/><Button variant="ghost" onClick={()=>{onChange('');setOpen(false);}}>Fjern dato</Button></PopoverContent></Popover></div>;
}
