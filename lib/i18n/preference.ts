import {resolvePublishedLocale,type Locale} from './config';
export const LANGUAGE_COOKIE='noracre-language';
export function readLanguagePreference(cookieHeader:string|null|undefined):Locale{
 const value=cookieHeader?.split(';').map(part=>part.trim()).find(part=>part.startsWith(LANGUAGE_COOKIE+'='))?.slice(LANGUAGE_COOKIE.length+1);
 return resolvePublishedLocale(value);
}
export function languagePreferenceCookie(locale:Locale,secure:boolean):string{
 return `${LANGUAGE_COOKIE}=${resolvePublishedLocale(locale)}; Path=/; Max-Age=31536000; SameSite=Lax${secure?'; Secure':''}`;
}
