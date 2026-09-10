export async function guardRequest(request: Request): Promise<Request | Response> {
  const url = new URL(request.url);
  // Noracre serves its images directly; no public image proxy is needed.
  if (["/_vinext/image", "/_next/image"].includes(url.pathname.replace(/\/+$/, "")))
    return new Response(null, { status: 404 });
  if (!url.pathname.startsWith("/api/")) {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method))
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD, OPTIONS" } });
    return request;
  }
  if (url.pathname !== "/api/auth/config" && !/^Bearer \S+$/i.test(request.headers.get("authorization") ?? ""))
    return Response.json({ error: "Du må være logget inn." }, { status: 401 });
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return request;
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin)
    return Response.json({ error: "Forespørselen må komme fra CRM-et." }, { status: 403 });
  const multipart = (request.headers.get("content-type") ?? "").startsWith("multipart/form-data");
  // Bound aggregate uploads as well as each individual file.
  const limit = multipart ? 24 * 1024 * 1024 : 1024 * 1024;
  const tooLarge = () => Response.json({ error: "Forespørselen er for stor." }, { status: 413 });
  if (Number(request.headers.get("content-length")) > limit) return tooLarge();
  if (!request.body) return request;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); return tooLarge(); }
      chunks.push(value);
    }
  } catch {
    return Response.json({ error: "Ufullstendig forespørsel." }, { status: 400 });
  }
  return new Request(request, { body: new Blob(chunks as BlobPart[]) });
}

export function secureResponse(request: Request, upstream: Response) {
  const response = new Response(upstream.body, upstream);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // These directives do not interfere with vinext's inline hydration scripts.
  response.headers.set("Content-Security-Policy", "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  if (new URL(request.url).pathname.startsWith("/api/")) response.headers.set("Cache-Control", "private, no-store");
  return response;
}
