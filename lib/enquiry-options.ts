import type {MessageKey} from './i18n';
// Wire values are stable identifiers, independent of the visitor's language.
export const enquiryUserCounts=[
 {value:'1-5',label:'enquiry.users1to5'},{value:'6-10',label:'enquiry.users6to10'},
 {value:'11-25',label:'enquiry.users11to25'},{value:'26-plus',label:'enquiry.users26plus'},
 {value:'unsure',label:'common.unsure'}
] as const satisfies readonly {value:string;label:MessageKey}[];
