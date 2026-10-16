import {NextResponse} from "next/server";
import {UUID_RE} from "@/lib/http";
import {bearerTokenFromRequest,verifyKhposAccessToken,KhposAuthError} from "@/lib/khpos/auth";
import {getAnnouncements,announcementAction,getAnnouncementTracking} from "@/lib/khpos/announcements";
export const dynamic="force-dynamic";
function response(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});}
async function handle(request:Request,write:boolean){
 try{
  const token=bearerTokenFromRequest(request);if(!token)throw new KhposAuthError("Sign in to continue.",401);
  const user=await verifyKhposAccessToken(token),url=new URL(request.url),school=url.searchParams.get("school");
  if(school!==null&&!UUID_RE.test(school))return response({error:"Invalid school reference."},400);
  const tracking=url.searchParams.get("tracking");
  if(!write&&tracking){if(!UUID_RE.test(tracking))return response({error:"Invalid announcement reference."},400);const offset=Number(url.searchParams.get("offset")||0);return response({tracking:await getAnnouncementTracking(user.id,tracking,Number.isFinite(offset)?Math.floor(Math.max(0,offset)):0)});}
  if(write){
   const body=await request.json();if(!body||typeof body!=="object"||Array.isArray(body)||!["save","publish","withdraw","read","acknowledge"].includes(body.mode))return response({error:"Invalid announcement action."},400);
   for(const key of ["id","campusId","unitId"]){if(body[key]!=null&&body[key]!==""&&(typeof body[key]!=="string"||!UUID_RE.test(body[key])))return response({error:"Invalid audience or announcement reference."},400);}
   if(!school&&!["read","acknowledge"].includes(body.mode)&&user.aal!=="aal2")throw new KhposAuthError("Verify administrator MFA before publishing or changing a network notice.",403);
   if(body.documentUrl){let link:URL;try{link=new URL(body.documentUrl);}catch{return response({error:"Use a valid HTTPS document link."},400);}if(link.protocol!=="https:"||link.username||link.password)return response({error:"Use an HTTPS document link without embedded credentials."},400);}
   await announcementAction(user.id,school,body.mode,body);
  }
  return response({workspace:await getAnnouncements(user.id,school)});
 }catch(cause){const message=cause instanceof Error?cause.message:"Announcements could not be loaded.";return response({error:message},cause instanceof KhposAuthError?cause.status:/authority|membership|not assigned|administration/.test(message)?403:400);}
}
export async function GET(request:Request){return handle(request,false);}
export async function POST(request:Request){return handle(request,true);}
