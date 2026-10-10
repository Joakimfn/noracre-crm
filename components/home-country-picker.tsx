"use client";
import {homeCountries} from '@/lib/home-countries';
import {useUiTranslation,UiText} from '@/lib/i18n/ui';
import {useI18n} from '@/lib/i18n/react';
export function HomeCountryPicker({value,onChange}:{value:string;onChange:(country:string)=>void}){
 const {locale}=useI18n(),{ui}=useUiTranslation(),names=new Intl.DisplayNames([locale],{type:'region'});
 const options=homeCountries.map(code=>({code,name:names.of(code)??code})).sort((a,b)=>a.name.localeCompare(b.name,locale));
 return <label className="form-field"><UiText text="Bedriftens hjemland" /><select aria-label={ui("Bedriftens hjemland")} value={value} onChange={e=>onChange(e.target.value)}>{options.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select><span className="form-hint"><UiText text="Hjemlandet bestemmer standardspråk. Velg salgslandene for ringelister nedenfor." /></span></label>;
}
