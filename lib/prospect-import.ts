// Column names from Companies House, CRO, own spreadsheets and procurement exports.
// Never mistake a procurement award ID for a company's legal registration number.
import {franceEmployeeRange} from './france-register-options';
const canonical=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
function column(row:Record<string,unknown>,labels:string[]){
 const entries=Object.entries(row).map(([key,value])=>[canonical(key),value] as const);
 for(const label of labels){const value=entries.find(([key])=>key===canonical(label))?.[1];if(value!==undefined&&value!==null&&String(value).trim()!=='')return String(value).trim();}
 return '';
}
// Preserve leading zeros and alphanumeric prefixes (GB, AU, NZ, NG) while
// matching the same registration number across spreadsheets and stored lists.
export function normalizeRegistryId(value:unknown,country?:string){
 const id=String(value??'').replace(/\s/g,'').trim().toUpperCase();
 // France's SIREN identifies the company; a SIRET adds a five-digit
 // establishment suffix. Match imported establishments to their legal company.
 if(country==='FR'&&/^[\d.-]+$/.test(id)){
  const digits=id.replace(/[.-]/g,'');
  if(/^\d{9}(?:\d{5})?$/.test(digits))return digits.slice(0,9);
 }
 return id;
}
export type ImportedProspect={name:string;orgNumber:string;industry:string;city:string;employees:number|null;phone:string;email:string;website:string;address?:string;postalCode?:string;employeeRange?:string;employeeRangeYear?:string};
const idLabels=['orgNumber','org_number','organisasjonsnummer','siren','siret','company_number','company number','company_num','company num','registration_number','registration no','registration number','registered number','crn','rc_number','rc number','cac registration number','business registration number'];
const employeeLabels=['employees','employee_count','employee count','employees_total','employees total','number of employees','number_of_employees','average number of employees','headcount','staff_count','staff count','antall ansatte','antall_ansatte','antallansatte'];
function employees(row:Record<string,unknown>){
 const raw=column(row,employeeLabels).replace(/\s/g,'').replace(/,/g,'');
 if(!/^\d+$/.test(raw))return null;
 const n=Number(raw);return Number.isSafeInteger(n)&&n<=1_000_000?n:null;
}
export function mapProspectRows(records:Record<string,unknown>[]):ImportedProspect[]{
 return records.map(row=>{
 const address=column(row,['address','adresse','registered_address','street address']);
 const postalCode=column(row,['postalCode','postal_code','code_postal','postnummer','postcode']);
 const employeeRange=column(row,['employeeRange','employee_range'])||franceEmployeeRange(column(row,['tranche_effectif_salarie','trancheEffectifsUniteLegale']));
 const rangeYear=column(row,['employeeRangeYear','employee_range_year','annee_tranche_effectif_salarie','anneeEffectifsUniteLegale']);
 return {
  name:column(row,['company name','company_name','companyname','nom_complet','nom_raison_sociale','denomination','raison sociale','supplier name','supplier_name','supplier','supplier_name_text','business name','business_name','firmanavn','bedrift','navn','name']),
  orgNumber:normalizeRegistryId(column(row,idLabels)),
  industry:column(row,['industry','bransje','naeringskode','activite_principale','code naf','code ape','nace','sic','sector','supplier sector','supplier_sector','category','award category']),
  city:column(row,['city','libelle_commune','commune','ville','by','sted','town','locality','county','region','province','district','fylke','supplier city','supplier_city','supplier province']),
  employees:employees(row),
  phone:column(row,['phone','telefon','mobil']),
  email:column(row,['email','e-post','epost']),
  website:column(row,['website','nettside']),
  ...(address?{address}:{}),...(postalCode?{postalCode}:{}),...(employeeRange?{employeeRange}:{}),...(/^\d{4}$/.test(rangeYear)?{employeeRangeYear:rangeYear}:{}),
 };}).filter(row=>row.name);
}
export function mapHeadcountRows(records:Record<string,unknown>[]):Array<{orgNumber:string;employees:number}>{
 const seen=new Map<string,number>();
 for(const row of records){
  const id=normalizeRegistryId(column(row,idLabels)),n=employees(row);
  if(id&&id.length<=64&&n!==null)seen.set(id,n);
 }
 return [...seen].map(([orgNumber,employees])=>({orgNumber,employees}));
}
