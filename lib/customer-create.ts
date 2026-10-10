type Request=(url:string,init:RequestInit)=>Promise<Response>;
/** Only return a customer once the API has confirmed a real persisted record. */
export async function createConfirmedCustomer<T extends {name:string;id:number}>(request:Request,draft:T):Promise<T>{
 const response=await request('/api/companies',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(draft)}).catch(()=>{throw new Error('Kunne ikke legge til kunden');});
 const raw:unknown=await response.json().catch(()=>null);
 const payload=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 if(!response.ok)throw new Error(typeof payload.error==='string'?payload.error:'Kunne ikke legge til kunden');
 const company=payload.company&&typeof payload.company==='object'?payload.company as Record<string,unknown>:{};
 if(!Number.isSafeInteger(company.id)||Number(company.id)<=0||typeof company.name!=='string')throw new Error('Kunne ikke legge til kunden');
 return {...draft,...company} as T;
}
