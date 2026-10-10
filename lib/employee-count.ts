/** Match a known exact headcount or a published range, without inventing an exact count. */
export function matchesEmployeeCount(entry:{employees?:number|null;employeeRange?:string},minimum:string,maximum:string,includeUnknown=false):boolean{
 if(minimum===''&&maximum==='')return true;
 const lower=minimum===''?0:Number(minimum),upper=maximum===''?Infinity:Number(maximum);
 if(!Number.isFinite(lower)||Number.isNaN(upper)||lower<0||upper<lower)return false;
 if(entry.employees!=null)return Number.isFinite(entry.employees)&&entry.employees>=lower&&entry.employees<=upper;
 const range=entry.employeeRange?.replace(/[,\s\u202f]/g,'').match(/^(\d+)(?:[–-](\d+)|(\+))?$/);
 if(!range)return includeUnknown;
 const rangeLower=Number(range[1]),rangeUpper=range[3]?Infinity:Number(range[2]??range[1]);
 return rangeUpper>=lower&&rangeLower<=upper;
}
export function employeeRangeText(range:string,number:(value:number)=>string):string{
 const match=range.replace(/[,\s\u202f]/g,'').match(/^(\d+)(?:([–-])(\d+)|(\+))?$/);
 if(!match)return range;
 return number(Number(match[1]))+(match[3]?'–'+number(Number(match[3])):match[4]??'');
}
