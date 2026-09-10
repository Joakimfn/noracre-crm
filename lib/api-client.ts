const SESSION_KEY = "noracre-supabase-session";

type StoredSession = {
  access_token?: string;
  refresh_token?: string;
};

function getStoredSession(): StoredSession {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "{}") as StoredSession;
  } catch {
    return {};
  }
}

export function getStoredAccessToken(): string {
  return getStoredSession().access_token ?? "";
}

export function clearStoredSession() {
  if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY);
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  // Never forward a session token to another origin or follow API redirects.
  if (typeof window !== "undefined") {
    const destination = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (destination.origin !== window.location.origin)
      throw new Error("API-kall må bruke CRM-ets egen adresse.");
  }
  init = { ...init, redirect: "error" };
  const token = getStoredAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status !== 401 || !getStoredSession().refresh_token)
    return response;

  const configResponse = await fetch("/api/auth/config");
  const config = (await configResponse.json().catch(() => ({}))) as {
    configured?: boolean;
    url?: string;
    anonKey?: string;
  };
  const refreshToken = getStoredSession().refresh_token;
  if (!config.configured || !config.url || !config.anonKey || !refreshToken)
    return response;
  const refreshResponse = await fetch(
    `${config.url}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
  );
  if (!refreshResponse.ok) {
    clearStoredSession();
    return response;
  }
  const refreshed = (await refreshResponse.json()) as StoredSession;
  localStorage.setItem(SESSION_KEY, JSON.stringify(refreshed));
  const retryHeaders = new Headers(init.headers);
  retryHeaders.set("Authorization", `Bearer ${refreshed.access_token}`);
  return fetch(input, { ...init, headers: retryHeaders });
}

export const supabaseSessionKey = SESSION_KEY;
