import {homeCountries,parseHomeCountry} from './home-countries';

export const importFields = [
 {key:'name',label:'Bedriftsnavn',aliases:['bedrift','bedriftsnavn','firmanavn','company','company name','organization','organization name','account name','kunde','name','navn','nom complet','nom raison sociale','raison sociale','denomination']},
 {key:'orgNumber',label:'Organisasjonsnummer',aliases:['organisasjonsnummer','orgnr','org nr','organization number','vat number','siren','siret','company number','registration number','org number']},
 {key:'country',label:'Land',aliases:['country','country code','land','landskode','pays','code pays']},
 {key:'externalId',label:'Kunde-ID fra tidligere system',aliases:['company id','organization id','account id','record id','kunde id','id']},
 {key:'companyReference',label:'Tilknyttet bedrift (navn, org.nr. eller kunde-ID)',aliases:['associated company','associated company id','company name','company id','organization','organization id','account name','account id','bedrift','firmanavn','siren','siret','company number','org number','organisasjonsnummer']},
 {key:'contactName',label:'Kontaktperson / fullt navn',aliases:['contact name','full name','kontaktperson','kontakt','contact','person','name','navn']},
 {key:'firstName',label:'Fornavn',aliases:['first name','firstname','fornavn']},
 {key:'lastName',label:'Etternavn',aliases:['last name','lastname','surname','etternavn']},
 {key:'contactTitle',label:'Kontaktpersonens tittel',aliases:['job title','title','stilling','tittel','position']},
 {key:'contactPhone',label:'Kontaktpersonens telefon',aliases:['mobile phone','mobile','mobil','contact phone','phone','telefon']},
 {key:'contactEmail',label:'Kontaktpersonens e-post',aliases:['contact email','email','e-post','epost','e-postadresse']},
 {key:'phone',label:'Bedriftens telefon',aliases:['company phone','business phone','telefon','phone']},
 {key:'email',label:'Bedriftens e-post',aliases:['company email','email','e-post','epost']},
 {key:'city',label:'By / sted',aliases:['city','by','sted','poststed','ville','libelle commune']},
 {key:'address',label:'Adresse',aliases:['address','adresse','registered address','street address']},
 {key:'postalCode',label:'Postnummer',aliases:['postal code','postnummer','postcode','code postal']},
 {key:'industry',label:'Bransje',aliases:['industry','bransje','activite principale','code naf','code ape']},
 {key:'employees',label:'Antall ansatte',aliases:['employees','employee count','antall ansatte','headcount']},
 {key:'employeeRange',label:'Ansattgruppe',aliases:['employee range','employee band','employeeRange','tranche effectif salarie','tranche effectifs unite legale']},
 {key:'employeeRangeYear',label:'År for ansattgruppe',aliases:['employee range year','employeeRangeYear','annee tranche effectif salarie','annee effectifs unite legale']},
 {key:'note',label:'Notater / aktivitetstekst',aliases:['note','notes','notat','notater','description','beskrivelse','kommentar','body']},
 {key:'stage',label:'Kundestatus',aliases:['stage','status','lifecycle stage','kundestatus']},
 {key:'kind',label:'Aktivitetstype',aliases:['type','kind','activity type','aktivitetstype']},
 {key:'createdAt',label:'Dato for historisk aktivitet',aliases:['created at','created date','activity date','dato','date','created_at']},
 {key:'dueAt',label:'Dato for neste oppfølging',aliases:['due date','due at','next activity date','neste oppfølging','nextactiondate','due_at']},
] as const;
export type ImportMode='customers'|'contacts'|'activities';
export type ImportRow=Partial<Record<typeof importFields[number]['key'],string>>;
export function fieldsForMode(mode:ImportMode){return importFields.filter(f=>mode==='customers'?!['companyReference','kind','createdAt'].includes(f.key):mode==='contacts'?['country','companyReference','contactName','firstName','lastName','contactTitle','contactPhone','contactEmail'].includes(f.key):['country','companyReference','note','kind','createdAt','dueAt'].includes(f.key));}
const normalize=(s:string)=>s.normalize('NFKC').replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().replace(/[_.-]/g,' ').replace(/\s+/g,' ').trim();
export function guessColumns(headers:string[],mode:ImportMode){return Object.fromEntries(fieldsForMode(mode).map(field=>[field.key,headers.findIndex(header=>field.aliases.some(alias=>!(mode==='customers'&&field.key==='contactName'&&['name','navn'].includes(alias))&&normalize(alias)===normalize(header)))]));}
export function mapImportRow(row:string[],mapping:Record<string,number>):ImportRow{return Object.fromEntries(Object.entries(mapping).filter(([,index])=>index>=0).map(([key,index])=>[key,String(row[index]??'').trim()]));}
const countryKey=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
let countriesByName:Map<string,string>|undefined;
export function parseImportCountry(value:unknown,fallback='NO'){
 const input=String(value??'').trim();if(!input)return parseHomeCountry(fallback);
 const code=input.toUpperCase();if(homeCountries.includes(code))return code;
 if(!countriesByName){
  countriesByName=new Map();
  for(const locale of ['en','nb','fr']){
   const names=new Intl.DisplayNames([locale],{type:'region'});
   for(const country of homeCountries){const name=names.of(country);if(name)countriesByName.set(countryKey(name),country);}
  }
 }
 const country=countriesByName.get(countryKey(input));
 if(!country)throw Error('Land må være en gyldig landskode eller et landnavn.');
 return country;
}
export function contactImportName(row:ImportRow){return row.contactName||[row.firstName,row.lastName].filter(Boolean).join(' ');}
export function importRowProblem(row:ImportRow,mode:ImportMode){if(mode==='customers'&&!row.name)return 'Bedriftsnavn mangler';if(mode!=='customers'&&!row.companyReference)return 'Tilknyttet bedrift mangler';if(mode==='contacts'&&!contactImportName(row))return 'Kontaktpersonens navn mangler';if(mode==='activities'&&!row.note)return 'Aktivitetstekst mangler';return '';}
export function importDate(value:string|undefined){
 if(!value)return '';
 let text=value.trim();const nb=text.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
 if(nb)text=`${nb[3]}-${nb[2]}-${nb[1]}T${nb[4]??'09'}:${nb[5]??'00'}:00`;
 if(!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(text)||!Number.isFinite(Date.parse(text)))throw Error('Bruk datoformat ÅÅÅÅ-MM-DD eller DD.MM.ÅÅÅÅ, eventuelt med klokkeslett.');
 const parts=text.slice(0,10).split('-').map(Number);const check=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));if(check.getUTCFullYear()!==parts[0]||check.getUTCMonth()!==parts[1]-1||check.getUTCDate()!==parts[2])throw Error('Datoen finnes ikke i kalenderen.');
 return text.length===10?`${text}T09:00:00`:text;
}
