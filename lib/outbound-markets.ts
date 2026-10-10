import {homeCountries,parseHomeCountry} from './home-countries';
import {organizationLocale} from './i18n/country';
import type {Locale} from './i18n/config';

export type OutboundMarketDefaults={country:string;currency:string;timeZone:string;locale:Locale};
/**
 * Display/recording defaults, never exchange rates or a change to existing invoices.
 * Currency snapshot: Unicode CLDR 48 territory/currency data, reviewed 2026-10-10:
 * https://www.unicode.org/cldr/charts/48/supplemental/detailed_territory_currency_information.html
 * Time zones: IANA zone.tab. Multi-zone countries use an editable representative zone.
 * An organization or lead can override the zone; a country does not locate a recipient.
 */
const marketData:Record<string,readonly [string,string]>={
  AD: ["EUR", "Europe/Andorra"],
  AE: ["AED", "Asia/Dubai"],
  AF: ["AFN", "Asia/Kabul"],
  AG: ["XCD", "America/Antigua"],
  AI: ["XCD", "America/Anguilla"],
  AL: ["ALL", "Europe/Tirane"],
  AM: ["AMD", "Asia/Yerevan"],
  AO: ["AOA", "Africa/Luanda"],
  AQ: ["XXX", "Etc/UTC"],
  AR: ["ARS", "America/Argentina/Buenos_Aires"],
  AS: ["USD", "Pacific/Pago_Pago"],
  AT: ["EUR", "Europe/Vienna"],
  AU: ["AUD", "Australia/Sydney"],
  AW: ["AWG", "America/Aruba"],
  AX: ["EUR", "Europe/Mariehamn"],
  AZ: ["AZN", "Asia/Baku"],
  BA: ["BAM", "Europe/Sarajevo"],
  BB: ["BBD", "America/Barbados"],
  BD: ["BDT", "Asia/Dhaka"],
  BE: ["EUR", "Europe/Brussels"],
  BF: ["XOF", "Africa/Ouagadougou"],
  BG: ["EUR", "Europe/Sofia"],
  BH: ["BHD", "Asia/Bahrain"],
  BI: ["BIF", "Africa/Bujumbura"],
  BJ: ["XOF", "Africa/Porto-Novo"],
  BL: ["EUR", "America/St_Barthelemy"],
  BM: ["BMD", "Atlantic/Bermuda"],
  BN: ["BND", "Asia/Brunei"],
  BO: ["BOB", "America/La_Paz"],
  BQ: ["USD", "America/Kralendijk"],
  BR: ["BRL", "America/Sao_Paulo"],
  BS: ["BSD", "America/Nassau"],
  BT: ["BTN", "Asia/Thimphu"],
  BV: ["NOK", "Etc/UTC"],
  BW: ["BWP", "Africa/Gaborone"],
  BY: ["BYN", "Europe/Minsk"],
  BZ: ["BZD", "America/Belize"],
  CA: ["CAD", "America/Toronto"],
  CC: ["AUD", "Indian/Cocos"],
  CD: ["CDF", "Africa/Kinshasa"],
  CF: ["XAF", "Africa/Bangui"],
  CG: ["XAF", "Africa/Brazzaville"],
  CH: ["CHF", "Europe/Zurich"],
  CI: ["XOF", "Africa/Abidjan"],
  CK: ["NZD", "Pacific/Rarotonga"],
  CL: ["CLP", "America/Santiago"],
  CM: ["XAF", "Africa/Douala"],
  CN: ["CNY", "Asia/Shanghai"],
  CO: ["COP", "America/Bogota"],
  CR: ["CRC", "America/Costa_Rica"],
  CU: ["CUP", "America/Havana"],
  CV: ["CVE", "Atlantic/Cape_Verde"],
  CW: ["XCG", "America/Curacao"],
  CX: ["AUD", "Indian/Christmas"],
  CY: ["EUR", "Asia/Nicosia"],
  CZ: ["CZK", "Europe/Prague"],
  DE: ["EUR", "Europe/Berlin"],
  DJ: ["DJF", "Africa/Djibouti"],
  DK: ["DKK", "Europe/Copenhagen"],
  DM: ["XCD", "America/Dominica"],
  DO: ["DOP", "America/Santo_Domingo"],
  DZ: ["DZD", "Africa/Algiers"],
  EC: ["USD", "America/Guayaquil"],
  EE: ["EUR", "Europe/Tallinn"],
  EG: ["EGP", "Africa/Cairo"],
  EH: ["MAD", "Africa/El_Aaiun"],
  ER: ["ERN", "Africa/Asmara"],
  ES: ["EUR", "Europe/Madrid"],
  ET: ["ETB", "Africa/Addis_Ababa"],
  FI: ["EUR", "Europe/Helsinki"],
  FJ: ["FJD", "Pacific/Fiji"],
  FK: ["FKP", "Atlantic/Stanley"],
  FM: ["USD", "Pacific/Chuuk"],
  FO: ["DKK", "Atlantic/Faroe"],
  FR: ["EUR", "Europe/Paris"],
  GA: ["XAF", "Africa/Libreville"],
  GB: ["GBP", "Europe/London"],
  GD: ["XCD", "America/Grenada"],
  GE: ["GEL", "Asia/Tbilisi"],
  GF: ["EUR", "America/Cayenne"],
  GG: ["GBP", "Europe/Guernsey"],
  GH: ["GHS", "Africa/Accra"],
  GI: ["GIP", "Europe/Gibraltar"],
  GL: ["DKK", "America/Nuuk"],
  GM: ["GMD", "Africa/Banjul"],
  GN: ["GNF", "Africa/Conakry"],
  GP: ["EUR", "America/Guadeloupe"],
  GQ: ["XAF", "Africa/Malabo"],
  GR: ["EUR", "Europe/Athens"],
  GS: ["GBP", "Atlantic/South_Georgia"],
  GT: ["GTQ", "America/Guatemala"],
  GU: ["USD", "Pacific/Guam"],
  GW: ["XOF", "Africa/Bissau"],
  GY: ["GYD", "America/Guyana"],
  HK: ["HKD", "Asia/Hong_Kong"],
  HM: ["AUD", "Etc/UTC"],
  HN: ["HNL", "America/Tegucigalpa"],
  HR: ["EUR", "Europe/Zagreb"],
  HT: ["HTG", "America/Port-au-Prince"],
  HU: ["HUF", "Europe/Budapest"],
  ID: ["IDR", "Asia/Jakarta"],
  IE: ["EUR", "Europe/Dublin"],
  IL: ["ILS", "Asia/Jerusalem"],
  IM: ["GBP", "Europe/Isle_of_Man"],
  IN: ["INR", "Asia/Kolkata"],
  IO: ["USD", "Indian/Chagos"],
  IQ: ["IQD", "Asia/Baghdad"],
  IR: ["IRR", "Asia/Tehran"],
  IS: ["ISK", "Atlantic/Reykjavik"],
  IT: ["EUR", "Europe/Rome"],
  JE: ["GBP", "Europe/Jersey"],
  JM: ["JMD", "America/Jamaica"],
  JO: ["JOD", "Asia/Amman"],
  JP: ["JPY", "Asia/Tokyo"],
  KE: ["KES", "Africa/Nairobi"],
  KG: ["KGS", "Asia/Bishkek"],
  KH: ["KHR", "Asia/Phnom_Penh"],
  KI: ["AUD", "Pacific/Tarawa"],
  KM: ["KMF", "Indian/Comoro"],
  KN: ["XCD", "America/St_Kitts"],
  KP: ["KPW", "Asia/Pyongyang"],
  KR: ["KRW", "Asia/Seoul"],
  KW: ["KWD", "Asia/Kuwait"],
  KY: ["KYD", "America/Cayman"],
  KZ: ["KZT", "Asia/Almaty"],
  LA: ["LAK", "Asia/Vientiane"],
  LB: ["LBP", "Asia/Beirut"],
  LC: ["XCD", "America/St_Lucia"],
  LI: ["CHF", "Europe/Vaduz"],
  LK: ["LKR", "Asia/Colombo"],
  LR: ["LRD", "Africa/Monrovia"],
  LS: ["ZAR", "Africa/Maseru"],
  LT: ["EUR", "Europe/Vilnius"],
  LU: ["EUR", "Europe/Luxembourg"],
  LV: ["EUR", "Europe/Riga"],
  LY: ["LYD", "Africa/Tripoli"],
  MA: ["MAD", "Africa/Casablanca"],
  MC: ["EUR", "Europe/Monaco"],
  MD: ["MDL", "Europe/Chisinau"],
  ME: ["EUR", "Europe/Podgorica"],
  MF: ["EUR", "America/Marigot"],
  MG: ["MGA", "Indian/Antananarivo"],
  MH: ["USD", "Pacific/Majuro"],
  MK: ["MKD", "Europe/Skopje"],
  ML: ["XOF", "Africa/Bamako"],
  MM: ["MMK", "Asia/Yangon"],
  MN: ["MNT", "Asia/Ulaanbaatar"],
  MO: ["MOP", "Asia/Macau"],
  MP: ["USD", "Pacific/Saipan"],
  MQ: ["EUR", "America/Martinique"],
  MR: ["MRU", "Africa/Nouakchott"],
  MS: ["XCD", "America/Montserrat"],
  MT: ["EUR", "Europe/Malta"],
  MU: ["MUR", "Indian/Mauritius"],
  MV: ["MVR", "Indian/Maldives"],
  MW: ["MWK", "Africa/Blantyre"],
  MX: ["MXN", "America/Mexico_City"],
  MY: ["MYR", "Asia/Kuala_Lumpur"],
  MZ: ["MZN", "Africa/Maputo"],
  NA: ["NAD", "Africa/Windhoek"],
  NC: ["XPF", "Pacific/Noumea"],
  NE: ["XOF", "Africa/Niamey"],
  NF: ["AUD", "Pacific/Norfolk"],
  NG: ["NGN", "Africa/Lagos"],
  NI: ["NIO", "America/Managua"],
  NL: ["EUR", "Europe/Amsterdam"],
  NO: ["NOK", "Europe/Oslo"],
  NP: ["NPR", "Asia/Kathmandu"],
  NR: ["AUD", "Pacific/Nauru"],
  NU: ["NZD", "Pacific/Niue"],
  NZ: ["NZD", "Pacific/Auckland"],
  OM: ["OMR", "Asia/Muscat"],
  PA: ["PAB", "America/Panama"],
  PE: ["PEN", "America/Lima"],
  PF: ["XPF", "Pacific/Tahiti"],
  PG: ["PGK", "Pacific/Port_Moresby"],
  PH: ["PHP", "Asia/Manila"],
  PK: ["PKR", "Asia/Karachi"],
  PL: ["PLN", "Europe/Warsaw"],
  PM: ["EUR", "America/Miquelon"],
  PN: ["NZD", "Pacific/Pitcairn"],
  PR: ["USD", "America/Puerto_Rico"],
  PS: ["ILS", "Asia/Gaza"],
  PT: ["EUR", "Europe/Lisbon"],
  PW: ["USD", "Pacific/Palau"],
  PY: ["PYG", "America/Asuncion"],
  QA: ["QAR", "Asia/Qatar"],
  RE: ["EUR", "Indian/Reunion"],
  RO: ["RON", "Europe/Bucharest"],
  RS: ["RSD", "Europe/Belgrade"],
  RU: ["RUB", "Europe/Moscow"],
  RW: ["RWF", "Africa/Kigali"],
  SA: ["SAR", "Asia/Riyadh"],
  SB: ["SBD", "Pacific/Guadalcanal"],
  SC: ["SCR", "Indian/Mahe"],
  SD: ["SDG", "Africa/Khartoum"],
  SE: ["SEK", "Europe/Stockholm"],
  SG: ["SGD", "Asia/Singapore"],
  SH: ["SHP", "Atlantic/St_Helena"],
  SI: ["EUR", "Europe/Ljubljana"],
  SJ: ["NOK", "Arctic/Longyearbyen"],
  SK: ["EUR", "Europe/Bratislava"],
  SL: ["SLE", "Africa/Freetown"],
  SM: ["EUR", "Europe/San_Marino"],
  SN: ["XOF", "Africa/Dakar"],
  SO: ["SOS", "Africa/Mogadishu"],
  SR: ["SRD", "America/Paramaribo"],
  SS: ["SSP", "Africa/Juba"],
  ST: ["STN", "Africa/Sao_Tome"],
  SV: ["USD", "America/El_Salvador"],
  SX: ["XCG", "America/Lower_Princes"],
  SY: ["SYP", "Asia/Damascus"],
  SZ: ["SZL", "Africa/Mbabane"],
  TC: ["USD", "America/Grand_Turk"],
  TD: ["XAF", "Africa/Ndjamena"],
  TF: ["EUR", "Indian/Kerguelen"],
  TG: ["XOF", "Africa/Lome"],
  TH: ["THB", "Asia/Bangkok"],
  TJ: ["TJS", "Asia/Dushanbe"],
  TK: ["NZD", "Pacific/Fakaofo"],
  TL: ["USD", "Asia/Dili"],
  TM: ["TMT", "Asia/Ashgabat"],
  TN: ["TND", "Africa/Tunis"],
  TO: ["TOP", "Pacific/Tongatapu"],
  TR: ["TRY", "Europe/Istanbul"],
  TT: ["TTD", "America/Port_of_Spain"],
  TV: ["AUD", "Pacific/Funafuti"],
  TW: ["TWD", "Asia/Taipei"],
  TZ: ["TZS", "Africa/Dar_es_Salaam"],
  UA: ["UAH", "Europe/Simferopol"],
  UG: ["UGX", "Africa/Kampala"],
  UM: ["USD", "Pacific/Midway"],
  US: ["USD", "America/New_York"],
  UY: ["UYU", "America/Montevideo"],
  UZ: ["UZS", "Asia/Samarkand"],
  VA: ["EUR", "Europe/Vatican"],
  VC: ["XCD", "America/St_Vincent"],
  VE: ["VES", "America/Caracas"],
  VG: ["USD", "America/Tortola"],
  VI: ["USD", "America/St_Thomas"],
  VN: ["VND", "Asia/Ho_Chi_Minh"],
  VU: ["VUV", "Pacific/Efate"],
  WF: ["XPF", "Pacific/Wallis"],
  WS: ["WST", "Pacific/Apia"],
  YE: ["YER", "Asia/Aden"],
  YT: ["EUR", "Indian/Mayotte"],
  ZA: ["ZAR", "Africa/Johannesburg"],
  ZM: ["ZMW", "Africa/Lusaka"],
  ZW: ["ZWG", "Africa/Harare"],
};
export function marketDefaults(country:unknown='NO'):OutboundMarketDefaults{
  const code=parseHomeCountry(country),[currency,timeZone]=marketData[code];
  return {country:code,currency,timeZone,locale:organizationLocale(code)};
}

