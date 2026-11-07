/** Inline essentials paint before the stylesheet and client bundles arrive. */
export function LoadingScreen({ message = "Opening your workspace…", inline = false }: { message?: string; inline?: boolean }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-loading-scope={inline ? "section" : "page"} style={{ position: inline ? "relative" : "fixed", inset: inline ? undefined : 0, zIndex: inline ? undefined : 9998, minHeight: inline ? 160 : "100svh", display: "grid", placeItems: "center", background: "#0f172a", color: "#fff", padding: inline ? "1rem" : "2rem", borderRadius: inline ? 16 : undefined, boxSizing: "border-box", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
      <div>
        <svg role="img" aria-label="KHP-OS app logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={inline ? 44 : 80} height={inline ? 44 : 80} style={{ display: "inline-block", verticalAlign: "middle" }}>
          <rect width="64" height="64" rx="16" fill="#0f4fd8" />
          <path d="M14 38 L24 38 L29 22 L37 44 L42 32 L50 32" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="50" cy="22" r="5" fill="#10b981" />
        </svg>
        <p style={{ margin: "1rem 0 .5rem", fontSize: inline ? 16 : 22, fontWeight: 800 }}>KHP-OS</p>
        <p style={{ margin: 0, color: "#cbd5e1", fontSize: 15 }}>{message}</p>
        <span aria-hidden="true" className="motion-safe:animate-spin" style={{ display: "inline-block", marginTop: 24, width: 24, height: 24, border: "3px solid #334155", borderTopColor: "#6ee7b7", borderRadius: "50%" }} />
      </div>
    </div>
  );
}
