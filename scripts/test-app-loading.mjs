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

// KHP-OS uses only the preferred branded full-screen loader.
// Root boot remains for the other KAEC applications, but is suppressed on KHP-OS.
const root = fs.readFileSync('src/app/layout.tsx', 'utf8');
assert(root.includes('<AppBootScreen />'), 'Other KAEC apps must keep their existing startup cover');
assert(!root.includes('<NavigationFeedback />'), 'Do not layer a second navigation loader over the app');
assert(fs.readFileSync('src/app/globals.css', 'utf8')
  .includes('body:has(.khpos-platform-ui) [data-app-boot]'),
  'KHP-OS must not display the root boot cover as a second loader');
assert(fs.readFileSync('src/app/khpos/loading.tsx', 'utf8').includes('<LoadingScreen />'),
  'KHP-OS route fallback must be the full-screen branded loader');
assert(!fs.existsSync('src/app/khpos/[organisationId]/loading.tsx'),
  'The nested school segment must inherit the one shared route fallback');
for (const path of [
  'src/components/khpos/CommandCentre.tsx',
  'src/components/khpos/ops/MyWorkWorkspace.tsx',
  'src/components/khpos/ops/MeetingsWorkspace.tsx',
  'src/components/khpos/AnnouncementsWorkspace.tsx',
]) {
  const content = fs.readFileSync(path, 'utf8');
  assert(content.includes('<LoadingScreen />'), path + ': keep the original full-screen branded loader');
  assert(!content.includes('<LoadingScreen inline'), path + ': no reduced-size page loader');
}
for (const directory of ['src/components/khpos', 'src/app/khpos']) {
  const audit = dir => {
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      const path = dir + '/' + entry.name;
      if (entry.isDirectory()) { audit(path); continue; }
      if (!path.endsWith('.tsx')) continue;
      assert(!fs.readFileSync(path,'utf8').includes('<LoadingScreen inline'),
        path + ': do not reintroduce miniature KHP-OS loaders');
    }
  };
  audit(directory);
}
const noticeSource = fs.readFileSync('src/components/khpos/AnnouncementsWorkspace.tsx','utf8');
assert(noticeSource.includes('Fetching staff notices.'),
  'The compact announcement widget must not trigger an additional page-wide loader');
console.log('KHP-OS full-screen loading: one shared route fallback, no nested route loader, no mini or extra global navigation overlays.');

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

