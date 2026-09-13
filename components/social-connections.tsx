"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { SOCIAL_CHANNELS } from "@/lib/social-channels";
import { SocialChannelIcon } from "@/components/social-channel-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
export interface SocialConnection {id:number;platform:string;accountId:string;accountName:string;expired:boolean}
export interface SocialState {ready:boolean;connections:SocialConnection[];providers?:{meta:boolean;linkedin:boolean}}
interface Choice {id:string;name:string;instagram:{id:string;name:string}|null}
export function SocialConnections({organizationId,role,onChange}:{organizationId:number;role:string;onChange:(value:SocialState)=>void}){
  const [data,setData]=useState<SocialState>({ready:false,connections:[]});
  const [loading,setLoading]=useState(true),[error,setError]=useState("");
  const [connectionError,setConnectionError]=useState("");
  const [busy,setBusy]=useState(false),[pending,setPending]=useState("");
  const [discovery,setDiscovery]=useState<{returned:number;missingToken:number;missingTask:number;missingTasksField:number}|null>(null);
  const [pages,setPages]=useState<Choice[]>([]),[pageId,setPageId]=useState("");
  const [allowed,setAllowed]=useState<string[]>([]),[selected,setSelected]=useState<string[]>([]);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null),popup=useRef<Window|null>(null),generation=useRef(0);
  const admin=["Administrator","Superadmin"].includes(role);
  const headers={"x-organization-id":String(organizationId)};
  async function load(){
    const g=generation.current;
    try{
      const r=await apiFetch("/api/social/connections",{headers});const d=await r.json();
      if(!r.ok)throw Error(d.error);
      if(g!==generation.current)return;
      setData(d);onChange(d);setError("");setConnectionError(d.connectionError??"");
    }catch{if(g===generation.current)setError("Kunne ikke hente kontotilkoblingene. Prøv å åpne modulen på nytt.");}
    finally{if(g===generation.current)setLoading(false);}
  }
  useEffect(()=>{
    generation.current++;setConnectionError("");setLoading(true);setData({ready:false,connections:[]});onChange({ready:false,connections:[]});load();
    return()=>{generation.current++;if(timer.current)clearTimeout(timer.current);popup.current?.close();};
    // Remount on organization change; onChange is the parent's stable state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[organizationId]);
  async function connect(){
    if(busy)return;
    const g=generation.current;
    popup.current=window.open("about:blank","noracre-meta","width=650,height=760");
    if(!popup.current)return toast.error("Tillat sprettoppvinduer for å koble til Meta.");
    popup.current.opener=null;
    setBusy(true);setConnectionError("");
    try{
      const r=await apiFetch("/api/social/meta/start",{method:"POST",headers});const d=await r.json();
      if(!r.ok)throw Error(d.error);
      if(g!==generation.current){popup.current?.close();return;}
      const target=new URL(d.url);if(target.origin!=="https://www.facebook.com")throw Error("Ugyldig tilkoblingsadresse.");
      popup.current!.location.href=target.toString();
      const until=Date.now()+590000;
      const poll=async()=>{
        if(g!==generation.current)return;
        try{
          const response=await apiFetch(`/api/social/meta/accounts?id=${encodeURIComponent(d.id)}`,{headers});const result=await response.json();
          if(g!==generation.current)return;
          if(!response.ok)throw Error(result.error);
          if(result.status==="ready"){
            popup.current?.close();setPending(d.id);setPages(result.pages);setDiscovery(result.discovery??null);setAllowed(result.platforms);setPageId("");setSelected([]);setBusy(false);return;
          }
          if(result.status==="error")throw Error(result.error || "Tilkoblingen ble ikke fullført. Start på nytt.");
          if(Date.now()>until)throw Error("Tilkoblingen ble avbrutt eller utløp.");
          timer.current=setTimeout(poll,2000);
        }catch(e){if(g===generation.current){setBusy(false);popup.current?.close();setConnectionError(e instanceof Error?e.message:"Kunne ikke koble til.");}}
      };
      timer.current=setTimeout(poll,1500);
    }catch(e){popup.current?.close();setBusy(false);setConnectionError(e instanceof Error?e.message:"Kunne ikke koble til.");}
  }
  async function save(){
    setBusy(true);
    try{
      const r=await apiFetch("/api/social/meta/accounts",{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({id:pending,pageId,platforms:selected})});const d=await r.json();
      if(!r.ok)throw Error(d.error);
      setPending("");await load();toast.success("Bedriftens kontoer er koblet til.");
    }catch(e){toast.error(e instanceof Error?e.message:"Kunne ikke lagre tilkoblingen.");}finally{setBusy(false);}
  }
  const [linkedinPending,setLinkedinPending]=useState("");
  const [linkedinPages,setLinkedinPages]=useState<{id:string;name:string}[]>([]),[linkedinPage,setLinkedinPage]=useState("");
  const [disconnectId,setDisconnectId]=useState<number|null>(null);
  async function connectLinkedIn(){
    if(busy)return;const g=generation.current;
    popup.current=window.open("about:blank","noracre-linkedin","width=650,height=760");
    if(!popup.current)return toast.error("Tillat sprettoppvinduer for å koble til LinkedIn.");
    popup.current.opener=null;setBusy(true);setConnectionError("");
    try{
      const r=await apiFetch("/api/social/linkedin/start",{method:"POST",headers}),d=await r.json();if(!r.ok)throw Error(d.error);
      if(g!==generation.current){popup.current?.close();return;}
      const target=new URL(d.url);if(target.origin!=="https://www.linkedin.com"||target.pathname!=="/oauth/v2/authorization")throw Error("Ugyldig tilkoblingsadresse.");
      popup.current!.location.href=target.toString();const until=Date.now()+590000;
      const poll=async()=>{
        if(g!==generation.current)return;
        try{const r=await apiFetch(`/api/social/linkedin/accounts?id=${encodeURIComponent(d.id)}`,{headers}),result=await r.json();
          if(g!==generation.current)return;if(!r.ok)throw Error(result.error);
          if(result.status==="ready"){popup.current?.close();setLinkedinPending(d.id);setLinkedinPages(result.pages);setLinkedinPage("");setBusy(false);return;}
          if(result.status==="error")throw Error(result.error||"LinkedIn-tilkoblingen ble ikke fullført.");
          if(Date.now()>until||popup.current?.closed)throw Error("LinkedIn-tilkoblingen ble avbrutt eller utløp.");
          timer.current=setTimeout(poll,2000);
        }catch(e){if(g===generation.current){setBusy(false);popup.current?.close();setConnectionError(e instanceof Error?e.message:"Kunne ikke koble til LinkedIn.");}}
      };timer.current=setTimeout(poll,1500);
    }catch(e){if(g===generation.current){popup.current?.close();setBusy(false);setConnectionError(e instanceof Error?e.message:"Kunne ikke koble til LinkedIn.");}}
  }
  async function saveLinkedIn(){
    if(busy)return;setBusy(true);
    try{const r=await apiFetch("/api/social/linkedin/accounts",{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({id:linkedinPending,pageId:linkedinPage})}),d=await r.json();if(!r.ok)throw Error(d.error);setLinkedinPending("");await load();toast.success("LinkedIn-bedriftssiden er koblet til.");}
    catch(e){toast.error(e instanceof Error?e.message:"Kunne ikke koble til LinkedIn.");}finally{setBusy(false);}
  }
  async function disconnect(){
    if(!disconnectId||busy)return;setBusy(true);
    try{const r=await apiFetch(`/api/social/connections?id=${disconnectId}`,{method:"DELETE",headers});if(!r.ok)throw Error();setDisconnectId(null);await load();toast.success("LinkedIn er koblet fra.");}
    catch{toast.error("Kunne ikke koble fra LinkedIn.");}finally{setBusy(false);}
  }
  const chosen=pages.find(p=>p.id===pageId);
  return <section className="surface">
    <div className="surface-head"><h3>Kanaler</h3></div>
    <p className="form-hint">{loading?"Henter kontotilkoblinger …":error||(!data.ready?"Kontotilkoblingene venter på at Noracre fullfører oppsettet.":"Koble til bedriftens kontoer på Facebook, Instagram og LinkedIn. Kun administratorer kan endre tilkoblingene.")}</p>
    {connectionError&&<p role="alert" className="form-hint" style={{color:"var(--destructive)"}}>{connectionError}</p>}
    {busy&&!pending&&!linkedinPending&&!disconnectId&&<Button variant="ghost" onClick={()=>{generation.current++;if(timer.current)clearTimeout(timer.current);popup.current?.close();setBusy(false);}}>Avbryt venting</Button>}
    <div className="channel-grid social-connections">
      {SOCIAL_CHANNELS.map(channel=>{
        const connection=data.connections.find(c=>c.platform===channel),meta=["Facebook","Instagram"].includes(channel),linkedin=channel==="LinkedIn",ready=linkedin?Boolean(data.providers?.linkedin):Boolean(data.providers?.meta??data.ready);
        const profileUrl=connection ? channel==="Facebook" && /^\d+$/.test(connection.accountId)
          ? `https://www.facebook.com/${connection.accountId}`
          : channel==="Instagram" && /^[A-Za-z0-9._]{1,30}$/.test(connection.accountName)
            ? `https://www.instagram.com/${encodeURIComponent(connection.accountName)}/` : linkedin && /^\d+$/.test(connection.accountId) ? `https://www.linkedin.com/company/${connection.accountId}/` : null : null;
        return <div key={channel}>
          {profileUrl ? <a className="social-profile-link" href={profileUrl} target="_blank" rel="noopener noreferrer" aria-label={`Åpne ${connection!.accountName} på ${channel} (ny fane)`}><SocialChannelIcon channel={channel}/></a> : <SocialChannelIcon channel={channel}/>}
          <strong>{channel}</strong>
          <span>{connection?`${connection.accountName}${connection.expired?" · Tilgang utløpt":" · Tilkoblet"}`:meta?"Ikke tilkoblet":linkedin?(ready?"Ikke tilkoblet":"Venter på oppsett"):"Kommer senere"}</span>
          {meta&&admin&&<Button size="sm" variant="outline" disabled={busy||loading||!ready||Boolean(error)} onClick={connect}>{busy?"Venter …":connection?"Koble til på nytt":"Koble til"}</Button>}
          {linkedin&&admin&&<div className="linkedin-connection-actions"><Button size="sm" variant="outline" disabled={busy||loading||!ready||Boolean(error)} onClick={connectLinkedIn}>{busy?"Venter …":connection?"Koble til på nytt":"Koble til"}</Button>{connection&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>setDisconnectId(connection.id)}>Koble fra</Button>}</div>}

        </div>;
      })}
    </div>
    <Dialog open={Boolean(pending)} onOpenChange={open=>{if(!open&&!busy)setPending("");}}><DialogContent><DialogHeader><DialogTitle>Velg bedriftens kontoer</DialogTitle><DialogDescription>Velg siden som tilhører denne bedriften. Eksisterende tilkobling erstattes bare for kanalene du velger.</DialogDescription></DialogHeader>
      {!pages.length?<p>Meta returnerte ingen sider med publiseringstilgang. Kontroller at du administrerer en Facebook-side, og at du ga tilgang til den.{discovery&&<span> Sider mottatt: {discovery.returned}. Uten kontotilgang: {discovery.missingToken}. Uten publiseringsrolle: {discovery.missingTask}. Uten rolleopplysninger: {discovery.missingTasksField}.</span>}</p>:<Select value={pageId} onValueChange={value=>{setPageId(value);setSelected([]);}}><SelectTrigger><SelectValue placeholder="Velg Facebook-side"/></SelectTrigger><SelectContent>{pages.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>}
      {chosen&&<div className="social-account-options">{["Facebook","Instagram"].map(platform=>{
        const enabled=allowed.includes(platform)&&(platform!=="Instagram"||Boolean(chosen.instagram));
        return <label key={platform}><input type="checkbox" disabled={!enabled} checked={selected.includes(platform)} onChange={e=>setSelected(s=>e.target.checked?[...s,platform]:s.filter(p=>p!==platform))}/><span>{platform}: {platform==="Facebook"?chosen.name:chosen.instagram?.name??"Ingen tilknyttet profesjonell konto"}{!allowed.includes(platform)?" · Publiseringstillatelse mangler":""}</span></label>;
      })}</div>}
      <Button disabled={busy||!pageId||!selected.length} onClick={save}>{busy?"Lagrer …":"Koble til valgte kontoer"}</Button>
    </DialogContent></Dialog>
    <Dialog open={Boolean(linkedinPending)} onOpenChange={open=>{if(!open&&!busy)setLinkedinPending("");}}><DialogContent><DialogHeader><DialogTitle>Velg LinkedIn-bedriftsside</DialogTitle><DialogDescription>Velg siden som tilhører bedriften i CRM-et. En eksisterende LinkedIn-tilkobling erstattes når du bekrefter.</DialogDescription></DialogHeader>
      {!linkedinPages.length?<p>Ingen bedriftssider med publiseringstilgang ble funnet. Kontroller rollen din på LinkedIn-siden og tillatelsene du ga Noracre.</p>:<Select value={linkedinPage} onValueChange={setLinkedinPage}><SelectTrigger><SelectValue placeholder="Velg LinkedIn-side"/></SelectTrigger><SelectContent>{linkedinPages.map(page=><SelectItem key={page.id} value={page.id}>{page.name}</SelectItem>)}</SelectContent></Select>}
      <Button disabled={busy||!linkedinPage} onClick={saveLinkedIn}>{busy?"Kobler til …":"Koble til bedriftssiden"}</Button>
    </DialogContent></Dialog>
    <Dialog open={disconnectId!==null} onOpenChange={open=>{if(!open&&!busy)setDisconnectId(null);}}><DialogContent><DialogHeader><DialogTitle>Koble fra LinkedIn?</DialogTitle><DialogDescription>Tilgangsnøkkelen fjernes fra CRM-et. Publiserte innlegg på LinkedIn beholdes.</DialogDescription></DialogHeader><Button variant="outline" disabled={busy} onClick={()=>setDisconnectId(null)}>Avbryt</Button><Button disabled={busy} onClick={disconnect}>{busy?"Kobler fra …":"Koble fra LinkedIn"}</Button></DialogContent></Dialog>
  </section>;
}
