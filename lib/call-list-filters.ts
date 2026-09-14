import {z} from 'zod';
export const callListFilterSchema=z.object({
 count:z.number().int().min(1).max(100),
 minEmployees:z.number().int().min(0).max(1000000),
 maxEmployees:z.number().int().min(0).max(1000000),
 locationCodes:z.array(z.string().regex(/^(county:\d{2}|\d{4})$/)).max(400),
 industryCodes:z.array(z.string().regex(/^\d{2}(\.\d{1,3})?$/)).max(100),
 organizationForms:z.array(z.string().regex(/^[A-ZÆØÅ0-9]{2,8}$/)).min(1).max(100),
 establishedFrom:z.string(), establishedTo:z.string(),
 requirePhone:z.boolean(), requireEmail:z.boolean(),
}).superRefine((f,ctx)=>{
 const issue=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if(f.maxEmployees<f.minEmployees)issue('Maks ansatte må være minst like stort som min. ansatte.');
 if([2,3,4].includes(f.minEmployees)||[1,2,3].includes(f.maxEmployees))issue('Registeret skjuler eksakt antall for 1–4 ansatte. Bruk 1 som nedre grense og minst 4 som øvre grense for denne gruppen.');
 for(const d of [f.establishedFrom,f.establishedTo])if(d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d))issue('Velg en gyldig etableringsdato.');
 if(f.establishedFrom&&f.establishedTo&&f.establishedFrom>f.establishedTo)issue('Etablert fra må være før etablert til.');
});
export type CallListFilters=z.infer<typeof callListFilterSchema>;
export const defaultCallListFilters:CallListFilters={count:50,minEmployees:1,maxEmployees:30,locationCodes:[],industryCodes:[],organizationForms:['AS'],establishedFrom:'',establishedTo:'',requirePhone:false,requireEmail:false};
export function parseCallListFilters(data:Record<string,unknown>){
 return callListFilterSchema.safeParse({...defaultCallListFilters,...data,
 locationCodes:data.locationCodes??(data.municipalityCode&&data.municipalityCode!=='all'?[data.municipalityCode]:[]),
 industryCodes:data.industryCodes??(data.industryCode&&data.industryCode!=='all'?[data.industryCode]:[])});
}
export function expandLocations(codes:string[],municipalities:{value:string}[]){
 const valid=new Set(municipalities.map(x=>x.value));
 const expanded=new Set<string>();
 for(const code of codes){if(code.startsWith('county:')){const matches=municipalities.filter(m=>m.value.startsWith(code.slice(7)));if(!matches.length)throw Error('Velg et gyldig fylke.');for(const m of matches)expanded.add(m.value);}else{if(!valid.has(code))throw Error('Velg et gyldig sted.');expanded.add(code);}}
 return [...expanded];
}
export function matchesCallListCompany(company:{antallAnsatte?:number|null;harRegistrertAntallAnsatte?:boolean;stiftelsesdato?:string;naeringskode1?:{kode?:string};naeringskode2?:{kode?:string};naeringskode3?:{kode?:string};forretningsadresse?:{kommunenummer?:string};postadresse?:{kommunenummer?:string}},f:CallListFilters,municipalities:string[]){
 const n=company.antallAnsatte;
 // The upstream employee query distinguishes zero employees from the hidden 1–4 group.
 const employees=n==null?(company.harRegistrertAntallAnsatte===true?f.minEmployees<=1&&f.maxEmployees>=4:f.minEmployees===0):n>=f.minEmployees&&n<=f.maxEmployees;
 const place=company.forretningsadresse?.kommunenummer;
 const date=company.stiftelsesdato??'';
 return employees&&(!municipalities.length||municipalities.includes(place??''))&&(!f.industryCodes.length||f.industryCodes.some(code=>[company.naeringskode1,company.naeringskode2,company.naeringskode3].some(x=>x?.kode?.startsWith(code))))&&(!f.establishedFrom||(!!date&&date>=f.establishedFrom))&&(!f.establishedTo||(!!date&&date<=f.establishedTo));
}
