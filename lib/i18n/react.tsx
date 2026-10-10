"use client";
import {createContext,useContext,useMemo,useState,useEffect,useRef,type ReactNode} from 'react';
import {createI18n,defaultI18n,DEFAULT_LOCALE,DEFAULT_TIME_ZONE,DEFAULT_CURRENCY,type Locale} from './index';
import {resolveLocale} from './config';
import {activeLanguageCookie,languagePreferenceCookie,publishedLanguage,storedLanguagePreference} from './preference';
const I18nContext=createContext({...defaultI18n,setLocale:(_locale:Locale)=>{},applyOrganizationLocale:(_locale:Locale,_id:number)=>{}});
export function I18nProvider({children,locale=DEFAULT_LOCALE,timeZone=DEFAULT_TIME_ZONE,currency=DEFAULT_CURRENCY}:{children:ReactNode;locale?:Locale;timeZone?:string;currency?:string}){
 const [selectedLocale,updateLocale]=useState(locale);
 const organizationId=useRef<number|null>(null);
 const manualPreferences=useRef(new Map<number,Locale>());
 // An entry link or a choice on the login screen overrides old organisation
 // settings once. Later organisation switches retain their own preferences.
 const entryChoice=useRef(typeof location!=='undefined'&&location.href?publishedLanguage(new URL(location.href).searchParams.get('lang')):undefined);
 const initialPreference=useRef(typeof document!=='undefined'?storedLanguagePreference(document.cookie):undefined);
 useEffect(()=>{document.documentElement.lang=selectedLocale;},[selectedLocale]);
 const value=useMemo(()=>({...createI18n(selectedLocale,{timeZone,currency}),setLocale:(next:Locale)=>{
  const safe=resolveLocale(next);
  if(organizationId.current!==null){
   manualPreferences.current.set(organizationId.current,safe);
   try{localStorage.setItem("noracre-language:org:"+organizationId.current,safe);}catch{}
  }else entryChoice.current=safe;
  document.cookie=activeLanguageCookie(safe,location.protocol==='https:');
  document.cookie=languagePreferenceCookie(safe,location.protocol==='https:');
  // A stale entry query must not undo a subsequent manual choice on reload.
  if(typeof window!=='undefined'&&location.href){
   const url=new URL(location.href);
   if(url.searchParams.has('lang')){url.searchParams.delete('lang');window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);}
  }
  updateLocale(safe);
 },applyOrganizationLocale:(next:Locale,id:number)=>{
  const firstOrganization=organizationId.current===null;
  organizationId.current=id;
  let saved=manualPreferences.current.get(id);
  try{saved??=publishedLanguage(localStorage.getItem("noracre-language:org:"+id));}catch{}
  const manual=entryChoice.current??saved??(firstOrganization?initialPreference.current:undefined);
  const selected=manual??next;
  const safe=resolveLocale(selected);
  if(manual){manualPreferences.current.set(id,safe);try{localStorage.setItem("noracre-language:org:"+id,safe);}catch{}}
  entryChoice.current=undefined;
  // Server-rendered settings and legal pages must use the active organisation's language too.
  document.cookie=activeLanguageCookie(safe,location.protocol==='https:');
  updateLocale(safe);
 }}),[selectedLocale,timeZone,currency]);
 return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export const useI18n=()=>useContext(I18nContext);
