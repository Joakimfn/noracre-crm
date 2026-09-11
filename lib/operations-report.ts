export interface BillingEvent {id:number;organizationId:number;entityType:string;entityId:number;membershipId:number;moduleKey:string;label:string;active:boolean;monthlyPrice:number;eventKind:string;occurredAt:string;referenceAt:string}
export function operationsReport(events:BillingEvent[],now=new Date()){
 const ordered=[...events].sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)||a.id-b.id);
 const startedAt=ordered[0]?.occurredAt??now.toISOString();
 const months=[];
 for(let offset=11;offset>=0;offset--){
  const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-offset,1));
  const end=new Date(Math.min(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,1)-1,now.getTime()));
  const state=new Map<string,BillingEvent>();
  for(const e of ordered){if(e.occurredAt>end.toISOString())break;state.set(`${e.entityType}:${e.entityId}`,e);}
  const values=[...state.values()],orgs=new Set(values.filter(e=>e.entityType==='organization'&&e.active).map(e=>e.organizationId));
  const users=values.filter(e=>e.entityType==='user'&&e.active&&orgs.has(e.organizationId));
  const members=new Set(users.map(e=>`${e.organizationId}:${e.entityId}`));
  const modules=values.filter(e=>e.entityType==='module'&&e.active&&orgs.has(e.organizationId));
  const enabled=new Set(modules.map(e=>`${e.organizationId}:${e.moduleKey}`));
  const licenses=values.filter(e=>e.entityType==='license'&&e.active&&members.has(`${e.organizationId}:${e.membershipId}`)&&enabled.has(`${e.organizationId}:${e.moduleKey}`));
  const mrr=users.reduce((s,e)=>s+e.monthlyPrice,0)+licenses.reduce((s,e)=>s+e.monthlyPrice,0);
  months.push({month:start.toISOString().slice(0,7),available:end.toISOString()>=startedAt,partial:start.toISOString()<startedAt&&end.toISOString()>=startedAt,current:offset===0,organizations:orgs.size,users:users.length,modules:modules.length,licenses:licenses.length,mrr});
 }
 return {startedAt,months};
}
