export const locales={nb:{intl:'nb-NO',direction:'ltr'},en:{intl:'en-GB',direction:'ltr'}} as const;
export type Locale=keyof typeof locales;
export const DEFAULT_LOCALE:Locale='nb';
export const DEFAULT_TIME_ZONE='Europe/Oslo';
export const DEFAULT_CURRENCY='NOK';
// Only complete, reviewed languages belong here. Do not infer language from the browser yet.
export const publishedLocales:readonly Locale[]=['nb','en'];
export function resolveLocale(value:unknown):Locale{
 if(typeof value!=='string')return DEFAULT_LOCALE;
 const language=value.trim().toLowerCase().split('-')[0];
 const canonical=language==='no'?'nb':language;
 return Object.hasOwn(locales,canonical)?canonical as Locale:DEFAULT_LOCALE;
}
export function resolvePublishedLocale(value:unknown):Locale{const locale=resolveLocale(value);return publishedLocales.includes(locale)?locale:DEFAULT_LOCALE;}
