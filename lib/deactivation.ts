import {AccessError} from "@/lib/tenant";
export function disableAt(value:unknown){
 if(value===undefined||value===null||value==="")return "";
 const date=new Date(String(value));
 if(!Number.isFinite(date.getTime())||date.getTime()<=Date.now())throw new AccessError(400,"Velg et tidspunkt frem i tid, eller velg Nå.");
 return date.toISOString();
}
