import { NextResponse } from "next/server";
import { bearerTokenFromRequest, verifyKhposAccessToken, KhposAuthError } from "@/lib/khpos/auth";
import {
  SchoolDeskError,getSchoolDesk,createSchoolEngagement,updateSchoolEngagement,
  addSchoolCommitment,updateSchoolCommitment,verifySchoolCommitment,logSchoolFollowup,
} from "@/lib/khpos/hq-schools";

export const runtime="nodejs";
export const dynamic="force-dynamic";
function reply(value:unknown,status=200) {
  return NextResponse.json(value,{status,headers:{"Cache-Control":"private, no-store"}});
}
function failure(error:unknown) {
  if(error instanceof KhposAuthError || error instanceof SchoolDeskError)
    return reply({ok:false,error:error.message},error.status);
  console.error("[kaec-hq-school-desk] request failed",error);
  return reply({ok:false,error:"School oversight could not complete this request."},500);
}
async function authenticate(request:Request) {
  const token=bearerTokenFromRequest(request);
  if(!token)throw new KhposAuthError("Sign in to continue.",401);
  return verifyKhposAccessToken(token);
}
export async function GET(request:Request) {
  try { return reply({ok:true,desk:await getSchoolDesk(await authenticate(request))}); }
  catch(error){return failure(error);}
}
export async function POST(request:Request) {
  try {
    const user=await authenticate(request);
    if(Number(request.headers.get("content-length")??0)>16000)
      return reply({ok:false,error:"School execution requests must be under 16 KB."},413);
    const payload=await request.json() as unknown;
    if(!payload || typeof payload!=="object" || Array.isArray(payload))
      throw new SchoolDeskError("Invalid school execution request.",400);
    const body=payload as Record<string,unknown>;
    let desk;
    switch(body.action) {
      case "create_engagement": desk=await createSchoolEngagement(user,body);break;
      case "update_engagement": desk=await updateSchoolEngagement(user,body);break;
      case "add_commitment": desk=await addSchoolCommitment(user,body);break;
      case "progress": desk=await updateSchoolCommitment(user,body);break;
      case "verify": desk=await verifySchoolCommitment(user,body);break;
      case "followup": desk=await logSchoolFollowup(user,body);break;
      default: throw new SchoolDeskError("Unknown school supervision action.",400);
    }
    return reply({ok:true,desk});
  } catch(error) {
    if(error instanceof SyntaxError)return reply({ok:false,error:"Invalid JSON request."},400);
    return failure(error);
  }
}
