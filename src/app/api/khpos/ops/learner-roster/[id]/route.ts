import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";

const input = z.discriminatedUnion("action", [
  z.object({action:z.literal("share"),campus:z.uuid(),enabled:z.boolean().optional()}),
  z.object({action:z.literal("classes"),campus:z.uuid()}),
  z.object({action:z.literal("sync"),campus:z.uuid(),classId:z.uuid(),sourceClass:z.uuid(),term:z.uuid(),after:z.uuid().nullable()}),
]);
const schools = z.array(z.object({id:z.uuid(), name:z.string(), session:z.string().nullable()}));
const learners = z.array(z.object({id:z.uuid(),name:z.string().nullable(),admission:z.string().nullable()})).max(50);

function json(data: unknown, status = 200) {
  return Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request: Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const school=z.uuid().parse((await params).id);
    const raw=await request.text();
    if(raw.length>4096) return json({error:"This roster request is too large."},413);
    const body=JSON.parse(raw);
    const token=bearerTokenFromRequest(request);
    const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
    if(body?.action==="export") {
      const key=process.env.KSI_ROSTER_BRIDGE_KEY?.trim();
      const supplied=Buffer.from(token ?? "");
      const expected=Buffer.from(key ?? "");
      if(!key || key.length<32 || expected.length!==supplied.length || !timingSafeEqual(expected,supplied)) {
        return json({error:"Roster connection unavailable."},403);
      }
      const query=z.object({workspace:z.uuid(),campus:z.uuid().optional(),classId:z.uuid().optional(),
        term:z.uuid().optional(),after:z.uuid().nullable().optional()}).parse(body);
      const {data,error}=await db.rpc("khpos_export_roster_to_ksi",{p_school:school,p_workspace:query.workspace,
        p_campus:query.campus??null,p_class:query.classId??null,p_term:query.term??null,p_after:query.after??null});
      if(error) return json({error:"Could not load the shared KHP-OS roster."},error.code==="42501"?403:400);
      return json({rows:data});
    }
    if(!token) return json({error:"Sign in to open the learner roster."},401);
    const actor=await verifyKhposAccessToken(token);
    const selection=input.parse(body);
    const scope=await db.rpc("khpos_finance_register_server",{p_actor:actor.id,p_school:school,p_campus:null,p_action:"context",p_input:{}});
    if(scope.error || !scope.data?.campuses?.some((c:{id:string;canManage:boolean})=>c.id===selection.campus && c.canManage)) {
      return json({error:"You need learner registration access for this campus."},403);
    }
    const {data:pair,error:pairError}=await db.from("khpos_integrations").select("external_tenant_id")
      .eq("organisation_id",school).eq("provider","ksi").eq("status","active").maybeSingle();
    if(pairError) throw pairError;
    if(!pair?.external_tenant_id) return json({error:"Pair this KHP-OS school with KSI first."},409);
    if(selection.action==="share") {
      const {data,error}=await db.rpc("khpos_manage_ksi_roster_share",{p_actor:actor.id,p_school:school,
        p_campus:selection.campus,p_workspace:pair.external_tenant_id,p_enabled:selection.enabled??null});
      if(error) return json({error:"Could not manage roster sharing for this campus."},error.code==="42501"?403:503);
      return json({enabled:data});
    }
    const key=process.env.KSI_ROSTER_BRIDGE_KEY?.trim();
    if(!key) return json({error:"The KSI roster connection has yet to be configured."},503);
    const endpoint=new URL(process.env.KSI_ROSTER_URL || "https://www.ksi.name.ng/api/integrations/khpos/roster");
    if(endpoint.protocol!=="https:") throw new Error("HTTPS is required");
    const response=await fetch(endpoint,{
      method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},
      body:JSON.stringify({action:"export",workspace:pair.external_tenant_id,
        ...(selection.action==="sync" ? {classId:selection.sourceClass,after:selection.after} : {})}),
      redirect:"error",cache:"no-store",signal:AbortSignal.timeout(8000),
    });
    if(!response.ok) return json({error:response.status===403 ?
      "Ask your KSI school owner to enable roster sharing in Academic Setup." : "Could not load the KSI roster."},response.status===403?403:503);
    const payload=await response.json();
    if(selection.action==="classes") return json({classes:schools.parse(payload.rows)});
    const batch=z.object({session:z.string().nullable(),learners}).parse(payload.rows);
    const rows=batch.learners;
    const {data,error}=await db.rpc("khpos_import_ksi_roster",{p_actor:actor.id,p_school:school,p_campus:selection.campus,
      p_workspace:pair.external_tenant_id,p_class:selection.classId,p_term:selection.term,p_session:batch.session,p_rows:rows});
    if(error) return json({error:error.code==="22023"?error.message:"Could not sync this class."},error.code==="42501"?403:400);
    return json({results:data,after:rows.length===50?rows[49].id:null});
  } catch(error) {
    if(error instanceof KhposAuthError) return json({error:error.message},error.status);
    return json({error:"The learner roster could not be loaded or synced."},503);
  }
}
