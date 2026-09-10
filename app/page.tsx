import CRMClient from "./crm-client";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getChatGPTUser();
  if (!user)
    return (
      <main className="login-page">
        <section className="login-card">
          <img
            className="login-logo"
            src="/noracre-logo-primary.svg"
            alt="Noracre"
          />
          <p className="eyebrow">NORACRE CRM</p>
          <h1>Kundene dine. Samlet.</h1>
          <p>Logg inn for å se kunder, kontaktpersoner og oppfølginger.</p>
          <a
            className="login-button"
            href={chatGPTSignInPath("/")}
            target="_top"
          >
            Logg inn med ChatGPT
          </a>
        </section>
      </main>
    );
  return <CRMClient />;
}
