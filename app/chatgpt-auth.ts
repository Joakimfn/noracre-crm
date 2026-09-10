import { redirect } from "next/navigation";

export type ChatGPTUser = {
  id: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

type RuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
};

export async function getChatGPTUser(
  request?: Request,
): Promise<ChatGPTUser | null> {
  const authorization = request?.headers.get("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as RuntimeEnv;
    if (!runtime.SUPABASE_URL || !runtime.SUPABASE_ANON_KEY) return null;
    const response = await fetch(`${runtime.SUPABASE_URL}/auth/v1/user`, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: authorization,
        apikey: runtime.SUPABASE_ANON_KEY,
      },
    });
    if (!response.ok) return null;
    const account = (await response.json()) as {
      id?: string;
      email?: string;
      email_confirmed_at?: string;
      user_metadata?: Record<string, unknown>;
    };
    const email = String(account.email ?? "").trim().toLowerCase();
    if (!account.id || !email || !account.email_confirmed_at) return null;
    const fullName = String(
      account.user_metadata?.full_name ?? account.user_metadata?.name ?? "",
    ).trim();
    return {
      id: account.id,
      displayName: fullName || email,
      email,
      fullName: fullName || null,
    };
  }

  return null;

}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
