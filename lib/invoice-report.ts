import type {BillingEvent} from './operations-report';

const DAY=86_400_000;
const oslo=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'});
function calendarDay(at:string|Date){
 const parts=oslo.formatToParts(new Date(at));
 const n=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
 return Date.UTC(n('year'),n('month')-1,n('day'));
}
export function monthlyRate(state:Map<string,BillingEvent>){
 const values=[...state.values()];
 if(!values.some(e=>e.entityType==='organization'&&e.active))return 0;
 const users=values.filter(e=>e.entityType==='user'&&e.active);
 const members=new Set(users.map(e=>e.entityId));
 const modules=new Set(values.filter(e=>e.entityType==='module'&&e.active).map(e=>e.moduleKey));
 return users.reduce((sum,e)=>sum+Math.round(e.monthlyPrice*100),0)+values.filter(e=>e.entityType==='license'&&e.active&&members.has(e.membershipId)&&modules.has(e.moduleKey)).reduce((sum,e)=>sum+Math.round(e.monthlyPrice*100),0);
}

/** Changes take effect the following Norwegian calendar day. Round once per company/month. */
export function invoiceReport(events:BillingEvent[],organizations:{id:number;name:string;revenueFrom?:string}[],now=new Date()){
 const today=calendarDay(now),current=new Date(today);
 const monthStart=Date.UTC(current.getUTCFullYear(),current.getUTCMonth(),1);
 const previousStart=Date.UTC(current.getUTCFullYear(),current.getUTCMonth()-1,1);
 const yearStart=Date.UTC(current.getUTCFullYear(),0,1);
 const from=Math.min(previousStart,yearStart);
 const grouped=new Map<number,BillingEvent[]>();
 const names=new Map(organizations.map(o=>[o.id,o.name]));
 for(const e of events){
  if(new Date(e.occurredAt).getTime()>now.getTime())continue;
  if(!grouped.has(e.organizationId))grouped.set(e.organizationId,[]);
  grouped.get(e.organizationId)!.push(e);
  if(!names.has(e.organizationId))names.set(e.organizationId,e.entityType==='organization'?e.label:`Bedrift ${e.organizationId}`);
 }
 const rows=[...names].map(([organizationId,organizationName])=>{
  const ordered=(grouped.get(organizationId)??[]).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)||a.id-b.id);
  const effectiveDays=ordered.map(e=>calendarDay(e.occurredAt)+DAY);
  const firstOrg=ordered.find(e=>e.entityType==='organization');
  // Baselines prove state only from the recorded date, never the old reference date.
  const knownFrom=firstOrg?.eventKind==='baseline'?calendarDay(firstOrg.occurredAt)+DAY:firstOrg? -Infinity:Infinity;
  const assignedAt=organizations.find(o=>o.id===organizationId)?.revenueFrom;
  const revenueFrom=assignedAt?calendarDay(assignedAt)+DAY:-Infinity;
  const previousComplete=knownFrom<=Math.max(previousStart,revenueFrom),ytdComplete=knownFrom<=Math.max(yearStart,revenueFrom);
  const state=new Map<string,BillingEvent>();
  let index=0,rate=0,previousOre=0,ytdOre=0,monthNumerator=0;
  for(let day=from;day<=today;day+=DAY){
   let changed=false;
   while(index<ordered.length&&effectiveDays[index]<=day){
    const e=ordered[index++];state.set(`${e.entityType}:${e.entityId}`,e);changed=true;
   }
   if(changed)rate=monthlyRate(state);
   // Current day is not complete yet; YTD is accrued through yesterday.
   if(day<today && day>=revenueFrom)monthNumerator+=rate;
   const date=new Date(day),next=new Date(day+DAY);
   if(next.getUTCMonth()!==date.getUTCMonth()||day===today){
    const start=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1);
    const days=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
    const amount=Math.round(monthNumerator/days);
    if(start===previousStart)previousOre=amount;
    if(start>=yearStart)ytdOre+=amount;
    monthNumerator=0;
   }
  }
  return {organizationId,organizationName,previousOre,ytdOre,previousComplete,ytdComplete};
 }).sort((a,b)=>a.organizationName.localeCompare(b.organizationName,'nb')||a.organizationId-b.organizationId);
 return {previousMonth:new Date(previousStart).toISOString().slice(0,7),year:current.getUTCFullYear(),throughDate:new Date(today-DAY).toISOString().slice(0,10),rows};
}
export function invoicePage<T extends {organizationName:string}>(rows:T[],query:string,page:number){
 const filtered=rows.filter(row=>row.organizationName.toLocaleLowerCase('nb').includes(query.trim().toLocaleLowerCase('nb')));
 const pages=Math.max(1,Math.ceil(filtered.length/10));
 const current=Math.max(0,Math.min(page,pages-1));
 return {rows:filtered.slice(current*10,current*10+10),total:filtered.length,pages,page:current};
}
