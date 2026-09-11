export function socialDiagnostic(payload: string) {
      const messages: Record<string,string> = {
        access:"Tilgangen til markedsføringsmodulen kunne ikke bekreftes.",
        consent:"Meta returnerte ingen godkjenning. Start tilkoblingen på nytt.",
        code_exchange:"Meta avviste utvekslingen av innloggingskoden. Administratoren må kontrollere app-ID, apphemmelighet og returadresse.",
        token_exchange:"Meta kunne ikke opprette varig kontotilgang. Administratoren må kontrollere Meta-oppsettet.",
        permissions:"CRM-et kunne ikke hente tillatelsene fra Meta.",
        pages:"CRM-et kunne ikke hente Facebook-sidene. Kontroller sidetilgangen hos Meta.",
        token_expiry:"Meta returnerte ingen gyldig utløpstid for tilgangen.",
        storage:"CRM-et kunne ikke lagre tilkoblingen. Kontakt administratoren.",
      };
      let diagnostic: {stage?:string;code?:number} = {};
      try { diagnostic=JSON.parse(payload||"{}"); } catch {}
      const stage=typeof diagnostic?.stage==="string" && Object.hasOwn(messages,diagnostic.stage) ? diagnostic.stage : "unknown";
      const code=Number.isSafeInteger(diagnostic?.code) ? diagnostic.code : undefined;
      return {error:(messages[stage]??"Tilkoblingen ble ikke fullført. Start på nytt.")+(code!==undefined?` (Meta-feilkode ${code})`:""),stage};
}
