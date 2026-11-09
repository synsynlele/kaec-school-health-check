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
  const hasLoadErrorRecovery = /\.catch\(\(/.test(source);
  const hasActionErrorRecovery = /\bcatch\s*\(/.test(source) || /\bcatch\s*\{/.test(source);
  const hasBusyCleanup = /\bfinally\s*\{/.test(source);
  assert(hasVisibleFeedback, name + ': successful work should have a consistent visible notification');
  assert(hasLoadErrorRecovery, name + ': network load failures must not leave an endless loader');
  assert(hasActionErrorRecovery && hasBusyCleanup, name + ': action failures must clear the busy state');
  return {file, hasVisibleFeedback, hasLoadErrorRecovery, hasActionErrorRecovery, hasBusyCleanup};
});

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
matrix.push('', '## Every inner screen must additionally pass', '', '- [ ] All visible tabs, accordions, modals, date pickers, search, sorting, pagination and long lists.', '- [ ] Bright and dark appearance at 360, 390 and 430 CSS px, 200% text zoom, tablet and desktop.', '- [ ] Focus order, Escape, selected state, labels, status feedback, meaningful empty and failure screens.', '- [ ] Staff member can complete assigned action without founder or developer explanation.', '- [ ] No duplicate input when records are already available in the school operating system.', '- [ ] No data loss; approved historic records and correction trails remain retrievable.', '- [ ] Confidentiality and school-campus-role separation; independent approval is preserved.', '- [ ] School Guardian signs off core operations and an authorised HQ tester signs off corporate-only routes.', '', 'A source-level automated pass is not a substitute for these human-verified results.', '');
fs.writeFileSync('artifacts/khpos-ui-manual-test-matrix.md',matrix.join('\n'));
console.log('Generated page-by-page human UAT matrix: artifacts/khpos-ui-manual-test-matrix.md');
