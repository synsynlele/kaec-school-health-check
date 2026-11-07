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
assert.match(html, /background:#0f172a/);
assert(!html.includes('<img'), 'The first loading paint must not depend on an image request');

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
