import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const khpos=fs.readFileSync("src/app/khpos/page.tsx","utf8");
const landing=fs.readFileSync("src/components/landing/ProductLanding.tsx","utf8");
function hexToLinear(s){
  const hex=s.replace("#","");
  const rgb=[0,2,4].map(x=>parseInt(hex.slice(x,x+2),16)/255);
  return rgb.map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4);
}
function brightness(hex){
  const [r,g,b]=hexToLinear(hex);
  return r*0.2126+g*0.7152+b*0.0722;
}
function contrast(a,b){
  const x=brightness(a),y=brightness(b);
  return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
assert(contrast("#a7f3d0","#102233")>=7,"KHP-OS sign-in card must have AAA text contrast");
assert(contrast("#0f172a","#ffffff")>=7,"Landing sign-in button must have AAA text contrast");
assert.match(khpos,/href="\/account"[\s\S]*?aria-label="Sign in to your school/);
assert.match(khpos,/style=\{\{ backgroundColor: "#a7f3d0", color: "#102233" \}\}/);
assert.match(khpos,/min-h-40/);
assert.match(khpos,/text-xl font-black leading-snug">Sign in to your school/);
assert.match(khpos,/Continue to sign in/);
assert(!khpos.includes("from-mint-200 to-mint-400"),"Never rely on a gradient for a sign-in card's only visible fill");
assert.match(landing,/<Link href="\/account" aria-label="Sign in to your school" className="inline-flex/);
assert.match(landing,/className=\{schoolSignIn\} style=\{\{ backgroundColor: "#0f172a", color: "#ffffff" \}\}/);
assert.match(landing,/href="\/khpos" className="font-bold text-brand-700/,"Incoming Custodians must still find the KHP-OS invitation entrance");
for(const path of ["src/app/khpos/page.tsx","src/components/landing/ProductLanding.tsx"]){
  const ast=ts.createSourceFile(path,fs.readFileSync(path,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length,0,path+" syntax");
}
console.log("Sign-in mobile visibility passed: solid native color fallback, AAA contrast, prominent labels, mobile touch targets and preserved routes.");
