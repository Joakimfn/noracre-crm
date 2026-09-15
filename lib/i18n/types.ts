import type {nb} from './messages/nb';
export type MessageKey=keyof typeof nb;
export type Message=string|({other:string}&Partial<Record<Intl.LDMLPluralRule,string>>);
export type MessageValues=Record<string,string|number>;
