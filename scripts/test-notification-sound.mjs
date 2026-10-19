import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const listeners = {},
  shown = [];
const worker = {
  addEventListener: (name, fn) => (listeners[name] = fn),
  skipWaiting: async () => {},
  clients: {
    claim: async () => {},
    matchAll: async () => [],
    openWindow: async () => {},
  },
  location: { origin: "https://www.kshc.name.ng" },
  registration: {
    showNotification: async (title, options) => shown.push({ title, options }),
  },
};
vm.runInNewContext(fs.readFileSync("public/khpos-sw.js", "utf8"), {
  self: worker,
  URL,
});
async function push(data) {
  let pending;
  listeners.push({ data, waitUntil: (p) => (pending = p) });
  await pending;
}
await push({
  json: () => ({
    title: "School action",
    body: "Open your work queue",
    tag: "khpos-school",
    url: "/khpos/school/work",
  }),
});
await push({
  json: () => ({
    title: "Another action",
    body: "A new action is due",
    tag: "khpos-school",
  }),
});
assert.equal(shown.length, 2);
for (const notice of shown) {
  assert.equal(
    notice.options.renotify,
    true,
    "replacement tags must request a new alert",
  );
  assert.equal(notice.options.silent, false);
  assert.deepEqual(Array.from(notice.options.vibrate), [200, 100, 200]);
  assert.ok(notice.options.tag);
  assert.equal(
    "sound" in notice.options,
    false,
    "no unsupported custom ringtone option",
  );
}
await push({
  json: () => {
    throw new Error("Bad payload");
  },
});
assert.equal(shown[2].title, "KHP-OS");
assert.equal(shown[2].options.tag, "khpos");
assert.ok(
  listeners.install && listeners.activate,
  "worker updates activate without a cache dependency",
);
const bell = fs.readFileSync(
  "src/components/khpos/NotificationBell.tsx",
  "utf8",
);
assert.ok(bell.includes("Test device alert"));
assert.ok(
  bell.includes(
    "This does not verify background delivery or whether sound played.",
  ),
);
console.log(
  "Notification sound: repeated-tag re-alert, non-silent/vibration request, safe fallback and honest on-device test guidance passed.",
);

// Verify the actual bell UI keeps setup out of daily reminders.
const ts = (await import("typescript")).default;
const jsx = await import("react/jsx-runtime");
const state = [], refs = []; let cursor = 0, refCursor = 0;
const component = {};
const react = {
  useState(initial) { const i=cursor++; if (!(i in state)) state[i]=typeof initial==="function"?initial():initial; return [state[i],v=>{state[i]=typeof v==="function"?v(state[i]):v;}]; },
  useRef(initial) { const i=refCursor++; return refs[i]??= {current:initial}; },
  useEffect() {}, useCallback: f=>f,
};
vm.runInNewContext(ts.transpileModule(bell,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports:component,Date,Set,Notification:{permission:"granted"},document:{body:{}},window:{Notification:{},matchMedia:()=>({matches:true})},
  fetch:async()=>({ok:true,json:async()=>({ok:true,alerts:[],total:0})}),
  require(name){
    if(name==="react")return react;
    if(name==="react/jsx-runtime")return jsx;
    if(name==="react-dom")return {createPortal:element=>element};
    if(name==="next/link")return {default:"a"};
    if(name==="lucide-react")return {Bell:"span",X:"span"};
    if(name==="@mmmike/web-push/client")return {isPushSupported:()=>true};
    if(name==="@/lib/supabase/client")return {createBrowserSupabaseClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:"test"}}})}})};
    if(name==="@/lib/khpos/ops/action-events")return {KHPOS_ACTIVITY_CHANGED:"changed"};
    throw new Error(name);
  },
});
const render=()=>{cursor=0;refCursor=0;return component.NotificationBell({organisationId:"school"});};
function nodes(node){return !node||typeof node!=="object"?[]:[node,...[node.props?.children].flat(Infinity).flatMap(nodes)];}
const button=(tree,label)=>nodes(tree).find(n=>n.type==="button"&&n.props.children===label);
let tree=render();nodes(tree).find(n=>n.props?.["aria-label"]==="Notifications, 0 active").props.onClick();
tree=render();assert(button(tree,"Notification settings"));assert(!button(tree,"Test device alert"));assert(!nodes(tree).some(n=>n.type==="details"));
button(tree,"Notification settings").props.onClick();tree=render();
assert(button(tree,"Test device alert"));assert(button(tree,"Enable device alerts"));
const help=nodes(tree).find(n=>n.type==="details");assert(help);assert(!help.props.open,"Sound help starts collapsed");
assert(nodes(tree).some(n=>n.type==="summary"&&n.props.children==="Notifications not making sound?"));
button(tree,"← Back to notifications").props.onClick();tree=render();assert(!button(tree,"Test device alert"));
console.log("Notification settings view passed: clean daily list, separate device controls/test, collapsed sound help and return navigation.");
