import {accessResponse,requireTenant} from '@/lib/tenant';
import {getCallListOptions} from '@/lib/call-list-options';
export async function GET(request:Request){try{await requireTenant(request);return Response.json(await getCallListOptions(),{headers:{'cache-control':'private, max-age=3600'}});}catch(error){return accessResponse(error);}}
