import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getKhposPlatformAccess } from "@/lib/khpos/platform-admin";
import type { VerifiedKhposUser } from "@/lib/khpos/auth";

export const HQ_MODULES = ["governance", "people", "work", "partnerships", "products", "finance", "command"] as const;
export const HQ_ROLES = ["vision_custodian", "system_steward", "alliance_catalyst", "product_architect", "movement_curator", "finance_steward", "team_member"] as const;
export type HqModule = (typeof HQ_MODULES)[number];
export type HqDataModule = Exclude<HqModule, "command">;
export type HqRole = (typeof HQ_ROLES)[number];
export type HqStatus = "draft" | "active" | "in_review" | "completed" | "cancelled";
export type HqPriority = "low" | "normal" | "high" | "critical";

const allowedModules: Record<HqRole, readonly HqModule[]> = {
  vision_custodian: HQ_MODULES,
  system_steward: ["governance", "people", "work", "partnerships", "products", "command"],
  alliance_catalyst: ["work", "partnerships", "command"],
  product_architect: ["work", "products", "command"],
  movement_curator: ["work", "products", "command"],
  finance_steward: ["work", "finance", "command"],
  team_member: ["work", "command"],
};
export const HQ_RECORD_TYPES: Record<HqDataModule, readonly string[]> = {
  governance: ["constitution", "policy", "playbook", "authority", "decision"],
  people: ["appointment", "responsibility", "handover", "leave", "succession"],
  work: ["task", "recurring_obligation", "report", "approval", "meeting_action"],
  partnerships: ["prospect", "agreement", "onboarding", "supervision", "renewal"],
  products: ["roadmap", "milestone", "release", "incident", "project"],
  finance: ["budget", "invoice", "expense", "income", "obligation"],
};
export interface HqMember {
  user_id: string;
  email: string;
  display_name: string;
  role: HqRole;
  status: "active" | "suspended";
}
export interface HqRecord {
  id: string;
  module: HqDataModule;
  record_type: string;
  title: string;
  description: string;
  status: HqStatus;
  priority: HqPriority;
  owner_user_id: string | null;
  backup_user_id: string | null;
  due_on: string | null;
  cadence: string;
  amount: number | null;
  currency: string;
  created_by: string;
  updated_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface HqSnapshot {
  viewer: { userId: string; role: HqRole; email: string; aal: string };
  allowedModules: readonly HqModule[];
  records: HqRecord[];
  members: HqMember[];
  limitedTo: number;
  hasMore: boolean;
  generatedAt: string;
}
export class HqError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "HqError";
  }
}
let service: SupabaseClient | null = null;
function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HqError("KAEC HQ database configuration is unavailable.", 503);
  if (!service) service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return service;
}
function isRole(value: unknown): value is HqRole {
  return typeof value === "string" && HQ_ROLES.some((x) => x === value);
}
function dataModule(value: unknown): value is HqDataModule {
  return typeof value === "string" && value !== "command" && HQ_MODULES.some((x) => x === value);
}
function stringValue(value: unknown, max: number, label: string, min = 0): string {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    throw new HqError(label + " must contain between " + min + " and " + max + " characters.");
  }
  return value.trim();
}
function idValue(value: unknown, label: string): string | null {
  if (value === null || value === "" || value === undefined) return null;
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new HqError("Invalid " + label + ".");
  }
  return value;
}
function pick<T extends string>(input: unknown, options: readonly T[], label: string): T {
  if (typeof input !== "string" || !options.some((x) => x === input)) throw new HqError("Invalid " + label + ".");
  return input as T;
}
function ensureObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HqError("A valid record is required.");
  return value as Record<string, unknown>;
}
async function memberFor(user: VerifiedKhposUser): Promise<HqMember> {
  const { data, error } = await db().from("kaec_hq_members").select("user_id,email,display_name,role,status").eq("user_id", user.id).maybeSingle();
  if (error) throw new HqError("KAEC HQ roles could not be checked.", 503);
  if (!data || data.status !== "active" || !isRole(data.role) || data.email.toLowerCase() !== user.email) {
    throw new HqError("Your school account does not grant access to KAEC HQ. An authorised corporate appointment is required.", 403);
  }
  return data as HqMember;
}
function canAccess(member: HqMember, module: HqModule) {
  return allowedModules[member.role].includes(module);
}
function canEditRecord(member: HqMember, record: HqRecord, userId: string) {
  if (!canAccess(member, record.module)) return false;
  if (member.role === "team_member") {
    return [record.owner_user_id, record.backup_user_id, record.created_by].includes(userId);
  }
  return true;
}
function requireMfa(user: VerifiedKhposUser) {
  if (user.aal !== "aal2") throw new HqError("Verify your authenticator MFA to perform this corporate governance action.", 403);
}
function validateRecordFields(
  input: Record<string, unknown>,
  module: HqDataModule,
  userId: string,
) {
  const recordType = pick(input.record_type, HQ_RECORD_TYPES[module], "record type");
  const status = pick(input.status ?? "draft", ["draft", "active", "in_review", "completed", "cancelled"] as const, "status");
  const priority = pick(input.priority ?? "normal", ["low", "normal", "high", "critical"] as const, "priority");
  const owner = idValue(input.owner_user_id ?? userId, "owner");
  const backup = idValue(input.backup_user_id, "backup");
  if (status !== "draft" && status !== "cancelled" && !owner) throw new HqError("Active work needs an accountable owner.");
  if (owner && backup && owner === backup) throw new HqError("The backup must be a different person.");
  if (priority === "critical" && status !== "draft" && status !== "cancelled" && !backup) {
    throw new HqError("Critical work needs a separate backup person.");
  }
  const due = input.due_on ? stringValue(input.due_on, 10, "due date", 10) : null;
  if (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || Number.isNaN(Date.parse(due + "T00:00:00Z")))) {
    throw new HqError("Enter a valid date in YYYY-MM-DD format.");
  }
  const cadence = pick(input.cadence ?? "once", ["once", "daily", "weekly", "monthly", "termly", "quarterly", "yearly"] as const, "cadence");
  const currency = pick(input.currency ?? "NGN", ["NGN", "USD", "GBP", "EUR"] as const, "currency");
  const rawAmount = input.amount;
  const amount = rawAmount === null || rawAmount === "" || rawAmount === undefined ? null : Number(rawAmount);
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 999999999999.99 || Math.round(amount * 100) / 100 !== amount)) {
    throw new HqError("Amount must be a non-negative value with at most two decimal places.");
  }
  if (module !== "finance" && amount !== null) throw new HqError("Financial values belong in Finance.");
  return {
    module,
    record_type: recordType,
    title: stringValue(input.title, 180, "title", 4),
    description: stringValue(input.description ?? "", 5000, "description"),
    status, priority, owner_user_id: owner, backup_user_id: backup,
    due_on: due, cadence, currency, amount,
  };
}
async function checkAppointedUsers(ids: (string | null)[]) {
  const selected = [...new Set(ids.filter((x): x is string => !!x))];
  if (!selected.length) return;
  const { data, error } = await db().from("kaec_hq_members").select("user_id,status").in("user_id", selected);
  if (error || (data ?? []).filter((x) => x.status === "active").length !== selected.length) {
    throw new HqError("Owner and backup must be active KAEC HQ members.");
  }
}
async function loadRecord(id: string) {
  const { data, error } = await db().from("kaec_hq_records").select("*").eq("id", id).maybeSingle();
  if (error) throw new HqError("Record could not be loaded.", 503);
  if (!data) throw new HqError("Record not found.", 404);
  return data as HqRecord;
}
export async function getHqSnapshot(user: VerifiedKhposUser): Promise<HqSnapshot> {
  const member = await memberFor(user);
  const visible = allowedModules[member.role].filter((x) => x !== "command") as HqDataModule[];
  let query = db().from("kaec_hq_records").select("*").in("module", visible).order("updated_at", { ascending: false }).limit(301);
  if (member.role === "team_member") {
    query = query.or("owner_user_id.eq." + user.id + ",backup_user_id.eq." + user.id + ",created_by.eq." + user.id);
  }
  let membersQuery = db().from("kaec_hq_members").select("user_id,email,display_name,role,status").order("display_name");
  if (member.role !== "vision_custodian") membersQuery = membersQuery.eq("status", "active");
  const [recordsResult, membersResult] = await Promise.all([query, membersQuery]);
  if (recordsResult.error || membersResult.error) throw new HqError("KAEC HQ could not load corporate records.", 503);
  const records = (recordsResult.data ?? []) as HqRecord[];
  return {
    viewer: { userId: user.id, email: user.email, role: member.role, aal: user.aal },
    allowedModules: allowedModules[member.role],
    records: records.slice(0, 300),
    members: ((membersResult.data ?? []) as HqMember[]).map((person) => ({
      ...person,
      email: member.role === "vision_custodian" ? person.email : "",
    })),
    limitedTo: 300, hasMore: records.length > 300, generatedAt: new Date().toISOString(),
  };
}
export async function createHqRecord(user: VerifiedKhposUser, raw: unknown): Promise<HqSnapshot> {
  const actor = await memberFor(user);
  const input = ensureObject(raw);
  if (!dataModule(input.module) || !canAccess(actor, input.module)) throw new HqError("This corporate module is not assigned to your role.", 403);
  if (input.module === "finance") requireMfa(user);
  const values = validateRecordFields(input, input.module, user.id);
  if (values.status === "completed" || values.status === "in_review") throw new HqError("Start new records as drafts or active work.");
  await checkAppointedUsers([values.owner_user_id, values.backup_user_id]);
  const { error } = await db().from("kaec_hq_records").insert({ ...values, created_by: user.id, updated_by: user.id });
  if (error) throw new HqError("Could not create the corporate record: " + error.message, 500);
  return getHqSnapshot(user);
}
export async function updateHqRecord(user: VerifiedKhposUser, raw: unknown): Promise<HqSnapshot> {
  const actor = await memberFor(user);
  const input = ensureObject(raw);
  const id = idValue(input.id, "record ID");
  if (!id) throw new HqError("Record ID is required.");
  const previous = await loadRecord(id);
  if (!canEditRecord(actor, previous, user.id)) throw new HqError("You cannot change this corporate record.", 403);
  if (previous.module === "finance") requireMfa(user);
  if (previous.status === "completed" || previous.status === "cancelled") throw new HqError("Closed records cannot be silently rewritten. Create a new record.", 409);
  const values = validateRecordFields({ ...previous, ...input, module: previous.module }, previous.module, user.id);
  if (values.status === "completed") throw new HqError("Submit for review, then an independent authorised reviewer can complete the item.");
  if (previous.status === "in_review" && values.status !== "in_review" && values.status !== "active") {
    throw new HqError("Review records may only be returned to active work.");
  }
  await checkAppointedUsers([values.owner_user_id, values.backup_user_id]);
  const { data, error } = await db().from("kaec_hq_records").update({ ...values, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", id).eq("updated_at", previous.updated_at).select("id");
  if (error) throw new HqError("Could not update the corporate record.", 500);
  if (!data?.length) throw new HqError("Someone edited this record. Refresh and try again.", 409);
  return getHqSnapshot(user);
}
export async function reviewHqRecord(user: VerifiedKhposUser, raw: unknown): Promise<HqSnapshot> {
  const member = await memberFor(user);
  const input = ensureObject(raw);
  const id = idValue(input.id, "record ID");
  if (!id) throw new HqError("Record ID required.");
  const previous = await loadRecord(id);
  if (previous.status !== "in_review") throw new HqError("Only work submitted for review can be verified.", 409);
  if (!canAccess(member, previous.module)) throw new HqError("This review is outside your authority.", 403);
  const verifier = member.role === "vision_custodian" || member.role === "system_steward" || (previous.module === "finance" && member.role === "finance_steward");
  if (!verifier) throw new HqError("An authorised corporate reviewer is required.", 403);
  if (previous.created_by === user.id || previous.owner_user_id === user.id) {
    throw new HqError("Corporate evidence must be reviewed by a different authorised person.", 403);
  }
  if (previous.module === "finance" || previous.priority === "critical") requireMfa(user);
  const decision = pick(input.decision, ["approve", "return"] as const, "review decision");
  const { data, error } = await db().from("kaec_hq_records").update({
    status: decision === "approve" ? "completed" : "active",
    reviewed_by: user.id, reviewed_at: new Date().toISOString(),
    updated_by: user.id, updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "in_review").eq("updated_at", previous.updated_at).select("id");
  if (error) throw new HqError("Review decision could not be recorded.", 500);
  if (!data?.length) throw new HqError("This record changed while you were reviewing it. Refresh.", 409);
  return getHqSnapshot(user);
}
export async function changeHqMember(user: VerifiedKhposUser, raw: unknown): Promise<HqSnapshot> {
  const actor = await memberFor(user);
  if (actor.role !== "vision_custodian") throw new HqError("Only the Vision Custodian can appoint corporate roles.", 403);
  requireMfa(user);
  const input = ensureObject(raw);
  const action = pick(input.action, ["grant", "suspend", "reactivate"] as const, "member action");
  const email = stringValue(input.email, 254, "email", 5).toLowerCase();
  const role = pick(input.role, HQ_ROLES, "role");
  if (role === "vision_custodian") throw new HqError("Additional Vision Custodian appointments require separate board governance.", 403);
  if (email === user.email && action === "suspend") throw new HqError("You cannot suspend yourself.", 403);
  const name = stringValue(input.display_name, 120, "display name", 2);
  const { data: list, error: listError } = await db().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new HqError("Identity directory could not be checked.", 503);
  const existing = list.users.find((u) => u.email?.toLowerCase() === email && u.email_confirmed_at);
  if (!existing) throw new HqError("This person must first sign in and verify their KAEC account.", 404);
  if (action === "grant") {
    const { error } = await db().from("kaec_hq_members").upsert({
      user_id: existing.id, email, display_name: name, role, status: "active",
      granted_by: user.id, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new HqError("Could not grant this corporate role.", 500);
  } else {
    const { data, error } = await db().from("kaec_hq_members").update({
      status: action === "suspend" ? "suspended" : "active",
      role, display_name: name, granted_by: user.id, updated_at: new Date().toISOString(),
    }).eq("user_id", existing.id).select("user_id");
    if (error || !data?.length) throw new HqError("This corporate appointment does not exist.", 404);
  }
  return getHqSnapshot(user);
}
export async function bootstrapHq(user: VerifiedKhposUser): Promise<HqSnapshot> {
  requireMfa(user);
  const designatedEmail = process.env.KAEC_HQ_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!designatedEmail || user.email !== designatedEmail) throw new HqError("KAEC HQ founder provisioning is not authorised for this account.", 403);
  const platform = await getKhposPlatformAccess(user.id);
  if (platform?.status !== "active" || platform.role !== "super_admin") {
    throw new HqError("Provisioning requires an active Platform Super Admin with MFA.", 403);
  }
  const { count, error } = await db().from("kaec_hq_members").select("user_id", { count: "exact", head: true });
  if (error) throw new HqError("KAEC HQ provisioning status could not be checked.", 503);
  if (count !== 0) throw new HqError("KAEC HQ is already provisioned. Use corporate role management.", 409);
  const { error: insertError } = await db().from("kaec_hq_members").insert({
    user_id: user.id, email: user.email, display_name: "Vision Custodian",
    role: "vision_custodian", status: "active", granted_by: user.id,
  });
  if (insertError) throw new HqError("KAEC HQ provisioning failed.", 500);
  return getHqSnapshot(user);
}