export type OutboundPlaybook={
  country:string;locale:Locale;phoneScript:string;emailSubject:string;emailBody:string;
  permissionGuidance:string;placeholders:readonly string[];
};
const placeholders=['companyName','sellerName','prospectName','contactName','topic','meetingLink'] as const;
/** Editable drafts: no automatic send, quoted price, feature promise or meeting confirmation. */
export function outboundPlaybook(country:unknown,locale?:unknown):OutboundPlaybook{
  const defaults=marketDefaults(country),requested=typeof locale==='string'?locale.split('-')[0].toLowerCase():'';
  const language:Locale=requested==='nb'||requested==='no'?'nb':requested==='fr'?'fr':requested==='en'?'en':defaults.locale;
  if(language==='nb')return {country:defaults.country,locale:language,placeholders,
    phoneScript:'Hei, det er {{sellerName}} fra {{companyName}}. Jeg ringer for å finne ut hvem som har ansvar for {{topic}} hos {{prospectName}}. Passer det med et kort spørsmål nå?',
    emailSubject:'{{topic}} hos {{prospectName}}',
    emailBody:'Hei {{contactName}},\n\nJeg heter {{sellerName}} og jobber i {{companyName}}. Jeg vil gjerne avklare om {{topic}} er relevant for dere. Er du riktig person å snakke med?\n\nHvis det er aktuelt, kan vi ta en kort prat: {{meetingLink}}\n\nGi gjerne beskjed hvis dere ikke ønsker videre kontakt.\n\nVennlig hilsen\n{{sellerName}}\n{{companyName}}',
    permissionGuidance:'Tilpass teksten til bedriftens faktiske tilbud. Kontroller kontaktgrunnlag, lokale regler og reservasjoner før kontakt. Landets standardtidssone kan avvike fra mottakerens; velg riktig tidssone.'};
  if(language==='fr')return {country:defaults.country,locale:language,placeholders,
    phoneScript:'Bonjour, je suis {{sellerName}} de {{companyName}}. Je cherche la personne responsable de {{topic}} chez {{prospectName}}. Avez-vous un instant pour une courte question ?',
    emailSubject:'{{topic}} chez {{prospectName}}',
    emailBody:'Bonjour {{contactName}},\n\nJe suis {{sellerName}} de {{companyName}}. Je souhaite savoir si {{topic}} pourrait vous intéresser. Êtes-vous la bonne personne pour en parler ?\n\nSi cela vous intéresse, vous pouvez choisir un créneau pour un bref échange : {{meetingLink}}\n\nSi vous ne souhaitez plus être contacté, indiquez-le-nous.\n\nCordialement,\n{{sellerName}}\n{{companyName}}',
    permissionGuidance:"Adaptez ce modèle à l'offre réelle de votre entreprise. Vérifiez les autorisations, les règles locales et les oppositions avant tout contact. Le fuseau proposé pour le pays peut différer de celui du destinataire."};
  const greeting=defaults.country==='NG'?'Good day':'Hello';
  return {country:defaults.country,locale:language,placeholders,
    phoneScript:greeting+", I'm {{sellerName}} from {{companyName}}. Who is responsible for {{topic}} at {{prospectName}}? Is now a convenient time for a brief question?",
    emailSubject:'{{topic}} at {{prospectName}}',
    emailBody:greeting+' {{contactName}},\n\nI am {{sellerName}} from {{companyName}}. I would like to find out whether {{topic}} is relevant to your team. Are you the right person to speak to?\n\nIf useful, you can choose a time for a short conversation: {{meetingLink}}\n\nPlease let me know if you do not want any further contact.\n\nKind regards,\n{{sellerName}}\n{{companyName}}',
    permissionGuidance:"Adapt this draft to your company's actual offer. Verify contact permissions, local rules and opt-outs before contacting anyone. A country's suggested time zone may differ from the recipient's; select the appropriate zone."};
}

