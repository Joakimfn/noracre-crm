
import {useUiTranslation} from '@/lib/i18n/ui';
import {teamsPhoneLink} from '@/lib/phone-link';
export function PhoneLink({phone}:{phone:string}){
 const {ui}=useUiTranslation();
 const href=teamsPhoneLink(phone);
 return href?<a className="teams-phone-link" href={href} target="_blank" rel="noopener noreferrer" title={ui("Ring via Teams — krever Teams-telefoni")} aria-label={`Ring ${phone} via Teams`}>{phone}</a>:<span>{phone||ui("Ikke oppgitt")}</span>;
}

