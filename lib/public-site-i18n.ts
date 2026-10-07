import siteEnglish from './i18n/site-en.json';
import uiEnglish from './i18n/ui-en.json';
import {nb} from './i18n/messages/nb';
import {en} from './i18n/messages/en';
import type {Locale} from './i18n/config';
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const catalog:Record<string,string>={...uiEnglish,...siteEnglish};
for(const key of Object.keys(nb) as (keyof typeof nb)[]){const value=nb[key],translation=en[key];if(typeof value==='string'&&typeof translation==='string')catalog[value]=translation;}
const escapedCatalog=Object.fromEntries(Object.entries(catalog).map(([key,value])=>[escape(key),escape(value)]));
/** Only developer-authored website copy is translated. URLs, form values and scripts are untouched. */
export function localizePublicHtml(html:string,locale:Locale,base:string):string{
 if(locale==='nb')return html;
 const translate=(value:string)=>{const key=value.trim();const translated=Object.hasOwn(catalog,key)?escape(catalog[key]):Object.hasOwn(escapedCatalog,key)?escapedCatalog[key]:undefined;return translated===undefined?value:value.replace(key,()=>translated);};
 return html.split(/(<[^>]*>)/g).map(part=>{
  if(!part.startsWith('<'))return translate(part);
  return part.replace(/\b(aria-label|placeholder|title|content|alt)="([^"]*)"/g,(_all,name,value)=>`${name}="${translate(value)}"`)
   .replace(/\bhref="([^"]*)"/g,(all,href)=>href.startsWith(base+'/')&&!href.startsWith('//')&&!href.includes('?')?`href="${href}?lang=en"`:all);
 }).join('');
}
export function publicClientTranslations(locale:Locale){return locale==='en'?catalog:{};}
