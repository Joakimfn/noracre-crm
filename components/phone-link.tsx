import {teamsPhoneLink} from '@/lib/phone-link';
export function PhoneLink({phone}:{phone:string}){
 const href=teamsPhoneLink(phone);
 return href?<a className="teams-phone-link" href={href} target="_blank" rel="noopener noreferrer" title="Ring via Teams — krever Teams-telefoni" aria-label={`Ring ${phone} via Teams`}>{phone}</a>:<span>{phone||'Ikke oppgitt'}</span>;
}
