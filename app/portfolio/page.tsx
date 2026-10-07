import type {Metadata} from 'next';
import Portfolio from './portfolio';
export const metadata:Metadata={title:'Joakim Nygård · Noracre CRM',description:'A sales leader’s hands-on CRM project: prospecting, customer context and a clear next step.',robots:{index:false,follow:false}};
export default function PortfolioPage(){return <Portfolio/>;}
