import { AccessError } from "@/lib/tenant";
import { graph, MetaError } from "@/lib/social-meta";

export function jpegDimensions(bytes: Uint8Array): {width:number;height:number}|null {
  if(bytes[0]!==255||bytes[1]!==216)return null;
  let pos=2;
  while(pos+4<=bytes.length){
    if(bytes[pos++]!==255)return null;
    while(pos<bytes.length&&bytes[pos]===255)pos++;
    const marker=bytes[pos++];
    if(marker===217||marker===218)return null;
    if(marker===1||marker>=208&&marker<=215)continue;
    if(pos+2>bytes.length)return null;
    const length=bytes[pos]*256+bytes[pos+1];
    if(length<2||pos+length>bytes.length)return null;
    if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){
      if(length<8)return null;
      return {height:bytes[pos+3]*256+bytes[pos+4],width:bytes[pos+5]*256+bytes[pos+6]};
    }
    pos+=length;
  }
  return null;
}
async function finished(container:string,token:string){
  for(let attempt=0;attempt<4;attempt++){
    const r=await graph<{status_code:string}>(container,token,{fields:"status_code"});
    if(r.status_code==="FINISHED")return;
    if(r.status_code!=="IN_PROGRESS")throw new MetaError(false);
    if(attempt<3)await new Promise(resolve=>setTimeout(resolve,1000));
  }
  throw new AccessError(409,"Meta bruker lengre tid på bildene. Ingenting er publisert på denne kanalen.");
}
const idOf=(r:{id?:string})=>{if(!r.id||!/^\d+(?:_\d+)?$/.test(r.id))throw new MetaError(true);return r.id;};
export async function publishMeta(platform:string,accountId:string,token:string,content:string,urls:string[]){
  if(platform==="Facebook"){
    const attached=[];
    for(const url of urls){
      const id=idOf(await graph<{id:string}>(`${accountId}/photos`,token,{url,published:"false"},"POST"));
      attached.push({media_fbid:id});
    }
    return idOf(await graph<{id:string}>(`${accountId}/feed`,token,{message:content,...(attached.length?{attached_media:JSON.stringify(attached)}:{})},"POST"));
  }
  if(platform!=="Instagram"||!urls.length)throw new AccessError(400,"Instagram krever minst ett JPEG-bilde.");
  const children=[];
  for(const url of urls){
    const id=idOf(await graph<{id:string}>(`${accountId}/media`,token,{image_url:url,...(urls.length>1?{is_carousel_item:"true"}:{caption:content})},"POST"));
    await finished(id,token);children.push(id);
  }
  const container=children.length===1?children[0]:idOf(await graph<{id:string}>(`${accountId}/media`,token,{media_type:"CAROUSEL",children:children.join(","),caption:content},"POST"));
  if(children.length>1)await finished(container,token);
  return idOf(await graph<{id:string}>(`${accountId}/media_publish`,token,{creation_id:container},"POST"));
}
