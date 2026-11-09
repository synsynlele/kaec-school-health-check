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
const imports = s => [...s.matchAll(/from\s+["'](@\/components\/khpos\/[^"']+)["']/g)].map(m=>m[1].replace(/^@\//,'src/')+'.tsx');
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
for(const p of comps){const c=evaluate(p);componentInfo.set(p,{...c,lines:read(p).split('\n').length,imports:imports(read(p))});}
const routeInfo=[];
for(const p of routes){evaluate(p);const s=read(p);const targets=imports(s);for(const x of targets)if(!fs.existsSync(x))missing.push({route:p,missing:x});routeInfo.push({route:p.replace('src/app/khpos','/khpos'),components:targets,hasMetadata:/export\s+const\s+metadata\b/.test(s),usesOrganisationId:s.includes('organisationId')});}
assert.deepEqual(diagnostics,[],'TSX parse errors');
assert.deepEqual(missing,[],'Unresolved workspace import');
assert(routeInfo.filter(x=>x.route.startsWith('/khpos/[organisationId]')).every(x=>x.usesOrganisationId),'School page missing organisation binding');
const visited=new Set();function follow(p){if(visited.has(p)||!componentInfo.has(p))return;visited.add(p);for(const c of componentInfo.get(p).imports)follow(c);}for(const p of routeInfo)for(const c of p.components)follow(c);
const all=[...componentInfo.entries()].map(([file,o])=>({file,lines:o.lines,buttons:o.buttons,inputs:o.inputs,selects:o.selects,textareas:o.textareas,forms:o.forms,tables:o.tables,headings:o.headings,reachable:visited.has(file)}));
const heavy=all.filter(x=>x.lines>800).sort((a,b)=>b.lines-a.lines);
const output={generatedAt:new Date().toISOString(),limitations:'Source audit only, not authenticated visual or device validation',schoolRouteCount:schoolRoutes.length,khposRouteCount:routes.length,componentCount:comps.length,routeReachableComponentCount:visited.size,routes:routeInfo,components:all,topComplexity:heavy.slice(0,30),warnings,manualAcceptanceRequired:['Per-role signed-in browser interaction','All tabs, dialogs, edit and approval flows','360/390/430px, tablet, desktop, dark and light modes','Keyboard, screenreader, contrast and text zoom','Cross-school authorisation, persistence and no data loss']};
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/khpos-ui-route-audit.json',JSON.stringify(output,null,2)+'\n');
console.log('KHP-OS full route/source audit: '+schoolRoutes.length+' school pages, '+routes.length+' total routes, '+comps.length+' JSX files, '+visited.size+' reachable inner component files.');
console.log('Watch: '+heavy.length+' components >800 lines; '+warnings.length+' heuristic interaction warnings.');
for(const w of warnings.slice(0,25))console.log('CHECK '+w.file+':'+w.line+' '+w.kind);
console.log('Detailed audit: artifacts/khpos-ui-route-audit.json');
