import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O1 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, "const operationsLinks", "school workspace navigation");
requireText(nav, 'suffix: "/team"', "school workspace navigation");
requireText(nav, "Operate", "school workspace navigation");

const page = read("src/app/khpos/[organisationId]/team/page.tsx");
requireText(page, "OperationsTeamWorkspace", "team route");
requireText(page, "UUID_RE", "team route validation");

const api = read("src/app/api/khpos/ops/structure/[id]/route.ts");
for (const expected of [
  "bearerTokenFromRequest",
  "verifyKhposAccessToken",
  "getKhposOpsStructure",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "Operations structure API");
}

const service = read("src/lib/khpos/ops/structure.ts");
for (const expected of [
  "khpos_ops_get_structure_server",
  "SUPABASE_SERVICE_ROLE_KEY",
  "KhposOpsRoleCharter",
  "KhposOpsRoleAssignment",
]) {
  requireText(service, expected, "Operations structure service");
}

const workspace = read("src/components/khpos/ops/OperationsTeamWorkspace.tsx");
for (const expected of [
  "Institutional Structure & Roles",
  "Operating hierarchy",
  "Reports to",
  "Owned outcomes",
  "Decision rights",
  "/api/khpos/ops/structure/",
]) {
  requireText(workspace, expected, "Operations team workspace");
}

for (const protectedFile of [
  "src/lib/khpos/priorities.ts",
  "src/lib/khpos/implementation.ts",
  "src/lib/khpos/evidence.ts",
  "src/lib/khpos/review.ts",
  "src/lib/khpos/improvement.ts",
]) {
  const source = read(protectedFile);
  if (source.includes("khpos_ops_")) {
    throw new Error(
      `Operations O1 contract failed: ${protectedFile} must not be repurposed for routine Operations data.`,
    );
  }
}

console.log("KHP-OS Operations O1 application foundation validated.");
