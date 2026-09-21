/** Store hundredths of a percentage point to avoid floating-point rate drift. */
export function parseCommissionPercentage(value:unknown):number {
 const text=typeof value==='number'||typeof value==='string'?String(value).trim().replace(',','.'):'';
 if(!/^\d{1,3}(?:\.\d{1,2})?$/.test(text)||Number(text)>100)throw new Error('Oppgi provisjon fra 0 til 100 prosent, med maksimalt to desimaler.');
 return Math.round(Number(text)*100);
}
