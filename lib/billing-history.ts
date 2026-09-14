import type {BillingEvent} from './operations-report';
const moduleName=(key:string)=>({ringelister:'Ringelister',markedsforing:'Markedsføring'}[key]??key);
export function billingHistory(events:BillingEvent[],organizationId:number){
 const ordered=events.filter(e=>e.organizationId===organizationId).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)||a.id-b.id);
 const users=new Map(ordered.filter(e=>e.entityType==='user').map(e=>[e.membershipId||e.entityId,e.label]));
 const previous=new Map<string,BillingEvent>();
 return ordered.map(e=>{const key=e.entityType+':'+e.entityId,old=previous.get(key);previous.set(key,e);
 const action=e.eventKind==='baseline'?'Registrert startstatus':e.eventKind==='deleted'?'Slettet':old&&e.active===old.active&&e.monthlyPrice!==old.monthlyPrice?'Pris endret':e.active?'Aktivert':'Deaktivert';
 const item=e.entityType==='license'?moduleName(e.moduleKey)+' · '+(users.get(e.membershipId)??'Bruker '+e.membershipId):e.entityType==='module'?moduleName(e.moduleKey):e.label;
 return {...e,action,item,category:({user:'CRM-bruker',license:'Modultilgang',module:'Modul',organization:'Bedrift'}[e.entityType]??e.entityType),previousPrice:old?.monthlyPrice};
 }).reverse();
}
