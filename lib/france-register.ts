import {AccessError} from '@/lib/tenant';
import {franceEmployeeBands,franceEmployeeRange,franceRegions} from './france-register-options';
import type {RegisterRow} from './international-registers';

const text=(v:unknown)=>typeof v==='string'?v.trim():v==null?'':String(v);
export const FRANCE_REGISTER_SOURCE='Annuaire des Entreprises (INSEE / Sirene)';
type Establishment={siret?:string;adresse?:string;code_postal?:string;commune?:string;departement?:string;region?:string;libelle_commune?:string;libelle_commune_etranger?:string;etat_administratif?:string;statut_diffusion_etablissement?:string};
type FrenchCompany={siren?:string;nom_complet?:string;nom_raison_sociale?:string;activite_principale?:string;etat_administratif?:string;statut_diffusion?:string;tranche_effectif_salarie?:string;annee_tranche_effectif_salarie?:string;complements?:{est_entrepreneur_individuel?:boolean};siege?:Establishment;matching_etablissements?:Establishment[]};

export function normalizeFranceCompany(company:FrenchCompany,preferMatchingAddress=false,addressFilter?:(address:Establishment)=>boolean):RegisterRow|null{
  const orgNumber=text(company.siren),name=text(company.nom_complet)||text(company.nom_raison_sociale);
  if(!/^\d{9}$/.test(orgNumber)||!name||company.etat_administratif!=='A'||company.statut_diffusion&&company.statut_diffusion!=='O')return null;
  const eligibleAddress=(item:Establishment)=>item.etat_administratif==='A'&&(!item.statut_diffusion_etablissement||item.statut_diffusion_etablissement==='O')&&(!addressFilter||addressFilter(item));
  const address=preferMatchingAddress?company.matching_etablissements?.find(eligibleAddress)??(company.siege&&eligibleAddress(company.siege)?company.siege:undefined):company.siege;
  if(preferMatchingAddress&&!address)return null;
  // Employee band belongs to the legal company. Never use establishment bands
  // as company headcounts, and never turn a range into a fabricated exact value.
  return {orgNumber,name,industry:text(company.activite_principale),city:text(address?.libelle_commune)||text(address?.libelle_commune_etranger),address:text(address?.adresse),postalCode:text(address?.code_postal),siret:text(address?.siret),employees:null,employeeRange:franceEmployeeRange(company.tranche_effectif_salarie),employeeRangeYear:/^\d{4}$/.test(text(company.annee_tranche_effectif_salarie))?text(company.annee_tranche_effectif_salarie):''};
}

export function franceSearchParams(data:Record<string,unknown>){
  const count=Number(data.count??50),page=Number(data.page??1),query=text(data.query),location=text(data.location).toUpperCase(),industry=text(data.industry).toUpperCase(),region=text(data.region);
  if(!Number.isInteger(count)||count<1||count>100)throw new AccessError(400,'Velg 1–100 bedrifter.');
  if(!Number.isInteger(page)||page<1||page>400)throw new AccessError(400,'Velg en gyldig side mellom 1 og 400.');
  if(query.length>160||location.length>100||industry.length>160)throw new AccessError(400,'Søket er for langt.');
  if(data.establishedFrom||data.establishedTo)throw new AccessError(400,'Det franske registersøket støtter ikke etableringsdato.');
  if(data.minEmployees!==undefined||data.maxEmployees!==undefined)throw new AccessError(400,'Det franske registeret bruker ansattgrupper. Velg en ansattgruppe i stedet for et eksakt ansattall.');
  if(data.requirePhone||data.requireEmail)throw new AccessError(400,'Denne registerkilden tilbyr ikke filter for telefon eller e-post.');
  const bands=data.employeeBands??[];
  if(!Array.isArray(bands)||bands.length>franceEmployeeBands.length||bands.some(band=>!franceEmployeeBands.some(option=>option.value===band)))throw new AccessError(400,'Velg en gyldig ansattgruppe.');
  if(region&&!franceRegions.some(option=>option.value===region))throw new AccessError(400,'Velg en gyldig fransk region.');
  const params=new URLSearchParams({etat_administratif:'A',minimal:'true',include:'siege,matching_etablissements,complements',limite_matching_etablissements:'1'});
  const normalizedQuery=/^[\d\s]+$/.test(query)?query.replace(/\s/g,''):query;
  if(/^\d{9}(?:\d{5})?$/.test(normalizedQuery)&&(location||industry||region||bands.length))throw new AccessError(400,'Bruk enten SIREN/SIRET eller filtre. Det franske registeret ignorerer filtre ved direkte nummeroppslag.');
  if(query)params.set('q',normalizedQuery);
  if(location){
    const codes=location.split(',').map(code=>code.trim());
    if(codes.every(code=>/^\d{5}$/.test(code)))params.set('code_postal',codes.join(','));
    else if(codes.every(code=>/^(?:0[1-9]|[1-8]\d|9[0-5]|2A|2B|97[1-46])$/.test(code)))params.set('departement',codes.join(','));
    else throw new AccessError(400,'Oppgi franske departementsnumre eller postnumre, for eksempel 75 eller 75001.');
  }
  if(industry){
    const codes=industry.split(',').map(code=>code.trim());
    if(codes.every(code=>/^[A-U]$/.test(code)))params.set('section_activite_principale',codes.join(','));
    else if(codes.every(code=>/^\d{2}\.?\d{2}[A-Z]$/.test(code)))params.set('activite_principale',codes.map(code=>code.includes('.')?code:code.slice(0,2)+'.'+code.slice(2)).join(','));
    else throw new AccessError(400,'Oppgi en full NAF-kode, for eksempel 62.01Z, eller en bransjeseksjon A–U.');
  }
  if(region)params.set('region',region);
  if(bands.length)params.set('tranche_effectif_salarie',[...new Set(bands)].join(','));
  if(data.includeEnk===false)params.set('est_entrepreneur_individuel','false');
  return {count,page,params,hasLocation:!!location||!!region,bands:bands as string[],includeEnk:data.includeEnk!==false};
}

