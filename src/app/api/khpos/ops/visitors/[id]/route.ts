import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { createPairing, gateDesk, gateVisitAction, GateError, revokeDevice } from "@/lib/khpos/ops/visitors";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"private, no-store"};
function fail(error:unknown){
  if(error instanceof GateError || error instanceof KhposAuthError)
    return NextResponse.json({ok:false,error:error.message},{status:error.status,headers:noStore});
  console.error("[khpos][visitors] request failed",error);
  return NextResponse.json({ok:false,error:"Gate & Visitors could not complete this request."},{status:500,headers:noStore});
}
async function actor(request:Request){
  const token=bearerTokenFromRequest(request);
  if(!token)throw new KhposAuthError("Sign in to manage school visitors.",401);
  return (await verifyKhposAccessToken(token)).id;
}
function validSchool(id:string){if(!UUID_RE.test(id))throw new GateError("School not found.",404);}
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
  try{
    const {id}=await context.params;validSchool(id);
    const user=await actor(request);
    return NextResponse.json({ok:true,desk:await gateDesk(id,user)},{headers:noStore});
  }catch(error){return fail(error);}
}
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{
    const {id}=await context.params;validSchool(id);
    const user=await actor(request);
    const raw=await request.text();
    if(raw.length>1600)throw new GateError("The visitor operation is too long.");
    let body:Record<string,unknown>;
    try{body=JSON.parse(raw) as Record<string,unknown>;}catch{throw new GateError("Enter a valid request.");}
    if(!body || typeof body!=="object" || Array.isArray(body))
      throw new GateError("Enter a valid request.");
    if(body.mode==="pair"){
      if(typeof body.campusId!=="string" || !UUID_RE.test(body.campusId) ||
         typeof body.deviceLabel!=="string" || body.deviceLabel.trim().length<2 ||
         body.deviceLabel.trim().length>80)
        throw new GateError("Select a campus and enter a device name.");
      const pairing=await createPairing(id,user,body.campusId,body.deviceLabel.trim());
      return NextResponse.json({ok:true,pairing},{headers:noStore});
    }
    if(body.mode==="revoke"){
      if(typeof body.deviceId!=="string" || !UUID_RE.test(body.deviceId))
        throw new GateError("Choose a valid device.");
      await revokeDevice(id,user,body.deviceId);
      return NextResponse.json({ok:true,desk:await gateDesk(id,user)},{headers:noStore});
    }
    if(["admit","depart","decline"].includes(String(body.mode)) &&
       typeof body.visitId==="string" && UUID_RE.test(body.visitId)){
      await gateVisitAction(id,user,body.visitId,body.mode as "admit"|"depart"|"decline");
      return NextResponse.json({ok:true,desk:await gateDesk(id,user)},{headers:noStore});
    }
    throw new GateError("Unsupported visitor operation.");
  }catch(error){return fail(error);}
}
