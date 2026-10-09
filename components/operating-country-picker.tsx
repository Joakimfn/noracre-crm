"use client";
import {registerCountries,type RegisterCountry} from '@/lib/operating-countries';
export function OperatingCountryPicker({value,onChange}:{value:RegisterCountry[];onChange:(value:RegisterCountry[])=>void}){
 return <fieldset className="country-picker"><legend>Land bedriften opererer i</legend>{registerCountries.map(c=><label key={c.code}><input type="checkbox" checked={value.includes(c.code)} onChange={e=>onChange(e.target.checked?[...value,c.code]:value.filter(v=>v!==c.code))}/>{c.name}</label>)}</fieldset>;
}
