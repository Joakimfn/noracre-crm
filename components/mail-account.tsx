"use client";
import {useCrmApi,useDemoMode} from "@/lib/crm-api";
import {useEffect,useState,useCallback,useRef} from "react";
import {Button} from "@/components/ui/button";
import {toast} from "sonner";
type Status={account:{email:string;provider:string}|null;providers:{google:boolean;microsoft:boolean}};
export function MailAccount({organizationId,onChange}:{organizationId:number;onChange?:()=>void}){
 const apiFetch=useCrmApi(),demoMode=useDemoMode();

 const [status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const requestId=useRef(0),onChangeRef=useRef(onChange);onChangeRef.current=onChange;
 const headers={"x-organization-id":String(organizationId)};
 const load=useCallback(async()=>{const id=++requestId.current;try{const r=await apiFetch('/api/email/account',{headers:{"x-organization-id":String(organizationId)}});const d=await r.json();if(!r.ok)throw Error(d.error||'Kunne ikke hente kontostatus.');if(id!==requestId.current)return;setStatus(d);setError('');onChangeRef.current?.();}catch(e){if(id===requestId.current)setError(e instanceof Error?e.message:'Kunne ikke hente kontostatus.');}},[organizationId]);
 useEffect(()=>{
  setStatus(null);setError('');void load();
  const refresh=()=>{if(document.visibilityState==='visible')void load();};
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return ()=>{requestId.current++;window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[load]);
 async function connect(provider:string){if(demoMode)return toast.info("Kontotilkobling er deaktivert i demoen.");setBusy(true);const popup=window.open('about:blank','noracre-mail-connect','width=600,height=760');try{if(!popup)throw Error('Tillat popup-vinduet for å koble til kontoen.');const r=await apiFetch('/api/email/connect',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({provider})});const d=await r.json();if(!r.ok)throw Error(d.error);popup.location.href=d.url;}catch(e){popup?.close();toast.error(e instanceof Error?e.message:'Tilkoblingen kunne ikke startes.');}finally{setBusy(false);}}
 async function disconnect(){setBusy(true);try{const r=await apiFetch('/api/email/account',{method:'DELETE',headers});if(!r.ok)throw Error('Kunne ikke koble fra.');await load();}catch(e){toast.error(e instanceof Error?e.message:'Kunne ikke koble fra.');}finally{setBusy(false);}}
 return <section className="mail-account"><h3>Din e-postkonto</h3><p className="form-hint">{!status?(error?'Kontostatus er utilgjengelig. Prøver igjen når du kommer tilbake til vinduet.':'Henter kontostatus …'):status.account?`Tilkoblet: ${status.account.email}`:'Koble til kontoen du vil sende fra. E-postene sendes gjennom kontoen din og lagres i Sendt-mappen.'}</p>
 {status?.account?.provider==='microsoft'&&<p className="form-hint">Microsoft: maks 2 MB vedlegg samlet.</p>}
 <p className="form-hint">Vi bruker kontotilgangen til å vise avsender og sende e-post du bekrefter. Les om datatilgang, lagring og sletting i <a href="/personvern#google-data" target="_blank" rel="noopener noreferrer" style={{textDecoration:'underline'}}>personvernerklæringen</a>.</p>
 {error&&<p role="alert">{error}</p>}
 <div className="mail-account-actions"><Button variant="outline" disabled={busy||!status?.providers.google} onClick={()=>connect('google')}>Koble til Google</Button><Button variant="outline" disabled={busy||!status?.providers.microsoft} onClick={()=>connect('microsoft')}>Koble til Microsoft</Button>{status?.account&&<Button variant="outline" disabled={busy} onClick={disconnect}>Koble fra</Button>}</div>
 {status&&!status.providers.google&&!status.providers.microsoft&&<p className="form-hint">Noracre må fullføre Google- og Microsoft-oppsettet før kontotilkobling kan aktiveres.</p>}
 </section>;
}
