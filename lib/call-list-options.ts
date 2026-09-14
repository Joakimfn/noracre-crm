import snapshot from './call-list-catalog.json';
type OrganizationForm = {
  kode: string;
  beskrivelse: string;
  utgaatt?: string | boolean;
};
const fallbackForms: OrganizationForm[] = [
  ["ADOS", "Administrativ enhet - offentlig sektor"],
  ["ANNA", "Annen juridisk person"],
  ["ANS", "Ansvarlig selskap med solidarisk ansvar"],
  ["AS", "Aksjeselskap"],
  ["ASA", "Allmennaksjeselskap"],
  ["BA", "Selskap med begrenset ansvar"],
  ["BBL", "Boligbyggelag"],
  ["BO", "Andre bo"],
  ["BRL", "Borettslag"],
  ["DA", "Ansvarlig selskap med delt ansvar"],
  ["ENK", "Enkeltpersonforetak"],
  ["EOFG", "Europeisk økonomisk foretaksgruppe"],
  ["ESEK", "Eierseksjonssameie"],
  ["FKF", "Fylkeskommunalt foretak"],
  ["FLI", "Forening/lag/innretning"],
  ["FYLK", "Fylkeskommune"],
  ["GFS", "Gjensidig forsikringsselskap"],
  ["IKJP", "Andre ikke-juridiske personer"],
  ["IKS", "Interkommunalt selskap"],
  ["KBO", "Konkursbo"],
  ["KF", "Kommunalt foretak"],
  ["KIRK", "Den norske kirke"],
  ["KOMM", "Kommune"],
  ["KS", "Kommandittselskap"],
  ["KTRF", "Kontorfellesskap"],
  ["NUF", "Norskregistrert utenlandsk foretak"],
  ["OPMV", "Særskilt oppdelt enhet, jf. mval. § 2-2"],
  ["ORGL", "Organisasjonsledd"],
  ["PERS", "Andre enkeltpersoner som registreres i tilknyttet register"],
  ["PK", "Pensjonskasse"],
  ["PRE", "Partrederi"],
  ["SA", "Samvirkeforetak"],
  ["SAM", "Tingsrettslig sameie"],
  ["SE", "Europeisk selskap"],
  ["SF", "Statsforetak"],
  ["SPA", "Sparebank"],
  ["STAT", "Staten"],
  ["STI", "Stiftelse"],
  ["SÆR", "Annet foretak iflg. særskilt lov"],
  ["TVAM", "Tvangsregistrert for MVA"],
  ["UTLA", "Utenlandsk enhet"],
  ["VPFO", "Verdipapirfond"],
].map(([kode, beskrivelse]) => ({ kode, beskrivelse }));

export const organizationForms = fallbackForms.map(item => ({value:item.kode,label:item.beskrivelse+' ('+item.kode+')'})).sort((a,b)=>a.label.localeCompare(b.label,'nb'));
export type CallListOptions = {counties:{value:string;label:string}[];municipalities:{value:string;label:string}[];industries:{value:string;label:string}[];organizationForms:{value:string;label:string}[]};
let cache: {date:string;options:CallListOptions}|undefined;
export async function getCallListOptions():Promise<CallListOptions>{
 const date=new Date().toISOString().slice(0,10);
 if(cache?.date===date)return cache.options;
 const results=await Promise.allSettled([104,131,6].map(async id=>{
 const response=await fetch('https://data.ssb.no/api/klass/v1/classifications/'+id+'/codesAt?date='+date+'&language=nb',{headers:{accept:'application/json'},signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error('SSB unavailable');
 const data=await response.json() as {codes:{code:string;name:string;level:string}[]};
 const items=data.codes.filter(x=>id===6?['2','5'].includes(x.level):!['99','9999'].includes(x.code)).map(x=>({value:x.code,label:x.name+(id===6?' ('+x.code+')':'')})).sort((a,b)=>a.label.localeCompare(b.label,'nb'));
 if(!items.length)throw new Error('Empty classification');return items;
 }));
 const [a,b,c]=results;
 const options={counties:a.status==='fulfilled'?a.value:snapshot.counties,municipalities:b.status==='fulfilled'?b.value:snapshot.municipalities,industries:c.status==='fulfilled'?c.value:snapshot.industries,organizationForms};
 if(results.every(r=>r.status==='fulfilled'))cache={date,options};
 return options;
}
