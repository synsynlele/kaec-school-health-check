import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`KHP-OS Lite contract failed: ${context} is missing ${expected}`);
  }
}

const layout = read("src/app/layout.tsx");
const landing = read("src/components/landing/Hero.tsx");
const distribution = read("src/components/pwa/KhposDistributionButton.tsx");
const manifest = read("src/app/manifest.ts");
const twa = read("android-lite/twa-manifest.production.json");
const assetlinks = read("public/.well-known/assetlinks.json");
const readme = read("android-lite/README.md");

for (const required of [
  'manifest: "/manifest.webmanifest"',
  "beforeinstallprompt",
  'document.referrer.startsWith("android-app://")',
  'new Event("khpos:install-state")',
]) {
  requireText(layout, required, "root install capture");
}

requireText(landing, "KhposDistributionButton", "KSHC landing page");

for (const required of [
  'DistributionMode = "hidden" | "android" | "desktop"',
  "Android|iPhone|iPad|iPod|Mobile",
  "isDesktopChromium",
  "Download KHP-OS",
  "Install KHP-OS",
  "releases/latest/download/KHP-OS-Lite.apk",
  "await promptEvent.prompt()",
]) {
  requireText(distribution, required, "landing distribution behavior");
}

for (const required of [
  'start_url: "/khpos"',
  'scope: "/"',
  'display: "standalone"',
  'sizes: "192x192"',
  'sizes: "512x512"',
]) {
  requireText(manifest, required, "PWA manifest");
}

for (const required of [
  '"packageId": "ng.name.khpos.lite"',
  '"host": "www.kshc.name.ng"',
  '"startUrl": "/khpos"',
  '"appVersion": "1.0.0"',
  '"value": "4A:83:6C:70:C0:50:E8:BC:FA:45:CB:35:28:92:EC:6A:0E:21:C9:86:D7:7B:BD:8C:B9:4C:62:FA:52:9B:70:DC"',
]) {
  requireText(twa, required, "Android production identity");
}

requireText(
  assetlinks,
  '"package_name": "ng.name.khpos.lite"',
  "Digital Asset Links binding",
);
requireText(
  readme,
  "exact existing KSHC favicon artwork",
  "app icon identity contract",
);

for (const iconPath of ["public/khpos-icon-192.png", "public/khpos-icon-512.png"]) {
  if (!fs.existsSync(path.join(root, iconPath))) {
    throw new Error(`KHP-OS Lite contract failed: missing ${iconPath}`);
  }
}

console.log("KHP-OS Lite distribution contract validated.");