export type FranceRegisterPage={rows:RegisterRow[];nextPage:number|null;hasMore:boolean};
export async function searchFranceRegisterPage(data:Record<string,unknown>,excludedIds:ReadonlySet<string>=new Set()):Promise<FranceRegisterPage>{
  const filter=franceSearchParams(data),rows:RegisterRow[]=[],seen=new Set<string>();
  let nextPage:number|null=null,hasMore=false;
  // French API returns up to 25 legal companies per page. Keep that page size
  // constant, including the last page, to avoid overlap/skips during pagination.
  const pageSize=25;
  const addressFilter=(address:Establishment)=>{
    const postal=filter.params.get('code_postal'),department=filter.params.get('departement'),region=filter.params.get('region');
    const area=text(address.departement)||(/^97/.test(text(address.commune))?text(address.commune).slice(0,3):text(address.commune).slice(0,2))||(/^97/.test(text(address.code_postal))?text(address.code_postal).slice(0,3):text(address.code_postal).slice(0,2));
    return (!postal||postal.split(',').includes(text(address.code_postal)))&&(!department||department.split(',').includes(area))&&(!region||region===text(address.region));
  };
  for(let page=filter.page;page<Math.min(401,filter.page+8)&&rows.length<filter.count;page++){
    const url=new URL('https://recherche-entreprises.api.gouv.fr/search');
    url.search=filter.params.toString();url.searchParams.set('per_page',String(pageSize));url.searchParams.set('page',String(page));
    let response:Response;
    try{response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Noracre/1.0 (+https://noracre.no; company register search)'},signal:AbortSignal.timeout(20000)});}
    catch{throw new AccessError(502,'Fikk ikke kontakt med bedriftsregisteret. Prøv igjen senere.','REGISTER_UNAVAILABLE');}
    if(response.status===429)throw new AccessError(503,'Bedriftsregisteret har begrenset antall forespørsler. Prøv igjen senere.','REGISTER_RATE_LIMIT');
    if(!response.ok)throw new AccessError(502,`Bedriftsregisteret svarte med HTTP ${response.status}. Prøv igjen senere.`,'REGISTER_ERROR');
    let payload:{results?:FrenchCompany[];total_pages?:number};
    try{payload=await response.json();}catch{throw new AccessError(502,'Bedriftsregisteret svarte med ugyldige data. Prøv igjen senere.','REGISTER_INVALID_RESPONSE');}
    if(!Array.isArray(payload?.results))throw new AccessError(502,'Bedriftsregisteret svarte med uventet format.','REGISTER_INVALID_RESPONSE');
    let processed=0;
    for(const company of payload.results){
      processed++;
      if(!company||typeof company!=='object')continue;
      // SIREN/SIRET direct lookups ignore upstream filters; recheck legal-state,
      // disclosure and employee bands here instead of admitting wrong matches.
      if(filter.bands.length&&!filter.bands.includes(text(company.tranche_effectif_salarie)))continue;
      if(!filter.includeEnk&&company.complements?.est_entrepreneur_individuel)continue;
      const row=normalizeFranceCompany(company,filter.hasLocation,addressFilter);
      if(row&&!seen.has(row.orgNumber)&&!excludedIds.has(row.orgNumber)){seen.add(row.orgNumber);rows.push(row);if(rows.length===filter.count)break;}
    }
    const remainingOnPage=processed<payload.results.length,morePages=payload.results.length===pageSize&&(!Number.isFinite(payload.total_pages)||page<Number(payload.total_pages))&&page<400;
    hasMore=remainingOnPage||morePages;nextPage=remainingOnPage?page:morePages?page+1:null;
    if(!morePages||rows.length===filter.count)break;
  }
  return {rows,nextPage,hasMore};
}

export async function searchFranceRegister(data:Record<string,unknown>,excludedIds:ReadonlySet<string>=new Set()):Promise<RegisterRow[]>{
  return (await searchFranceRegisterPage(data,excludedIds)).rows;
}
