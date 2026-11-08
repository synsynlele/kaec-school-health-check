import { NextResponse } from "next/server";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { getKhposOpsLibrary } from "@/lib/khpos/ops/library";
import { getHqSnapshot } from "@/lib/khpos/hq";
import { academyForRole, academyForSchoolRole } from "@/lib/khpos/academy-data";
import { createAcademyPdf, createAcademyPptx } from "@/lib/khpos/academy-documents";
import { UUID_RE } from "@/lib/http";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(request:Request){
  try{
    const url=new URL(request.url);
    const token=bearerTokenFromRequest(request);
    if(!token) throw new KhposAuthError("Sign in to use the Training Academy.",401);
    const user=await verifyKhposAccessToken(token);
    const scope=url.searchParams.get("scope");
    let courses;
    if(scope==="hq"){
      await getHqSnapshot(user);
      courses=academyForRole([],true);
    }else if(scope==="school"){
      const organisationId=url.searchParams.get("organisationId")??"";
      if(!UUID_RE.test(organisationId)) return json({ok:false,error:"Invalid school."},400);
      const library=await getKhposOpsLibrary(organisationId,user.id);
      courses=academyForSchoolRole(library.operatingRoleCodes,library.membershipRole);
    }else return json({ok:false,error:"Choose a school or HQ workspace."},400);
    const courseId=url.searchParams.get("course");
    const format=url.searchParams.get("format");
    if(!courseId && !format) return json({ok:true,courses});
    if(!courseId || !format || !["pdf","pptx"].includes(format)) return json({ok:false,error:"Invalid training download."},400);
    const course=courses.find(c=>c.id===courseId);
    if(!course) return json({ok:false,error:"Training is not available to this role."},403);
    const bytes=format==="pdf"?await createAcademyPdf(course):createAcademyPptx(course);
    const extension=format==="pdf"?"pdf":"pptx";
    const mime=format==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const body=new Uint8Array(new ArrayBuffer(bytes.length));
    body.set(bytes);
    return new Response(body,{status:200,headers:{
      "Content-Type":mime,
      "Content-Length":String(body.length),
      "Content-Disposition":'attachment; filename="KHP-OS-'+course.id+'-academy-v'+course.version+'.'+extension+'"',
      "Cache-Control":"private, no-store",
      "X-Content-Type-Options":"nosniff",
    }});
  }catch(error){
    const status=error instanceof KhposAuthError?error.status:
      error&&typeof error==="object"&&"status" in error&&typeof error.status==="number"?error.status:500;
    if(status>=500) console.error("[khpos][academy] request failed",error);
    return json({ok:false,error:status>=500?"Training materials could not load. Please retry.":error instanceof Error?error.message:"Access denied."},status);
  }
}
