import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const bucket = "khpos-finance-documents";
const maxBytes = 3_000_000;
const error = (message: string,status: number) => NextResponse.json({ error: message },{ status });

function documentType(bytes: Uint8Array) {
  if (Buffer.from(bytes.subarray(0,5)).toString("ascii")==="%PDF-") return "application/pdf";
  if (bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff) return "image/jpeg";
  if (Buffer.from(bytes.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  return null;
}

async function handle(request: Request, id: string, upload: boolean) {
  const params = new URL(request.url).searchParams;
  const campus = params.get("campus")??"";
  const entry = params.get("entry")??"";
  if (![id,campus,entry].every(value=>UUID_RE.test(value))) return error("Choose a valid school transaction.",400);
  try {
    const token = bearerTokenFromRequest(request);
    if (!token) return error("Sign in to access supporting documents.",401);
    const actor = await verifyKhposAccessToken(token);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return error("Supporting documents are temporarily unavailable.",503);
    const db = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const input = { p_actor:actor.id,p_school:id,p_campus:campus,p_entry:entry };
    const existing = await db.rpc("khpos_finance_document_server",input);
    if (existing.error) return error(existing.error.code==="42501" ? "Access denied." : "The transaction could not be opened.",
      existing.error.code==="42501" ? 403 : existing.error.code==="22023" ? 404 : 503);
    const stored = existing.data as { path: string | null; mime: string | null };
    if (!upload) {
      if (!stored.path || !stored.mime) return error("No supporting document is attached.",404);
      const { data } = await db.storage.from(bucket).download(stored.path);
      if (!data) return error("The supporting document could not be downloaded.",503);
      const ext = stored.mime==="image/png" ? "png" : stored.mime==="image/jpeg" ? "jpg" : "pdf";
      return new Response(data,{headers:{
        "Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename="finance-document.${ext}"`,
        "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
      }});
    }
    if (stored.path) return error("A supporting document is already attached.",409);
    if (Number(request.headers.get("content-length"))>maxBytes) return error("Choose a file of 3 MB or less.",413);
    const reader = request.body?.getReader();
    if (!reader) return error("Choose a PDF, PNG or JPEG file.",400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const {value,done} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length>maxBytes) { await reader.cancel(); return error("Choose a file of 3 MB or less.",413); }
      chunks.push(value);
    }
    const file = Buffer.concat(chunks);
    const mime = documentType(file);
    if (!mime) return error("Choose a PDF, PNG or JPEG file.",400);
    const path = id+"/"+campus+"/"+entry+"/"+randomUUID();
    const result = await db.storage.from(bucket).upload(path,file,{contentType:mime,upsert:false});
    if (result.error) return error("The supporting document could not be uploaded.",503);
    const saved = await db.rpc("khpos_finance_document_server",{...input,p_path:path,p_mime:mime});
    if (saved.error) {
      // Only remove our own object after a definite database rejection.
      if (["23505","22023","42501"].includes(saved.error.code)) await db.storage.from(bucket).remove([path]);
      return error("The document could not be attached. Try downloading it before retrying.",saved.error.code==="23505"?409:503);
    }
    return NextResponse.json({ ok:true },{status:201});
  } catch (cause) {
    if (cause instanceof KhposAuthError) return error(cause.message,cause.status);
    return error("The document request could not be completed.",503);
  }
}

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request,context: Context) { return handle(request,(await context.params).id,false); }
export async function POST(request: Request,context: Context) { return handle(request,(await context.params).id,true); }
