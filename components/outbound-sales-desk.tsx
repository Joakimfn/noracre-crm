"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {Phone,ArrowRight,ArrowLeft,BarChart3,CalendarClock,Users,Target,Settings,Search,CheckCircle,ExternalLink,ShieldAlert,RefreshCw} from "lucide-react";
import {toast} from "sonner";
import {useCrmApi} from "@/lib/crm-api";
import {useI18n} from "@/lib/i18n/react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import "./outbound-sales-desk.css";

type Config={enabled:boolean;currency:string;timezone:string;commissionBps:number;pitch:string};
type Lead={id:number;name:string;country:string;orgNumber:string;city:string;industry:string;employees:number|null;employeeRange:string;phone:string;website:string;email:string;status:string;assignedMembershipId:number;suppressed:boolean;state:{assignedMembershipId:number;attempts:number;pipeline:string;nextCallAt:string;lastOutcome:string;lastNote:string;contactName:string;contactPhone:string;doNotContact:boolean}|null};
type Deal={id:number;entryId:number;pipeline:string;membershipId:number;monthlyAmountMinor:number;currency:string;commissionBps:number;note:string};
type Payment={id:number;entryId:number;membershipId:number;paidAmountMinor:number;currency:string;commissionBps:number;paymentReference:string};
type ResponseData={settings:Config;rows:Lead[];hasMore:boolean;metrics:{attempts:number;uniqueCalled:number;conversations:number;meetings:number;conversationRate:number;stages:Record<string,number>}|null;deals:Deal[];payments:Payment[];byMember?:{membershipId:number;name:string;attempts:number;conversations:number;meetings:number;won:number;commissionsByCurrency:Record<string,number>}[];members:{id:number;name:string;active:boolean}[];canManage:boolean;error?:string};
const defaults:Config={enabled:false,currency:"NOK",timezone:"Europe/Oslo",commissionBps:0,pitch:""};
const outcomes=["Ikke svar","Sentralbord","Feil nummer","Beslutningstaker kontaktet","Interessert","Ikke interessert","Møte booket","Reservert mot kontakt"];
const stages=["Prospekt","Demo booket","Demo gjennomført","Prøveperiode","Tilbud","Kunde","Tapt"];
const languages={
 nb:{desk:"Outbound-salg",standard:"Vanlig ringeliste",start:"Aktiver outbound-arbeidsflate",enable:"Bedriften driver med outbound sales",pitch:"Salgsmanus",dial:"Ringemodus",pipeline:"Pipeline",report:"Resultater",setup:"Innstillinger",calls:"Ringeforsøk",talk:"Samtaler med beslutningstaker",meetings:"Møter booket",rate:"Samtaleandel",next:"Neste bedrift",back:"Forrige",save:"Lagre",cancel:"Avbryt",noLeads:"Ingen tilgjengelige bedrifter. Opprett eller importer ringelister først.",search:"Søk etter bedrift, bransje eller sted",scheduled:"Tilbakeringing",outcome:"Samtaleresultat",note:"Samtalenotat",contact:"Kontaktperson",number:"Telefon til beslutningstaker",google:"Finn kontakt på Google",again:"Neste kontakt",action:"Registrer samtalen",owner:"Tildelt selger",assigned:"Tildel lead",all:"Alle selgere",pending:"Ingen planlagt dato",done:"Reservert mot kontakt",paid:"Bekreftet innbetalt",income:"Avtalt MRR",commission:"Opptjent provisjonsgrunnlag",payment:"Registrer bekreftet betaling",ref:"Faktura-/betalingsreferanse",verified:"Jeg har kontrollert at betalingen er mottatt",view:"Se lead",showAll:"Vis også fremtidige oppfølginger",empty:"Ingen matchende leads",more:"Hent flere",week:"Siste 7 dager",saveStage:"Lagre salgsfase",currency:"Valuta",timezone:"Tidssone",commissionRate:"Provisjon (%)",saveSettings:"Lagre oppsett",info:"Beløp registreres manuelt. Kun bekreftede betalinger gir provisjonsgrunnlag.",intro:"Én bedrift om gangen. Logg resultatet og velg neste oppfølging.",settingsHelp:"Denne visningen er frivillig for hver kundeorganisasjon.",alert:"Ingen kontakt til reserverte bedrifter."},
 en:{desk:"Outbound sales",standard:"Standard call lists",start:"Enable outbound workspace",enable:"Our company uses outbound sales",pitch:"Sales playbook",dial:"Dialer workspace",pipeline:"Pipeline",report:"Performance",setup:"Settings",calls:"Call attempts",talk:"Decision-maker conversations",meetings:"Meetings booked",rate:"Conversation rate",next:"Next prospect",back:"Previous",save:"Save",cancel:"Cancel",noLeads:"No accessible prospects. Create or import call lists first.",search:"Search company, industry or location",scheduled:"Callback",outcome:"Call outcome",note:"Call note",contact:"Contact person",number:"Decision-maker phone",google:"Find contact on Google",again:"Next contact",action:"Log call",owner:"Assigned rep",assigned:"Assign lead",all:"All reps",pending:"No planned date",done:"Do not contact",paid:"Received payments",income:"Contracted MRR",commission:"Earned commission basis",payment:"Record confirmed payment",ref:"Invoice/payment reference",verified:"I verified this payment was received",view:"View lead",showAll:"Show future callbacks",empty:"No matching prospects",more:"Load more",week:"Last 7 days",saveStage:"Save stage",currency:"Currency",timezone:"Time zone",commissionRate:"Commission (%)",saveSettings:"Save settings",info:"Revenue is recorded manually. Only confirmed payments count towards commission.",intro:"One prospect at a time. Log the outcome and plan the next action.",settingsHelp:"Each client organization can opt in separately.",alert:"Never contact suppressed companies."},
 fr:{desk:"Ventes sortantes",standard:"Listes classiques",start:"Activer l'espace de prospection",enable:"Notre entreprise fait de la prospection",pitch:"Argumentaire commercial",dial:"Appels",pipeline:"Pipeline",report:"Performances",setup:"Paramètres",calls:"Tentatives d'appel",talk:"Conversations décideur",meetings:"Rendez-vous fixés",rate:"Taux de conversation",next:"Prospect suivant",back:"Précédent",save:"Enregistrer",cancel:"Annuler",noLeads:"Aucun prospect. Créez ou importez une liste d'appels.",search:"Rechercher entreprise, secteur ou ville",scheduled:"Rappel",outcome:"Résultat d'appel",note:"Notes d'appel",contact:"Interlocuteur",number:"Téléphone du décideur",google:"Chercher le contact sur Google",again:"Prochain contact",action:"Enregistrer l'appel",owner:"Commercial assigné",assigned:"Attribuer le prospect",all:"Tous les commerciaux",pending:"Aucune date prévue",done:"Ne pas contacter",paid:"Paiements confirmés",income:"MRR contractuel",commission:"Assiette des commissions",payment:"Confirmer un paiement reçu",ref:"Référence facture/paiement",verified:"J'ai vérifié le paiement",view:"Voir le prospect",showAll:"Afficher les rappels futurs",empty:"Aucun prospect correspondant",more:"Plus de prospects",week:"7 derniers jours",saveStage:"Enregistrer l'étape",currency:"Devise",timezone:"Fuseau horaire",commissionRate:"Commission (%)",saveSettings:"Enregistrer",info:"Revenus saisis manuellement. Seuls les paiements confirmés comptent pour les commissions.",intro:"Un prospect à la fois. Enregistrez le résultat et planifiez la suite.",settingsHelp:"Chaque organisation peut activer ce mode séparément.",alert:"Ne jamais contacter les entreprises opposées."}
};
function formatMoney(amountMinor:number,currency:string,locale:string){try{return new Intl.NumberFormat(locale,{style:"currency",currency,maximumFractionDigits:2}).format(amountMinor/100);}catch{return `${(amountMinor/100).toFixed(2)} ${currency}`;}}
function nextDate(value:string,locale:string,timeZone:string){if(!value)return "";try{return new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short",timeZone}).format(new Date(value));}catch{return value;}}
const planScript=(lang:string)=>lang==="fr"?"Bonjour, je vous appelle de Noracre. Nous aidons les équipes commerciales à trouver des prospects, gérer les suivis et développer leurs ventes. Qui s'occupe de votre prospection commerciale ?":lang==="en"?"Hi, I'm calling from Noracre. We help outbound teams organize leads, calls, follow-ups and sales activity in one CRM. Who handles your sales prospecting?":"Hei, jeg ringer fra Noracre. Vi hjelper B2B-salgsteam med ringelister, oppfølging og salgsoversikt i ett CRM. Hvem har ansvaret for salgsarbeidet hos dere?";
export function OutboundSalesDesk({organizationId,selectedListId,onShowLegacy,onEnabledChange}:{organizationId:number;selectedListId:number|null;onShowLegacy:()=>void;onEnabledChange:(active:boolean)=>void}){
 const api=useCrmApi(),{locale}=useI18n(),lang=locale==="fr"?"fr":locale==="en"?"en":"nb",t=languages[lang],canManageRef=useMemo(()=>({current:false}),[]);
 const [state,setState]=useState<ResponseData>({settings:defaults,rows:[],hasMore:false,metrics:null,deals:[],payments:[],members:[],canManage:false});
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[tab,setTab]=useState<"dial"|"pipeline"|"report"|"settings">("dial");
 const [activeId,setActiveId]=useState<number|null>(null),[offset,setOffset]=useState(0),[search,setSearch]=useState(""),[showFuture,setShowFuture]=useState(false),[rep,setRep]=useState("all");
 const [outcome,setOutcome]=useState("Ikke svar"),[note,setNote]=useState(""),[callback,setCallback]=useState(""),[contact,setContact]=useState(""),[phone,setPhone]=useState("");
 const [stage,setStage]=useState("Prospekt"),[monthly,setMonthly]=useState(""),[selectedRep,setSelectedRep]=useState(""),[paymentRef,setPaymentRef]=useState(""),[paidAmount,setPaidAmount]=useState(""),[paymentChecked,setPaymentChecked]=useState(false);
 const [draftSettings,setDraftSettings]=useState<Config>(defaults);
 const headers={"x-organization-id":String(organizationId),"content-type":"application/json"};
 const refresh=useCallback(async(page=0,append=false)=>{
   const url=`/api/outbound?offset=${page}${selectedListId?`&listId=${selectedListId}`:""}`;
   const result=await api(url,{headers});const data=await result.json();
   if(!result.ok)throw new Error(data.error??"Outbound data could not load.");
   setState(old=>({...data,rows:append?[...old.rows,...data.rows]:data.rows}));
   setDraftSettings(old=>append?old:data.settings);
   setOffset(page);onEnabledChange(Boolean(data.settings.enabled));canManageRef.current=Boolean(data.canManage);
   return data as ResponseData;
 },[api,organizationId,selectedListId,onEnabledChange,canManageRef]);
 useEffect(()=>{let mounted=true;setLoading(true);setError("");setActiveId(null);void refresh().catch(e=>{if(mounted)setError(e.message)}).finally(()=>{if(mounted)setLoading(false)});return()=>{mounted=false}},[refresh]);
 const now=Date.now();
 const filtered=useMemo(()=>state.rows.filter(r=>{
   if(r.suppressed||r.state?.pipeline==="Tapt"||r.state?.pipeline==="Kunde")return false;
   // Scheduled demos and trials live in the pipeline; return to dialing only for a due callback.
   if(["Demo booket","Demo gjennomført","Prøveperiode","Tilbud"].includes(r.state?.pipeline??"")&&!r.state?.nextCallAt)return false;
   if(rep!=="all"&&String(r.assignedMembershipId)!==rep)return false;
   if(!showFuture&&r.state?.nextCallAt&&Date.parse(r.state.nextCallAt)>now)return false;
   const term=search.trim().toLowerCase();
   return !term||[r.name,r.city,r.industry,r.orgNumber].some(x=>String(x??"").toLowerCase().includes(term));
 }),[state.rows,search,showFuture,rep,now]);
 const selected=(tab==="dial"?filtered.find(x=>x.id===activeId)??filtered[0]:state.rows.find(x=>x.id===activeId)??filtered[0]??state.rows[0])??null;
 const chosenDeal=state.deals.find(d=>d.entryId===selected?.id);
 const chosenIndex=filtered.findIndex(x=>x.id===selected?.id);
 function selectLead(lead:Lead){setActiveId(lead.id);setSelectedRep("");setOutcome("Ikke svar");setNote("");setCallback("");setContact(lead.state?.contactName??"");setPhone(lead.state?.contactPhone??lead.phone??"");setStage(chosenStage(lead,state.deals));setMonthly(String((state.deals.find(d=>d.entryId===lead.id)?.monthlyAmountMinor??0)/100));setPaymentChecked(false);setPaymentRef("");setPaidAmount("");}
 function chosenStage(lead:Lead,deals:Deal[]){return deals.find(d=>d.entryId===lead.id)?.pipeline??lead.state?.pipeline??"Prospekt";}
 useEffect(()=>{if(selected&&selected.id!==activeId)selectLead(selected);},[selected?.id,activeId]);
 async function submit(body:Record<string,unknown>,success:string){
   setBusy(true);try{
     const response=await api("/api/outbound",{method:"POST",headers,body:JSON.stringify(body)});
     const data=await response.json().catch(()=>({}));
     if(!response.ok)throw new Error(data.error??"Could not save.");
     toast.success(success);await refresh(0,false);return true;
   }catch(e){toast.error(e instanceof Error?e.message:"Could not save.");return false;}finally{setBusy(false)}
 }
 function nextLead(){if(!filtered.length)return;const next=filtered[(chosenIndex+1)%filtered.length];selectLead(next);}
 function previousLead(){if(!filtered.length)return;const next=filtered[(chosenIndex-1+filtered.length)%filtered.length];selectLead(next);}
 async function logCall(){
   if(!selected)return;
   const target=filtered[(chosenIndex+1)%filtered.length];
   const ok=await submit({type:"dial",entryId:selected.id,outcome,note,nextCallAt:callback?new Date(callback).toISOString():"",contactName:contact,contactPhone:phone},lang==="fr"?"Appel enregistré":lang==="en"?"Call logged":"Samtalen er registrert");
   if(ok){setNote("");setCallback("");setActiveId(target?.id===selected.id?null:target?.id??null);}
 }
 async function saveStage(){
   if(!selected)return;
   const amount=Math.round(Number(monthly)*100);
   if(!Number.isSafeInteger(amount)||amount<0)return toast.error("Invalid MRR.");
   await submit({type:"stage",entryId:selected.id,pipeline:stage,monthlyAmountMinor:amount,note},lang==="fr"?"Étape enregistrée":lang==="en"?"Stage saved":"Salgsfasen er oppdatert");
 }
 async function savePayment(){
   if(!selected||!paymentChecked)return;
   const paid=Math.round(Number(paidAmount)*100);
   if(!Number.isSafeInteger(paid)||paid<=0)return toast.error("Invalid payment amount.");
   const ok=await submit({type:"payment",entryId:selected.id,paidAmountMinor:paid,reference:paymentRef,confirmed:paymentChecked},lang==="fr"?"Paiement enregistré":lang==="en"?"Payment recorded":"Betaling er registrert");
   if(ok){setPaymentRef("");setPaidAmount("");setPaymentChecked(false);}
 }
 async function saveSettings(){
   const done=await submit({type:"settings",...draftSettings},lang==="fr"?"Paramètres enregistrés":lang==="en"?"Settings saved":"Innstillingene er lagret");
   if(done)setTab(draftSettings.enabled?"dial":"settings");
 }
 const money=(minor:number,currency=state.settings.currency)=>formatMoney(minor,currency,locale);
 const roleName=(id:number)=>state.members.find(u=>u.id===id)?.name??String(id);
 const assignments=state.payments.reduce((acc,p)=>{const key=p.currency;const prev=acc[key]??{paid:0,commission:0};prev.paid+=p.paidAmountMinor;prev.commission+=Math.round(p.paidAmountMinor*p.commissionBps/10000);acc[key]=prev;return acc;},{} as Record<string,{paid:number;commission:number}>);
 const totals=Object.entries(assignments);
 if(loading)return <div className="outbound-desk outbound-load" role="status"><RefreshCw size={18}/> {lang==="en"?"Loading outbound workspace…":lang==="fr"?"Chargement de la prospection…":"Laster outbound-arbeidsflaten …"}</div>;
 if(error)return <div className="outbound-desk"><p role="alert">{error}</p><Button onClick={()=>void refresh().catch(e=>setError(e.message))}>{lang==="en"?"Retry":lang==="fr"?"Réessayer":"Prøv igjen"}</Button></div>;
 return <section className="outbound-desk" aria-label={t.desk}>
   <header className="outbound-top"><div><span className="outbound-eyebrow"><Target size={15}/> {t.desk}</span><h2>{state.settings.enabled?t.desk:t.start}</h2><p>{state.settings.enabled?t.intro:t.settingsHelp}</p></div><Button variant="outline" onClick={onShowLegacy}>{t.standard}<ExternalLink size={14}/></Button></header>
   {!state.settings.enabled?state.canManage?<div className="outbound-optin"><p>{t.settingsHelp}</p><label><input type="checkbox" checked={draftSettings.enabled} onChange={e=>setDraftSettings({...draftSettings,enabled:e.target.checked})}/> {t.enable}</label><Button disabled={busy||!draftSettings.enabled} onClick={()=>void saveSettings()}>{t.start}</Button></div>:<p className="outbound-note">{t.settingsHelp}</p>:<>
   <nav className="outbound-tabs" aria-label={t.desk}>
    {([{id:"dial",name:t.dial,icon:Phone},{id:"pipeline",name:t.pipeline,icon:Target},{id:"report",name:t.report,icon:BarChart3},...(state.canManage?[{id:"settings",name:t.setup,icon:Settings}]:[])] as const).map(x=><button key={x.id} type="button" className={tab===x.id?"active":""} onClick={()=>setTab(x.id)}><x.icon size={16}/>{x.name}</button>)}
   </nav>
   {tab==="dial"&&<div className="outbound-layout">
     <aside className="outbound-queue"><div className="outbound-queue-head"><strong>{t.dial}</strong><span>{filtered.length} leads</span></div>
       <label className="outbound-search"><Search size={16}/><Input placeholder={t.search} value={search} onChange={e=>setSearch(e.target.value)}/></label>
       <label className="outbound-check"><input type="checkbox" checked={showFuture} onChange={e=>setShowFuture(e.target.checked)}/>{t.showAll}</label>
       {state.canManage&&<select aria-label={t.owner} value={rep} onChange={e=>setRep(e.target.value)}><option value="all">{t.all}</option>{state.members.map(u=><option value={u.id} key={u.id}>{u.name}</option>)}</select>}
       <div className="outbound-queue-list">{filtered.map(r=><button key={r.id} type="button" className={selected?.id===r.id?"current":""} onClick={()=>selectLead(r)}><strong>{r.name}</strong><small>{r.city||r.country} · {r.employeeRange|| (r.employees!=null?`${r.employees} ${lang==="en"?"staff":"ansatte"}`:"")}</small>{r.state?.nextCallAt&&<small><CalendarClock size={12}/>{nextDate(r.state.nextCallAt,locale,state.settings.timezone)}</small>}</button>)}</div>
       {state.hasMore&&<Button disabled={busy} variant="outline" onClick={async()=>{try{await refresh(offset+150,true)}catch(e){toast.error(String(e))}}}>{t.more}</Button>}
     </aside>
     <div className="outbound-current">
      {selected?<><div className="outbound-heading"><div><span className="outbound-eyebrow">{selected.country} · {selected.orgNumber}</span><h3>{selected.name}</h3><p>{selected.industry||"—"} · {selected.city||"—"} · {selected.employeeRange||(selected.employees!=null?`${selected.employees} ansatte`:lang==="en"?"Staff not reported":"Ansatte ikke oppgitt")}</p></div><span className="outbound-attempts">{selected.state?.attempts??0} {t.calls.toLowerCase()}</span></div>
       <div className="outbound-prospect-tools"><a href={`https://www.google.com/search?q=${encodeURIComponent(selected.name+" "+selected.city+" managing director phone")}`} target="_blank" rel="noopener noreferrer"><Search size={15}/>{t.google}<ExternalLink size={13}/></a>{selected.website&&<a href={/^https?:\/\//i.test(selected.website)?selected.website:`https://${selected.website}`} target="_blank" rel="noopener noreferrer">{lang==="fr"?"Site web":lang==="en"?"Website":"Nettside"}</a>}</div>
       {selected.suppressed&&<p role="alert" className="outbound-warning"><ShieldAlert size={16}/>{t.alert}</p>}
       <div className="outbound-fields"><label>{t.contact}<Input maxLength={120} value={contact} onChange={e=>setContact(e.target.value)}/></label><label>{t.number}<Input type="tel" maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)}/></label></div>
       <div className="outbound-fields"><label>{t.outcome}<select value={outcome} onChange={e=>setOutcome(e.target.value)}>{outcomes.map(x=><option key={x} value={x}>{x}</option>)}</select></label><label>{t.again} ({state.settings.timezone})<Input type="datetime-local" value={callback} onChange={e=>setCallback(e.target.value)}/><small className="outbound-muted">{lang==="en"?"Leave blank: missed calls get a callback in 48 hours. Date entry uses your device time zone.":lang==="fr"?"Vide : rappel automatique dans 48 h. La saisie utilise le fuseau horaire de votre appareil.":"Tomt felt: ikke besvarte samtaler får ny ringedato om 48 timer. Datoen du oppgir følger tidssonen på enheten din."}</small></label></div>
       <label>{t.note}<Textarea rows={3} maxLength={1500} value={note} onChange={e=>setNote(e.target.value)}/></label>
       {selected.state?.lastOutcome&&<p className="outbound-muted">{lang==="en"?"Last outcome":lang==="fr"?"Dernier résultat":"Siste resultat"}: {selected.state.lastOutcome} · {selected.state.lastNote}</p>}
       <div className="outbound-controls"><Button variant="outline" disabled={busy} onClick={previousLead}><ArrowLeft size={15}/>{t.back}</Button><Button disabled={busy||selected.suppressed} onClick={()=>void logCall()}><CheckCircle size={16}/>{busy?"…":t.action}</Button><Button variant="outline" disabled={busy} onClick={nextLead}>{t.next}<ArrowRight size={15}/></Button></div>
       {state.canManage&&<div className="outbound-assign"><label>{t.owner}<select value={selectedRep||String(selected.assignedMembershipId||"")} onChange={e=>setSelectedRep(e.target.value)}><option value="">Velg selger</option>{state.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><Button disabled={busy||!(selectedRep||selected.assignedMembershipId)} variant="outline" onClick={()=>void submit({type:"assign",entryIds:[selected.id],membershipId:Number(selectedRep||selected.assignedMembershipId)},lang==="en"?"Assigned":lang==="fr"?"Attribué":"Lead er tildelt")}>{t.assigned}</Button></div>}
      </>:<p className="outbound-empty">{state.rows.length?t.empty:t.noLeads}</p>}
     </div>
     <aside className="outbound-playbook"><strong>{t.pitch}</strong><p>{state.settings.pitch||planScript(lang)}</p><p className="outbound-muted">{t.alert}</p></aside>
   </div>}
   {tab==="pipeline"&&<div className="outbound-pipeline"><div className="outbound-pipeline-board">{stages.map(st=><div key={st}><small>{st}</small><strong>{state.metrics?.stages[st]??0}</strong></div>)}</div>
    <div className="outbound-pipeline-form"><label>{t.search}<select value={activeId??""} onChange={e=>{const lead=state.rows.find(r=>r.id===Number(e.target.value));if(lead)selectLead(lead)}}><option value="">Velg bedrift</option>{state.rows.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
    {selected?<><h3>{selected.name}</h3><label>{t.pipeline}<select value={stage} onChange={e=>setStage(e.target.value)}>{stages.map(v=><option key={v} value={v}>{v}</option>)}</select></label><label>{t.income} ({state.settings.currency})<Input type="number" min="0" step=".01" value={monthly} onChange={e=>setMonthly(e.target.value)}/></label><label>{t.note}<Textarea rows={2} value={note} onChange={e=>setNote(e.target.value)}/></label><Button disabled={busy} onClick={()=>void saveStage()}>{t.saveStage}</Button>
     {state.canManage&&(chosenDeal?.pipeline==="Kunde"||stage==="Kunde")&&<div className="outbound-payment"><h4>{t.payment}</h4><p>{t.info}</p><label>{t.ref}<Input value={paymentRef} maxLength={100} onChange={e=>setPaymentRef(e.target.value)}/></label><label>{t.paid} ({state.settings.currency})<Input type="number" min="0" step=".01" value={paidAmount} onChange={e=>setPaidAmount(e.target.value)}/></label><label className="outbound-check"><input type="checkbox" checked={paymentChecked} onChange={e=>setPaymentChecked(e.target.checked)}/>{t.verified}</label><Button disabled={busy||!paymentChecked||paymentRef.length<3} onClick={()=>void savePayment()}>{t.payment}</Button></div>}
     </>:<p>{t.noLeads}</p>}</div></div>}
   {tab==="report"&&<div className="outbound-report">
     <p className="outbound-muted">{t.week}</p><div className="outbound-metrics"><div><Phone/><span>{t.calls}</span><strong>{state.metrics?.attempts??0}</strong></div><div><Users/><span>{t.talk}</span><strong>{state.metrics?.conversations??0}</strong></div><div><CalendarClock/><span>{t.meetings}</span><strong>{state.metrics?.meetings??0}</strong></div><div><Target/><span>{t.rate}</span><strong>{state.metrics?.conversationRate??0}%</strong></div></div>
     <h3>{t.income} / {t.commission}</h3><p className="outbound-muted">{t.info}</p>{totals.length?totals.map(([currency,v])=><div className="outbound-revenue" key={currency}><span>{currency} · {t.paid}</span><strong>{money(v.paid,currency)}</strong><span>{t.commission}</span><strong>{money(v.commission,currency)}</strong></div>):<p>{lang==="fr"?"Aucun paiement confirmé":lang==="en"?"No confirmed payments":"Ingen bekreftede betalinger"}</p>}
     <h3>{t.owner}</h3><div className="outbound-rep-report">{(state.byMember??[]).map(member=><div key={member.membershipId}><strong>{member.name}</strong><span>{member.attempts} {t.calls.toLowerCase()} · {member.conversations} {t.talk.toLowerCase()}</span><span>{member.meetings} {t.meetings.toLowerCase()} · {member.won} {lang==="en"?"won":lang==="fr"?"gagnés":"vunnet"}</span><span>{Object.entries(member.commissionsByCurrency).map(([currency,amount])=>money(amount,currency)).join(" / ")||"—"}</span></div>)}</div>
   </div>}
   {tab==="settings"&&state.canManage&&<div className="outbound-settings"><label className="outbound-check"><input type="checkbox" checked={draftSettings.enabled} onChange={e=>setDraftSettings({...draftSettings,enabled:e.target.checked})}/>{t.enable}</label><div className="outbound-fields"><label>{t.currency}<Input maxLength={3} value={draftSettings.currency} onChange={e=>setDraftSettings({...draftSettings,currency:e.target.value.toUpperCase()})}/></label><label>{t.timezone}<Input value={draftSettings.timezone} maxLength={64} onChange={e=>setDraftSettings({...draftSettings,timezone:e.target.value})}/></label><label>{t.commissionRate}<Input type="number" min="0" max="50" step=".1" value={draftSettings.commissionBps/100} onChange={e=>setDraftSettings({...draftSettings,commissionBps:Math.round(Number(e.target.value)*100)})}/></label></div><label>{t.pitch}<Textarea rows={6} maxLength={8000} value={draftSettings.pitch} placeholder={planScript(lang)} onChange={e=>setDraftSettings({...draftSettings,pitch:e.target.value})}/></label><p className="outbound-muted">{t.info}</p><Button disabled={busy} onClick={()=>void saveSettings()}>{t.saveSettings}</Button></div>}
   </>}
 </section>;
}
