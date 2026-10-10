"use client";
import {homeCountries} from '@/lib/home-countries';
import {useI18n} from '@/lib/i18n/react';
export function HomeCountryPicker({value,onChange}:{value:string;onChange:(country:string)=>void}){
 const {locale}=useI18n(),names=new Intl.DisplayNames([locale==='nb'?'nb':'en'],{type:'region'});
 const options=homeCountries.map(code=>({code,name:names.of(code)??code})).sort((a,b)=>a.name.localeCompare(b.name,locale));
 return <label className="form-field">{locale==='nb'?'Bedriftens hjemland':'Company home country'}<select aria-label={locale==='nb'?'Bedriftens hjemland':'Company home country'} value={value} onChange={e=>onChange(e.target.value)}>{options.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select><span className="form-hint">{locale==='nb'?'Hjemlandet bestemmer standardspråk. Velg salgslandene for ringelister nedenfor.':'The home country sets the default language. Choose sales countries for prospecting lists below.'}</span></label>;
}
