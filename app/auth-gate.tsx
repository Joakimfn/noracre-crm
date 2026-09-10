"use client";

import { FormEvent, useEffect, useState } from "react";
import CRMClient from "./crm-client";
import { apiFetch, supabaseSessionKey } from "@/lib/api-client";

type AuthConfig = { configured: boolean; url?: string; anonKey?: string };
type AuthMode = "login" | "signup" | "reset";

export default function AuthGate() {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/config")
      .then((response) => response.json() as Promise<AuthConfig>)
      .then(async (next) => {
        setConfig(next);
        if (!next.configured) return;
        const hash = new URLSearchParams(window.location.hash.slice(1));
        if (hash.get("type") === "recovery" && hash.get("access_token")) {
          localStorage.setItem(
            supabaseSessionKey,
            JSON.stringify({
              access_token: hash.get("access_token"),
              refresh_token: hash.get("refresh_token"),
            }),
          );
          window.history.replaceState({}, "", window.location.pathname);
          setMode("reset");
          return;
        }
        const response = await apiFetch("/api/session");
        if (response.ok) setReady(true);
      })
      .catch(() => setConfig({ configured: false }));
  }, []);

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    if (!config?.url || !config.anonKey) return;
    setBusy(true);
    setMessage("");
    const endpoint =
      mode === "login"
        ? `${config.url}/auth/v1/token?grant_type=password`
        : `${config.url}/auth/v1/signup`;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { apikey: config.anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
        error_description?: string;
        msg?: string;
        user?: unknown;
      };
      if (!response.ok)
        throw new Error(data.error_description || data.msg || "Innloggingen mislyktes.");
      if (data.access_token) {
        localStorage.setItem(supabaseSessionKey, JSON.stringify(data));
        const session = await apiFetch("/api/session");
        if (!session.ok) {
          localStorage.removeItem(supabaseSessionKey);
          const detail = (await session.json().catch(() => ({}))) as { error?: string };
          throw new Error(detail.error || "Du har ikke tilgang til en organisasjon ennå.");
        }
        setReady(true);
      } else {
        setMessage("Sjekk e-posten din og bekreft kontoen før du logger inn.");
        setMode("login");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Noe gikk galt.");
    } finally {
      setBusy(false);
    }
  }

  async function recoverPassword() {
    if (!config?.url || !config.anonKey || !email.trim()) {
      setMessage("Skriv inn e-postadressen din først.");
      return;
    }
    setBusy(true);
    const response = await fetch(`${config.url}/auth/v1/recover`, {
      method: "POST",
      headers: { apikey: config.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    setMessage(
      response.ok
        ? "Hvis adressen finnes, mottar du straks en e-post for å tilbakestille passordet."
        : "Kunne ikke sende e-post akkurat nå.",
    );
    setBusy(false);
  }

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    if (!config?.url || !config.anonKey) return;
    setBusy(true);
    setMessage("");
    const session = JSON.parse(
      localStorage.getItem(supabaseSessionKey) ?? "{}",
    ) as { access_token?: string };
    const response = await fetch(`${config.url}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${session.access_token ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });
    if (response.ok) {
      const access = await apiFetch("/api/session");
      if (access.ok) setReady(true);
      else {
        setMode("login");
        setMessage("Passordet er oppdatert. Logg inn for å fortsette.");
      }
    } else setMessage("Kunne ikke oppdatere passordet. Be om en ny lenke.");
    setBusy(false);
  }

  if (ready) return <CRMClient />;
  return (
    <main className="login-page">
      <section className="login-card">
        <img className="login-logo" src="/noracre-logo-primary.svg" alt="Noracre" />
        <p className="eyebrow">NORACRE CRM</p>
        <h1>
          {mode === "login"
            ? "Logg inn"
            : mode === "signup"
              ? "Opprett brukerkonto"
              : "Velg nytt passord"}
        </h1>
        <p>
          {mode === "login"
            ? "Logg inn for å se kunder, kontaktpersoner og oppfølginger."
            : mode === "signup"
              ? "Bruk e-postadressen administratoren har registrert for deg."
              : "Skriv inn et nytt passord for kontoen din."}
        </p>
        <form onSubmit={mode === "reset" ? updatePassword : authenticate} className="login-form">
          {mode !== "reset" && (
            <label>
              E-post
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
          )}
          <label>
            Passord
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
          </label>
          <button className="login-button" type="submit" disabled={busy || !config?.configured}>
            {busy
              ? "Vent litt …"
              : mode === "login"
                ? "Logg inn"
                : mode === "signup"
                  ? "Opprett konto"
                  : "Lagre nytt passord"}
          </button>
        </form>
        {message && <p className="login-message">{message}</p>}
        {!config?.configured && config !== null && (
          <p className="login-message">Innloggingen klargjøres. Prøv igjen litt senere.</p>
        )}
        {mode !== "reset" && (
          <button className="login-link" type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Første gang? Opprett konto" : "Har du allerede konto? Logg inn"}
          </button>
        )}
        {mode === "login" && (
          <button className="login-link" type="button" onClick={recoverPassword}>Glemt passord?</button>
        )}
      </section>
    </main>
  );
}
