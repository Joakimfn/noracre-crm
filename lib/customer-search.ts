export type SearchCustomer = {name:string;contactName?:string;orgNumber?:string;phone?:string;email?:string;searchContacts?:{name:string;title?:string;email?:string;phone?:string}[]};
export function matchesCustomer(customer:SearchCustomer,query:string){
 const normalized=query.trim().toLocaleLowerCase('nb-NO').replace(/\s+/g,' ');
 if(!normalized)return true;
 const contacts=customer.searchContacts??[];
 const text=[customer.name,customer.contactName,customer.orgNumber,customer.email,...contacts.flatMap(c=>[c.name,c.title,c.email])].filter(Boolean).join(' ').toLocaleLowerCase('nb-NO').replace(/\s+/g,' ');
 if(text.includes(normalized))return true;
 if(!/^[+\d\s().-]+$/.test(normalized))return false;
 const digits=normalized.replace(/\D/g,'');
 return !!digits && [customer.phone,customer.orgNumber,...contacts.map(c=>c.phone)].some(value=>(value??'').replace(/\D/g,'').includes(digits));
}
