type Industry={value:string;label:string};
/** Everyday Norwegian trades, including common spelling variants. Match catalog codes, not invented companies. */
export function industryLanguage(prompt:string,industries:Industry[]){
 const text=prompt.toLowerCase().replace(/h[aå]ndt?verk/g,'håndverk');
 const groups:[RegExp,string[]][]=[
 [/(?<![\p{L}])håndverk(?!s?(?:kunst|design))/u,['43.210','43.221','43.222','43.223','43.230','43.240','43.310','43.320','43.330','43.340','43.350','43.410','43.910']],
 [/(?<![\p{L}])(?:elektriker|elektrobedrift|elinstallatør)/u,['43.210']],
 [/(?<![\p{L}])(?:rørlegg|rorlegg)/u,['43.221']],
 [/(?<![\p{L}])(?:snekker|snikkar|tømrer|tomrer|tømmermester)/u,['43.320']],
 [/(?<![\p{L}])(?:maler(?:bedrift|firma|mester|e|ne)?)(?![\p{L}])/u,['43.340']],
 [/(?<![\p{L}])(?:murer|murermester|muring)/u,['43.910']],
 [/(?<![\p{L}])(?:taktekker|blikkenslager|takarbeid)/u,['43.410']],
 ];
 return [...new Set(groups.filter(([pattern])=>pattern.test(text)).flatMap(([,codes])=>codes))].filter(code=>industries.some(i=>i.value===code));
}
