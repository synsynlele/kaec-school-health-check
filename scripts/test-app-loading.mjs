import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

function load(path, require, extra = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require, ...extra });
  return exports;
}
const screen = load('src/components/navigation/LoadingScreen.tsx', () => jsx);
const html = renderToStaticMarkup(React.createElement(screen.LoadingScreen));
assert.match(html, /role="status"/);
assert.match(html, /KHP-OS/);
assert.match(html, /Opening your workspace/);
assert.match(html, /min-height:100svh/);
assert.match(html, /position:fixed;inset:0/);
assert.match(html, /background:#0f172a/);
assert(!html.includes('<img'), 'The first loading paint must not depend on an image request');
const sectionHtml = renderToStaticMarkup(React.createElement(screen.LoadingScreen, { inline: true }));
assert.match(sectionHtml, /data-loading-scope="section"/);
assert.match(sectionHtml, /position:relative/);
assert(!sectionHtml.includes('position:fixed'), 'A section refresh must not block the whole workspace');
assert.match(sectionHtml, /KHP-OS/);
assert.match(sectionHtml, /role="status"/);

let state = true, effect, nextFrame = 0;
const frames = new Map();
const boot = load('src/components/navigation/AppBootScreen.tsx', name => {
  if (name === 'react/jsx-runtime') return jsx;
  if (name === './LoadingScreen') return screen;
  if (name === 'react') return { useState: () => [state, value => { state = value; }], useEffect: fn => { effect = fn; } };
  throw new Error(name);
}, {
  requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; },
  cancelAnimationFrame: id => frames.delete(id),
});
const cover = boot.AppBootScreen();
assert.equal(cover.props.style.position, 'fixed');
assert.equal(cover.props.style.inset, 0);
const cleanup = effect();
frames.get(1)();
assert.equal(state, true, 'Hydration must leave the cover in place through the first paint');
frames.get(2)();
assert.equal(state, false);
assert.equal(boot.AppBootScreen(), null, 'The boot screen must release the usable page');
cleanup();
assert(!frames.has(2), 'Pending animation frames are cleaned up on unmount');
const manifest = load('src/app/manifest.ts', () => ({})).default();
assert.equal(manifest.background_color, '#0f172a');
assert.equal(JSON.parse(fs.readFileSync('android-lite/twa-manifest.production.json')).backgroundColor, manifest.background_color);
assert.equal(JSON.parse(fs.readFileSync('public/khpos-lite-bootstrap.webmanifest')).background_color, manifest.background_color);
console.log('Loading passed: inline branded first paint, no image dependency, hydration handoff, frame cleanup and matching app backgrounds.');

// Prevent another page from introducing its own full-size spinner or loading screen.
const legacy = [];
function auditLoaders(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { auditLoaders(path); continue; }
    if (!path.endsWith('.tsx') || path.endsWith('/LoadingScreen.tsx')) continue;
    const source = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'Loader2' && /size-(?:[7-9]|\d{2,})\b/.test(node.getText(source))) legacy.push(path);
      if (ts.isJsxText(node) && /^(Loading|Preparing|Opening|Checking) .+(?:…|\.{3})$/.test(node.text.trim())) legacy.push(path);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
auditLoaders('src');
assert.deepEqual(legacy, [], 'Page and section loading states must use the shared branded design');
console.log('App-wide loading audit passed: no separate page spinners or legacy loading screens.');

// Short client navigations must never paint an extra full-screen loader.
const root = fs.readFileSync('src/app/layout.tsx', 'utf8');
assert(root.includes('<AppBootScreen />'), 'Other KAEC applications must retain their existing boot cover');
assert.match(fs.readFileSync('src/app/globals.css', 'utf8'),
  /body:has\(\.khpos-platform-ui\) \[data-app-boot\]/,
  'KHP-OS route pages must not inherit a second hydration-wide boot cover');
