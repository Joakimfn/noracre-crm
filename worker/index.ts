import {applyScheduledDeactivations,refreshBrregBatch} from "./maintenance";
import {dispatchDueSocialPosts} from '../lib/social-publication';
import {dispatchDueCampaigns} from "../lib/email-campaigns";
/** Cloudflare Worker entry point for the vinext-starter template. */
import handler from "vinext/server/app-router-entry";
import { guardRequest, secureResponse } from "../lib/request-security";
import { publicWebsite } from "../lib/public-site";
import { publicEnquiry } from "../lib/public-enquiries";
import {publishedLocales,type Locale} from '../lib/i18n/config';
import {LANGUAGE_COOKIE,languagePreferenceCookie,activeLanguageCookie} from '../lib/i18n/preference';
import {requestLanguage} from '../lib/i18n/request';

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
    ctx.waitUntil(dispatchDueSocialPosts());
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url=new URL(request.url);
      if(url.pathname==='/api/public/enquiry')return secureResponse(request,await publicEnquiry(request,env));
      const isWebsite=['noracre.no','www.noracre.no'].includes(url.hostname);
      const isPreview=url.pathname==='/nettside'||url.pathname.startsWith('/nettside/');
      // Public presentation uses only its isolated sample-data runtime, never tenant data.
      if(url.pathname==='/portfolio'){
        const guarded=await guardRequest(request);
        return secureResponse(request,guarded instanceof Response?guarded:await handler.fetch(guarded,env,ctx));
      }
      if(isWebsite||isPreview){
        if(!['GET','HEAD'].includes(request.method))return secureResponse(request,new Response(null,{status:405,headers:{Allow:'GET, HEAD'}}));
        if(isWebsite&&url.hostname==='www.noracre.no'){url.hostname='noracre.no';return secureResponse(request,Response.redirect(url.toString(),308));}
        if(url.pathname==='/robots.txt')return secureResponse(request,new Response('User-agent: *\nAllow: /\nSitemap: https://noracre.no/sitemap.xml\n',{headers:{'Content-Type':'text/plain'}}));
        if(url.pathname==='/sitemap.xml'){
          const pages=['','/crm','/moduler','/om-noracre','/kontakt','/demo','/bli-kunde','/bli-partner','/personvern'];
          const entries=pages.flatMap(path=>publishedLocales.map(locale=>'<url><loc>https://noracre.no'+path+'?lang='+locale+'</loc>'+publishedLocales.map(language=>'<xhtml:link rel="alternate" hreflang="'+language+'" href="https://noracre.no'+path+'?lang='+language+'"/>').join('')+'</url>')).join('');
          return secureResponse(request,new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'+entries+'</urlset>',{headers:{'Content-Type':'application/xml'}}));
        }
        if(isPreview||!url.pathname.match(/\.[a-z0-9]+$/i)){
          const {locale,explicit}=requestLanguage(request);
          const response=publicWebsite(isPreview?url.pathname.slice('/nettside'.length)||'/':url.pathname,isPreview?'/nettside':'',env,locale);
          response.headers.set('Cache-Control','private, no-store');
          // Save valid manual choices even with JavaScript disabled.
          if(explicit)response.headers.append('Set-Cookie',languagePreferenceCookie(explicit,url.protocol==='https:'));
          return secureResponse(request,request.method==='HEAD'?new Response(null,response):response);
        }
        return secureResponse(request,await env.ASSETS.fetch(request));
      }
      // Set the initial login language too. Public and CRM cookies are host-only,
      // so an explicit language link is carried across to the CRM subdomain.
      const isCrmPage=['GET','HEAD'].includes(request.method)&&!url.pathname.startsWith('/api/')&&!url.pathname.match(/\.[a-z0-9]+$/i);
      let incoming=request;
      let crmLocale:Locale|undefined;
      let explicitLocale:Locale|undefined;
      if(isCrmPage){
        const selected=requestLanguage(request,true);
        crmLocale=selected.locale;
        explicitLocale=selected.explicit;
        const headers=new Headers(request.headers);
        const otherCookies=(headers.get('cookie')??'').split(';').map(part=>part.trim()).filter(part=>part&&!part.startsWith(LANGUAGE_COOKIE+'='));
        // RootLayout and legal-page metadata consume this resolved request cookie.
        headers.set('cookie',[...otherCookies,LANGUAGE_COOKIE+'='+crmLocale].join('; '));
        incoming=new Request(request,{headers});
      }
      const guarded = await guardRequest(incoming);
      const upstream = guarded instanceof Response ? guarded : await handler.fetch(guarded, env, ctx);
      const response=secureResponse(request, upstream);
      if(crmLocale){
        response.headers.set('Content-Language',crmLocale);
        response.headers.set('Cache-Control','private, no-store');
        if(explicitLocale){
          response.headers.append('Set-Cookie',languagePreferenceCookie(explicitLocale,url.protocol==='https:'));
          response.headers.append('Set-Cookie',activeLanguageCookie(explicitLocale,url.protocol==='https:'));
        }
      }
      return response;
    } catch {
      return secureResponse(request, Response.json({ error: "Noe gikk galt. Prøv igjen." }, { status: 500 }));
    }
  },
};

export default worker;
