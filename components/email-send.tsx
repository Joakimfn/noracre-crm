"use client";
import {locales} from '@/lib/i18n/config';
import {useI18n} from '@/lib/i18n/react';
import {UiText,useUiTranslation} from '@/lib/i18n/ui';

import {useCrmApi} from "@/lib/crm-api";
import { useEffect, useRef, useState } from "react";
import { MailAccount } from "@/components/mail-account";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Props = { organizationId: number; companyIds: number[]; contactId?: number; attachmentIds?: number[]; files?: File[]; subject: string; message: string; recipientLabel: string; bulk?: boolean; scheduledAt?: string; onSent?: () => void };
export function EmailSend(p: Props) {
 const {locale}=useI18n();
 const {ui}=useUiTranslation();
 const apiFetch=useCrmApi();

  const [open,setOpen]=useState(false), [sending,setSending]=useState(false), [config,setConfig]=useState<{configured:boolean;from:string;replyTo:string}|null>(null);
  const attempt = useRef({fingerprint:"",key:""});
  function refresh(){apiFetch("/api/email",{headers:{"x-organization-id":String(p.organizationId)}}).then(async r=>{if(r.ok)setConfig(await r.json());}).catch(()=>{});}
  useEffect(()=>{setConfig(null);refresh();},[p.organizationId]);
  async function send() {
    if (sending) return;
    setSending(true);
    try {
      const fingerprint=JSON.stringify([p.organizationId,p.companyIds,p.contactId,p.attachmentIds,p.subject,p.message,p.scheduledAt,p.files?.map(f=>[f.name,f.size,f.lastModified])]);
      if(attempt.current.fingerprint!==fingerprint) attempt.current={fingerprint,key:crypto.randomUUID()};
      const form=new FormData();form.set("companyIds",JSON.stringify(p.companyIds));form.set("attachmentIds",JSON.stringify(p.attachmentIds??[]));form.set("contactId",String(p.contactId??""));form.set("mode",p.bulk?"campaign":"offer");form.set("scheduledAt",p.scheduledAt?new Date(p.scheduledAt).toISOString():"");form.set("subject",p.subject);form.set("message",p.message);
      p.files?.forEach(file=>form.append("files",file));
      const response=await apiFetch("/api/email",{method:"POST",headers:{"x-organization-id":String(p.organizationId),"idempotency-key":attempt.current.key},body:form});
      const data=await response.json();if(!response.ok){if(data.id)p.onSent?.();throw new Error(data.error||"E-posten kunne ikke sendes.");}
      toast.success(ui(data.scheduled?"E-post planlagt til {0} mottakere.":"E-post sendt fra kontoen din til {0} mottakere.",{"0":data.count}));setOpen(false);p.onSent?.();
    }catch(error){toast.error(ui(error instanceof Error?error.message:"Sendingen kunne ikke bekreftes. Prøv igjen med samme melding."));}finally{setSending(false);}
  }
  return <div className="email-send"><Button disabled={sending||!p.companyIds.length||!p.subject.trim()||!p.message.trim()||!config?.configured} onClick={()=>setOpen(true)}><Mail/>{p.scheduledAt?ui("Planlegg e-post"):ui("Send e-post")}</Button>
    <p className="form-hint">{config?.configured?ui("Fra: {0}",{"0":config.from}):config===null?ui("Henter e-postkonto …"):ui("Ingen e-postkonto er tilkoblet")}.{p.bulk?ui(" Mottakerne skjules som blindkopi, og du får en kopi."):""}</p>
    {config?.configured===false&&<MailAccount organizationId={p.organizationId} onChange={refresh}/>}
    <Dialog open={open} onOpenChange={value=>{if(!sending)setOpen(value);}}><DialogContent><DialogHeader><DialogTitle>{p.scheduledAt?ui("Planlegge e-posten?"):ui("Send e-posten?")}</DialogTitle><DialogDescription>{p.recipientLabel}</DialogDescription></DialogHeader><p><UiText text="Fra: " />{config?.from||ui("Ingen konto")}</p>{p.scheduledAt&&<p><UiText text="Sendes automatisk: " />{new Date(p.scheduledAt).toLocaleString(locales[locale].intl)} ({Intl.DateTimeFormat().resolvedOptions().timeZone}<UiText text="). Mottakerutvalget lagres slik det er nå." /></p>}<strong>{p.subject}</strong><p className="email-confirm-body">{p.message}</p><p>{(p.files?.length??0)+(p.attachmentIds?.length??0)}<UiText text=" vedlegg" /></p><Button disabled={sending} onClick={send}>{sending?ui("Behandler …"):p.scheduledAt?ui("Bekreft planlegging"):ui("Bekreft og send")}</Button></DialogContent></Dialog>
  </div>;
}