export type OutboundContactHours={weekdays:number[];start:string;end:string};
export type OutboundMarketRules={
  blockedCountries:string[];blockedIndustries:string[];blockedRegions:string[];
  requireContactPermission:boolean;contactHours:OutboundContactHours|null;
};
export const defaultOutboundRules=():OutboundMarketRules=>({
  blockedCountries:[],blockedIndustries:[],blockedRegions:[],requireContactPermission:false,contactHours:null,
});
const record=(value:unknown):Record<string,unknown>|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
function terms(value:unknown,field:string,max:number):string[]{
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>max||value.some(v=>typeof v!=='string'||!v.trim()||v.trim().length>120))
    throw new RangeError('Invalid outbound rule: '+field);
  return [...new Set(value.map(v=>String(v).trim()))];
}
const validTime=(value:unknown):value is string=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
/** Reject malformed rules rather than silently dropping an administrator's restrictions. */
export function normalizeOutboundRules(value:unknown):OutboundMarketRules{
  if(value===undefined||value===null||value==='')return defaultOutboundRules();
  let parsed=value;
  if(typeof value==='string'){
    if(value.length>16000)throw new RangeError('Outbound rules are too large.');
    try{parsed=JSON.parse(value);}catch{throw new RangeError('Outbound rules must be valid JSON.');}
  }
  const obj=record(parsed);
  if(!obj)throw new RangeError('Outbound rules must be an object.');
  const countries=terms(obj.blockedCountries,'blockedCountries',249).map(v=>v.toUpperCase());
  if(countries.some(c=>!homeCountries.includes(c)))throw new RangeError('Invalid blocked country.');
  if(obj.requireContactPermission!==undefined&&typeof obj.requireContactPermission!=='boolean')
    throw new RangeError('requireContactPermission must be true or false.');
  let contactHours:OutboundContactHours|null=null;
  if(obj.contactHours!==undefined&&obj.contactHours!==null){
    const hours=record(obj.contactHours);
    if(!hours||!Array.isArray(hours.weekdays)||!hours.weekdays.length||hours.weekdays.length>7
      ||hours.weekdays.some(v=>!Number.isInteger(v)||Number(v)<1||Number(v)>7)
      ||!validTime(hours.start)||!validTime(hours.end)||hours.start===hours.end)
      throw new RangeError('Choose valid weekdays and contact hours.');
    contactHours={weekdays:[...new Set(hours.weekdays as number[])].sort((a,b)=>a-b),start:hours.start,end:hours.end};
  }
  return {blockedCountries:[...new Set(countries)],blockedIndustries:terms(obj.blockedIndustries,'blockedIndustries',50),
    blockedRegions:terms(obj.blockedRegions,'blockedRegions',50),requireContactPermission:obj.requireContactPermission===true,contactHours};
}
export type OutboundEligibilityReason='eligible'|'do_not_contact'|'country_blocked'|'industry_blocked'|'region_blocked'|'permission_required'|'outside_contact_hours'|'invalid_time_zone'|'invalid_date'|'invalid_rules'|'invalid_country';
export type OutboundEligibility={eligible:boolean;reason:OutboundEligibilityReason;localDate?:string;localTime?:string;timeZone?:string};
type OutboundEntry={
  country?:unknown;industry?:unknown;industryCode?:unknown;city?:unknown;region?:unknown;regionName?:unknown;county?:unknown;address?:unknown;
  doNotContact?:unknown;suppressed?:unknown;suppressionId?:unknown;contactPermission?:unknown;timeZone?:unknown;
  state?:{doNotContact?:unknown;contactPermission?:unknown}|null;
};
const flag=(value:unknown)=>value===true||value===1||value==='true';
const permitted=(value:unknown)=>value===true||value==='granted';
const comparable=(value:unknown)=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('en').replace(/\s+/g,' ').trim();
function matches(values:unknown[],blocked:string[]){const haystack=values.map(comparable).join(' ');return blocked.some(term=>haystack.includes(comparable(term)));}
const weekdayNumbers:Record<string,number>={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};
function localParts(instant:Date,timeZone:string){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(instant);
  const get=(name:string)=>parts.find(p=>p.type===name)?.value??'';
  return {year:get('year'),month:get('month'),day:get('day'),hour:get('hour'),minute:get('minute'),second:get('second'),weekday:weekdayNumbers[get('weekday')]};
}
/** This is configurable contact eligibility, not a certification of local legal compliance. */
export function eligibleForOutbound(entry:OutboundEntry,rulesValue:unknown,now:Date|string|number=new Date(),timeZone?:string):OutboundEligibility{
  const reject=(reason:OutboundEligibilityReason):OutboundEligibility=>({eligible:false,reason});
  if(flag(entry.doNotContact)||flag(entry.suppressed)||flag(entry.state?.doNotContact)
    ||(entry.suppressionId!==undefined&&entry.suppressionId!==null&&Number(entry.suppressionId)>0))return reject('do_not_contact');
  let rules:OutboundMarketRules;
  try{rules=normalizeOutboundRules(rulesValue);}catch{return reject('invalid_rules');}
  const country=String(entry.country??'').trim().toUpperCase();
  if(rules.blockedCountries.includes(country))return reject('country_blocked');
  if(matches([entry.industry,entry.industryCode],rules.blockedIndustries))return reject('industry_blocked');
  if(matches([entry.region,entry.regionName,entry.county,entry.city,entry.address],rules.blockedRegions))return reject('region_blocked');
  if(rules.requireContactPermission&&!permitted(entry.contactPermission)&&!permitted(entry.state?.contactPermission))return reject('permission_required');
  if(!rules.contactHours)return {eligible:true,reason:'eligible'};
  const instant=now instanceof Date?now:new Date(now);
  if(!Number.isFinite(instant.getTime()))return reject('invalid_date');
  let zone:string,parts:ReturnType<typeof localParts>;
  try{
    zone=timeZone??(typeof entry.timeZone==='string'?entry.timeZone:marketDefaults(country).timeZone);
    parts=localParts(instant,zone);
  }catch{return reject(homeCountries.includes(country)||timeZone||entry.timeZone?'invalid_time_zone':'invalid_country');}
  const current=parts.hour+':'+parts.minute,{start,end,weekdays}=rules.contactHours;
  // An overnight window belongs to the weekday on which it starts.
  const within=start<end?weekdays.includes(parts.weekday)&&current>=start&&current<end
    :(current>=start&&weekdays.includes(parts.weekday))||(current<end&&weekdays.includes(parts.weekday===1?7:parts.weekday-1));
  return {eligible:within,reason:within?'eligible':'outside_contact_hours',localDate:parts.year+'-'+parts.month+'-'+parts.day,
    localTime:current,timeZone:zone};
}

