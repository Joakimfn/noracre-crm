"use client";
import {createContext,useContext,useMemo,type ReactNode} from 'react';
import {createI18n,defaultI18n,DEFAULT_LOCALE,DEFAULT_TIME_ZONE,DEFAULT_CURRENCY,type Locale} from './index';
const I18nContext=createContext(defaultI18n);
export function I18nProvider({children,locale=DEFAULT_LOCALE,timeZone=DEFAULT_TIME_ZONE,currency=DEFAULT_CURRENCY}:{children:ReactNode;locale?:Locale;timeZone?:string;currency?:string}){
 const value=useMemo(()=>createI18n(locale,{timeZone,currency}),[locale,timeZone,currency]);
 return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export const useI18n=()=>useContext(I18nContext);
