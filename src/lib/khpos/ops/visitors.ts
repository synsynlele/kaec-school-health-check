import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | null = null;
function db(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new GateError("Visitor registration is not configured.", 503);
  return serviceClient ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export class GateError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function code(length: number) {
  return Array.from(randomBytes(length), value => alphabet[value % alphabet.length]).join("");
}
function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
const today = () => new Date().toISOString().slice(0, 10);
const future = (durationMs: number) => new Date(Date.now() + durationMs).toISOString();
const allowedRoles = new Set(["SCHOOL_CUSTODIAN", "SCHOOL_GUARDIAN", "SCHOOL_CARE_OPERATIONS_OFFICER"]);

type Campus = { id: string; name: string };
type GateScope = { campuses: Campus[]; canPair: boolean; organisationName: string };
export type GateVisit = {
  id: string; campus_id: string; visitor_name: string; phone: string | null;
  purpose: string; host_name: string; reference: string; status: string;
  submitted_at: string; admitted_at: string | null; departed_at: string | null;
};
export type GateDevice = {
  id: string; campus_id: string; device_label: string; paired_at: string;
  expires_at: string; last_seen_at: string | null; revoked_at: string | null;
};
export type GateDeskData = { organisationName: string; campuses: Campus[];
  canPair: boolean; visits: GateVisit[]; devices: GateDevice[];
  summary: { waiting: number; onCampus: number };
};

async function schoolScope(orgId: string, userId: string): Promise<GateScope> {
  const client = db();
  const { data: organisation, error: orgError } = await client.from("organisations")
    .select("id,name,status,partner_status,partner_entitlements").eq("id",orgId).maybeSingle();
  if (orgError || !organisation || organisation.status !== "active" ||
      organisation.partner_status !== "active" ||
      !organisation.partner_entitlements?.includes("khpos_core"))
    throw new GateError("This school is not active for KHP-OS.", 403);
  const { data: member } = await client.from("organisation_memberships")
    .select("id").eq("organisation_id",orgId).eq("user_id",userId)
    .eq("status","active").limit(1).maybeSingle();
  if (!member) throw new GateError("You do not have access to this school.", 403);

  const { data: assignments, error: assignmentError } = await client.from("khpos_ops_role_assignments")
    .select("role_id,campus_id").eq("user_id",userId).eq("status","active")
    .lte("start_date",today()).or(`end_date.is.null,end_date.gte.${today()}`);
  if (assignmentError || !assignments?.length)
    throw new GateError("An active school leadership or care role is required.", 403);
  const { data: roles, error: roleError } = await client.from("khpos_ops_roles")
    .select("id,code").eq("organisation_id",orgId).eq("status","active")
    .in("id",assignments.map(x => x.role_id));
  if (roleError) throw new GateError("Could not verify your school role.", 503);
  const allowed = assignments.filter(a =>
    roles?.some(r => r.id === a.role_id && allowedRoles.has(r.code)));
  if (!allowed.length)
    throw new GateError("Only authorised school leaders and care officers can manage visitors.",403);
  const global = allowed.some(a => a.campus_id == null);
  const campusIds = allowed.map(a => a.campus_id).filter((id): id is string => !!id);
  const { data: campuses, error } = await client.from("khpos_ops_campuses")
    .select("id,name").eq("organisation_id",orgId).eq("status","active")
    .order("name");
  if (error) throw new GateError("School campuses could not be loaded.",503);
  const visible = (campuses ?? []).filter(c => global || campusIds.includes(c.id));
  if (!visible.length) throw new GateError("You have no authorised campus.",403);
  const canPair = allowed.some(a => roles?.some(r => r.id === a.role_id &&
    ["SCHOOL_CUSTODIAN","SCHOOL_GUARDIAN"].includes(r.code)));
  return { campuses: visible, organisationName: organisation.name, canPair };
}
function allowedCampus(scope: GateScope, campusId: string) {
  if (!scope.campuses.some(c => c.id === campusId))
    throw new GateError("This campus is outside your authorised scope.",403);
}
export async function gateDesk(orgId: string, userId: string): Promise<GateDeskData> {
  const scope = await schoolScope(orgId,userId);
  const ids=scope.campuses.map(c=>c.id);
  const client=db();
  const [{data:visits,error:visitsError},{data:devices,error:devicesError},
    {count:waiting},{count:onCampus}]=await Promise.all([
      client.from("khpos_gate_visitor_visits")
        .select("id,campus_id,visitor_name,phone,purpose,host_name,reference,status,submitted_at,admitted_at,departed_at")
        .eq("organisation_id",orgId).in("campus_id",ids).order("submitted_at",{ascending:false}).limit(150),
      client.from("khpos_gate_devices")
        .select("id,campus_id,device_label,paired_at,expires_at,last_seen_at,revoked_at")
        .eq("organisation_id",orgId).in("campus_id",ids).order("paired_at",{ascending:false}).limit(40),
      client.from("khpos_gate_visitor_visits").select("id",{head:true,count:"exact"})
        .eq("organisation_id",orgId).in("campus_id",ids).eq("status","awaiting_admission"),
      client.from("khpos_gate_visitor_visits").select("id",{head:true,count:"exact"})
        .eq("organisation_id",orgId).in("campus_id",ids).eq("status","on_campus"),
    ]);
  if (visitsError || devicesError) throw new GateError("Visitor records could not be loaded.",503);
  return { organisationName:scope.organisationName,campuses:scope.campuses,
    canPair:scope.canPair, visits:(visits??[]) as GateVisit[],
    devices:(devices??[]) as GateDevice[],summary:{waiting:waiting??0,onCampus:onCampus??0} };
}
export async function createPairing(orgId:string,userId:string,campusId:string,label:string) {
  const scope=await schoolScope(orgId,userId);
  if (!scope.canPair) throw new GateError("Only a School Guardian or School Custodian can pair devices.",403);
  allowedCampus(scope,campusId);
  const pin=code(10);
  const {error}=await db().from("khpos_gate_pairing_codes").insert({
    organisation_id:orgId,campus_id:campusId,device_label:label,
    code_hash:digest("pair:"+pin),created_by:userId,
    expires_at:future(10*60_000),
  });
  if(error) throw new GateError("Could not generate an activation code.",503);
  return {code:pin,expiresInMinutes:10};
}
export async function revokeDevice(orgId:string,userId:string,deviceId:string){
  const scope=await schoolScope(orgId,userId);
  if (!scope.canPair) throw new GateError("Only a School Guardian or School Custodian can revoke devices.",403);
  const {data,error}=await db().from("khpos_gate_devices").update({revoked_at:new Date().toISOString()})
    .eq("id",deviceId).eq("organisation_id",orgId).in("campus_id",scope.campuses.map(c=>c.id))
    .is("revoked_at",null).select("id").maybeSingle();
  if(error || !data) throw new GateError("That kiosk could not be revoked.",404);
}
type KioskDevice={id:string;organisation_id:string;campus_id:string;device_label:string};
export async function validKiosk(raw:string):Promise<{device:KioskDevice;school:string;campus:string}>{
  if(raw.length!==64 || !/^[a-f0-9]{64}$/.test(raw))throw new GateError("This kiosk needs activation.",401);
  const {data:device,error}=await db().from("khpos_gate_devices")
    .select("id,organisation_id,campus_id,device_label")
    .eq("token_hash",digest("kiosk:"+raw))
    .is("revoked_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
  if(error||!device)throw new GateError("This kiosk is not active. Ask the school to activate it.",401);
  const [{data:organisation},{data:campus}]=await Promise.all([
    db().from("organisations").select("name,status,partner_status,partner_entitlements").eq("id",device.organisation_id).maybeSingle(),
    db().from("khpos_ops_campuses").select("name,status").eq("id",device.campus_id).eq("organisation_id",device.organisation_id).maybeSingle(),
  ]);
  if(organisation?.status!=="active" || organisation?.partner_status!=="active" ||
     !organisation.partner_entitlements?.includes("khpos_core") || campus?.status!=="active")
    throw new GateError("The school kiosk is currently unavailable.",403);
  return {device:device as KioskDevice,school:organisation.name,campus:campus.name};
}
export async function activateKiosk(pin:string) {
  const formatted=pin.trim().toUpperCase().replace(/[-\s]/g,"");
  if(!/^[A-HJ-NP-Z2-9]{10}$/.test(formatted))
    throw new GateError("Enter the ten-character code provided by your school.",400);
  const now=new Date().toISOString();
  const {data:claimed,error}=await db().from("khpos_gate_pairing_codes")
    .update({redeemed_at:now})
    .eq("code_hash",digest("pair:"+formatted)).is("redeemed_at",null)
    .gt("expires_at",now).select("organisation_id,campus_id,device_label,created_by")
    .maybeSingle();
  if(error||!claimed) throw new GateError("This activation code has expired or has already been used.",403);
  const raw=randomBytes(32).toString("hex");
  const {error:deviceError}=await db().from("khpos_gate_devices").insert({
    organisation_id:claimed.organisation_id,campus_id:claimed.campus_id,
    device_label:claimed.device_label,paired_by:claimed.created_by,
    token_hash:digest("kiosk:"+raw),expires_at:future(30*24*60*60_000),
  });
  if(deviceError) throw new GateError("The device could not be activated. Generate a new code.",503);
  return raw;
}
async function quota(deviceId:string,kind:"check_in"|"check_out",max:number){
  const {data,error}=await db().rpc("khpos_gate_consume_rate_limit",{
    p_device_id:deviceId,p_event_type:kind,p_limit:max,
  });
  if(error)throw new GateError("The visitor kiosk is temporarily unavailable.",503);
  if(data!==true)throw new GateError("Too many submissions. Please ask reception for help.",429);
}
export async function kioskCheckIn(raw:string,input:{name:string;phone?:string;purpose:string;host:string}){
  const {device}=await validKiosk(raw);
  await quota(device.id,"check_in",60);
  const name=input.name.trim().replace(/\s+/g," ");
  const host=input.host.trim().replace(/\s+/g," ");
  const phone=(input.phone??"").trim();
  if(name.length<3 || name.length>100 || host.length<2 || host.length>90 ||
    (phone!=="" && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) ||
    !["parent_guardian","appointment","delivery","contractor","official","other"].includes(input.purpose))
    throw new GateError("Please check the name, person to visit, purpose and optional phone number.");
  const departureCode=code(12);
  const reference="VIS-"+code(8);
  const {data,error}=await db().from("khpos_gate_visitor_visits").insert({
    organisation_id:device.organisation_id,campus_id:device.campus_id,device_id:device.id,
    reference,visitor_name:name,phone:phone||null,purpose:input.purpose,
    host_name:host,status:"awaiting_admission",exit_code_hash:digest("exit:"+departureCode),
  }).select("id").single();
  if(error||!data)throw new GateError("Your visit could not be recorded. Please ask reception for help.",503);
  // The database trigger writes the visit event in the same transaction.
  return {reference,departureCode};
}
export async function kioskCheckOut(raw:string,inputCode:string){
  const {device}=await validKiosk(raw);
  await quota(device.id,"check_out",60);
  const key=inputCode.trim().toUpperCase().replace(/[-\s]/g,"");
  if(!/^[A-HJ-NP-Z2-9]{12}$/.test(key))
    throw new GateError("Check the departure code on your visitor receipt.");
  const now=new Date().toISOString();
  const {data,error}=await db().from("khpos_gate_visitor_visits")
    .update({status:"departed",departed_at:now,check_out_method:"visitor_kiosk",exit_kiosk_device_id:device.id})
    .eq("organisation_id",device.organisation_id).eq("campus_id",device.campus_id)
    .eq("exit_code_hash",digest("exit:"+key)).eq("status","on_campus")
    .select("id").maybeSingle();
  if(error || !data)
    throw new GateError("This code could not be checked out. Please ask reception for help.",400);
  return {ok:true};
}
export async function gateVisitAction(orgId:string,userId:string,visitId:string,
  action:"admit"|"depart"|"decline") {
  const scope=await schoolScope(orgId,userId);
  const status=action==="admit"?"on_campus":action==="depart"?"departed":"declined";
  const expected=action==="depart"?"on_campus":"awaiting_admission";
  const now=new Date().toISOString();
  const fields=action==="admit"?{admitted_at:now,admitted_by:userId}
    :action==="depart"?{departed_at:now,departed_by:userId,check_out_method:"staff"}
    :{declined_at:now,declined_by:userId};
  const {data,error}=await db().from("khpos_gate_visitor_visits")
    .update({status,...fields}).eq("id",visitId).eq("organisation_id",orgId)
    .in("campus_id",scope.campuses.map(c=>c.id)).eq("status",expected)
    .select("id,campus_id").maybeSingle();
  if(error||!data)throw new GateError("This visit has already changed or is not in your campus.",409);
  // Audit trail inserted atomically by the database trigger.
}
