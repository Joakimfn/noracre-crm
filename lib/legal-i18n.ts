import french from './i18n/legal-fr.json';
import type {Locale} from './i18n/config';
/** Static legal and product notices only. Never use for customer-authored content. */
export function translateLegal(text:string,locale:Locale):string{
 if(locale!=='fr')return text;
 const key=text.trim().replace(/\s+/g,' ');
 if(!Object.hasOwn(french,key))return text;
 return text.replace(/\S[\s\S]*\S|\S/,()=>(french as Record<string,string>)[key]);
}
