import {AccessError,accessResponse} from '@/lib/tenant';
import {socialAccess} from '@/lib/social-meta';
import {publishStoredPost,cancelSocialPublication} from '@/lib/social-publication';
export async function POST(request:Request){
  try{
    const ctx=await socialAccess(request);
    const form=request.headers.get('content-type')?.includes('multipart/form-data')?await request.formData():null;
    const body=form?JSON.parse(String(form.get('payload')??'{}')):await request.json();
    const prepared=new Map<number,File>();
    if(form)for(const [key,value] of form.entries())if(key!=='payload'){
      const id=Number(key.replace(/^image:/,''));
      if(!/^image:\d+$/.test(key)||!(value instanceof File)||prepared.has(id))throw new AccessError(400,"Ugyldig bildevedlegg.");
      prepared.set(id,value);
    }
    if(prepared.size>6||[...prepared.values()].reduce((sum,f)=>sum+f.size,0)>20*1024*1024)throw new AccessError(400,"Maks seks bilder og 20 MB samlet.");
    if(body.confirm!==true)throw new AccessError(400,'Bekreft handlingen først.');
    if(body.action==='cancel')return Response.json(await cancelSocialPublication(ctx,Number(body.postId)));
    if(body.action!==undefined&&!['schedule','publish'].includes(body.action))throw new AccessError(400,'Ugyldig publiseringsvalg.');
    return Response.json(await publishStoredPost(ctx,body,prepared,()=>socialAccess(request)));
  }catch(error){return accessResponse(error);}
}
