// INSEE employee bands, as published by the official Annuaire des Entreprises.
// These are ranges, not exact or current headcounts. NN is not a numeric count.
export const franceEmployeeBands = [
  {value:'00',label:'0'}, {value:'01',label:'1–2'}, {value:'02',label:'3–5'},
  {value:'03',label:'6–9'}, {value:'11',label:'10–19'}, {value:'12',label:'20–49'},
  {value:'21',label:'50–99'}, {value:'22',label:'100–199'}, {value:'31',label:'200–249'},
  {value:'32',label:'250–499'}, {value:'41',label:'500–999'}, {value:'42',label:'1,000–1,999'},
  {value:'51',label:'2,000–4,999'}, {value:'52',label:'5,000–9,999'}, {value:'53',label:'10,000+'},
] as const;
export const franceRegions = [
  {value:'11',label:'Île-de-France'}, {value:'24',label:'Centre-Val de Loire'},
  {value:'27',label:'Bourgogne-Franche-Comté'}, {value:'28',label:'Normandie'},
  {value:'32',label:'Hauts-de-France'}, {value:'44',label:'Grand Est'},
  {value:'52',label:'Pays de la Loire'}, {value:'53',label:'Bretagne'},
  {value:'75',label:'Nouvelle-Aquitaine'}, {value:'76',label:'Occitanie'},
  {value:'84',label:'Auvergne-Rhône-Alpes'}, {value:'93',label:"Provence-Alpes-Côte d’Azur"},
  {value:'94',label:'Corse'}, {value:'01',label:'Guadeloupe'}, {value:'02',label:'Martinique'},
  {value:'03',label:'Guyane'}, {value:'04',label:'La Réunion'}, {value:'06',label:'Mayotte'},
] as const;
export const franceIndustrySections = [
  ['A','Agriculture, sylviculture et pêche'], ['B','Industries extractives'], ['C','Industrie manufacturière'],
  ['D','Électricité, gaz, vapeur et air conditionné'], ['E','Eau, assainissement et déchets'],
  ['F','Construction'], ['G','Commerce et réparation automobile'], ['H','Transports et entreposage'],
  ['I','Hébergement et restauration'], ['J','Information et communication'],
  ['K','Finance et assurance'], ['L','Immobilier'], ['M','Activités scientifiques et techniques'],
  ['N','Services administratifs et soutien'], ['O','Administration publique'], ['P','Enseignement'],
  ['Q','Santé et action sociale'], ['R','Arts, spectacles et loisirs'], ['S','Autres services'],
  ['T','Activités des ménages'], ['U','Activités extraterritoriales'],
].map(([value,label])=>({value,label:label+' ('+value+')'}));

export function franceEmployeeRange(code:unknown){
  return franceEmployeeBands.find(band=>band.value===code)?.label??'';
}
