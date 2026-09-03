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
const releaseWorkflow = read(".github/workflows/android-lite-release.yml");
const vercel = read("vercel.json");

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
  '333c2be691c73939d6a9b2917a6a5e81cf57b505/public/khpos-icon-512.png',
  '333c2be691c73939d6a9b2917a6a5e81cf57b505/public/khpos-lite-bootstrap.webmanifest',
  '"value": "43:D7:AC:C8:15:57:83:F9:35:4F:61:F8:8F:D6:4C:E1:FB:24:F1:9B:16:3E:BF:F9:1B:FC:CB:AD:0D:AF:40:4E"',
]) {
  requireText(twa, required, "Android production identity");
}

requireText(
  assetlinks,
  '"package_name": "ng.name.khpos.lite"',
  "Digital Asset Links binding",
);
requireText(
  assetlinks,
  '"43:D7:AC:C8:15:57:83:F9:35:4F:61:F8:8F:D6:4C:E1:FB:24:F1:9B:16:3E:BF:F9:1B:FC:CB:AD:0D:AF:40:4E"',
  "Digital Asset Links certificate",
);
requireText(
  readme,
  "exact existing KSHC favicon artwork",
  "app icon identity contract",
);
for (const required of [
  "stage-khpos-lite-distribution",
  "KHPOS_ANDROID_KEYSTORE_B64",
  "KHPOS_ANDROID_KEYSTORE_PASSWORD",
  "KHP-OS-Lite.apk",
  "43:D7:AC:C8:15:57:83:F9:35:4F:61:F8:8F:D6:4C:E1:FB:24:F1:9B:16:3E:BF:F9:1B:FC:CB:AD:0D:AF:40:4E",
]) {
  requireText(releaseWorkflow, required, "pre-merge Android release gate");
}
for (const required of ['"*": false', '"main": true', '"*-preview": true']) {
  requireText(vercel, required, "Vercel quota gate");
}

for (const iconPath of ["public/khpos-icon-192.png", "public/khpos-icon-512.png"]) {
  if (!fs.existsSync(path.join(root, iconPath))) {
    throw new Error(`KHP-OS Lite contract failed: missing ${iconPath}`);
  }
}

console.log("KHP-OS Lite distribution contract validated.");
