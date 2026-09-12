/** Eight-digit numbers are Norwegian; international numbers must include + or 00. */
export function teamsPhoneLink(raw:string){
 let number=raw.trim().replace(/[\s().-]/g,'');
 if(number.startsWith('00'))number='+'+number.slice(2);
 if(/^\d{8}$/.test(number))number='+47'+number;
 if(!/^\+[1-9]\d{6,14}$/.test(number))return null;
 return `https://teams.microsoft.com/l/call/0/0?users=${encodeURIComponent('4:'+number)}`;
}
