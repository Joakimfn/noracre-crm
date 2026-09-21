"use client";
import {useDemoMode} from "@/lib/crm-api";
import {useEffect,useState} from 'react';
import {Plus,X} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
const presets=[5,15,30,60,120,1440,2880,10080];
export function ReminderFields({value,onChange}:{value:number[];onChange:(value:number[])=>void}){
 const demoMode=useDemoMode();
 const [custom,setCustom]=useState<number[]>(value.flatMap((n,i)=>presets.includes(n)?[]:[i]));
 const [permission,setPermission]=useState<NotificationPermission|'unsupported'|null>(null),[requesting,setRequesting]=useState(false);
 useEffect(()=>{const read=()=>setPermission('Notification' in window?Notification.permission:'unsupported');read();window.addEventListener('focus',read);return()=>window.removeEventListener('focus',read);},[]);
 async function allow(){if(demoMode||!('Notification' in window))return;setRequesting(true);try{setPermission(await Notification.requestPermission());}finally{setRequesting(false);}}
 function remove(index:number){onChange(value.filter((_,i)=>i!==index));setCustom(current=>current.filter(i=>i!==index).map(i=>i>index?i-1:i));}
 const add=<Button type="button" variant="outline" className="reminder-add" onClick={()=>onChange([...value,value.length?(value[0]===1440?15:1440):15])}><Plus size={16}/>Legg til varsling</Button>;
 return <fieldset className="reminder-fields"><legend>Varsling før oppfølging</legend>
 {!value.length&&<div className="reminder-row"><span className="reminder-none">Ingen varsling</span>{add}</div>}
 {value.map((minutes,index)=><div className="reminder-row" key={index}><label className="reminder-choice">Varsling {index+1}<select value={custom.includes(index)||!presets.includes(minutes)?'custom':minutes} onChange={e=>{const selected=e.target.value;setCustom(current=>selected==='custom'?[...current,index]:current.filter(i=>i!==index));const next=[...value];next[index]=selected==='custom'?1:Number(selected);onChange(next);}}><option value={5}>5 minutter før</option><option value={15}>15 minutter før</option><option value={30}>30 minutter før</option><option value={60}>1 time før</option><option value={120}>2 timer før</option><option value={1440}>1 dag før</option><option value={2880}>2 dager før</option><option value={10080}>1 uke før</option><option value="custom">Egendefinert</option></select>{(custom.includes(index)||!presets.includes(minutes))&&<span className="reminder-custom"><Input aria-label={`Minutter før for varsling ${index+1}`} type="number" min={1} max={43200} value={minutes} onChange={e=>{const next=[...value];next[index]=Number(e.target.value);onChange(next);}}/> minutter før</span>}</label><Button type="button" variant="ghost" size="icon" aria-label={`Fjern varsling ${index+1}`} onClick={()=>remove(index)}><X size={16}/></Button>{index===0&&value.length<2&&add}</div>)}
 {value.length===2&&value[0]===value[1]&&<p role="alert">Velg ulike tidspunkter for de to varslene.</p>}
 {!demoMode&&!!value.length&&<div className="reminder-permission"><small>CRM-et må være åpent når varslingen skal vises.</small>{permission==='default'&&<Button type="button" variant="outline" disabled={requesting} onClick={()=>void allow()}>{requesting?'Venter på nettleseren …':'Tillat varsler i nettleseren'}</Button>}{permission==='denied'&&<small role="status">Nettleseren blokkerer varsler. Tillat varsler for CRM i nettleserens nettstedinnstillinger.</small>}{permission==='unsupported'&&<small role="status">Denne nettleseren støtter ikke varsler. Oppfølgingen lagres som vanlig.</small>}</div>}
 </fieldset>;
}
