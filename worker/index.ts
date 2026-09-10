/** Cloudflare Worker entry point for the vinext-starter template. */
import handler from "vinext/server/app-router-entry";
import { guardRequest, secureResponse } from "../lib/request-security";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BUCKET: R2Bucket;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const guarded = await guardRequest(request);
      const upstream = guarded instanceof Response ? guarded : await handler.fetch(guarded, env, ctx);
      return secureResponse(request, upstream);
    } catch {
      return secureResponse(request, Response.json({ error: "Noe gikk galt. Prøv igjen." }, { status: 500 }));
    }
  },
};

export default worker;
