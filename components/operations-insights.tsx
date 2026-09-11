"use client";
import {useEffect,useState} from "react";
import {Activity,Download,RefreshCw,ChevronRight} from "lucide-react";
import {apiFetch} from "@/lib/api-client";
import {Button} from "@/components/ui/button";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import type {BillingEvent} from "@/lib/operations-report";
import {operationsReport} from "@/lib/operations-report";
const money=(n:number)=>n.toLocaleString('nb-NO',{maximumFractionDigits:0})+' kr';
const date=(s:string)=>s?new Date(s).toLocaleString('nb-NO'):"Ikke registrert";
const moduleName=(s:string)=>s==='ringelister'?'Ringelister':s==='markedsforing'?'Markedsføring':s;
function csv(name:string,rows:(string|number)[][]){const text='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
type Health={checkedAt:string;status:string;scope:string;checks:{name:string;ok:boolean;ms:number;detail:string}[]};
export function HealthStatus(){
 const [open,setOpen]=useState(false),[health,setHealth]=useState<Health|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
 async function check(){setBusy(true);setError('');try{const r=await apiFetch('/api/system-health');if(!r.ok)throw Error();setHealth(await r.json());}catch{setError('Status kunne ikke kontrolleres. CRM eller innlogging kan være utilgjengelig. Prøv igjen.');setHealth(null);}finally{setBusy(false);}}
 useEffect(()=>{check();},[]);
 const status=busy?'Kontrollerer …':error?'Ukjent':health?.status??'Ikke kontrollert';
 return <><button type="button" className={`server-health health-button ${status==='Normal'?'ok':'error'}`} onClick={()=>setOpen(true)} aria-label={`Systemstatus: ${status}. Vis detaljer`}><Activity/><span><small>Systemstatus</small><strong>{status}</strong></span><ChevronRight size={16}/></button>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Systemstatus</DialogTitle><DialogDescription>Reelle tilgjengelighetskontroller av CRM-tjenestene.</DialogDescription></DialogHeader>
 {error&&<p role="alert">{error}</p>}{health&&<><p className="form-hint">Sist kontrollert: {date(health.checkedAt)}</p><div className="health-checks">{health.checks.map(c=><div key={c.name}><div><strong>{c.name}</strong><span className={c.ok?'health-good':'health-bad'}>{c.ok?'Tilgjengelig':'Feil'} · {c.ms} ms</span></div><p>{c.detail}</p></div>)}</div><p className="form-hint">{health.scope}</p></>}
 <Button type="button" disabled={busy} onClick={check}><RefreshCw size={16}/>{busy?'Kontrollerer …':'Kontroller på nytt'}</Button></DialogContent></Dialog></>;
}
type Event=BillingEvent&{organizationName:string};
type Report=ReturnType<typeof operationsReport>&{events:Event[]};
export function OperationsInsights(){
 const [data,setData]=useState<Report|null>(null),[error,setError]=useState(''),[org,setOrg]=useState('all'),[month,setMonth]=useState('all'),[page,setPage]=useState(0);
 async function load(){setError('');try{const r=await apiFetch('/api/operations');if(!r.ok)throw Error();setData(await r.json());}catch{setError('Driftshistorikken kunne ikke hentes. Prøv igjen.');}}
 useEffect(()=>{load();},[]);
 if(error)return <section className="surface"><p role="alert">{error}</p><Button onClick={load}>Prøv igjen</Button></section>;
 if(!data)return <section className="surface"><p>Laster aktiveringshistorikk …</p></section>;
 const options=[...new Map(data.events.map(e=>[e.organizationId,e.organizationName])).entries()];
 const events=data.events.filter(e=>org==='all'||e.organizationId===Number(org));
 const report=org==='all'?data:operationsReport(events);
 const log=events.filter(e=>month==='all'||e.occurredAt.slice(0,7)===month).slice().reverse();
 const kind=(e:Event)=>e.entityType==='organization'?'Bedrift':e.entityType==='user'?'Bruker':e.entityType==='module'?'Modul':'Modultilgang for bruker';
 const description=(e:Event)=>e.entityType==='user'||e.entityType==='organization'?e.label:moduleName(e.moduleKey)+(e.entityType==='license'?` · ${data.events.find(x=>x.entityType==='user'&&x.entityId===e.membershipId)?.label??`Bruker ${e.membershipId}`}`:'');
 const action=(e:Event)=>e.eventKind==='baseline'?`Startstatus: ${e.active?'aktiv':'inaktiv'}`:e.eventKind==='deleted'?'Fjernet':e.active?'Aktivert / oppdatert':'Deaktivert';
 return <><section className="surface operations-history"><div className="surface-head"><div><p className="eyebrow">UTVIKLING OVER TID</p><h3>Månedsrapport</h3></div><Button variant="outline" onClick={()=>csv('noracre-manedsrapport.csv',[['Måned','Bedrifter','Brukere','Moduler','Modultilganger','MRR NOK','Datagrunnlag'],...report.months.map(m=>[m.month,...(m.available?[m.organizations,m.users,m.modules,m.licenses,m.mrr]:['','','','','']),m.available?(m.partial?'Delvis historikk':m.current?'Hittil denne måneden':'Månedsslutt'):'Ingen historikk'])])}><Download size={16}/>Eksporter rapport</Button></div>
 <div className="operations-report-filter"><span>Bedrift</span><Select value={org} onValueChange={v=>{setOrg(v);setPage(0);}}><SelectTrigger aria-label="Bedrift i driftsrapport"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Alle bedrifter</SelectItem>{options.map(([id,name])=><SelectItem key={id} value={String(id)}>{name}</SelectItem>)}</SelectContent></Select></div>
 <p className="form-hint">Status ved månedsslutt (UTC), og hittil i inneværende måned. MRR er beregnet månedsbeløp. Beløpene er abonnementsverdi, ikke innbetalinger. CRM: 399 kr per aktiv bruker. Moduler: registrert pris per aktiv brukertilgang. Deaktiverte bedrifter og brukere teller ikke.</p>
 <div className="operations-table-scroll"><table className="operations-report-table"><thead><tr>{['Måned','Bedrifter','Brukere','Moduler','Modultilganger','MRR'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{report.months.slice().reverse().map(m=><tr key={m.month}><th>{new Date(m.month+'-01T12:00:00Z').toLocaleDateString('nb-NO',{month:'long',year:'numeric'})}{m.current&&<small>Hittil</small>}{m.partial&&<small>Delvis historikk</small>}</th>{m.available?<><td>{m.organizations}</td><td>{m.users}</td><td>{m.modules}</td><td>{m.licenses}</td><td>{money(m.mrr)}</td></>:<td colSpan={5}>Historikk ikke registrert</td>}</tr>)}</tbody></table></div>
 <p className="form-hint">Full endringslogg fra {date(data.startedAt)}. Startstatus bygger på eksisterende registreringer; tidligere deaktiveringer og reaktiveringer kan ikke rekonstrueres sikkert.</p></section>
 <section className="surface operations-history"><div className="surface-head"><div><p className="eyebrow">FAKTURAGRUNNLAG</p><h3>Aktiveringslogg</h3></div><Button variant="outline" onClick={()=>csv('noracre-aktiveringslogg.csv',[['Registrert UTC','Bedrift','Type','Navn/modul','Hendelse','Opprinnelig dato UTC','Månedspris NOK'],...log.map(e=>[e.occurredAt,e.organizationName,kind(e),description(e),action(e),e.referenceAt,e.monthlyPrice])])}><Download size={16}/>Eksporter logg</Button></div>
 <div className="operations-report-filter"><span>Loggmåned</span><Select value={month} onValueChange={v=>{setMonth(v);setPage(0);}}><SelectTrigger aria-label="Måned i aktiveringslogg"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Alle måneder</SelectItem>{data.months.filter(m=>m.available).map(m=><SelectItem key={m.month} value={m.month}>{m.month}</SelectItem>)}</SelectContent></Select></div>
 <p className="form-hint">Bruk endringsdatoene til å avgrense fakturaperioden. Ved startstatus vises også tidligere lagret opprettelses- eller aktiveringsdato. Loggen beregner ikke delmånedsfakturering.</p>
 <div className="operations-table-scroll"><table className="operations-report-table"><thead><tr><th>Registrert</th><th>Bedrift</th><th>Bruker / modul</th><th>Hendelse</th><th>Tidligere registrert dato</th></tr></thead><tbody>{log.slice(page*20,(page+1)*20).map(e=><tr key={e.id}><td>{date(e.occurredAt)}</td><td>{e.organizationName}</td><td><strong>{description(e)}</strong><small>{kind(e)}</small></td><td>{action(e)}</td><td>{e.eventKind==='baseline'?date(e.referenceAt):'—'}</td></tr>)}</tbody></table></div>{!log.length&&<p>Ingen hendelser i utvalget.</p>}
 <div className="operations-log-pages"><span>{log.length} hendelser</span><Button variant="ghost" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Forrige</Button><Button variant="ghost" disabled={(page+1)*20>=log.length} onClick={()=>setPage(p=>p+1)}>Neste</Button></div></section></>;
}
