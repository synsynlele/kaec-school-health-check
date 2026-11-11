import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function walk(dir, ending) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(x => {
    const p = path.join(dir,x.name);
    return x.isDirectory() ? walk(p,ending) : p.endsWith(ending) ? [p] : [];
  }).sort();
}
const read = p => fs.readFileSync(p,'utf8');
const parse = p => ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function imports(code, from) {
  return [...code.matchAll(/from\s+["']([^"']+)["']/g)].map(m => {
    const spec = m[1];
    if (!spec.startsWith('@/components/khpos/') && !spec.startsWith('./') && !spec.startsWith('../')) return null;
    const base = spec.startsWith('@/') ? spec.replace(/^@\//, 'src/') : path.normalize(path.join(path.dirname(from), spec));
    return [base + '.tsx',path.join(base,'index.tsx')].find(candidate => candidate.startsWith('src/components/khpos/') && fs.existsSync(candidate)) || null;
  }).filter(Boolean);
}
const routes = walk('src/app/khpos','/page.tsx');
const schoolRoutes = routes.filter(p=>p.startsWith('src/app/khpos/[organisationId]/'));
const comps = walk('src/components/khpos','.tsx');
assert(schoolRoutes.length >= 55, 'Unexpectedly missing school pages');
const diagnostics = [], missing = [], warnings = [], componentInfo = new Map();
function evaluate(p) {
  const ast = parse(p);
  for (const e of ast.parseDiagnostics) diagnostics.push(p+': '+ts.flattenDiagnosticMessageText(e.messageText,' '));
  const counts={buttons:0,inputs:0,selects:0,textareas:0,forms:0,tables:0,headings:0};
  function visit(n) {
    if (ts.isJsxSelfClosingElement(n)||ts.isJsxOpeningElement(n)) {
      const tag = n.tagName.getText(ast);
      const attrs=Object.fromEntries(n.attributes.properties.filter(ts.isJsxAttribute).map(a=>[a.name.getText(ast),a.initializer?.getText(ast)||'true']));
      const keys={button:'buttons',input:'inputs',select:'selects',textarea:'textareas',form:'forms',table:'tables'};
      if (keys[tag]) counts[keys[tag]]++;
      if (/^h[1-3]$/.test(tag)) counts.headings++;
      if (['div','span','p'].includes(tag)&&attrs.onClick&&!attrs.role&&!attrs.tabIndex) warnings.push({file:p,line:ast.getLineAndCharacterOfPosition(n.pos).line+1,kind:'clickable-nonsemantic'});
      if (tag==='a'&&attrs.target?.includes('_blank')&&!attrs.rel?.includes('noopener')) warnings.push({file:p,line:ast.getLineAndCharacterOfPosition(n.pos).line+1,kind:'external-link-rel'});
    }
    ts.forEachChild(n,visit);
  }
  visit(ast);
  return counts;
}
for(const p of comps){const c=evaluate(p);componentInfo.set(p,{...c,lines:read(p).split('\n').length,imports:imports(read(p),p)});}
const routeInfo=[];
for(const p of routes){evaluate(p);const s=read(p);const targets=imports(s,p);for(const x of targets)if(!fs.existsSync(x))missing.push({route:p,missing:x});routeInfo.push({route:p.replace('src/app/khpos','/khpos').replace(/\/page\.tsx$/,''),components:targets,hasMetadata:/export\s+const\s+metadata\b/.test(s),usesOrganisationId:s.includes('organisationId')});}
assert.deepEqual(diagnostics,[],'TSX parse errors');
assert.deepEqual(missing,[],'Unresolved workspace import');
assert(routeInfo.filter(x=>x.route.startsWith('/khpos/[organisationId]')).every(x=>x.usesOrganisationId),'School page missing organisation binding');
assert(routeInfo.every(x=>x.hasMetadata),'Every KHP-OS page must have explicit document metadata');
assert.deepEqual(warnings,[],'Inaccessible click targets or unsafe external links must be fixed before release');
const visited=new Set();function follow(p){if(visited.has(p)||!componentInfo.has(p))return;visited.add(p);for(const c of componentInfo.get(p).imports)follow(c);}for(const p of routeInfo)for(const c of p.components)follow(c);for(const layout of walk('src/app/khpos','/layout.tsx'))for(const c of imports(read(layout),layout))follow(c);
const all=[...componentInfo.entries()].map(([file,o])=>({file,lines:o.lines,buttons:o.buttons,inputs:o.inputs,selects:o.selects,textareas:o.textareas,forms:o.forms,tables:o.tables,headings:o.headings,reachable:visited.has(file)}));
const heavy=all.filter(x=>x.lines>800).sort((a,b)=>b.lines-a.lines);

const complexWorkspaces = [
  'LearnerProgressWorkspace','BuilderProjectsWorkspace','AcademicAssuranceWorkspace',
  'StaffTransitionWorkspace','StaffAccountabilityWorkspace','SkillsDevelopmentWorkspace',
  'AcademicDeliveryWorkspace','YoungCeoWorkspace','StaffPerformanceWorkspace',
  'PotentialDevelopmentWorkspace','ReportsWorkspace','PerformanceWorkspace',
  'DecisionsWorkspace','LeadershipFinancialWorkspace','RecruitmentWorkspace',
  'AvailabilityWorkspace','MyWorkWorkspace','PeopleWorkspace',
];
const complexWorkspaceResilience = complexWorkspaces.map(name => {
  const file = name === 'ReportsWorkspace'
    ? 'src/components/khpos/ReportsWorkspace.tsx'
    : 'src/components/khpos/ops/' + name + '.tsx';
  const source = read(file);
  const hasVisibleFeedback = /<ActionFeedback\b/.test(source) && /notice=\{(?!""|''|null)/.test(source);
  const hasLoadErrorRecovery = /\.catch\(\(/.test(source) || (/void \(async \(\) => \{/.test(source) && /\bcatch\s*\{/.test(source));
  const hasActionErrorRecovery = /\bcatch\s*\(/.test(source) || /\bcatch\s*\{/.test(source);
  const hasBusyCleanup = /\bfinally\s*\{/.test(source);
  assert(hasVisibleFeedback, name + ': successful work should have a consistent visible notification');
  assert(hasLoadErrorRecovery, name + ': network load failures must not leave an endless loader');
  assert(hasActionErrorRecovery && hasBusyCleanup, name + ': action failures must clear the busy state');
  return {file, hasVisibleFeedback, hasLoadErrorRecovery, hasActionErrorRecovery, hasBusyCleanup};
});


// Institutional UI coverage gate: every KHP-OS route inherits the design system,
// and school, corporate HQ and administration navigation are separate.
// This is source evidence only; it never marks a screen visually approved.
const platformLayout = read('src/app/khpos/layout.tsx');
const schoolLayout = read('src/app/khpos/[organisationId]/layout.tsx');
const hqLayout = read('src/app/khpos/hq/layout.tsx');
const adminLayout = read('src/app/khpos/admin/layout.tsx');
const hqNavigation = read('src/components/khpos/HqSectionNavigation.tsx');
const adminNavigation = read('src/components/khpos/AdminNav.tsx');
const platformStyles = read('src/app/globals.css');
assert(platformLayout.includes('khpos-platform-ui'), 'Every KHP-OS route needs the shared design system');
for (const token of ['--khpos-control-height:', '--khpos-radius-card:', '.khpos-interface-card', '.khpos-horizontal-nav']) {
  assert(platformStyles.includes(token), 'KHP-OS shared interface system missing '+token);
}
const sharedActiveNav = read('src/components/khpos/useActiveNavScroll.ts');
assert(sharedActiveNav.includes('row.scrollLeft +='), 'Long navigation must keep the selected destination visible');
for (const file of ['SchoolWorkspaceNav.tsx', 'HqSectionNavigation.tsx', 'AdminNav.tsx', 'KaecHqWorkspace.tsx']) {
  assert(read('src/components/khpos/'+file).includes('useActiveNavScroll'), 'Active navigation is missing from '+file);
}
for (const file of [
  'src/components/khpos/ops/AcademicDeliveryWorkspace.tsx',
  'src/components/khpos/ops/PeopleWorkspace.tsx',
  'src/components/khpos/ops/IssuesWorkspace.tsx',
  'src/components/khpos/ops/DecisionsWorkspace.tsx',
  'src/components/khpos/ops/LearnerProgressWorkspace.tsx',
  'src/components/khpos/ops/StaffAccountabilityWorkspace.tsx',
  'src/components/khpos/ops/StaffPerformanceWorkspace.tsx',
  'src/components/khpos/ReportsWorkspace.tsx',
  'src/components/khpos/ops/MeetingsWorkspace.tsx',
  'src/components/khpos/AdminConsoleWorkspace.tsx'
]) {
  const source = read(file);
  assert(source.includes('khpos-hero') || source.includes('khpos-interface-card'),
    'Important workspace lacks the common visual system: '+file);
}
assert(schoolLayout.includes('SchoolWorkspaceNav'), 'School-specific navigation must survive the UI overhaul');
assert(hqLayout.includes('HqSectionNavigation'), 'HQ subpages need a consistent corporate navigation');
assert(adminLayout.includes('<AdminNav />'), 'Admin pages need the shared admin navigation');
assert(adminNavigation.includes('School Platform'), 'Do not remove the admin account escape route');
assert(hqNavigation.includes('aria-current=') && hqNavigation.includes('overflow-x-auto'),
  'HQ subpage navigation must be accessible on mobile');
for (const href of ['/khpos/hq/schools','/khpos/hq/reports','/khpos/hq/meetings','/khpos/hq/ideas','/khpos/hq/ask']) {
  assert(hqNavigation.includes(href), 'HQ navigation missing ' + href);
}
for (const rule of ['--khpos-focus:', 'color-scheme: light;', 'scroll-margin-block-start:', 'div:has(> table)', 'prefers-reduced-motion']) {
  assert(platformStyles.includes(rule), 'KHP-OS cross-app styling missing ' + rule);
}
const adminRoutes = routeInfo.filter(item => item.route.startsWith('/khpos/admin'));
assert.equal(adminRoutes.length, 4, 'Unexpected platform-admin route count');
for (const route of adminRoutes) {
  const routeFile = 'src/app' + route.route.replace('/khpos','/khpos') + '/page.tsx';
  const text = read(routeFile);
  assert(!text.includes('<AdminNav'), 'Admin route must not render a second navigation: ' + route.route);
}
function routeFamily(route) {
  return route.startsWith('/khpos/[organisationId]') ? 'school'
    : route.startsWith('/khpos/hq') ? 'hq'
    : route.startsWith('/khpos/admin') ? 'admin'
    : 'entry-or-network';
}
function componentsForRoute(route) {
  const seen = new Set();
  function visit(file) {
    if (seen.has(file) || !componentInfo.has(file)) return;
    seen.add(file);
    for (const child of componentInfo.get(file).imports) visit(child);
  }
  for (const file of route.components) visit(file);
  return [...seen].sort();
}
const surfaceCoverage = routeInfo.map(route => {
  const files = componentsForRoute(route);
  const components = files.map(file => ({file, ...componentInfo.get(file)}));
  const total = key => components.reduce((sum, c) => sum + (c[key] || 0), 0);
  return {
    route: route.route, family: routeFamily(route.route),
    inheritedDesignSystem: true, manualVisualStatus: 'not-tested',
    componentFiles: files,
    innerScreenIndicators: {
      formElements: total('forms'), buttons: total('buttons'), inputs: total('inputs'),
      selects: total('selects'), textareas: total('textareas'), tables: total('tables'),
      headlines: total('headings'),
    },
  };
});

// Route-specific review evidence: report each destination and the subcomponents
// that actually render its controls. A static check cannot assert visual parity.
const everyScreenReview = surfaceCoverage.map(screen => {
  const componentPaths = screen.componentFiles;
  const pagePath = 'src/app' + screen.route + '/page.tsx';
  const sources = [pagePath, ...componentPaths].filter(file => fs.existsSync(file));
  const source = sources.map(file => read(file)).join('\n');
  const directComponents = screen.componentFiles.map(file => path.basename(file, '.tsx'));
  const controls = screen.innerScreenIndicators;
  const indicators = {
    labelledPageHeading: /<h1\b/.test(source),
    searchOrSort: /RecordQueueSearchControls|type="search"|role="search"|Sort records|searchParams/.test(source),
    historyOrReview: /RecordQueueTabs|History|history|review/.test(source),
    formInteraction: controls.inputs + controls.selects + controls.textareas + controls.forms > 0,
    formFeedback: /ActionFeedback|role="alert"|role="status"|notice\b/.test(source),
    loadingOrRetry: /LoadingScreen|loading|Loading|Retry|try again/.test(source),
    surfaceStyling: /khpos-interface-card|khpos-hero|rounded-(?:2xl|3xl)|rounded-\[/.test(source),
    responsiveComposition: /\b(?:sm|md|lg|xl):/.test(source),
    mobileGridReview: /(?:^|\s)grid-cols-[3456](?:\s|")/.test(source),
  };
  const sourceReviewFlags = [];
  if (!indicators.labelledPageHeading) sourceReviewFlags.push('Confirm a visible, meaningful page heading');
  if (indicators.formInteraction && !indicators.formFeedback) sourceReviewFlags.push('Inspect success/error feedback on forms');
  if (indicators.mobileGridReview) sourceReviewFlags.push('Inspect base-width 3+ column grids on 320px phones');
  if (!indicators.surfaceStyling) sourceReviewFlags.push('Inspect individual content-card styling');
  if (!indicators.responsiveComposition) sourceReviewFlags.push('Inspect mobile/tablet layout');
  return {
    route: screen.route,
    family: screen.family,
    directComponents,
    reachableComponentCount: componentPaths.length,
    controls,
    sourceIndicators: indicators,
    sourceReviewFlags,
    codeAuditStatus: 'reviewed-by-structural-audit',
    authenticatedVisualStatus: 'not-tested',
    deviceAcceptance: {mobile320:false,mobile390:false,tablet:false,desktop:false},
    roleWorkflowAcceptance: false,
  };
});
assert.equal(everyScreenReview.length, 71, 'Every school, HQ, admin and other route must have an acceptance record');
assert.equal(new Set(everyScreenReview.map(row => row.route)).size, 71,
  'Per-route review has duplicate destinations');
const screenIssues = everyScreenReview.reduce((sum,row)=>sum+row.sourceReviewFlags.length,0);
fs.writeFileSync('artifacts/khpos-every-screen-source-review.json',
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    scope: 'All 71 KHP-OS routes and their imported workspace components',
    limits: 'Static structural inspection only. Role-scoped signed-in browser, screenshots, real-device interaction and visual parity are not tested.',
    routeCount: everyScreenReview.length,
    flagsNeedingManualInspection: screenIssues,
    routes: everyScreenReview,
  },null,2)+'\n');
const columns = [
  '# KHP-OS — every page and inner-screen acceptance register',
  '',
  'This register audits code composition across all 71 routes. **All signed-in visual/device/role checks are intentionally unapproved** until an authorised school/HQ/admin tester exercises the screens.',
  '',
  '| Route | Area | Direct component(s) | Source flags | Mobile | Desktop | Workflow |',
  '|---|---|---|---|---|---|---|',
];
for (const item of everyScreenReview) {
  const flags = item.sourceReviewFlags.length ? item.sourceReviewFlags.join('; ') : 'No source heuristic flagged';
  columns.push('| '+item.route+' | '+item.family+' | '+(item.directComponents.join(', ')||'Route component')+' | '+flags+' | ☐ | ☐ | ☐ |');
}
columns.push('', '## Acceptance rules', '',
  'A route is complete only when an authorised tester has checked its full page, inner forms, tabs, filters, modals, search, sorting, history, permission-denied view, error feedback, selected state and mobile overflow.',
  'Test 320/390px phones, tablet, desktop, keyboard-only and 200% text zoom. Assess teacher, school leader, staff with multiple roles, HQ member and platform administrator as relevant. Preserve safeguarding and cross-school isolation.',
  '', 'Never interpret codeAuditStatus as a screenshot, accessibility or workflow sign-off.', '');
fs.writeFileSync('artifacts/khpos-every-screen-acceptance.md', columns.join('\n')+'\n');
console.log('Every-screen source review: '+everyScreenReview.length+' routes; '+screenIssues+
  ' targeted human-review flags. Screens remain unapproved for signed-in visual/device QA.');

assert.equal(surfaceCoverage.length, routes.length, 'Every KHP-OS page must appear in the UI coverage matrix');
assert.equal(surfaceCoverage.filter(r => r.family === 'school').length, 56,
  'All school pages must be source-reviewed');
assert.equal(surfaceCoverage.filter(r => r.family === 'hq').length, 6,
  'All six corporate HQ pages must be source-reviewed');
const surfaceStats = Object.fromEntries(['school','hq','admin','entry-or-network']
  .map(family => [family, surfaceCoverage.filter(item => item.family === family).length]));
fs.mkdirSync('artifacts', {recursive: true});
fs.writeFileSync('artifacts/khpos-ui-surface-coverage.json',
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    limitation: 'Static JSX and layout inventory. No signed-in screenshot, device testing or role approval has been performed.',
    surfaceStats, routes: surfaceCoverage,
  }, null, 2) + '\n');
console.log('Institutional UI coverage: ' + JSON.stringify(surfaceStats) +
  ' routes with shared design tokens and dedicated school/HQ/admin shells.');

const output={generatedAt:new Date().toISOString(),limitations:'Source audit only, not authenticated visual or device validation',schoolRouteCount:schoolRoutes.length,khposRouteCount:routes.length,componentCount:comps.length,routeReachableComponentCount:visited.size,routes:routeInfo,components:all,topComplexity:heavy.slice(0,30),complexWorkspaceResilience,warnings,manualAcceptanceRequired:['Per-role signed-in browser interaction','All tabs, dialogs, edit and approval flows','360/390/430px, tablet, desktop, dark and light modes','Keyboard, screenreader, contrast and text zoom','Cross-school authorisation, persistence and no data loss']};
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/khpos-ui-route-audit.json',JSON.stringify(output,null,2)+'\n');
console.log('KHP-OS full route/source audit: '+schoolRoutes.length+' school pages, '+routes.length+' total routes, '+comps.length+' JSX files, '+visited.size+' reachable inner component files.');
console.log('Watch: '+heavy.length+' components >800 lines; '+warnings.length+' heuristic interaction warnings.');
for(const w of warnings.slice(0,25))console.log('CHECK '+w.file+':'+w.line+' '+w.kind);
console.log('Detailed audit: artifacts/khpos-ui-route-audit.json');

const matrix = [
  '# KHP-OS — complete authenticated page and inner-workflow acceptance matrix',
  '',
  'Generated from the current repository route inventory. This is a **test plan**, not proof of visual or functional approval. Do not mark a row passed until it has actually been exercised under its intended role.',
  '',
  'For each screen: navigate from its parent and a deep link; inspect visual hierarchy and all inner tabs/drawers/dialogs; complete a safe create/edit/save/return journey where authorised; confirm feedback, errors, permissions, state persistence and history; test at mobile 360/390/430px, tablet and desktop.',
  '',
  '| Route | Main component | Critical role/workflow focus | Mobile | Desktop | Authorised workflow | Result |',
  '|---|---|---|---|---|---|---|',
];
function focusFor(route) {
  const q = route.toLowerCase();
  if(q.includes('safeguarding')) return 'Confidential cases, separate authority, redaction, no leaked summaries';
  if(q.includes('visitors') || q.includes('visitor-kiosk')) return 'Pairing, visitor self-check-in, authorised admission and check-out; never disclose visitor register to kiosk';
  if(q.includes('teaching-presence') || q.endsWith('/work')) return 'Attendance, actual class evidence, overdue actions and linked records';
  if(q.includes('meetings')) return 'Invitations, join/end/cancel, history and decision-to-work';
  if(q.includes('reports')) return 'Report draft, submission, assigned review, return, correction and privacy';
  if(q.includes('academic-')) return 'Timetables, teaching/exam approval, revisions and clash checks';
  if(q.includes('staff-') || q.includes('/people') || q.includes('/team')) return 'School role scope, approvals, employee record versions and history';
  if(q.includes('parents') || q.includes('parent-journeys')) return 'Family contact scope, enquiry stages and recipient privacy';
  if(q.includes('decisions') || q.includes('issues')) return 'Author, approver, escalation, verified closure and audit trail';
  if(q.includes('announcements')) return 'Audience, publishing rights, acknowledgement and withdrawal';
  if(q.includes('ideas')) return 'Anonymous/private participation, audience isolation and moderation';
  if(q.includes('library') || q.includes('records')) return 'Source-controlled policy, approved process, record retrieval';
  if(q.includes('builder-') || q.includes('young-ceo') || q.includes('worldready') || q.includes('skills-') || q.includes('potential-')) return 'Only relevant school programmes, accurate learner evidence and age scope';
  if(q.includes('admin') || q.includes('/hq/') || q.includes('portfolio')) return 'Company/school boundary, appointed HQ roles and limited disclosures';
  return 'Primary actions, states, record detail, search/filter, errors and history';
}
for(const page of routeInfo) {
  const componentNames=page.components.map(x=>path.basename(x,'.tsx')).join(', ')||'(page layout)';
  matrix.push('| '+page.route+' | '+componentNames+' | '+focusFor(page.route)+' | ☐ | ☐ | ☐ | Untested |');
}
matrix.push('', '## Corporate HQ & platform-administration acceptance', '',
  '- [ ] HQ overview, School Pathfinders, reports, meetings, discussions and Ask KHP-OS each open from both deep links and mobile navigation.',
  '- [ ] Corporate modules use the correct appointed role, MFA requirements, review authority and self-approval exclusions.',
  '- [ ] Admin Console, announcements, school/campus directory and partnership governance retain administrator MFA, required reasons and access decisions.',
  '- [ ] Narrow phones can scroll horizontal HQ/admin navigation without page-width overflow or hidden action buttons.',
  '- [ ] Partnership confirmation dialog remains readable with large text, keyboard access and long approval reasons.',
  '- [ ] Verify denied, signed-out, loading, empty, offline, successful and error states independently for HQ and administration.',
  '');
matrix.push('', '## Every inner screen must additionally pass', '', '- [ ] All visible tabs, accordions, modals, date pickers, search, sorting, pagination and long lists.', '- [ ] Bright and dark appearance at 360, 390 and 430 CSS px, 200% text zoom, tablet and desktop.', '- [ ] Focus order, Escape, selected state, labels, status feedback, meaningful empty and failure screens.', '- [ ] Staff member can complete assigned action without founder or developer explanation.', '- [ ] No duplicate input when records are already available in the school operating system.', '- [ ] No data loss; approved historic records and correction trails remain retrievable.', '- [ ] Confidentiality and school-campus-role separation; independent approval is preserved.', '- [ ] School Guardian signs off core operations and an authorised HQ tester signs off corporate-only routes.', '', 'A source-level automated pass is not a substitute for these human-verified results.', '');
fs.writeFileSync('artifacts/khpos-ui-manual-test-matrix.md',matrix.join('\n'));
console.log('Generated page-by-page human UAT matrix: artifacts/khpos-ui-manual-test-matrix.md');
