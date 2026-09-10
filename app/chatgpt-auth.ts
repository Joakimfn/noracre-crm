import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  id: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
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
      headers: {
        Authorization: authorization,
        apikey: runtime.SUPABASE_ANON_KEY,
      },
    });
    if (!response.ok) return null;
    const account = (await response.json()) as {
      id?: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
    };
    const email = String(account.email ?? "").trim().toLowerCase();
    if (!account.id || !email) return null;
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

  const requestHeaders = await headers();
  const rawEmail = requestHeaders.get(USER_EMAIL_HEADER);
  if (!rawEmail) return null;
  const email = rawEmail.trim().toLowerCase();

  // The hosted site always forwards the verified ChatGPT email, but regular
  // browser sessions do not currently include the separate user-id header.
  // Use the verified, normalized email as a stable tenant key in that case.
  const id =
    requestHeaders.get(USER_ID_HEADER) ??
    `email:${email.trim().toLowerCase()}`;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    id,
    displayName: fullName ?? email,
    email,
    fullName,
  };
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
