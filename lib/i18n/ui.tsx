"use client";
import {useI18n} from './react';
import english from './ui-en.json';
import french from './ui-fr.json';
import type {Locale} from './config';
import {useCallback} from 'react';
/** Presentation only: stored statuses, roles and customer-entered content stay unchanged. */
export function translateUi(text:string|null|undefined,locale:Locale,values:Record<string,string|number|null|undefined>={}):string {
 if(typeof text!=='string')return '';
 if(locale==='nb')return text.replace(/\{(\d+)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]??''):match);
 const key=text.trim();
 const catalogue=locale==='fr'?french:english;
 let translated=Object.hasOwn(catalogue,key)?(catalogue as Record<string,string>)[key]:undefined;
 // This provider-owned error has a variable HTTP status. Preserve arbitrary customer text.
 const registerError=translated===undefined?/^Bedriftsregisteret svarte med HTTP (\d{3})\. Prøv igjen senere\.$/.exec(key):null;
 if(registerError){
  const template='Bedriftsregisteret svarte med HTTP {0}. Prøv igjen senere.';
  translated=(catalogue as Record<string,string>)[template];
  values={...values,'0':registerError[1]};
 }
 // Import errors include a row number; only translate known system messages,
 // preserving arbitrary names, values and other customer-authored text.
 const rowError=translated===undefined?/^Rad (\d+): (.+)$/.exec(key):null;
 if(rowError){
  const detail=rowError[2],withoutPeriod=detail.replace(/\.$/,'');
  const fieldError=/^feltet (.+) er for langt\.$/.exec(detail);
  if(fieldError&&Object.hasOwn(catalogue,fieldError[1])){
   translated=(catalogue as Record<string,string>)['Rad {0}: feltet {1} er for langt.'];
   values={...values,'0':rowError[1],'1':(catalogue as Record<string,string>)[fieldError[1]]};
  }else if(Object.hasOwn(catalogue,detail)||Object.hasOwn(catalogue,withoutPeriod)){
   translated=(catalogue as Record<string,string>)['Rad {0}: {1}'];
   const inner=Object.hasOwn(catalogue,detail)?(catalogue as Record<string,string>)[detail]:(catalogue as Record<string,string>)[withoutPeriod]+'.';
   values={...values,'0':rowError[1],'1':inner};
  }
 }
 const invalidRow=translated===undefined?/^Rad (\d+) er ugyldig\.$/.exec(key):null;
 if(invalidRow){translated=(catalogue as Record<string,string>)['Rad {0} er ugyldig.'];values={...values,'0':invalidRow[1]};}
 return (translated===undefined?text:text.replace(key,()=>translated)).replace(/\{(\d+)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]??''):match);
}
export function useUiTranslation(){const {locale}=useI18n();const ui=useCallback((text:string|null|undefined,values?:Record<string,string|number|null|undefined>)=>translateUi(text,locale,values),[locale]);return {ui};}
export function UiText({text}:{text:string}){const {ui}=useUiTranslation();return <>{ui(text)}</>;}
