export const registerCountries = [
  {code:'NO',name:'Norge',source:'Brønnøysundregistrene'},
  {code:'GB',name:'Storbritannia',source:'Companies House'},
  {code:'IE',name:'Irland',source:'Companies Registration Office'},
  {code:'AU',name:'Australia',source:'ABN Lookup'},
  {code:'NZ',name:'New Zealand',source:'NZBN'},
] as const;
export type RegisterCountry = typeof registerCountries[number]['code'];
export function parseCountries(value:unknown):RegisterCountry[]{
 if(value===undefined)return ['NO'];
 if(!Array.isArray(value)||!value.length||value.length>5||value.some(c=>!registerCountries.some(r=>r.code===c)))throw Error('Velg minst ett gyldig land.');
 return [...new Set(value)] as RegisterCountry[];
}
export function storedCountries(value:string):RegisterCountry[]{try{return parseCountries(JSON.parse(value));}catch{return ['NO'];}}
