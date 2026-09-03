import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE, appUrl } from "@/lib/site";
import "./globals.css";

const pwaInstallCaptureScript = `
(() => {
  if (window.__khposInstallCaptureReady) return;
  window.__khposInstallCaptureReady = true;

  const isAndroidAppShell = () =>
    document.referrer.startsWith("android-app://");

  const isStandalone = () => {
    const displayMode =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = window.navigator.standalone === true;
    return displayMode || iosStandalone || isAndroidAppShell();
  };

  const isMobile = () => {
    const ua = navigator.userAgent;
    const regularMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const iPadDesktopMode =
      /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
    return regularMobile || iPadDesktopMode;
  };

  const publishInstallState = () => {
    window.dispatchEvent(new Event("khpos:install-state"));
  };

  if (isStandalone()) {
    window.__khposAppInstalled = true;
    window.__khposDeferredInstallPrompt = null;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();

    // Mobile distribution is handled by KHP-OS Lite for Android. Never retain
    // a browser PWA prompt on mobile or inside an already-installed app shell.
    if (isStandalone() || isMobile()) {
      window.__khposDeferredInstallPrompt = null;
      publishInstallState();
      return;
    }

    // Capture before React hydration so an early desktop install event is not
    // lost before the landing-page client component mounts.
    window.__khposDeferredInstallPrompt = event;
    publishInstallState();
  });

  window.addEventListener("appinstalled", () => {
    window.__khposDeferredInstallPrompt = null;
    window.__khposAppInstalled = true;
    publishInstallState();
  });
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: "KHP-OS",
  manifest: "/manifest.webmanifest",
  keywords: [
    "school health check",
    "school improvement",
    "AI school report",
    "school diagnostic",
    "KAEC-NG",
    "human potential development",
    "institutional transformation",
    "KHP-OS",
    "school assessment",
  ],
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  appleWebApp: {
    capable: true,
    title: "KHP-OS",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0f4fd8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white font-sans text-slate-900 antialiased">
        <script dangerouslySetInnerHTML={{ __html: pwaInstallCaptureScript }} />
        {children}
      </body>
    </html>
  );
}
