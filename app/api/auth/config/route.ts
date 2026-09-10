export async function GET() {
  const { env } = await import("cloudflare:workers");
  const runtime = env as unknown as {
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
  };
  if (!runtime.SUPABASE_URL || !runtime.SUPABASE_ANON_KEY)
    return Response.json({ configured: false });
  return Response.json({
    configured: true,
    url: runtime.SUPABASE_URL,
    anonKey: runtime.SUPABASE_ANON_KEY,
  });
}
