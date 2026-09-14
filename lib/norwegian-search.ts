/** Norwegian search conventions. Dates stay ISO internally; user-facing dates are Norwegian. */
export function osloToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function norwegianDate(value:string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('.') : value;
}
export function isoDate(value:string) {
  const text=value.trim();
  const match=text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  const iso=match?`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`:text;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||!Number.isFinite(Date.parse(iso))||new Date(iso).toISOString().slice(0,10)!==iso)throw Error(`«${text}» er ikke en gyldig dato. Bruk DD.MM.ÅÅÅÅ.`);
  return iso;
}
const shiftDays=(day:string,days:number)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
const shiftMonths=(day:string,months:number)=>{const d=new Date(day+'T12:00:00Z'),n=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(n,last));return d.toISOString().slice(0,10);};
export type SearchDates={establishedFrom:string;establishedTo:string};
export function norwegianSearchDates(prompt:string,today=osloToday()):SearchDates|null {
  const text=prompt.toLowerCase().replace(/[–—]/g,'-');
  const year=Number(today.slice(0,4));
  const finish=(from:string,to:string):SearchDates=>{
    if(from>today)throw Error(`Startdatoen ${norwegianDate(from)} ligger frem i tid. Hvilken tidligere periode ønsker du?`);
    if(from&&to&&from>to)throw Error('Fra-datoen må være før til-datoen.');
    return {establishedFrom:from,establishedTo:to>today?today:to};
  };
  const monthNames=['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'];
  const numericText=text.replace(new RegExp('\\b(\\d{1,2})\\.?\\s+('+monthNames.join('|')+')\\s+((?:19|20|21)\\d{2})\\b','g'),(_,d,m,y)=>`${d}.${monthNames.indexOf(m)+1}.${y}`);
  const tokens=[...numericText.matchAll(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4}|(?:19|20|21)\d{2})\b/g)];
  const relevant=tokens.filter(m=>m[0].length>4||!/^[\s-]*(?:ansatte|bedrifter|kunder|kr|kroner)\b/.test(numericText.slice(m.index!+m[0].length)));
  // Bare employee/price ranges must not turn into establishment years.
  const employeeRange=/\b(?:19|20|21)\d{2}\s*-\s*(?:19|20|21)\d{2}\s*(?:ansatte|bedrifter|kunder|kr|kroner)\b/.test(numericText);
  if(relevant.length&&!employeeRange){
    const bounds=relevant.map(m=>m[0].length===4?{from:m[0]+'-01-01',to:m[0]+'-12-31'}:{from:isoDate(m[0]),to:isoDate(m[0])});
    if(bounds.length>2)throw Error('Velg én sammenhengende etableringsperiode, for eksempel 2024–2025.');
    if(bounds.length===2){
      const middle=numericText.slice(relevant[0].index!+relevant[0][0].length,relevant[1].index);
      if(/eller/.test(middle)&&bounds[0].to.slice(0,4)!==bounds[1].from.slice(0,4)&&Number(bounds[1].from.slice(0,4))-Number(bounds[0].from.slice(0,4))!==1)throw Error('Disse årene er ikke sammenhengende. Søk på ett år om gangen, eller velg hele perioden.');
      return finish(bounds[0].from,bounds[1].to);
    }
    const before=numericText.slice(0,relevant[0].index).trim();
    if(/\b(?:før|innen|til(?: og med)?)$/.test(before))return finish('',/\bfør$/.test(before)?shiftDays(bounds[0].from,-1):bounds[0].to);
    if(/\b(?:fra|siden|etter|fra og med)$/.test(before))return finish(/\better$/.test(before)?shiftDays(bounds[0].to,1):bounds[0].from,today);
    return finish(bounds[0].from,bounds[0].to);
  }
  if(/\b(?:i fjor|fjoråret|forrige (?:år|kalenderår))\b/.test(text))return finish(`${year-1}-01-01`,`${year-1}-12-31`);
  if(/\b(?:i år|inneværende år|hittil i år|ytd)\b/.test(text))return finish(`${year}-01-01`,today);
  const duration=text.match(/\b(?:siste|seneste|sist[e]?|de siste)\s+(\d{1,4}|ett?|en|to|tre|seks|tolv)\s+(dag(?:er|ene)?|uke(?:r|ne)?|måned(?:er|ene)?|år(?:et|ene)?)\b/);
  if(duration){
    const n=Number(duration[1])||({ett:1,et:1,en:1,to:2,tre:3,seks:6,tolv:12} as Record<string,number>)[duration[1]];
    if(n>0){const unit=duration[2];return finish(unit.startsWith('måned')?shiftMonths(today,-n):unit.startsWith('år')?shiftMonths(today,-12*n):shiftDays(today,-n*(unit.startsWith('uke')?7:1)),today);}
  }
  if(/\b(?:nyetablert\w*|nyoppstart\w*|nystart\w*|nystift\w*|nyregistrert\w*|nye bedrifter|siste året|siste år|det siste året|siste 365 dager)\b/.test(text))return finish(shiftDays(today,-365),today);
  return null;
}
const regionDefinitions:[RegExp,string[]][]=[
  [/\b(?:nord[ -]?(?:norge|noreg)|nordnorske|nord[ -]?norske)\b/,['18','55','56']],
  [/\b(?:sørlandet|sørlands\w*)\b/,['42']],
  [/\b(?:vestlandet|vest[ -]?(?:norge|noreg)|vestlands\w*)\b/,['11','15','46']],
  [/\b(?:østlandet|austlandet|øst[ -]?(?:norge|noreg)|østlands\w*)\b/,['03','31','32','33','34','39','40']],
  [/\b(?:midt[ -]?(?:norge|noreg)|midtnorske)\b/,['15','50']],
  [/\b(?:sør[ -]?(?:norge|noreg)|syd[ -]?norge)\b/,['03','11','15','31','32','33','34','39','40','42','46','50']],
  [/\btrøndelag\b/,['50']],
  [/\bviken\b/,['31','32','33']],
  [/\b(?:vestfold og telemark)\b/,['39','40']],
  [/\b(?:troms og finnmark)\b/,['55','56']],
];
export function norwegianRegions(prompt:string):string[]{
  const text=prompt.toLowerCase().replace(/[–—]/g,'-');
  return [...new Set(regionDefinitions.filter(([pattern])=>new RegExp(pattern.source.replace(/^\\b/,'(?<![\\p{L}\\p{N}])').replace(/\\b$/,'(?![\\p{L}\\p{N}])'),'u').test(text)).flatMap(([,codes])=>codes.map(c=>'county:'+c)))];
}

