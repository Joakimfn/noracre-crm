import {nb} from './messages/nb';
import {en} from './messages/en';
import {fr} from './messages/fr';
import {DEFAULT_LOCALE,DEFAULT_TIME_ZONE,DEFAULT_CURRENCY,locales,type Locale} from './config';
import type {Message,MessageKey,MessageValues} from './types';
export * from './config';
export type {MessageKey,Message,MessageValues} from './types';
const catalogues:Record<Locale,Record<MessageKey,Message>>={nb,en,fr};
export function createI18n(locale:Locale=DEFAULT_LOCALE,settings:{timeZone?:string;currency?:string}={}){
 const intlLocale=locales[locale].intl,timeZone=settings.timeZone??DEFAULT_TIME_ZONE,currency=settings.currency??DEFAULT_CURRENCY;
 const number=(value:number,options:Intl.NumberFormatOptions={})=>new Intl.NumberFormat(intlLocale,options).format(value);
 const t=(key:MessageKey,values:MessageValues={})=>{
  const message:Message=catalogues[locale][key]??nb[key];
  let text:string;
  if(typeof message==='string')text=message;
  else{if(typeof values.count!=='number'||!Number.isFinite(values.count))throw new Error('A finite count is required for '+key);const plural=new Intl.PluralRules(intlLocale).select(values.count);text=message[plural]??message.other;}
  return text.replace(/\{(\w+)\}/g,(_match,name:string)=>{if(!Object.hasOwn(values,name))throw new Error('Missing message value '+name+' for '+key);return typeof values[name]==='number'?number(values[name]):values[name];});
 };
 return {locale,timeZone,currency,t,number,
  money:(value:number,options:Omit<Intl.NumberFormatOptions,'style'|'currency'>={})=>number(value,{...options,style:'currency',currency}),
  date:(value:Date|number,options:Intl.DateTimeFormatOptions={})=>new Intl.DateTimeFormat(intlLocale,{...options,timeZone}).format(value),
  // Calendar dates have no time zone: do not shift a birthday or invoice date across days.
  calendarDate:(value:string,options:Intl.DateTimeFormatOptions={})=>{
   const date=new Date(value+'T12:00:00Z');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw new RangeError('Invalid calendar date');
   return new Intl.DateTimeFormat(intlLocale,{...options,timeZone:'UTC'}).format(date);
  }
 };
}
export const defaultI18n=createI18n();