/** Values for datetime-local, explicitly interpreted in the selected organization time zone. */
export function utcToLocalDateTime(value:unknown,timeZone:string):string{
  if(!value)return '';
  const date=new Date(String(value));
  if(!Number.isFinite(date.getTime()))return '';
  try{const p=localParts(date,timeZone);return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute;}catch{return '';}
}
export function localDateTimeToUtc(value:string,timeZone:string):string{
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if(!match)throw new RangeError('Choose a valid date and time.');
  const [,y,m,d,h,min]=match,year=Number(y),month=Number(m),day=Number(d),hour=Number(h),minute=Number(min);
  if(year<2000||year>2200||month<1||month>12||day<1||day>31||hour>23||minute>59)
    throw new RangeError('Choose a valid date and time.');
  const wall=Date.UTC(year,month-1,day,hour,minute);
  if(new Date(wall).getUTCDate()!==day)throw new RangeError('Choose a valid date and time.');
  // Collect the offsets on both sides of a daylight-saving transition, then verify candidates.
  const offsets=new Set<number>();
  for(const delta of [-36,-24,-12,0,12,24,36]){
    const probe=new Date(wall+delta*3600000),p=localParts(probe,timeZone);
    offsets.add(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second))-probe.getTime());
  }
  const candidates=[...offsets].map(offset=>wall-offset).filter(ms=>utcToLocalDateTime(new Date(ms).toISOString(),timeZone)===value).sort((a,b)=>a-b);
  if(!candidates.length)throw new RangeError('This local time does not exist because the clocks change. Choose another time.');
  // A repeated autumn time selects the first occurrence consistently.
  return new Date(candidates[0]).toISOString();
}

