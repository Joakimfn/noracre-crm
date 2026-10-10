"use client";
import {UiText} from '@/lib/i18n/ui';
import {useI18n} from '@/lib/i18n/react';
import {registerCountries,type RegisterCountry} from '@/lib/operating-countries';
export function OperatingCountryPicker({value,onChange}:{value:RegisterCountry[];onChange:(value:RegisterCountry[])=>void}){
 const {locale}=useI18n(),names=new Intl.DisplayNames([locale],{type:"region"});
 return <fieldset className="country-picker"><legend><UiText text="Land bedriften opererer i" /></legend>{registerCountries.map(c=><label key={c.code}><input type="checkbox" checked={value.includes(c.code)} onChange={e=>onChange(e.target.checked?[...value,c.code]:value.filter(v=>v!==c.code))}/>{names.of(c.code)??c.name}</label>)}</fieldset>;
}
