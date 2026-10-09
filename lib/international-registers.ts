import {env} from 'cloudflare:workers';
import {AccessError} from '@/lib/tenant';
import {registerCountries,type RegisterCountry} from '@/lib/operating-countries';
export type RegisterRow={orgNumber:string;name:string;industry?:string;city?:string;phone?:string;email?:string;website?:string;employees?:number|null};
export const CRO_RESOURCE='3fef41bc-b8f4-4b10-8434-ce51c29b1bba';
const text=(v:unknown)=>typeof v==='string'?v.trim():v==null?'':String(v);
async function json(url:URL,headers:Record<string,string>={}){
 const r=await fetch(url,{headers:{Accept:'application/json',...headers},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new AccessError(502,`Registeret svarte med ${r.status}. Prøv igjen senere.`,'REGISTER_ERROR');
 return r.json();
}
export function internationalFilters(data:Record<string,unknown>){
 const count=Number(data.count??50),query=text(data.query),location=text(data.location),industry=text(data.industry),from=text(data.establishedFrom),to=text(data.establishedTo);
 if(!Number.isInteger(count)||count<1||count>100)throw new AccessError(400,'Velg 1–100 bedrifter.');
 if(query.length>160||location.length>100||industry.length>40)throw new AccessError(400,'Søket er for langt.');
 for(const date of [from,to])if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw new AccessError(400,'Velg en gyldig dato.');
 if(from&&to&&from>to)throw new AccessError(400,'Fra-dato må være før til-dato.');
 if(data.requirePhone||data.requireEmail)throw new AccessError(400,'Denne registerkilden tilbyr ikke filter for telefon eller e-post.');
 return {count,query,location,industry,from,to};
}
export async function searchInternationalRegister(country:Exclude<RegisterCountry,'NO'>,data:Record<string,unknown>):Promise<RegisterRow[]>{
 const f=internationalFilters(data),settings=env as unknown as Record<string,string|undefined>;
 if(country==='GB'){
 if(!settings.COMPANIES_HOUSE_API_KEY)throw new AccessError(503,'Companies House er ikke aktivert. Noracre må legge inn API-nøkkel.','REGISTER_NOT_CONFIGURED');
 const url=new URL('https://api.company-information.service.gov.uk/advanced-search/companies');
 url.searchParams.set('company_status','active');url.searchParams.set('size',String(f.count));
 for(const [key,value]of Object.entries({company_name_includes:f.query,location:f.location,sic_codes:f.industry,incorporated_from:f.from,incorporated_to:f.to}))if(value)url.searchParams.set(key,value);
 const payload=await json(url,{Authorization:`Basic ${btoa(settings.COMPANIES_HOUSE_API_KEY+':')}`});
 return (payload.items??[]).filter((r:{company_status?:string})=>r.company_status==='active').map((r:{company_number:string;company_name:string;sic_codes?:string[];registered_office_address?:{locality?:string;postal_code?:string}})=>({orgNumber:r.company_number,name:r.company_name,industry:r.sic_codes?.join(', ')??'',city:r.registered_office_address?.locality??r.registered_office_address?.postal_code??''}));
 }
 if(country==='IE'){
 // Values are quoted and SQL wildcards escaped. No user-controlled identifiers or SQL fragments.
 const quote=(v:string)=>"'"+v.replaceAll("'","''")+"'",like=(v:string)=>quote('%'+v.replaceAll('!','!!').replaceAll('%','!%').replaceAll('_','!_')+'%');
 const where=[`company_status_code IN ('1151','1051','1153')`];
 if(f.query)where.push(`company_name ILIKE ${like(f.query)} ESCAPE '!'`);
 if(f.location)where.push('('+['company_address_1','company_address_2','company_address_3','company_address_4','eircode'].map(column=>`${column} ILIKE ${like(f.location)} ESCAPE '!'`).join(' OR ')+')');
 if(f.industry){if(!/^\d{2,5}$/.test(f.industry))throw new AccessError(400,'Oppgi en NACE-kode med 2–5 sifre.');where.push(`nace_v2_code LIKE ${quote(f.industry+'%')}`);}
 if(f.from)where.push(`company_reg_date >= ${quote(f.from)}`);if(f.to)where.push(`company_reg_date < (${quote(f.to)}::date + INTERVAL '1 day')`);
 const url=new URL('https://opendata.cro.ie/api/3/action/datastore_search_sql');url.searchParams.set('sql',`SELECT company_num,company_name,nace_v2_code,company_address_3,company_address_4 FROM "${CRO_RESOURCE}" WHERE ${where.join(' AND ')} ORDER BY company_num DESC LIMIT ${f.count}`);
 const payload=await json(url);if(!payload.success)throw new AccessError(502,'CRO kunne ikke gjennomføre søket. Prøv igjen.','REGISTER_ERROR');
 return payload.result.records.map((r:Record<string,unknown>)=>({orgNumber:text(r.company_num),name:text(r.company_name),industry:text(r.nace_v2_code),city:text(r.company_address_4)||text(r.company_address_3)}));
 }
 if(country==='AU'){
 if(!settings.ABN_LOOKUP_GUID)throw new AccessError(503,'ABN Lookup er ikke aktivert. Noracre må legge inn registrert GUID.','REGISTER_NOT_CONFIGURED');
 if(!f.query)throw new AccessError(400,'Oppgi et bedriftsnavn eller søkeord for Australia.');
 if(f.industry||f.from||f.to)throw new AccessError(400,'ABN Lookup støtter ikke bransje- eller etableringsfilter i dette søket.');
 const url=new URL('https://abr.business.gov.au/json/MatchingNames.aspx');url.searchParams.set('name',f.query);url.searchParams.set('maxResults','200');url.searchParams.set('guid',settings.ABN_LOOKUP_GUID);url.searchParams.set('callback','noracre');
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new AccessError(502,'ABN Lookup kunne ikke hentes.');
 const body=(await response.text()).trim(),match=body.match(/^noracre\s*\(([\s\S]*)\)\s*;?$/);let payload;try{payload=JSON.parse(match?match[1]:body);}catch{throw new AccessError(502,'ABN Lookup svarte med ugyldige data.');}
 if(payload.Message)throw new AccessError(502,'ABN Lookup kunne ikke gjennomføre søket. Kontroller tilgangen.');
 const seen=new Set<string>();
 return (payload.Names??[]).filter((r:{Abn:string;IsCurrent:boolean;AbnStatus:string;State:string;Postcode:string})=>{if(!r.IsCurrent||!['Active','0000000001'].includes(r.AbnStatus)||seen.has(r.Abn)||f.location&&![r.State,r.Postcode].some(x=>text(x).toLowerCase()===f.location.toLowerCase()))return false;seen.add(r.Abn);return true;}).slice(0,f.count).map((r:{Abn:string;Name:string;State:string;Postcode:string})=>({orgNumber:r.Abn,name:r.Name,city:[r.State,r.Postcode].filter(Boolean).join(' ')}));
 }
 // Bulk NZBN data may not be used for direct marketing. Enabling API prospecting requires a separately approved use and credentials.
 if(!settings.NZBN_API_KEY||settings.NZBN_CALL_LISTS_APPROVED!=='true')throw new AccessError(503,'NZBN er ikke aktivert for ringelister. API-tilgang og tillatelse til denne bruken må avklares med NZBN. Du kan importere en egen liste.','REGISTER_APPROVAL_REQUIRED');
 if(!f.query)throw new AccessError(400,'Oppgi et bedriftsnavn eller søkeord for New Zealand.');
 if(f.location||f.industry||f.from||f.to)throw new AccessError(400,'NZBN-søket støtter foreløpig bedriftsnavn og antall.');
 const url=new URL('https://api.business.govt.nz/gateway/nzbn/v5/entities');url.searchParams.set('search-term',f.query);url.searchParams.set('page-size',String(f.count));url.searchParams.set('entity-status','Registered');
 const payload=await json(url,{'Ocp-Apim-Subscription-Key':settings.NZBN_API_KEY});
 return (payload.items??[]).filter((r:{entityStatusCode:string})=>r.entityStatusCode==='50').map((r:{nzbn:string;entityName:string})=>({orgNumber:r.nzbn,name:r.entityName}));
}
export function registerSource(country:RegisterCountry){return registerCountries.find(c=>c.code===country)!.source;}
