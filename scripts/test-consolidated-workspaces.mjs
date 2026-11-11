import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const read = path => fs.readFileSync(path, "utf8");
const hubs = {
  announcements: { views: ["meetings", "ideas"], modules: ["AnnouncementsWorkspace", "MeetingsWorkspace", "IdeasBoard"] },
  reports: { views: ["forms"], modules: ["ReportsWorkspace", "OperationalRecordsWorkspace"] },
  calendar: { views: ["events"], modules: ["InstitutionalCalendarWorkspace", "ExtendedWorkspace"] },
  parents: { views: ["enquiries"], modules: ["ParentPartnershipWorkspace", "ExtendedWorkspace"] },
  priorities: { views: ["plan", "evidence", "reviews", "improvement", "guides"], modules: ["PriorityInterventionWorkspace", "ImplementationWorkspace", "EvidenceVerificationWorkspace", "ReviewDecisionWorkspace", "ImprovementIntelligenceWorkspace", "PlaybooksWorkspace"] },
  performance: { views: ["campuses", "compare", "learning", "development", "brief"], modules: ["PerformanceWorkspace", "ExtendedWorkspace", "BenchmarkingWorkspace", "LearningIntelligenceWorkspace", "HumanPotentialIntelligenceWorkspace", "LeadershipBriefWorkspace"] },
};
const oldRoutes = {
  meetings: ["announcements", "meetings"],
  ideas: ["announcements", "ideas"],
  records: ["reports", "forms"],
  events: ["calendar", "events"],
  "parent-journeys": ["parents", "enquiries"],
  implementation: ["priorities", "plan"],
  evidence: ["priorities", "evidence"],
  reviews: ["priorities", "reviews"],
  improvement: ["priorities", "improvement"],
  playbooks: ["priorities", "guides"],
  "network-pulse": ["performance", "campuses"],
  benchmarking: ["performance", "compare"],
  "learning-intelligence": ["performance", "learning"],
  "human-potential-intelligence": ["performance", "development"],
  "leadership-brief": ["performance", "brief"],
};

assert.equal(Object.keys(oldRoutes).length, 15);
const root = "src/app/khpos/[organisationId]/";
for (const [slug, { views, modules }] of Object.entries(hubs)) {
  const source = read(root + slug + "/page.tsx");
  assert(source.includes("SchoolSectionTabs"), slug + ": shared in-page navigation missing");
  assert(source.includes("UUID_RE.test(organisationId)"), slug + ": missing school ID validation");
  for (const module of modules) assert(source.includes("<" + module), slug + ": lost " + module);
  for (const view of views) assert(source.includes('selected === "' + view + '"'), slug + ": missing " + view + " view");
}
for (const [slug, [destination, view]] of Object.entries(oldRoutes)) {
  const source = read(root + slug + "/page.tsx");
  const expected = 'redirectLegacySchoolWorkspace(organisationId, "' + destination + '", "' + view + '"';
  assert(source.includes(expected), slug + ": old bookmarked route must preserve workflow destination");
  assert(!source.includes("Workspace organisationId"), slug + ": duplicate page must not mount a second workflow");
}

const legacy={};
let actual="",missing=false;
const compile=ts.transpileModule(read("src/lib/khpos/redirect-legacy-workspace.ts"), {
  compilerOptions: {module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022}
}).outputText;
vm.runInNewContext(compile,{
  exports:legacy, URLSearchParams,
  require(name){
    if(name==="next/navigation") return {
      notFound(){missing=true;throw new Error("NOT_FOUND");},
      redirect(href){actual=href;throw new Error("REDIRECT");},
    };
    if(name==="@/lib/http")return {UUID_RE:/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i};
    throw new Error("Unexpected dependency: "+name);
  },
});
const organisationId="11111111-1111-4111-8111-111111111111";
const meetingId="22222222-2222-4222-8222-222222222222";
assert.throws(()=>legacy.redirectLegacySchoolWorkspace(organisationId,"announcements","meetings",{
  meeting:meetingId,view:"tampered",return:"my class",bad:"ok",
}),/REDIRECT/);
assert.equal(new URL("https://example.test"+actual).pathname, "/khpos/"+organisationId+"/announcements");
const query=new URL("https://example.test"+actual).searchParams;
assert.equal(query.get("meeting"),meetingId);
assert.equal(query.get("view"),"meetings","Old links cannot override their assigned inner view");
assert.equal(query.get("return"),"my class");
actual="";
assert.throws(()=>legacy.redirectLegacySchoolWorkspace("wrong-school","announcements","meetings",{}),/NOT_FOUND/);
assert.equal(missing,true,"Invalid organisation must not redirect into another school's app");
assert.equal(actual,"","Invalid organisation must not produce a redirect");

const hq=read("src/app/khpos/hq/meetings/page.tsx");
assert(hq.includes("<HqMeetings")&&hq.includes('<IdeasBoard scope="hq"'), "HQ collaboration preserves independent, authorised data providers");
assert(read("src/app/khpos/hq/ideas/page.tsx").includes('redirect("/khpos/hq/meetings?view=ideas")'),"HQ discussion legacy URL stays valid");
assert(!read("src/components/khpos/HqSectionNavigation.tsx").includes('href: "/khpos/hq/ideas"'),"HQ navigation cannot duplicate discussions");

const nav=read("src/components/khpos/SchoolWorkspaceNav.tsx");
assert(nav.includes('"/availability", "/visitors"'),"Attendance, outings and gate visitors remain grouped without merging sensitive workflows");
assert(nav.includes('"/safeguarding"'),"Protected safeguarding remains separate");
assert(nav.includes('"/decisions"'),"Operational approvals remain separate from School Improvement reviews");
console.log("KHP-OS consolidated workspaces: 15 school legacy routes, 6 canonical hubs, 1 unified HQ collaboration, query preservation, valid school boundaries, selected modules and safeguarding contracts passed.");
