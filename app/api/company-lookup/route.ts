import {AccessError,accessResponse,requireTenant} from '@/lib/tenant';
import {registerCountries,type RegisterCountry} from '@/lib/operating-countries';
import {searchInternationalRegister,registerSource} from '@/lib/international-registers';

type BrregCompany={navn?:string;organisasjonsnummer?:string;antallAnsatte?:number;forretningsadresse?:{adresse?:string[];postnummer?:string;poststed?:string};naeringskode1?:{beskrivelse?:string};organisasjonsform?:{kode?:string};telefon?:string;mobil?:string;epostadresse?:string};
function normalize(c:BrregCompany){return{name:c.navn??'',country:'NO',orgNumber:(c.organisasjonsnummer??'').replace(/(\d{3})(\d{3})(\d{3})/,'$1 $2 $3'),address:c.forretningsadresse?.adresse?.join(', ')??'',postalCode:c.forretningsadresse?.postnummer??'',city:c.forretningsadresse?.poststed??'',industry:c.naeringskode1?.beskrivelse??'',employees:c.antallAnsatte??null,employeeRange:'',employeeRangeYear:'',phone:c.telefon??c.mobil??'',email:c.epostadresse??'',source:'Brønnøysundregistrene'}}

export async function GET(request:Request){
  try{
    await requireTenant(request);
    const params=new URL(request.url).searchParams,q=params.get('q')?.trim()??'',includeEnk=params.get('includeEnk')==='1',country=params.get('country')??'NO';
    if(!registerCountries.some(option=>option.code===country))throw new AccessError(400,'Bedriftsoppslag er ikke tilgjengelig for dette landet. Legg til bedriften manuelt.');
    if(q.length<2)return Response.json({companies:[]});
    if(q.length>160)throw new AccessError(400,'Søket er for langt.');
    if(country!=='NO'){
      const source=registerSource(country as RegisterCountry),rows=await searchInternationalRegister(country as Exclude<RegisterCountry,'NO'>,{query:q,count:25,includeEnk});
      return Response.json({companies:rows.map(row=>({...row,country,source,phone:row.phone??'',email:row.email??'',address:row.address??'',postalCode:row.postalCode??'',employees:row.employees??null,employeeRange:row.employeeRange??'',employeeRangeYear:row.employeeRangeYear??''})),source});
    }
    const digits=q.replace(/\D/g,''),byId=/^[\d\s]+$/.test(q)&&digits.length===9,url=byId?new URL(`https://data.brreg.no/enhetsregisteret/api/enheter/${digits}`):new URL('https://data.brreg.no/enhetsregisteret/api/enheter');
    if(!byId){url.searchParams.set('navn',q);url.searchParams.set('size','50');if(!includeEnk)for(const code of ['AS','ASA','NUF','ANS','DA','KS','SA'])url.searchParams.append('organisasjonsform',code);}
    const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});
    if(response.status===404)return Response.json({companies:[]});
    if(!response.ok)throw new AccessError(502,'Bedriftssøket er midlertidig utilgjengelig.','REGISTER_ERROR');
    const payload=await response.json() as BrregCompany&{_embedded?:{enheter?:BrregCompany[]}},candidates=byId?[payload]:payload._embedded?.enheter??[];
    const rows=candidates.filter(company=>company.organisasjonsnummer&&company.navn&&(includeEnk||company.organisasjonsform?.kode!=='ENK')).slice(0,50);
    return Response.json({companies:rows.map(normalize),source:'Brønnøysundregistrene'});
  }catch(error){
    if(error instanceof AccessError)return accessResponse(error);
    console.error('Company lookup failed',error);
    return Response.json({companies:[],error:'Bedriftssøket er midlertidig utilgjengelig.'},{status:502});
  }
}
