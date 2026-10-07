"use client";
import {useI18n} from './react';
import english from './ui-en.json';
import type {Locale} from './config';
import {useCallback} from 'react';
/** Presentation only: stored statuses, roles and customer-entered content stay unchanged. */
export function translateUi(text:string|null|undefined,locale:Locale,values:Record<string,string|number|null|undefined>={}):string {
 if(typeof text!=='string')return '';
 if(locale==='nb')return text.replace(/\{(\d+)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]??''):match);
 const key=text.trim();
 const translated=Object.hasOwn(english,key)?(english as Record<string,string>)[key]:undefined;
 return (translated===undefined?text:text.replace(key,()=>translated)).replace(/\{(\d+)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]??''):match);
}
export function useUiTranslation(){const {locale}=useI18n();const ui=useCallback((text:string|null|undefined,values?:Record<string,string|number|null|undefined>)=>translateUi(text,locale,values),[locale]);return {ui};}
export function UiText({text}:{text:string}){const {ui}=useUiTranslation();return <>{ui(text)}</>;}