let foreignNames:string[]|undefined;
/** Reject only concrete requirements our public company register cannot satisfy. */
export function checkSearchScope(prompt:string){
  const text=prompt.toLowerCase();
  if(/\b(?:omsetning|omsetter|årsresultat|overskudd|driftsinntekter)\b/.test(text)&&!/\b(?:uten krav (?:til|om)|uavhengig av|ikke krav (?:til|om)|ingen krav (?:til|om))\s+(?:omsetning|årsresultat|overskudd|driftsinntekter)\b/.test(text))throw Error('Omsetning og regnskapstall er ikke søkbare ennå. Beskriv heller størrelse med antall ansatte.');
  if(!foreignNames){
    const names=new Intl.DisplayNames(['nb'],{type:'region'});
    foreignNames=[];
    for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
      const code=String.fromCharCode(a,b);if(code==='NO')continue;
      const name=names.of(code);if(name&&name!==code)foreignNames.push(name.toLowerCase());
    }
    foreignNames.push('england','amerika','united states','sweden','denmark','finland');
  }
  const country=foreignNames.find(name=>new RegExp('(?:^|\\s)(?:i|på|fra)\\s+(?:hele\\s+)?'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\p{L}\\p{N}])','u').test(text));
  if(country||/\b(?:utlandet|utenfor norge|svenske bedrifter|danske bedrifter|finske bedrifter|utenlandske bedrifter)\b/.test(text))throw Error('Bedriftsregisteret dekker Norge. Velg et norsk sted eller en norsk landsdel.');
}
