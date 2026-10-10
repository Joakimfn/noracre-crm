import {test,after,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {build} from 'esbuild';
import {writeFile,unlink,readFile} from 'node:fs/promises';
const output=new URL('./.outbound-partner-provisioning.mjs',import.meta.url);
const compiled=await build({entryPoints:['components/partner-customer-create.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',write:false,
 plugins:[{name:'partner-runtime',setup(builder){
  builder.onResolve({filter:/^(?:@\/lib\/(?:crm-api|i18n\/ui)|sonner|\.\/ui\/(?:button|input|dialog)|\.\/(?:home-country-picker|operating-country-picker))$/},args=>({path:args.path,namespace:'partner-test'}));
  builder.onLoad({filter:/.*/,namespace:'partner-test'},({path})=>{
   let code='';
   if(path==='@/lib/crm-api')code='export const useCrmApi=()=>globalThis.partnerOutboundApi;';
   else if(path==='@/lib/i18n/ui')code='import React from "react"; export const useUiTranslation=()=>({ui:text=>text});export const UiText=({text})=>React.createElement("span",null,text);';
   else if(path==='sonner')code='export const toast={success:text=>globalThis.partnerOutboundToasts.push(text),error:text=>globalThis.partnerOutboundToasts.push(text)};';
   else if(path==='./ui/button')code='import React from "react";export const Button=({children,...props})=>React.createElement("button",props,children);';
   else if(path==='./ui/input')code='import React from "react";export const Input=props=>React.createElement("input",props);';
   else if(path==='./home-country-picker')code='export const HomeCountryPicker=()=>null;';
   else if(path==='./operating-country-picker')code='export const OperatingCountryPicker=()=>null;';
   else code='import React from "react";export const Dialog=({open,children})=>open?React.createElement("section",null,children):null;export const DialogContent=({children})=>React.createElement("div",null,children);export const DialogHeader=DialogContent,DialogTitle=DialogContent,DialogDescription=DialogContent;';
   return {contents:code,loader:'js',resolveDir:process.cwd()};
  });
 }}]});
await writeFile(output,compiled.outputFiles[0].text);
const {PartnerCustomerCreate}=await import(output.href);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let renderer,requests,completed;
const text=node=>typeof node==='string'?node:(node?.children??[]).map(text).join('');
const button=name=>renderer.root.findAllByType('button').find(node=>text(node)===name);
const choice=()=>renderer.root.findAllByType('input').find(node=>node.props.type==='checkbox');
const field=name=>renderer.root.findAllByType('label').find(node=>text(node)===name).findByType('input');
async function click(name){const target=button(name);assert.ok(target,name);await act(async()=>target.props.onClick());}
async function set(name,value){await act(async()=>field(name).props.onChange({target:{value}}));}
async function opt(checked){await act(async()=>choice().props.onChange({target:{checked}}));}
async function mount(api){requests=[];completed=0;globalThis.partnerOutboundToasts=[];globalThis.partnerOutboundApi=async(url,options)=>{requests.push({url,headers:options.headers,body:JSON.parse(options.body)});return api?api(requests.at(-1)):Response.json({invitationSent:true});};await act(async()=>{renderer=create(React.createElement(PartnerCustomerCreate,{organizationId:7,onCreated:()=>completed++}));});await click('Opprett kundebedrift');await set('Bedriftsnavn','Client Ltd');await set('Kontaktpersonens e-post','admin@example.com');await set('Avtalt CRM-pris per bruker / måned (NOK)','499');}
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());renderer=null;});
after(async()=>{await unlink(output);delete globalThis.partnerOutboundApi;delete globalThis.partnerOutboundToasts;});
test('partner customer creation defaults to standard layout without buying module seats',async()=>{await mount();assert.equal(choice().props.checked,false);await click('Opprett bedrift');assert.equal(requests.length,1);assert.equal(requests[0].headers['x-organization-id'],'7');assert.equal(requests[0].body.type,'organization');assert.equal(requests[0].body.outboundEnabled,false);assert.equal(requests[0].body.crmPrice,'499');assert.equal(requests[0].body.ringPrice,'');assert.equal(requests[0].body.moduleKeys,undefined);assert.equal(completed,1);});
test('partner opt-in reaches the existing server boolean and is reset for the next new customer',async()=>{await mount();await opt(true);await click('Opprett bedrift');assert.equal(requests[0].body.outboundEnabled,true);assert.equal(requests[0].body.adminRole,'Administrator');await click('Opprett kundebedrift');assert.equal(choice().props.checked,false);assert.equal(field('Bedriftsnavn').props.value,'');});
test('failed provisioning preserves the outbound choice and customer fields for an explicit retry',async()=>{let count=0;await mount(()=>++count===1?Response.json({error:'Please verify the client email'},{status:400}):Response.json({invitationSent:true}));await opt(true);await click('Opprett bedrift');assert.equal(completed,0);assert.equal(choice().props.checked,true);assert.equal(field('Bedriftsnavn').props.value,'Client Ltd');assert.equal(globalThis.partnerOutboundToasts.at(-1),'Please verify the client email');await click('Opprett bedrift');assert.equal(requests.length,2);assert.equal(requests[1].body.outboundEnabled,true);assert.equal(completed,1);});
test('two rapid submits create only one customer provisioning request',async()=>{let finish;await mount(()=>new Promise(resolve=>{finish=resolve;}));await opt(true);const submit=button('Opprett bedrift').props.onClick;let first;await act(async()=>{first=submit();void submit();});assert.equal(requests.length,1);assert.equal(button('Opprett bedrift').props.disabled,true);await act(async()=>{finish(Response.json({invitationSent:true}));await first;});assert.equal(completed,1);});
test('outbound opt-in uses the existing English and French UI translations',async()=>{const key='Denne kunden driver med outbound sales og skal ha salgsarbeidsflaten';for(const locale of ['en','fr']){const data=JSON.parse(await readFile(new URL(`../lib/i18n/ui-${locale}.json`,import.meta.url),'utf8'));assert.ok(typeof data[key]==='string'&&data[key].length>10);}});
