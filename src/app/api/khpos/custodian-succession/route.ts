import { NextResponse } from "next/server";
import { bearerTokenFromRequest,verifyKhposAccessToken,KhposAuthError } from "@/lib/khpos/auth";
import { listSuccession,actSuccession,SuccessionError } from "@/lib/khpos/custodian-succession";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
function fail(cause:unknown){
  if(cause instanceof KhposAuthError||cause instanceof SuccessionError)
    return NextResponse.json({ok:false,error:cause.message},{status:cause.status,headers});
  console.error("[khpos] succession action",cause instanceof Error?cause.name:"unknown");
  return NextResponse.json({ok:false,error:"Custodian succession could not be processed."},{status:500,headers});
}
async function user(request:Request){
  const token=bearerTokenFromRequest(request);
  if(!token)throw new KhposAuthError("Please sign in with your verified account.",401);
  return verifyKhposAccessToken(token);
}
export async function GET(request:Request){
  try{
    const actor=await user(request);
    const search=new URL(request.url).searchParams;
    const scope=search.get("scope")||"candidate",schoolId=search.get("schoolId");
    return NextResponse.json({ok:true,...await listSuccession(actor,scope,schoolId)},{headers});
  }catch(cause){return fail(cause);}
}
export async function POST(request:Request){
  try{
    const actor=await user(request);
    const body=await request.text();
    if(body.length>10000)throw new SuccessionError("Succession input is too long.",413);
    let input:unknown;
    try{input=JSON.parse(body);}catch{throw new SuccessionError("Invalid succession form.");}
    const result=await actSuccession(actor,input);
    return NextResponse.json({ok:true,...result},{headers});
  }catch(cause){return fail(cause);}
}
