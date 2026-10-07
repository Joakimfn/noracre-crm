"use client";
import {createContext,useContext,useMemo,useState,useEffect,type ReactNode} from 'react';
import {createI18n,defaultI18n,DEFAULT_LOCALE,DEFAULT_TIME_ZONE,DEFAULT_CURRENCY,type Locale} from './index';
import {resolveLocale} from './config';
import {languagePreferenceCookie} from './preference';
const I18nContext=createContext({...defaultI18n,setLocale:(_locale:Locale)=>{}});
export function I18nProvider({children,locale=DEFAULT_LOCALE,timeZone=DEFAULT_TIME_ZONE,currency=DEFAULT_CURRENCY}:{children:ReactNode;locale?:Locale;timeZone?:string;currency?:string}){
 const [selectedLocale,updateLocale]=useState(locale);
 useEffect(()=>{document.documentElement.lang=selectedLocale;},[selectedLocale]);
 const value=useMemo(()=>({...createI18n(selectedLocale,{timeZone,currency}),setLocale:(next:Locale)=>{
  const safe=resolveLocale(next);
  document.cookie=languagePreferenceCookie(safe,location.protocol==='https:');
  updateLocale(safe);
 }}),[selectedLocale,timeZone,currency]);
 return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export const useI18n=()=>useContext(I18nContext);
