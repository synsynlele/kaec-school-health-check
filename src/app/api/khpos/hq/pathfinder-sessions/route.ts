import {NextResponse} from "next/server";
import {bearerTokenFromRequest,verifyKhposAccessToken,KhposAuthError} from "@/lib/khpos/auth";
import {SchoolDeskError} from "@/lib/khpos/hq-schools";
import {getPathfinderSessions,schedulePathfinder,actOnPathfinderSession} from "@/lib/khpos/hq-sessions";
export const runtime="nodejs";export const dynamic="force-dynamic";
function json(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});}
function fail(e:unknown){
 if(e instanceof KhposAuthError||e instanceof SchoolDeskError)return json({ok:false,error:e.message},e.status);
 console.error("[kaec-hq-pathfinder-sessions]",e);
 return json({ok:false,error:"Could not complete Pathfinder activity."},500);
}
async function auth(req:Request){
 const token=bearerTokenFromRequest(req);if(!token)throw new KhposAuthError("Sign in first.",401);
 return verifyKhposAccessToken(token);
}
export async function GET(req:Request){
 try{return json({ok:true,desk:await getPathfinderSessions(await auth(req))});}
 catch(e){return fail(e);}
}
export async function POST(req:Request){
 try{
  const user=await auth(req);
  if(Number(req.headers.get("content-length")??0)>12000)return json({ok:false,error:"Request too large."},413);
  const raw=await req.json() as Record<string,unknown>;
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new SchoolDeskError("Provide a valid supervision action.");
  const desk=raw.action==="schedule_session"
   ? await schedulePathfinder(user,raw)
   : await actOnPathfinderSession(user,raw);
  return json({ok:true,desk});
 }catch(e){return fail(e);}
}
