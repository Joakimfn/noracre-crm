export function paymentAmountOre(value:unknown){
 const text=typeof value==='string'||typeof value==='number'?String(value).trim().replace(/\s/g,'').replace(',','.'):'';
 if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw Error('Oppgi et gyldig beløp med maksimalt to desimaler.');
 const amount=Math.round(Number(text)*100);if(!Number.isSafeInteger(amount)||amount<=0||amount>1_000_000_000)throw Error('Beløpet må være større enn 0 og maksimalt 10 000 000 kr.');return amount;
}
export function norwegianToday(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function validatePaidOn(value:unknown,now=new Date()){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Oppgi datoen betalingen ble mottatt.');
 const parsed=new Date(value+'T12:00:00Z');if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value||value>norwegianToday(now))throw Error('Betalingsdatoen må være gyldig og kan ikke være i fremtiden.');return value;
}
export function paymentCommission(amountOre:number,basisPoints:number){return Math.round(amountOre*basisPoints/10000);}
export type CommissionPayment={id:number;companyName:string;reference:string;paidOn:string;amountOre:number;basisPoints:number;commissionOre:number;voidedAt:string};
export function paymentCommissionReport(payments:CommissionPayment[],now=new Date()){
 const today=norwegianToday(now),[year,month]=today.split('-').map(Number),previousMonth=new Date(Date.UTC(year,month-2,1)).toISOString().slice(0,7);
 const groups=new Map<string,CommissionPayment[]>([[previousMonth,[]],[today.slice(0,7),[]]]);
 for(const p of payments){if(p.voidedAt)continue;const key=p.paidOn.slice(0,7);if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(p);}
 return {previousMonth,months:[...groups].sort(([a],[b])=>b.localeCompare(a)).map(([month,entries])=>({month,closed:month<today.slice(0,7),amountOre:entries.reduce((s,p)=>s+p.amountOre,0),commissionOre:entries.reduce((s,p)=>s+p.commissionOre,0),entries:entries.sort((a,b)=>b.paidOn.localeCompare(a.paidOn)||b.id-a.id).map(({id,companyName,reference,paidOn,amountOre,basisPoints,commissionOre})=>({id,companyName,reference,paidOn,amountOre,basisPoints,commissionOre}))}))};
}

export type PartnerCustomer={id:number;name:string;active:boolean;assignedAt:string};
/** Every displayed amount comes from the same received-payment ledger. */
export function partnerCommissionOverview(customers:PartnerCustomer[],payments:(CommissionPayment&{organizationId:number})[],now=new Date()){
 const today=norwegianToday(now),year=Number(today.slice(0,4)),commission=paymentCommissionReport(payments,now);
 const rows=new Map(customers.map(c=>[c.id,{...c,historical:false,currentOre:0,previousOre:0,ytdOre:0}]));
 for(const p of payments){
  if(p.voidedAt)continue;
  if(!rows.has(p.organizationId))rows.set(p.organizationId,{id:p.organizationId,name:p.companyName,active:false,assignedAt:'',historical:true,currentOre:0,previousOre:0,ytdOre:0});
  const row=rows.get(p.organizationId)!;
  if(p.paidOn.slice(0,7)===today.slice(0,7))row.currentOre+=p.commissionOre;
  if(p.paidOn.slice(0,7)===commission.previousMonth)row.previousOre+=p.commissionOre;
  if(p.paidOn.slice(0,4)===String(year)&&p.paidOn<=today)row.ytdOre+=p.commissionOre;
 }
 return {commission,rows:[...rows.values()].sort((a,b)=>a.name.localeCompare(b.name,'nb')),year,previousMonth:commission.previousMonth,throughDate:today};
}
