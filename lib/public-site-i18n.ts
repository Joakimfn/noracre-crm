import siteEnglish from './i18n/site-en.json';
import siteFrench from './i18n/site-fr.json';
import uiEnglish from './i18n/ui-en.json';
import uiFrench from './i18n/ui-fr.json';
import {nb} from './i18n/messages/nb';
import {en} from './i18n/messages/en';
import {fr} from './i18n/messages/fr';
import type {Locale} from './i18n/config';
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function makeCatalog(ui:Record<string,string>,site:Record<string,string>,messages:typeof en):Record<string,string>{
 const catalog:Record<string,string>={...ui,...site};
 for(const key of Object.keys(nb) as (keyof typeof nb)[]){const value=nb[key],translation=messages[key];if(typeof value==='string'&&typeof translation==='string'&&!Object.hasOwn(catalog,value))catalog[value]=translation;}
 return catalog;
}
const catalogs:Record<Exclude<Locale,'nb'>,Record<string,string>>={en:makeCatalog(uiEnglish,siteEnglish,en),fr:makeCatalog(uiFrench,siteFrench,fr)};
/** Language queries must precede fragment identifiers, including module section links. */
function localizedHref(href:string,locale:Locale,base:string):string{
 if(href==='https://crm.noracre.no'||href.startsWith('https://crm.noracre.no/')){const url=new URL(href);if(!url.searchParams.has('lang'))url.searchParams.set('lang',locale);return url.toString();}
 if(!href.startsWith(base+'/')||href.startsWith('//'))return href;
 const [withoutHash,hash]=href.split('#',2);
 const [path,query]=withoutHash.split('?',2);
 // Only public pages, not icons, stylesheets or other asset URLs.
 if(path.slice(base.length).includes('.'))return href;
 const parameters=new URLSearchParams(query||'');
 if(!parameters.has('lang'))parameters.set('lang',locale);
 return `${path}?${parameters.toString()}${hash===undefined?'':'#'+hash}`;
}
/** Only developer-authored website copy is translated. Form values and scripts are untouched. */
export function localizePublicHtml(html:string,locale:Locale,base:string):string{
 if(locale==='nb')return html.replace(/\bhref="(https:\/\/crm\.noracre\.no(?:\/[^\"]*)?)"/g,(_all,href)=>`href="${localizedHref(href,locale,base)}"`);
 const catalog=catalogs[locale];
 const escapedCatalog=Object.fromEntries(Object.entries(catalog).map(([key,value])=>[escape(key),escape(value)]));
 const translate=(value:string)=>{const key=value.trim();const translated=Object.hasOwn(catalog,key)?escape(catalog[key]):Object.hasOwn(escapedCatalog,key)?escapedCatalog[key]:undefined;return translated===undefined?value:value.replace(key,()=>translated);};
 return html.split(/(<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>|<[^>]*>)/gi).map(part=>{
  if(/^<(?:script|style)\b/i.test(part))return part;
  if(!part.startsWith('<'))return translate(part);
  return part.replace(/\b(aria-label|placeholder|title|content|alt)="([^"]*)"/g,(_all,name,value)=>`${name}="${translate(value)}"`)
   .replace(/\bhref="([^"]*)"/g,(_all,href)=>`href="${localizedHref(href,locale,base)}"`);
 }).join('');
}
export function publicClientTranslations(locale:Locale){return locale==='nb'?{}:catalogs[locale];}
