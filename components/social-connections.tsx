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
export interface SocialState {ready:boolean;connections:SocialConnection[]}
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
  const chosen=pages.find(p=>p.id===pageId);
  return <section className="surface">
    <div className="surface-head"><div><p className="eyebrow">KANALER</p><h3>Koble til kontoer</h3></div></div>
    <p className="form-hint">{loading?"Henter kontotilkoblinger …":error||(!data.ready?"Facebook og Instagram venter på at Noracre fullfører Meta-oppsettet.":"Koble til bedriftens Facebook-side og tilknyttede profesjonelle Instagram-konto. Kun administratorer kan endre tilkoblingene.")}</p>
    {connectionError&&<p role="alert" className="form-hint" style={{color:"var(--destructive)"}}>{connectionError}</p>}
    {busy&&!pending&&<Button variant="ghost" onClick={()=>{generation.current++;if(timer.current)clearTimeout(timer.current);popup.current?.close();setBusy(false);}}>Avbryt venting</Button>}
    <div className="channel-grid social-connections">
      {SOCIAL_CHANNELS.map(channel=>{
        const connection=data.connections.find(c=>c.platform===channel),meta=["Facebook","Instagram"].includes(channel);
        const profileUrl=connection ? channel==="Facebook" && /^\d+$/.test(connection.accountId)
          ? `https://www.facebook.com/${connection.accountId}`
          : channel==="Instagram" && /^[A-Za-z0-9._]{1,30}$/.test(connection.accountName)
            ? `https://www.instagram.com/${encodeURIComponent(connection.accountName)}/` : null : null;
        return <div key={channel}>
          {profileUrl ? <a className="social-profile-link" href={profileUrl} target="_blank" rel="noopener noreferrer" aria-label={`Åpne ${connection!.accountName} på ${channel} (ny fane)`}><SocialChannelIcon channel={channel}/></a> : <SocialChannelIcon channel={channel}/>}
          <strong>{channel}</strong>
          <span>{connection?`${connection.accountName}${connection.expired?" · Tilgang utløpt":" · Tilkoblet"}`:meta?"Ikke tilkoblet":"Kommer senere"}</span>
          {meta&&admin&&!connection&&<Button size="sm" variant="outline" disabled={busy||loading||!data.ready||Boolean(error)} onClick={connect}>{busy?"Venter …":"Koble til"}</Button>}
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

  </section>;
}
