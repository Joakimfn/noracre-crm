import {accessResponse,requireTenant} from '@/lib/tenant';
import {getCallListOptions} from '@/lib/call-list-options';
import {franceEmployeeBands,franceRegions,franceIndustrySections} from '@/lib/france-register-options';
export async function GET(request:Request){try{await requireTenant(request);const country=new URL(request.url).searchParams.get('country');const options=country==='FR'?{regions:franceRegions,employeeBands:franceEmployeeBands,industrySections:franceIndustrySections}:await getCallListOptions();return Response.json(options,{headers:{'cache-control':'private, max-age=3600'}});}catch(error){return accessResponse(error);}}