assert.match(fs.readFileSync('src/app/khpos/loading.tsx', 'utf8'), /<LoadingScreen inline \/>/, 'KHP-OS route fallbacks must be branded and nonblocking');
assert.match(fs.readFileSync('src/app/khpos/[organisationId]/loading.tsx', 'utf8'), /<LoadingScreen inline \/>/, 'School route fallbacks must not cover their navigation shell');
let destination = '', pathname = '/khpos', query = '';
const listeners = {};
let nextTimer = 0;
const timers = new Map();
class Element { closest() { return this; } }
class Anchor extends Element {
  constructor(href) { super(); this.href = href; this.target = ''; }
  hasAttribute() { return false; }
}
const location = { origin: 'https://example.invalid', pathname: '/khpos', search: '' };
const navigation = load('src/components/navigation/NavigationFeedback.tsx', name => {
  if (name === 'react/jsx-runtime') return jsx;
  if (name === 'next/navigation') return { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(query) };
  if (name === 'react') return { useState: () => [destination, value => { destination = value; }], useEffect: fn => fn() };
  throw new Error(name);
}, { URL, Element, HTMLAnchorElement: Anchor,
  setTimeout: (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; },
  clearTimeout: id => timers.delete(id),
  document: { addEventListener: (key, fn) => { listeners[key] = fn; }, removeEventListener() {} },
  window: { location, addEventListener: (key, fn) => { listeners[key] = fn; }, removeEventListener() {} },
});
const tick = ms => {
  for (const [id, timer] of Array.from(timers)) if (timer.ms === ms) { timers.delete(id); timer.fn(); }
};
assert.equal(navigation.NavigationFeedback(), null);
listeners.click({ button: 0, target: new Anchor('https://example.invalid/khpos/hq') });
assert.equal(navigation.NavigationFeedback(), null, 'Short links should keep the old page immediately visible');
tick(450);
const indicator = renderToStaticMarkup(navigation.NavigationFeedback());
assert.match(indicator, /Moving to another page/);
assert.match(indicator, /role="status"/);
assert(!indicator.includes('position:fixed;inset:0'), 'Client navigation is nonblocking');
pathname = location.pathname = '/khpos/hq';
assert.equal(navigation.NavigationFeedback(), null);
listeners.pageshow();
listeners.click({ button: 0, target: new Anchor('https://outside.invalid/') });
assert.equal(navigation.NavigationFeedback(), null);
listeners.click({ button: 0, target: new Anchor('https://example.invalid/khpos/hq?view=history') });
assert.equal(navigation.NavigationFeedback(), null);
tick(450);
assert.match(renderToStaticMarkup(navigation.NavigationFeedback()), /Moving to another page/);
query = 'view=history';
assert.equal(navigation.NavigationFeedback(), null);
listeners.pageshow();
console.log('Navigation loading passed: delayed nonblocking indicator, old page preserved, route/query completion and page restoration.');

// A failed sign-in must show its error instead of leaving a permanent loading cover.
for (const rejected of [false, true]) {
  let cursor = 0;
  const states = [], effects = [];
  const client = { auth: { exchangeCodeForSession: async () => {
    if (rejected) throw new Error('Connection failure');
    return { error: new Error('Invalid response') };
  } } };
  const callback = load('src/app/auth/callback/page.tsx', name => {
    if (name === 'react/jsx-runtime') return jsx;
    if (name.endsWith('/LoadingScreen')) return screen;
    if (name === 'next/navigation') return { useRouter: () => ({ replace() { assert.fail('Failed sign-in must not redirect'); } }) };
    if (name === '@/lib/supabase/client') return { createBrowserSupabaseClient: () => client };
    if (name === 'react') return { useMemo: fn => fn(), useEffect: fn => effects.push(fn), useState(initial) {
      const i = cursor++; if (!(i in states)) states[i] = initial;
      return [states[i], value => { states[i] = value; }];
    } };
    throw new Error(name);
  }, { URLSearchParams, window: { location: { search: '?code=fixture', hash: '' } } });
  const render = () => { cursor = 0; return callback.default(); };
  assert.equal(render().type, screen.LoadingScreen);
  effects[0]();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  const errorHtml = renderToStaticMarkup(render());
  assert.match(errorHtml, /could not complete sign-in/);
  assert(!errorHtml.includes('aria-busy="true"'));
}
console.log('Sign-in loading recovery passed: rejected responses and connection errors release the page loader.');

const feedback = load('src/components/khpos/ops/ActionFeedback.tsx', name => {
  if (name === 'react/jsx-runtime') return jsx;
  if (name === 'lucide-react') return { AlertCircle: 'span', CheckCircle2: 'span', LoaderCircle: 'span', X: 'span' };
  throw new Error(name);
});
const close = () => {};
assert.equal(feedback.ActionFeedback({busy:false,error:'',notice:'',onDismiss:close}),null,'Idle feedback does not cover the school screen');
const loadingFeedback = renderToStaticMarkup(React.createElement(feedback.ActionFeedback,{busy:true,error:'',notice:'',onDismiss:close}));
assert.match(loadingFeedback,/role="status"/);
assert.match(loadingFeedback,/Saving…/);
assert.doesNotMatch(loadingFeedback,/Dismiss notification/,'Busy actions cannot be dismissed prematurely');
const savedFeedback = renderToStaticMarkup(React.createElement(feedback.ActionFeedback,{busy:false,error:'',notice:'Changes saved',onDismiss:close}));
assert.match(savedFeedback,/Action completed/);
assert.match(savedFeedback,/Changes saved/);
assert.match(savedFeedback,/Dismiss notification/);
const failedFeedback = renderToStaticMarkup(React.createElement(feedback.ActionFeedback,{busy:false,error:'Connection unavailable',notice:'',onDismiss:close}));
assert.match(failedFeedback,/role="alert"/);
assert.match(failedFeedback,/Connection unavailable/);
assert.match(failedFeedback,/max-h-/,'Long feedback must stay scrollable instead of covering the mobile page');
console.log('Shared KHP-OS feedback passed: idle, busy, success, failure, dismiss and constrained mobile display.');

