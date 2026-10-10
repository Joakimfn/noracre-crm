"use client";
import {createContext,useContext,useMemo,useState,useEffect,useRef,type ReactNode} from 'react';
import {createI18n,defaultI18n,DEFAULT_LOCALE,DEFAULT_TIME_ZONE,DEFAULT_CURRENCY,type Locale} from './index';
import {resolveLocale,publishedLocales,type Locale as PublishedLocale} from './config';
import {languagePreferenceCookie} from './preference';
const I18nContext=createContext({...defaultI18n,setLocale:(_locale:Locale)=>{},applyOrganizationLocale:(_locale:Locale,_id:number)=>{}});
export function I18nProvider({children,locale=DEFAULT_LOCALE,timeZone=DEFAULT_TIME_ZONE,currency=DEFAULT_CURRENCY}:{children:ReactNode;locale?:Locale;timeZone?:string;currency?:string}){
 const [selectedLocale,updateLocale]=useState(locale);
 const organizationId=useRef<number|null>(null);
 useEffect(()=>{document.documentElement.lang=selectedLocale;},[selectedLocale]);
 const value=useMemo(()=>({...createI18n(selectedLocale,{timeZone,currency}),setLocale:(next:Locale)=>{
  const safe=resolveLocale(next);
  if(organizationId.current!==null)try{localStorage.setItem("noracre-language:org:"+organizationId.current,safe);}catch{}
  document.cookie=languagePreferenceCookie(safe,location.protocol==='https:');
  updateLocale(safe);
 },applyOrganizationLocale:(next:Locale,id:number)=>{
  organizationId.current=id;
  let selected=next;
  try{const saved=localStorage.getItem("noracre-language:org:"+id);if(saved&&publishedLocales.includes(saved as PublishedLocale))selected=resolveLocale(saved);}catch{}
  const safe=resolveLocale(selected);
  // Server-rendered settings and legal pages must use the active organisation's language too.
  document.cookie=languagePreferenceCookie(safe,location.protocol==='https:');
  updateLocale(safe);
 }}),[selectedLocale,timeZone,currency]);
 return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export const useI18n=()=>useContext(I18nContext);
