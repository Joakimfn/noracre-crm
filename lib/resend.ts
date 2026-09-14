type RuntimeEnv = {
  RESEND_API_KEY?: string;
  APP_URL?: string;
};

export async function sendInvitation(input: {
  to: string;
  name: string;
  organization: string;
  role: string;
}) {
  const { env } = await import("cloudflare:workers");
  const runtime = env as unknown as RuntimeEnv;
  if (!runtime.RESEND_API_KEY)
    return { sent: false, reason: "not_configured" as const };
  const appUrl = (runtime.APP_URL || "https://crm.noracre.no").replace(/\/$/, "");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${runtime.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Noracre CRM <varsler@mail.noracre.no>",
      to: [input.to],
      subject: `Du er invitert til ${input.organization} i Noracre CRM`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17332b"><h2>Velkommen til Noracre CRM</h2><p>Hei ${escapeHtml(input.name)},</p><p>Du er registrert som ${escapeHtml(input.role.toLowerCase())} for <strong>${escapeHtml(input.organization)}</strong>.</p><p><a href="${appUrl}" style="display:inline-block;padding:12px 18px;background:#12664f;color:white;text-decoration:none;border-radius:8px">Opprett konto eller logg inn</a></p><p>Bruk e-postadressen denne invitasjonen ble sendt til.</p></div>`,
    }),
  });
  return { sent: response.ok, reason: response.ok ? undefined : "provider_error" };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

export async function sendSupportRequest(input:{to:string;organization:string;requester:string;organizationId:number;requestId:number}){
 const {env}=await import('cloudflare:workers');const runtime=env as unknown as RuntimeEnv;
 if(!runtime.RESEND_API_KEY)return {sent:false};
 const appUrl='https://crm.noracre.no';
 const link=appUrl+'/?supportRequest='+input.requestId+'&organization='+input.organizationId;
 const r=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+runtime.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'support-'+input.requestId+'-'+input.to},body:JSON.stringify({from:'Noracre CRM <noreply@mail.noracre.no>',to:[input.to],subject:'Godkjenn supporttilgang til '+input.organization,text:input.requester+' fra Noracre ber om tilgang til '+input.organization+'. Logg inn som administrator for å velge tilgang i 24 timer eller til dere slår den av: '+link,html:'<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17332b"><h2>Forespørsel om supporttilgang</h2><p>'+escapeHtml(input.requester)+' fra Noracre ber om tilgang til <strong>'+escapeHtml(input.organization)+'</strong>.</p><p>Du bestemmer om tilgangen skal vare i 24 timer eller til dere slår den av. Den kan når som helst avsluttes under Administrasjon.</p><p><a href="'+link+'" style="display:inline-block;padding:12px 18px;background:#12664f;color:white;text-decoration:none;border-radius:8px">Se forespørselen og velg tilgang</a></p><p>Logg inn med administratorbrukeren din. Ingen tilgang gis før du godkjenner.</p></div>'})});
 return {sent:r.ok};
}
