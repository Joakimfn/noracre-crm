import CRMClient from "./crm-client";
import AuthGate from "./auth-gate";
import { getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getChatGPTUser();
  if (!user) return <AuthGate />;
  return <CRMClient />;
}
