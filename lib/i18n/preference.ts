import {publishedLocales,resolvePublishedLocale,type Locale} from './config';
export const LANGUAGE_COOKIE='noracre-language';
// The active CRM language is session-only; organisation defaults must not become
// a persistent manual preference for the next visit or another organisation.
export const ACTIVE_LANGUAGE_COOKIE='noracre-language-active';
export function publishedLanguage(value:unknown):Locale|undefined{
 return typeof value==='string'&&publishedLocales.includes(value as Locale)?value as Locale:undefined;
}
export function storedLanguagePreference(cookieHeader:string|null|undefined,name=LANGUAGE_COOKIE):Locale|undefined{
 const value=cookieHeader?.split(';').map(part=>part.trim()).find(part=>part.startsWith(name+'='))?.slice(name.length+1);
 return publishedLanguage(value);
}
export function readLanguagePreference(cookieHeader:string|null|undefined):Locale{
 return resolvePublishedLocale(storedLanguagePreference(cookieHeader));
}
export function languagePreferenceCookie(locale:Locale,secure:boolean):string{
 return `${LANGUAGE_COOKIE}=${resolvePublishedLocale(locale)}; Path=/; Max-Age=31536000; SameSite=Lax${secure?'; Secure':''}`;
}
export function activeLanguageCookie(locale:Locale,secure:boolean):string{
 return `${ACTIVE_LANGUAGE_COOKIE}=${resolvePublishedLocale(locale)}; Path=/; SameSite=Lax${secure?'; Secure':''}`;
}
