"use client";
import { useEffect, useRef, useState } from "react";
import { MailAccount } from "@/components/mail-account";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Props = { organizationId: number; companyIds: number[]; contactId?: number; attachmentIds?: number[]; files?: File[]; subject: string; message: string; recipientLabel: string; bulk?: boolean; onSent?: () => void };
export function EmailSend(p: Props) {
  const [open,setOpen]=useState(false), [sending,setSending]=useState(false), [config,setConfig]=useState<{configured:boolean;from:string;replyTo:string}|null>(null);
  const attempt = useRef({fingerprint:"",key:""});
  function refresh(){apiFetch("/api/email",{headers:{"x-organization-id":String(p.organizationId)}}).then(async r=>{if(r.ok)setConfig(await r.json());}).catch(()=>{});}
  useEffect(()=>{setConfig(null);refresh();},[p.organizationId]);
  async function send() {
    if (sending) return;
    setSending(true);
    try {
      const fingerprint=JSON.stringify([p.organizationId,p.companyIds,p.contactId,p.attachmentIds,p.subject,p.message,p.files?.map(f=>[f.name,f.size,f.lastModified])]);
      if(attempt.current.fingerprint!==fingerprint) attempt.current={fingerprint,key:crypto.randomUUID()};
      const form=new FormData();form.set("companyIds",JSON.stringify(p.companyIds));form.set("attachmentIds",JSON.stringify(p.attachmentIds??[]));form.set("contactId",String(p.contactId??""));form.set("mode",p.bulk?"bulk":"offer");form.set("subject",p.subject);form.set("message",p.message);
      p.files?.forEach(file=>form.append("files",file));
      const response=await apiFetch("/api/email",{method:"POST",headers:{"x-organization-id":String(p.organizationId),"idempotency-key":attempt.current.key},body:form});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"E-posten kunne ikke sendes.");
      toast.success(`E-post sendt fra kontoen din til ${data.count} mottaker${data.count===1?"":"e"}.`);setOpen(false);p.onSent?.();
    }catch(error){toast.error(error instanceof Error?error.message:"Sendingen kunne ikke bekreftes. Prøv igjen med samme melding.");}finally{setSending(false);}
  }
  return <div className="email-send"><Button disabled={sending||!p.companyIds.length||!p.subject.trim()||!p.message.trim()||!config?.configured} onClick={()=>setOpen(true)}><Mail/>Send e-post</Button>
    <p className="form-hint">{config?.configured?`Fra: ${config.from}`:"Ingen e-postkonto er tilkoblet"}.{p.bulk?" Mottakerne skjules som blindkopi, og du får en kopi.":""}</p>
    {config?.configured===false&&<MailAccount organizationId={p.organizationId} onChange={refresh}/>}
    <Dialog open={open} onOpenChange={value=>{if(!sending)setOpen(value);}}><DialogContent><DialogHeader><DialogTitle>Send e-posten?</DialogTitle><DialogDescription>{p.recipientLabel}</DialogDescription></DialogHeader><p>Fra: {config?.from||"Ingen konto"}</p><strong>{p.subject}</strong><p className="email-confirm-body">{p.message}</p><p>{(p.files?.length??0)+(p.attachmentIds?.length??0)} vedlegg</p><Button disabled={sending} onClick={send}>{sending?"Sender …":"Bekreft og send"}</Button></DialogContent></Dialog>
  </div>;
}
