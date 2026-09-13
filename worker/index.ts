import {applyScheduledDeactivations,refreshBrregBatch} from "./maintenance";
import {dispatchDueCampaigns} from "../lib/email-campaigns";
/** Cloudflare Worker entry point for the vinext-starter template. */
import handler from "vinext/server/app-router-entry";
import { guardRequest, secureResponse } from "../lib/request-security";
import { publicWebsite } from "../lib/public-site";
import { publicEnquiry } from "../lib/public-enquiries";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BUCKET: R2Bucket;
  RESEND_API_KEY?: string;
  GOOGLE_DEMO_BOOKING_URL?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async scheduled(_event: unknown, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async()=>{await applyScheduledDeactivations(env.DB);await refreshBrregBatch(env.DB);})());
    ctx.waitUntil(dispatchDueCampaigns());
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url=new URL(request.url);
      if(url.pathname==='/api/public/enquiry')return secureResponse(request,await publicEnquiry(request,env));
      const isWebsite=['noracre.no','www.noracre.no'].includes(url.hostname);
      const isPreview=url.pathname==='/nettside'||url.pathname.startsWith('/nettside/');
      if(isWebsite||isPreview){
        if(!['GET','HEAD'].includes(request.method))return secureResponse(request,new Response(null,{status:405,headers:{Allow:'GET, HEAD'}}));
        if(isWebsite&&url.hostname==='www.noracre.no'){url.hostname='noracre.no';return secureResponse(request,Response.redirect(url.toString(),308));}
        if(url.pathname==='/robots.txt')return secureResponse(request,new Response('User-agent: *\nAllow: /\nSitemap: https://noracre.no/sitemap.xml\n',{headers:{'Content-Type':'text/plain'}}));
        if(url.pathname==='/sitemap.xml')return secureResponse(request,new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['','/crm','/moduler','/om-noracre','/kontakt','/demo','/bli-kunde','/personvern'].map(p=>'<url><loc>https://noracre.no'+p+'</loc></url>').join('')+'</urlset>',{headers:{'Content-Type':'application/xml'}}));
        if(isPreview||!url.pathname.match(/\.[a-z0-9]+$/i)){
          const response=publicWebsite(isPreview?url.pathname.slice('/nettside'.length)||'/':url.pathname,isPreview?'/nettside':'',env);
          return secureResponse(request,request.method==='HEAD'?new Response(null,response):response);
        }
        return secureResponse(request,await env.ASSETS.fetch(request));
      }
      const guarded = await guardRequest(request);
      const upstream = guarded instanceof Response ? guarded : await handler.fetch(guarded, env, ctx);
      return secureResponse(request, upstream);
    } catch {
      return secureResponse(request, Response.json({ error: "Noe gikk galt. Prøv igjen." }, { status: 500 }));
    }
  },
};

export default worker;
