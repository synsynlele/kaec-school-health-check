import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Navigation contract failed: ${context} is missing ${expected}`);
  }
}

const adminNav = read("src/components/khpos/AdminNav.tsx");
for (const href of [
  'href: "/khpos/admin"',
  'href: "/khpos/admin/partnerships"',
  'href: "/khpos/portfolio"',
]) {
  requireText(adminNav, href, "Admin navigation");
}
requireText(adminNav, "usePathname", "Admin active-route handling");
requireText(adminNav, 'href="/account"', "Admin school-platform escape action");
requireText(adminNav, "School Platform", "Admin school-platform escape label");

const adminConsole = read("src/components/khpos/AdminConsoleWorkspace.tsx");
requireText(adminConsole, 'window.location.replace("/khpos")', "Admin sign-out destination");
requireText(adminConsole, 'href="/account"', "Admin signed-out and denied escape route");
requireText(adminConsole, "Go to School Platform", "Admin signed-out and denied escape label");

const accountEntry = read("src/components/account/AccountEntry.tsx");
requireText(accountEntry, "return <AccountAccess />", "Explicit school/account context");
if (accountEntry.includes('router.replace("/khpos/admin")') || accountEntry.includes('fetch("/api/khpos/admin"')) {
  throw new Error(
    "Navigation contract failed: platform-admin authority must not force /account back into the Admin Console.",
  );
}

const portfolio = read("src/components/khpos/PortfolioIntelligenceWorkspace.tsx");
requireText(portfolio, 'href="/khpos/admin"', "Portfolio return link");
if (portfolio.includes('href="/"')) {
  throw new Error("Navigation contract failed: Network summary must not return to the public homepage.");
}

const accessHub = read("src/app/khpos/page.tsx");
for (const href of [
  'href="/khpos/admin"',
  'href="/khpos/admin/partnerships"',
  'href="/khpos/portfolio"',
  'href="/account"',
]) {
  requireText(accessHub, href, "KHP-OS secure access hub");
}

const schoolNav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
for (const suffix of [
  "/priorities",
  "/implementation",
  "/playbooks",
  "/evidence",
  "/reviews",
  "/improvement",
  "/benchmarking",
  "/learning-intelligence",
  "/human-potential-intelligence",
]) {
  requireText(schoolNav, `suffix: "${suffix}"`, "School workspace navigation");
}
requireText(schoolNav, 'href="/account"', "School workspace account access");
requireText(schoolNav, 'href="/khpos"', "School workspace secure access hub");
if (schoolNav.includes('href="/khpos/admin"')) {
  throw new Error(
    "Navigation contract failed: school users must not be offered platform-admin navigation from the school workspace.",
  );
}

const schoolLayout = read("src/app/khpos/[organisationId]/layout.tsx");
requireText(schoolLayout, "SchoolWorkspaceNav", "School workspace layout");
requireText(schoolLayout, "khpos-school-shell", "School workspace shell");

const playbooksPage = read("src/app/khpos/[organisationId]/playbooks/page.tsx");
requireText(playbooksPage, "PlaybooksWorkspace", "School playbooks route");
const playbooksLibrary = read("src/lib/khpos/playbooks.ts");
requireText(playbooksLibrary, "transformation-leadership", "Universal playbook library");
requireText(playbooksLibrary, "sustainability-institutionalisation", "Universal playbook library");
const playbooksWorkspace = read("src/components/khpos/PlaybooksWorkspace.tsx");
requireText(playbooksWorkspace, "Current action guides", "School playbooks workspace");
requireText(playbooksWorkspace, "/api/khpos/implementation/${organisationId}", "Playbook implementation data source");

const legacySchoolHome = read("src/app/khpos/[organisationId]/page.tsx");
requireText(legacySchoolHome, "redirect(`/khpos/${organisationId}/work`)", "Old school-home URL must lead to Today");
if (legacySchoolHome.includes("CommandCentre")) {
  throw new Error("A second school dashboard must no longer render.");
}
const healthPanel = read("src/components/khpos/ops/SchoolHealthSummary.tsx");
requireText(healthPanel, "School health & improvement", "Unique school-health content must be retained inside Today");
requireText(healthPanel, "View health report", "Authorised School Health Check access");
requireText(healthPanel, '"/report/" + baseline.assessmentId', "School Health Check report route");
requireText(healthPanel, "canViewHealthReport", "Diagnostic records remain role-restricted");
requireText(healthPanel, "onToggle", "School-health details must load only when opened");
const todayWorkspace = read("src/components/khpos/ops/MyWorkWorkspace.tsx");
requireText(todayWorkspace, '<TodayAttendanceCard organisationId={organisationId}', "Today attendance");
requireText(todayWorkspace, 'My reports</span>', "Direct reports link");
requireText(todayWorkspace, '<AnnouncementsWorkspace organisationId={organisationId} compact />', "Current announcements preview");
if (todayWorkspace.includes("<ReportsWorkspace") || todayWorkspace.includes("<AnnouncementsWorkspace organisationId={organisationId} />")) {
  throw new Error("Today must not embed full duplicate reporting or announcement workspaces.");
}
if (todayWorkspace.indexOf("<AnnouncementsWorkspace organisationId={organisationId} compact />") > todayWorkspace.indexOf('My reports</span>')) {
  throw new Error("Today must show live announcements above My reports.");
}
requireText(todayWorkspace, '<SchoolQuickActions organisationId={organisationId} reviewCount={verificationItems.length} />', "School-day quick actions");
if (todayWorkspace.includes('aria-label="Daily shortcuts"')) throw new Error("Today must have one consolidated quick-action area, not repeated shortcut rows.");
if (todayWorkspace.indexOf("<TodayAttendanceCard") > todayWorkspace.indexOf("<AssessmentTimetable")) {
  throw new Error("Today must show attendance before supplementary timetable panels.");
}
requireText(todayWorkspace, '<SchoolHealthSummary organisationId={organisationId} />', "School health & improvement is inside Today");

const partnershipStatus = read("src/components/khpos/PartnershipStatusWorkspace.tsx");
requireText(partnershipStatus, "Open KHP-OS", "Partnership primary action");
requireText(partnershipStatus, "bg-mint-300", "Partnership primary action contrast");

const globalStyles = read("src/app/globals.css");
for (const token of [
  "--color-mint-200:",
  "--color-mint-300:",
  "--color-mint-400:",
  ".khpos-school-shell",
]) {
  requireText(globalStyles, token, "KHP-OS workspace styling");
}

console.log("Navigation contract validated.");


const authCallback = read("src/app/auth/callback/page.tsx");
for (const expected of [
  'next === "/account"',
  'fetch("/api/account"',
  'body.platformAdmin?.status === "active"',
  'router.replace("/khpos/admin")',
]) {
  requireText(authCallback, expected, "platform-admin login routing");
}

const accountApi = read("src/app/api/account/route.ts");
for (const expected of [
  "getKhposPlatformAccess",
  "platformAdmin",
]) {
  requireText(accountApi, expected, "account authority discovery");
}

// Evaluate only the static navigation declarations to verify coverage, rather
// than asserting that a route merely appears somewhere in the component.
const declarations = schoolNav.slice(
  schoolNav.indexOf("const transformLinks"),
  schoolNav.indexOf("function NavigationGroup("),
);
const iconNames = schoolNav.match(/import \{([^}]*?)\} from "lucide-react"/)[1]
  .split(",").map((name) => name.trim()).filter(Boolean);
const context = Object.fromEntries(iconNames.map((name) => [name, {}]));
const navigation = vm.runInNewContext(
  ts.transpile(declarations + "\n({ workspaceLinks, dailyLinks, navigationGroups, schoolAreas, primarySuffix, matchesSearch });"),
  context,
);
const visibleLinks = [...navigation.dailyLinks, ...navigation.navigationGroups.flatMap((group) => group.links)];
const destinations = visibleLinks.map((link) => link.suffix);
if (new Set(destinations).size !== destinations.length) {
  throw new Error("School navigation contains duplicate destinations.");
}
for (const link of navigation.workspaceLinks) {
  const reachable = destinations.includes(link.suffix) || navigation.schoolAreas.some(area => area.routes.includes(link.suffix) && destinations.includes(area.routes[0]));
  if (!reachable) throw new Error(`School navigation lost ${link.suffix || "overview"}.`);
  const page = path.join(root, "src/app/khpos/[organisationId]", link.suffix, "page.tsx");
  if (!fs.existsSync(page)) throw new Error(`School navigation has no page for ${link.suffix}.`);
}
if (navigation.dailyLinks.map((link) => link.suffix).join(",") !== "/work,/teaching-presence,/reports,/announcements") {
  throw new Error("Mobile navigation must expose Today, School Day, Reports and Updates.");
}
if (!navigation.matchesSearch("/availability","Leave & cover","movement permission")) {
  throw new Error("Users must be able to search movement permission and find Leave & cover.");
}
const schoolDayArea = navigation.schoolAreas.find(area => area.routes[0] === "/teaching-presence");
if (!schoolDayArea || schoolDayArea.routes.join(",") !== "/teaching-presence,/availability,/visitors") {
  throw new Error("School-day attendance, movement and visitor register must remain together.");
}
const staffArea = navigation.schoolAreas.find(area => area.routes[0] === "/people");
if (staffArea?.routes.includes("/availability")) {
  throw new Error("Movement permission belongs with school-day sign-in, not staff administration.");
}
if (navigation.navigationGroups.length !== 6) {
  throw new Error("More must present six task-based school areas.");
}
if (destinations.length !== 20) throw new Error("Today replaces School Overview: keep exactly 20 distinct main entrances.");
if (navigation.workspaceLinks.some(link => link.suffix === "")) throw new Error("Remove the School Overview entry from More.");
if (!navigation.matchesSearch("/work", "Today", "school overview")) throw new Error("Users searching for the former overview must find Today.");
const secondaryRoutes = navigation.schoolAreas.flatMap(area=>area.routes);
if (new Set(secondaryRoutes).size !== secondaryRoutes.length) throw new Error("A page must belong to only one work area.");
for (const area of navigation.schoolAreas) for (const route of area.routes) {
  if (navigation.primarySuffix(route)!==area.routes[0]) throw new Error(`Wrong area entrance for ${route}`);
}
if (!navigation.matchesSearch("/people","Staff","leave") || !navigation.matchesSearch("/potential-development","Learner development","skills")) throw new Error("Page search must find pages inside a work area.");
console.log(`School navigation validated: ${navigation.workspaceLinks.length} routes reachable through ${destinations.length} unique main entrances, with related pages grouped and searchable.`);

for (const file of [
  "src/components/account/AccountAccess.tsx",
  "src/components/khpos/KaecHqWorkspace.tsx",
]) {
  requireText(read(file), 'window.location.replace("/khpos")', file + " sign-out returns to the app entrance");
}

requireText(schoolNav, 'window.location.replace("/khpos")', "Shared school sign-out returns to app entrance");
