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
