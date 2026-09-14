/** Offsets are minutes before the follow-up; at most two distinct reminders. */
export function validateReminderMinutes(value:unknown):number[]{
 if(!Array.isArray(value)||value.length>2||value.some(n=>!Number.isInteger(n)||n<1||n>43200)||new Set(value).size!==value.length)throw new Error('Velg opptil to ulike varsler, fra 1 minutt til 30 dager før.');
 return [...value].sort((a,b)=>b-a);
}
export function reminderMinutes(value?:string):number[]{
 try{return validateReminderMinutes(JSON.parse(value??'[15]'));}catch{return [15];}
}
export function activeReminder(activity:{dueAt:string;completedAt:string;reminderMinutes?:string},now:number):number|null{
 if(activity.completedAt||activity.dueAt.length<16)return null;
 const due=new Date(activity.dueAt).getTime();
 if(!Number.isFinite(due)||now>=due)return null;
 const offsets=reminderMinutes(activity.reminderMinutes);
 for(let i=0;i<offsets.length;i++)if(now>=due-offsets[i]*60000&&now<due-(offsets[i+1]??0)*60000)return offsets[i];
 return null;
}
export function reminderIsDue(activity:{dueAt:string;completedAt:string;reminderMinutes?:string},now:number){return activeReminder(activity,now)!==null;}
