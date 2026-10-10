import {websiteLocale} from './country';
import {ACTIVE_LANGUAGE_COOKIE,publishedLanguage,storedLanguagePreference} from './preference';

/** Resolve per request, using trusted edge metadata rather than client headers. */
export function requestLanguage(request:Request,crm=false){
 const explicit=publishedLanguage(new URL(request.url).searchParams.get('lang'));
 const cookies=request.headers.get('cookie');
 const active=crm?storedLanguagePreference(cookies,ACTIVE_LANGUAGE_COOKIE):undefined;
 const country=(request as Request & {cf?:{country?:string|null}}).cf?.country;
 return {locale:explicit??active??storedLanguagePreference(cookies)??websiteLocale(country),explicit};
}
