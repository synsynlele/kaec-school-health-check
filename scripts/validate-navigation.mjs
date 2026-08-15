import fs from "node:fs";
import path from "node:path";

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

const portfolio = read("src/components/khpos/PortfolioIntelligenceWorkspace.tsx");
requireText(portfolio, 'href="/khpos/admin"', "Portfolio return link");
if (portfolio.includes('href="/"')) {
  throw new Error("Navigation contract failed: Portfolio Intelligence must not return to the public homepage.");
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
  "/evidence",
  "/reviews",
  "/improvement",
  "/benchmarking",
  "/learning-intelligence",
  "/human-potential-intelligence",
]) {
  requireText(schoolNav, `suffix: "${suffix}"`, "School workspace navigation");
}
requireText(schoolNav, 'href="/khpos/admin"', "School workspace Admin Console access");

const schoolLayout = read("src/app/khpos/[organisationId]/layout.tsx");
requireText(schoolLayout, "SchoolWorkspaceNav", "School workspace layout");

console.log("Navigation contract validated.");
