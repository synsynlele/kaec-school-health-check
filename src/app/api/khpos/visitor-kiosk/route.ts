import { NextRequest, NextResponse } from "next/server";
import { activateKiosk, GateError, kioskCheckIn, kioskCheckOut, validKiosk } from "@/lib/khpos/ops/visitors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const key="khpos_gate_kiosk_device";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
function errorResponse(error:unknown){
  if(error instanceof GateError)
    return NextResponse.json({ok:false,error:error.message},{status:error.status,headers});
  console.error("[khpos][visitor-kiosk] request failed",error);
  return NextResponse.json({ok:false,error:"The school visitor kiosk is temporarily unavailable."},{status:500,headers});
}
export async function GET(request:NextRequest) {
  try{
    const token=request.cookies.get(key)?.value ?? "";
    if(!token)return NextResponse.json({ok:true,active:false},{headers});
    const state=await validKiosk(token);
    return NextResponse.json({ok:true,active:true,school:state.school,campus:state.campus},{headers});
  }catch(error){
    if(error instanceof GateError && error.status===401)
      return NextResponse.json({ok:true,active:false},{headers});
    return errorResponse(error);
  }
}
export async function POST(request:NextRequest){
  try{
    const origin=request.headers.get("origin");
    // A kiosk may be controlled only from its own origin; third-party sites cannot
    // silently use its restricted device cookie to register or exit visitors.
    if(!origin || origin!==request.nextUrl.origin)throw new GateError("Open the visitor kiosk on the school device.",403);
    const contentType=request.headers.get("content-type")??"";
    if(!contentType.startsWith("application/json"))
      throw new GateError("Invalid visitor form.",415);
    const raw=await request.text();
    if(raw.length>2200)throw new GateError("The visitor form is too long.");
    let data:Record<string,unknown>;
    try{data=JSON.parse(raw) as Record<string,unknown>;}catch{throw new GateError("Invalid visitor form.");}
    if(!data || Array.isArray(data) || typeof data!=="object")throw new GateError("Invalid visitor form.");
    if(data.action==="activate"){
      if(typeof data.code!=="string")throw new GateError("Enter the activation code.");
      const token=await activateKiosk(data.code);
      const response=NextResponse.json({ok:true,active:true},{headers});
      response.cookies.set({
        name:key,value:token, httpOnly:true,
        secure:process.env.NODE_ENV==="production",sameSite:"strict",
        maxAge:30*24*60*60,path:"/api/khpos/visitor-kiosk",
      });
      return response;
    }
    const token=request.cookies.get(key)?.value??"";
    if(data.action==="check_in"){
      if(typeof data.name!=="string"||typeof data.host!=="string"||
         typeof data.purpose!=="string"||
         (data.phone!=null && typeof data.phone!=="string"))
        throw new GateError("Complete your name, visit purpose and person you are seeing.");
      const receipt=await kioskCheckIn(token,{
        name:data.name,host:data.host,purpose:data.purpose,phone:data.phone as string|undefined,
      });
      return NextResponse.json({ok:true,receipt},{headers});
    }
    if(data.action==="check_out"){
      if(typeof data.code!=="string")throw new GateError("Enter your departure code.");
      await kioskCheckOut(token,data.code);
      return NextResponse.json({ok:true,departed:true},{headers});
    }
    throw new GateError("Unsupported visitor kiosk action.");
  }catch(error){return errorResponse(error);}
}
