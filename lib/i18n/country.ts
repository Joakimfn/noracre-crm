import {locales,publishedLocales,type Locale} from './config';
// Extend this mapping when a complete translation is published.
const countryLanguages:Record<string,string>={NO:'nb',FR:'fr',BE:'fr',DE:'de',ES:'es',IT:'it',PT:'pt',BR:'pt'};
export function organizationLocale(country:unknown):Locale{
 const candidate=countryLanguages[String(country??'').toUpperCase()]??'en';
 return Object.hasOwn(locales,candidate)&&publishedLocales.includes(candidate as Locale)?candidate as Locale:'en';
}
export function websiteLocale(country:unknown):Locale{return ['NO','SE','DK'].includes(String(country??'').toUpperCase())?'nb':organizationLocale(country);}
